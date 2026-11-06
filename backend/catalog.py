import json
import math
import sqlite3

from .db import get_db
from .utils import ApiError, parse_int, serialize_question
from .validators import validate_question_options, validate_subject_name


def subject_rows():
    return (
        get_db()
        .execute(
            """
            SELECT
                s.id, s.name, s.description, s.sort_order,
                s.created_at, s.updated_at,
                COUNT(q.id) AS question_count,
                COALESCE(SUM(CASE WHEN q.qtype = 'single' THEN 1 ELSE 0 END), 0) AS single_count,
                COALESCE(SUM(CASE WHEN q.qtype = 'multiple' THEN 1 ELSE 0 END), 0) AS multiple_count,
                COALESCE(SUM(CASE WHEN q.qtype = 'judge' THEN 1 ELSE 0 END), 0) AS judge_count
            FROM subjects s
            LEFT JOIN questions q ON q.subject_id = s.id AND q.is_deleted = 0
            WHERE s.is_deleted = 0
            GROUP BY s.id
            ORDER BY s.sort_order ASC, s.id ASC
            """
        )
        .fetchall()
    )


def serialize_subject(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "sort_order": row["sort_order"],
        "question_count": row["question_count"],
        "type_counts": {
            "single": row["single_count"],
            "multiple": row["multiple_count"],
            "judge": row["judge_count"],
        },
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def get_active_subject(subject_id):
    row = get_db().execute(
        "SELECT * FROM subjects WHERE id = ? AND is_deleted = 0", (subject_id,)
    ).fetchone()
    if not row:
        raise ApiError("科目不存在", 404)
    return row


def _subject_with_counts_or_404(subject_id):
    row = next(
        (item for item in subject_rows() if item["id"] == subject_id), None
    )
    if not row:
        raise ApiError("科目不存在", 404)
    return serialize_subject(row)


def list_subjects():
    return [serialize_subject(row) for row in subject_rows()]


def create_subject(data):
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
        cursor = db.execute(
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

    return _subject_with_counts_or_404(cursor.lastrowid)


def update_subject(subject_id, data):
    db = get_db()
    subject = get_active_subject(subject_id)

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

    return _subject_with_counts_or_404(subject_id)


def delete_subject(subject_id):
    get_active_subject(subject_id)
    db = get_db()
    db.execute(
        "UPDATE subjects SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (subject_id,),
    )
    db.execute("UPDATE questions SET is_deleted = 1 WHERE subject_id = ?", (subject_id,))
    db.commit()
    return {"id": subject_id, "message": "科目已删除"}


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


def get_question_or_404(question_id):
    question = _question_query(question_id)
    if not question:
        raise ApiError("题目不存在", 404)
    return question


def active_subject_or_404(subject_id):
    subject = get_db().execute(
        "SELECT * FROM subjects WHERE id = ? AND is_deleted = 0", (subject_id,)
    ).fetchone()
    if not subject:
        raise ApiError("科目不存在", 404)
    return subject


def validate_question_fields(data, current=None):
    subject_id = parse_int(
        data.get("subject_id", current["subject_id"] if current else None),
        "科目",
        minimum=1,
    )
    active_subject_or_404(subject_id)

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


def list_questions(
    subject_id=None, qtype=None, search=None, page=1, page_size=20
):
    page = parse_int(page, "页码", minimum=1, default=1)
    page_size = parse_int(
        page_size, "每页数量", minimum=1, maximum=100, default=20
    )

    db = get_db()
    filters = ["q.is_deleted = 0", "s.is_deleted = 0"]
    params = []

    if subject_id not in (None, ""):
        filters.append("q.subject_id = ?")
        params.append(parse_int(subject_id, "科目", minimum=1))

    if qtype:
        if qtype not in {"single", "multiple", "judge"}:
            raise ApiError("题型无效", 422)
        filters.append("q.qtype = ?")
        params.append(qtype)

    search = str(search or "").strip()
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

    pages = max(1, math.ceil(total / page_size)) if total else 0
    return {
        "items": [serialize_question(row, include_answer=True) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
    }


def create_question(data):
    subject_id, qtype, content, options, answer, explanation = (
        validate_question_fields(data)
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
    question = get_question_or_404(cursor.lastrowid)
    return serialize_question(question, include_answer=True)


def update_question(question_id, data):
    current = get_question_or_404(question_id)
    subject_id, qtype, content, options, answer, explanation = (
        validate_question_fields(data, current)
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
    question = get_question_or_404(question_id)
    return serialize_question(question, include_answer=True)


def delete_question(question_id):
    get_question_or_404(question_id)
    db = get_db()
    db.execute(
        "UPDATE questions SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (question_id,),
    )
    db.commit()
    return {"id": question_id, "message": "题目已删除"}
