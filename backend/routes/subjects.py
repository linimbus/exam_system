from flask import Blueprint, jsonify

from ..auth import login_required
from ..db import get_db
from ..utils import ApiError


bp = Blueprint("subjects", __name__)


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


@bp.get("/subjects")
@login_required
def list_subjects():
    return jsonify({"items": [serialize_subject(row) for row in subject_rows()]})


def get_active_subject(subject_id):
    row = get_db().execute(
        "SELECT * FROM subjects WHERE id = ? AND is_deleted = 0", (subject_id,)
    ).fetchone()
    if not row:
        raise ApiError("科目不存在", 404)
    return row
