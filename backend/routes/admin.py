import sqlite3

from flask import Blueprint, g, jsonify, request
from werkzeug.security import generate_password_hash

from .. import catalog
from ..auth import admin_required
from ..db import get_db
from ..utils import (
    ApiError,
    json_body,
    pagination_args,
    serialize_site_settings,
    serialize_user,
)
from ..validators import (
    validate_password,
    validate_site_description,
    validate_site_name,
    validate_username,
)


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


def _site_settings_row():
    return get_db().execute(
        "SELECT * FROM site_settings WHERE id = 1"
    ).fetchone()


# ------------------------------------------------------------ site settings


@bp.get("/settings")
@admin_required
def get_site_settings():
    return jsonify({"settings": serialize_site_settings(_site_settings_row())})


@bp.patch("/settings")
@admin_required
def update_site_settings():
    data = json_body()
    current = _site_settings_row()

    site_name = (
        validate_site_name(data.get("site_name"))
        if "site_name" in data
        else current["site_name"]
    )
    site_description = (
        validate_site_description(data.get("site_description"))
        if "site_description" in data
        else current["site_description"]
    )

    db = get_db()
    db.execute(
        """
        UPDATE site_settings
        SET site_name = ?, site_description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        """,
        (site_name, site_description),
    )
    db.commit()
    return jsonify({"settings": serialize_site_settings(_site_settings_row())})


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
    return jsonify({"subject": catalog.create_subject(json_body())}), 201


@bp.patch("/subjects/<int:subject_id>")
@admin_required
def update_subject(subject_id):
    return jsonify({"subject": catalog.update_subject(subject_id, json_body())})


@bp.delete("/subjects/<int:subject_id>")
@admin_required
def delete_subject(subject_id):
    return jsonify(catalog.delete_subject(subject_id))


# ------------------------------------------------------------ questions


@bp.get("/questions")
@admin_required
def list_questions():
    page, page_size = pagination_args(default_size=20)
    return jsonify(
        catalog.list_questions(
            subject_id=request.args.get("subject_id"),
            qtype=request.args.get("type"),
            search=request.args.get("search"),
            page=page,
            page_size=page_size,
        )
    )


@bp.post("/questions")
@admin_required
def create_question():
    return jsonify({"question": catalog.create_question(json_body())}), 201


@bp.patch("/questions/<int:question_id>")
@admin_required
def update_question(question_id):
    return jsonify(
        {"question": catalog.update_question(question_id, json_body())}
    )


@bp.delete("/questions/<int:question_id>")
@admin_required
def delete_question(question_id):
    return jsonify(catalog.delete_question(question_id))
