import json
import sqlite3

from flask import Blueprint, g, jsonify, request
from werkzeug.security import generate_password_hash

from ..auth import admin_required
from ..db import get_db
from ..utils import (
    ApiError,
    json_body,
    paginated_response,
    pagination_args,
    parse_int,
    serialize_question,
    serialize_user,
)
from ..validators import (
    validate_password,
    validate_question_options,
    validate_subject_name,
    validate_username,
)
from .subjects import serialize_subject, subject_rows


bp = Blueprint("admin", __name__)


def _bool_value(value, field_name):
    if isinstance(value, bool):
        return value
    raise ApiError(f"{field_name}必须是布尔值", 422)


def _active_admin_count(exclude_id=None):
    db = get_db()
    if exclude_id is None:
        row = db.execute(
            "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1"
        ).fetchone()
    else:
        row = db.execute(
            """
            SELECT COUNT(*) AS count FROM users
            WHERE role = 'admin' AND is_active = 1 AND id != ?
            """,
            (exclude_id,),
        ).fetchone()
    return row["count"]


def _get_user_or_404(user_id):
    user = get_db().execute(
        "SELECT * FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    if not user:
        raise ApiError("用户不存在", 404)
    return user


# ---------------------------------------------------------------- users


@bp.get("/users")
@admin_required
def list_users():
    search = str(request.args.get("search") or "").strip()
    db = get_db()
    where = ""
    params = []
    if search:
        where = "WHERE u.username LIKE ?"
        params.append(f"%{search}%")

    rows = db.execute(
        f"""
        SELECT u.*,
            (SELECT COUNT(*) FROM attempts a WHERE a.user_id = u.id) AS attempt_count
        FROM users u
        {where}
        ORDER BY CASE u.role WHEN 'admin' THEN 0 ELSE 1 END, u.created_at DESC
        """,
        params,
    ).fetchall()

    items = []
    for row in rows:
        item = serialize_user(row)
        item["attempt_count"] = row["attempt_count"]
        items.append(item)
    return jsonify({"items": items})


@bp.post("/users")
@admin_required
def create_user():
    data = json_body()
    username = validate_username(data.get("username"))
    password = validate_password(data.get("password"))
    role = str(data.get("role") or "user")
    if role not in {"user", "admin"}:
        raise ApiError("用户角色无效", 422)
    is_active = data.get("is_active", True)
    if not isinstance(is_active, bool):
        raise ApiError("is_active 必须是布尔值", 422)

    db = get_db()
    if db.execute(
        "SELECT id FROM users WHERE username = ? COLLATE NOCASE", (username,)
    ).fetchone():
        raise ApiError("该用户名已存在", 409)

    try:
        cursor = db.execute(
            """
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES (?, ?, ?, ?)
            """,
            (username, generate_password_hash(password), role, int(is_active)),
        )
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback()
        raise ApiError("该用户名已存在", 409) from None

    user = _get_user_or_404(cursor.lastrowid)
    return jsonify({"user": serialize_user(user)}), 201


@bp.patch("/users/<int:user_id>")
@admin_required
def update_user(user_id):
    data = json_body()
    db = get_db()
    target = _get_user_or_404(user_id)

    new_role = data.get("role", target["role"])
    if new_role not in {"user", "admin"}:
        raise ApiError("用户角色无效", 422)

    new_active = data.get("is_active", bool(target["is_active"]))
    if not isinstance(new_active, bool):
        raise ApiError("is_active 必须是布尔值", 422)

    new_password = None
    if "password" in data:
        new_password = validate_password(data.get("password"))

    if user_id == g.user["id"]:
        if new_role != "admin":
            raise ApiError("不能取消自己的管理员权限", 400)
        if not new_active:
            raise ApiError("不能停用自己的账号", 400)

    removing_admin = (
        target["role"] == "admin"
        and bool(target["is_active"])
        and (new_role != "admin" or not new_active)
    )
    if removing_admin and _active_admin_count(exclude_id=user_id) == 0:
        raise ApiError("系统至少需要保留一名启用状态的管理员", 400)

    updates = ["role = ?", "is_active = ?"]
    params = [new_role, int(new_active)]
    if new_password is not None:
        updates.append("password_hash = ?")
        params.append(generate_password_hash(new_password))
    params.append(user_id)

    db.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
    db.commit()
    return jsonify({"user": serialize_user(_get_user_or_404(user_id))})


@bp.delete("/users/<int:user_id>")
@admin_required
def delete_user(user_id):
    target = _get_user_or_404(user_id)
    if user_id == g.user["id"]:
        raise ApiError("不能删除自己的账号", 400)
    if (
        target["role"] == "admin"
        and target["is_active"]
        and _active_admin_count(exclude_id=user_id) == 0
    ):
        raise ApiError("系统至少需要保留一名启用状态的管理员", 400)

    get_db().execute("DELETE FROM users WHERE id = ?", (user_id,))
    get_db().commit()
    return jsonify({"message": "用户已删除"})


# ------------------------------------------------------------- subjects


@bp.post("/subjects")
@admin_required
def create_subject():
    data = json_body()
    name = validate_subject_name(data.get("name"))
    description = str(data.get("description") or "").strip()
    if len(description) > 500:
        raise ApiError("科目描述不能超过 500 个字符", 422)
    sort_order = parse_int(
        data.get("sort_order"), "排序值", minimum=0, maximum=9999, default=0
    )

    db = get_db()
    if db.execute(
        "SELECT id FROM subjects WHERE name = ? COLLATE NOCASE AND is_deleted = 0",
        (name,),
    ).fetchone():
        raise ApiError("该科目名称已存在", 409)

    try:
        db.execute(
            """
            INSERT INTO subjects (name, description, sort_order)
            VALUES (?, ?, ?)
            """,
            (name, description, sort_order),
        )
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback()
        raise ApiError("该科目名称已存在", 409) from None

    row = [
        item
        for item in subject_rows()
        if item["name"].casefold() == name.casefold()
    ][0]
    return jsonify({"subject": serialize_subject(row)}), 201


@bp.patch("/subjects/<int:subject_id>")
@admin_required
def update_subject(subject_id):
    data = json_body()
    db = get_db()
    subject = db.execute(
        "SELECT * FROM subjects WHERE id = ? AND is_deleted = 0", (subject_id,)
    ).fetchone()
    if not subject:
        raise ApiError("科目不存在", 404)

    name = (
        validate_subject_name(data.get("name"))
        if "name" in data
        else subject["name"]
    )
    description = (
        str(data.get("description") or "").strip()
        if "description" in data
        else subject["description"]
    )
    if len(description) > 500:
        raise ApiError("科目描述不能超过 500 个字符", 422)
    sort_order = (
        parse_int(
            data.get("sort_order"), "排序值", minimum=0, maximum=9999, default=0
        )
        if "sort_order" in data
        else subject["sort_order"]
    )

    duplicate = db.execute(
        """
        SELECT id FROM subjects
        WHERE name = ? COLLATE NOCASE AND is_deleted = 0 AND id != ?
        """,
        (name, subject_id),
    ).fetchone()
    if duplicate:
        raise ApiError("该科目名称已存在", 409)

    try:
        db.execute(
            """
            UPDATE subjects
            SET name = ?, description = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (name, description, sort_order, subject_id),
        )
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback()
        raise ApiError("该科目名称已存在", 409) from None

    row = [item for item in subject_rows() if item["id"] == subject_id][0]
    return jsonify({"subject": serialize_subject(row)})


@bp.delete("/subjects/<int:subject_id>")
@admin_required
def delete_subject(subject_id):
    db = get_db()
    subject = db.execute(
        "SELECT * FROM subjects WHERE id = ? AND is_deleted = 0", (subject_id,)
    ).fetchone()
    if not subject:
        raise ApiError("科目不存在", 404)

    db.execute(
        "UPDATE subjects SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (subject_id,),
    )
    db.execute("UPDATE questions SET is_deleted = 1 WHERE subject_id = ?", (subject_id,))
    db.commit()
    return jsonify({"message": "科目已删除"})


# ------------------------------------------------------------ questions


def _question_query(question_id):
    return get_db().execute(
        """
        SELECT q.*, s.name AS subject_name
        FROM questions q
        JOIN subjects s ON s.id = q.subject_id
        WHERE q.id = ? AND q.is_deleted = 0 AND s.is_deleted = 0
        """,
        (question_id,),
    ).fetchone()


def _get_question_or_404(question_id):
    question = _question_query(question_id)
    if not question:
        raise ApiError("题目不存在", 404)
    return question


def _active_subject_or_404(subject_id):
    subject = get_db().execute(
        "SELECT * FROM subjects WHERE id = ? AND is_deleted = 0", (subject_id,)
    ).fetchone()
    if not subject:
        raise ApiError("科目不存在", 404)
    return subject


def _validate_question_fields(data, current=None):
    subject_id = parse_int(
        data.get("subject_id", current["subject_id"] if current else None),
        "科目",
        minimum=1,
    )
    _active_subject_or_404(subject_id)

    qtype = str(data.get("qtype", current["qtype"] if current else "")).strip()
    if qtype not in {"single", "multiple", "judge"}:
        raise ApiError("题型无效", 422)

    content = str(data.get("content", current["content"] if current else "")).strip()
    if not content or len(content) > 2000:
        raise ApiError("题目内容需为 1-2000 个字符", 422)

    if "explanation" in data:
        explanation = str(data.get("explanation") or "").strip()
    else:
        explanation = current["explanation"] if current else ""
    if len(explanation) > 2000:
        raise ApiError("答案解析不能超过 2000 个字符", 422)

    if "options" in data or current is None:
        raw_options = data.get("options")
    else:
        raw_options = json.loads(current["options"])

    if "answer" in data or current is None:
        raw_answer = data.get("answer")
    else:
        raw_answer = json.loads(current["answer"])

    options_json, answer_json = validate_question_options(
        qtype, raw_options, raw_answer
    )
    return subject_id, qtype, content, options_json, answer_json, explanation


@bp.get("/questions")
@admin_required
def list_questions():
    page, page_size = pagination_args(default_size=20)
    db = get_db()
    filters = ["q.is_deleted = 0", "s.is_deleted = 0"]
    params = []

    subject_id = request.args.get("subject_id")
    if subject_id:
        filters.append("q.subject_id = ?")
        params.append(parse_int(subject_id, "科目", minimum=1))

    qtype = request.args.get("type")
    if qtype:
        if qtype not in {"single", "multiple", "judge"}:
            raise ApiError("题型无效", 422)
        filters.append("q.qtype = ?")
        params.append(qtype)

    search = str(request.args.get("search") or "").strip()
    if search:
        filters.append("q.content LIKE ?")
        params.append(f"%{search}%")

    where = " AND ".join(filters)
    total = db.execute(
        f"""
        SELECT COUNT(*) AS count FROM questions q
        JOIN subjects s ON s.id = q.subject_id
        WHERE {where}
        """,
        params,
    ).fetchone()["count"]

    rows = db.execute(
        f"""
        SELECT q.*, s.name AS subject_name
        FROM questions q
        JOIN subjects s ON s.id = q.subject_id
        WHERE {where}
        ORDER BY q.updated_at DESC, q.id DESC
        LIMIT ? OFFSET ?
        """,
        [*params, page_size, (page - 1) * page_size],
    ).fetchall()

    items = [serialize_question(row, include_answer=True) for row in rows]
    return paginated_response(items, total, page, page_size)


@bp.post("/questions")
@admin_required
def create_question():
    data = json_body()
    subject_id, qtype, content, options, answer, explanation = _validate_question_fields(
        data
    )

    db = get_db()
    cursor = db.execute(
        """
        INSERT INTO questions
            (subject_id, qtype, content, options, answer, explanation)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (subject_id, qtype, content, options, answer, explanation),
    )
    db.commit()
    question = _get_question_or_404(cursor.lastrowid)
    return jsonify({"question": serialize_question(question, include_answer=True)}), 201


@bp.patch("/questions/<int:question_id>")
@admin_required
def update_question(question_id):
    data = json_body()
    current = _get_question_or_404(question_id)
    subject_id, qtype, content, options, answer, explanation = _validate_question_fields(
        data, current
    )

    db = get_db()
    db.execute(
        """
        UPDATE questions
        SET subject_id = ?, qtype = ?, content = ?, options = ?, answer = ?,
            explanation = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (subject_id, qtype, content, options, answer, explanation, question_id),
    )
    db.commit()
    question = _get_question_or_404(question_id)
    return jsonify({"question": serialize_question(question, include_answer=True)})


@bp.delete("/questions/<int:question_id>")
@admin_required
def delete_question(question_id):
    _get_question_or_404(question_id)
    db = get_db()
    db.execute(
        "UPDATE questions SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (question_id,),
    )
    db.commit()
    return jsonify({"message": "题目已删除"})
