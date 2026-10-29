import json

from flask import Blueprint, g, jsonify, request

from ..auth import login_required
from ..db import get_db
from ..utils import (
    ApiError,
    paginated_response,
    pagination_args,
    parse_int,
    serialize_question,
)
from .exams import _serialize_attempt


bp = Blueprint("stats", __name__)


@bp.get("/stats/summary")
@login_required
def summary():
    user_id = g.user["id"]
    db = get_db()

    exam_stats = db.execute(
        """
        SELECT
            COUNT(*) AS total_exams,
            COALESCE(ROUND(AVG(score), 1), 0) AS average_score,
            COALESCE(MAX(score), 0) AS best_score
        FROM attempts
        WHERE user_id = ? AND status = 'submitted'
        """,
        (user_id,),
    ).fetchone()

    answer_stats = db.execute(
        """
        SELECT
            COUNT(aq.id) AS total_answered,
            COALESCE(SUM(CASE WHEN aq.is_correct = 1 THEN 1 ELSE 0 END), 0) AS total_correct,
            COALESCE(SUM(CASE WHEN aq.is_correct = 0 THEN 1 ELSE 0 END), 0) AS total_wrong,
            COUNT(DISTINCT CASE WHEN aq.is_correct = 0 THEN aq.question_id END) AS wrong_question_count
        FROM attempt_questions aq
        JOIN attempts a ON a.id = aq.attempt_id
        WHERE a.user_id = ? AND a.status = 'submitted'
        """,
        (user_id,),
    ).fetchone()

    total_answered = answer_stats["total_answered"]
    total_wrong = answer_stats["total_wrong"]
    accuracy = round((total_answered - total_wrong) / total_answered * 100, 1) if total_answered else 0
    wrong_rate = round(total_wrong / total_answered * 100, 1) if total_answered else 0

    subject_rows = db.execute(
        """
        SELECT
            s.id, s.name, s.description,
            (SELECT COUNT(*) FROM questions q
             WHERE q.subject_id = s.id AND q.is_deleted = 0) AS question_count,
            COUNT(DISTINCT a.id) AS attempts,
            COUNT(aq.id) AS answered,
            COALESCE(SUM(CASE WHEN aq.is_correct = 0 THEN 1 ELSE 0 END), 0) AS wrong_count,
            COUNT(DISTINCT CASE WHEN aq.is_correct = 0 THEN aq.question_id END) AS wrong_question_count
        FROM subjects s
        LEFT JOIN attempts a
            ON a.subject_id = s.id AND a.user_id = ? AND a.status = 'submitted'
        LEFT JOIN attempt_questions aq ON aq.attempt_id = a.id
        WHERE s.is_deleted = 0
        GROUP BY s.id
        ORDER BY s.sort_order ASC, s.id ASC
        """,
        (user_id,),
    ).fetchall()

    subjects = []
    for row in subject_rows:
        answered = row["answered"]
        subjects.append(
            {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "question_count": row["question_count"],
                "attempts": row["attempts"],
                "answered": answered,
                "wrong_count": row["wrong_count"],
                "wrong_question_count": row["wrong_question_count"],
                "wrong_rate": round(row["wrong_count"] / answered * 100, 1)
                if answered
                else 0,
            }
        )

    recent_rows = db.execute(
        """
        SELECT a.*, s.name AS subject_name,
            (SELECT COUNT(*) FROM attempt_questions aq
             WHERE aq.attempt_id = a.id AND aq.selected IS NOT NULL AND aq.selected != '[]') AS answered_count
        FROM attempts a
        JOIN subjects s ON s.id = a.subject_id
        WHERE a.user_id = ?
        ORDER BY a.id DESC
        LIMIT 5
        """,
        (user_id,),
    ).fetchall()

    return jsonify(
        {
            "stats": {
                "total_exams": exam_stats["total_exams"],
                "average_score": exam_stats["average_score"],
                "best_score": exam_stats["best_score"],
                "total_answered": total_answered,
                "total_correct": answer_stats["total_correct"],
                "total_wrong": total_wrong,
                "accuracy": accuracy,
                "wrong_rate": wrong_rate,
                "wrong_question_count": answer_stats["wrong_question_count"],
            },
            "subjects": subjects,
            "recent_attempts": [_serialize_attempt(row) for row in recent_rows],
        }
    )


@bp.get("/wrong-questions")
@login_required
def wrong_questions():
    page, page_size = pagination_args(default_size=10)
    user_id = g.user["id"]
    db = get_db()

    outer_filters = ["q.is_deleted = 0", "s.is_deleted = 0"]
    outer_params = []

    subject_id = request.args.get("subject_id")
    if subject_id:
        outer_filters.append("q.subject_id = ?")
        outer_params.append(parse_int(subject_id, "科目", minimum=1))

    qtype = request.args.get("type")
    if qtype:
        if qtype not in {"single", "multiple", "judge"}:
            raise ApiError("题型无效", 422)
        outer_filters.append("q.qtype = ?")
        outer_params.append(qtype)

    search = str(request.args.get("search") or "").strip()
    if search:
        outer_filters.append("q.content LIKE ?")
        outer_params.append(f"%{search}%")

    where = " AND ".join(outer_filters)
    cte = """
        WITH wrong AS (
            SELECT aq.question_id,
                   COUNT(*) AS wrong_count,
                   MAX(a.submitted_at) AS last_wrong_at
            FROM attempt_questions aq
            JOIN attempts a ON a.id = aq.attempt_id
            WHERE a.user_id = ? AND a.status = 'submitted' AND aq.is_correct = 0
            GROUP BY aq.question_id
        )
    """

    total = db.execute(
        f"""
        {cte}
        SELECT COUNT(*) AS count
        FROM wrong w
        JOIN questions q ON q.id = w.question_id
        JOIN subjects s ON s.id = q.subject_id
        WHERE {where}
        """,
        [user_id, *outer_params],
    ).fetchone()["count"]

    rows = db.execute(
        f"""
        {cte}
        SELECT q.*, s.name AS subject_name,
               w.wrong_count, w.last_wrong_at,
               (
                   SELECT aq2.selected
                   FROM attempt_questions aq2
                   JOIN attempts a2 ON a2.id = aq2.attempt_id
                   WHERE aq2.question_id = q.id AND a2.user_id = ?
                     AND a2.status = 'submitted' AND aq2.is_correct = 0
                   ORDER BY a2.submitted_at DESC, aq2.id DESC
                   LIMIT 1
               ) AS last_selected,
               (
                   SELECT COUNT(*)
                   FROM attempt_questions aq3
                   JOIN attempts a3 ON a3.id = aq3.attempt_id
                   WHERE aq3.question_id = q.id AND a3.user_id = ?
                     AND a3.status = 'submitted'
               ) AS attempted_count
        FROM wrong w
        JOIN questions q ON q.id = w.question_id
        JOIN subjects s ON s.id = q.subject_id
        WHERE {where}
        ORDER BY w.last_wrong_at DESC, q.id DESC
        LIMIT ? OFFSET ?
        """,
        [user_id, user_id, user_id, *outer_params, page_size, (page - 1) * page_size],
    ).fetchall()

    items = []
    for row in rows:
        item = serialize_question(row, include_answer=True)
        try:
            last_selected = (
                json.loads(row["last_selected"]) if row["last_selected"] else []
            )
        except (TypeError, ValueError):
            last_selected = []
        attempted_count = row["attempted_count"]
        item.update(
            {
                "wrong_count": row["wrong_count"],
                "attempted_count": attempted_count,
                "wrong_rate": round(row["wrong_count"] / attempted_count * 100, 1)
                if attempted_count
                else 0,
                "last_wrong_at": row["last_wrong_at"],
                "last_selected": last_selected,
            }
        )
        items.append(item)

    return paginated_response(items, total, page, page_size)
