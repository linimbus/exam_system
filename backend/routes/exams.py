import json

from flask import Blueprint, g, jsonify, request

from ..auth import login_required
from ..db import get_db
from ..utils import (
    ApiError,
    json_body,
    paginated_response,
    pagination_args,
    parse_int,
    serialize_question,
)
from .subjects import get_active_subject


bp = Blueprint("exams", __name__)


def _attempt_row(attempt_id, user_id):
    row = (
        get_db()
        .execute(
            """
            SELECT a.*, s.name AS subject_name,
                (SELECT COUNT(*) FROM attempt_questions aq
                 WHERE aq.attempt_id = a.id AND aq.selected IS NOT NULL AND aq.selected != '[]') AS answered_count
            FROM attempts a
            JOIN subjects s ON s.id = a.subject_id
            WHERE a.id = ? AND a.user_id = ?
            """,
            (attempt_id, user_id),
        )
        .fetchone()
    )
    if not row:
        raise ApiError("考试记录不存在", 404)
    return row


def _serialize_attempt(row):
    return {
        "id": row["id"],
        "subject_id": row["subject_id"],
        "subject_name": row["subject_name"],
        "status": row["status"],
        "total_questions": row["total_questions"],
        "correct_count": row["correct_count"],
        "score": row["score"],
        "answered_count": row["answered_count"],
        "started_at": row["started_at"],
        "submitted_at": row["submitted_at"],
    }


def _question_rows(attempt_id):
    return (
        get_db()
        .execute(
            """
            SELECT q.*, s.name AS subject_name,
                   aq.position, aq.selected, aq.is_correct
            FROM attempt_questions aq
            JOIN questions q ON q.id = aq.question_id
            JOIN subjects s ON s.id = q.subject_id
            WHERE aq.attempt_id = ?
            ORDER BY aq.position ASC
            """,
            (attempt_id,),
        )
        .fetchall()
    )


def _normalize_selected(raw_selected):
    if raw_selected is None:
        return []
    if isinstance(raw_selected, str):
        raw_selected = [raw_selected]
    if not isinstance(raw_selected, list):
        raise ApiError("答案格式无效", 422)
    selected = []
    for value in raw_selected:
        key = str(value).strip().upper()
        if key and key not in selected:
            selected.append(key)
    return selected


def _serialize_attempt_question(row, show_answers):
    item = serialize_question(row, include_answer=show_answers)
    try:
        selected = json.loads(row["selected"]) if row["selected"] else []
    except (TypeError, ValueError):
        selected = []
    item["position"] = row["position"]
    item["selected"] = selected
    if show_answers:
        item["is_correct"] = bool(row["is_correct"]) if row["is_correct"] is not None else False
    return item


def _attempt_detail(attempt_id, user_id):
    attempt = _attempt_row(attempt_id, user_id)
    show_answers = attempt["status"] == "submitted"
    questions = [
        _serialize_attempt_question(row, show_answers)
        for row in _question_rows(attempt_id)
    ]
    return jsonify(
        {
            "attempt": _serialize_attempt(attempt),
            "questions": questions,
        }
    )


@bp.post("/exams/start")
@login_required
def start_exam():
    data = json_body()
    subject_id = parse_int(data.get("subject_id"), "科目", minimum=1)
    subject = get_active_subject(subject_id)

    db = get_db()
    total_available = db.execute(
        "SELECT COUNT(*) AS count FROM questions WHERE subject_id = ? AND is_deleted = 0",
        (subject_id,),
    ).fetchone()["count"]
    if total_available == 0:
        raise ApiError("该科目暂无可用题目", 400)

    requested = data.get("question_count")
    if requested is None:
        question_count = min(10, total_available)
    else:
        question_count = parse_int(
            requested, "题目数量", minimum=1, maximum=100
        )
        if question_count > total_available:
            raise ApiError(
                f"题目数量不能超过该科目的可用题目数（{total_available}）", 422
            )

    questions = db.execute(
        """
        SELECT id FROM questions
        WHERE subject_id = ? AND is_deleted = 0
        ORDER BY RANDOM()
        LIMIT ?
        """,
        (subject_id, question_count),
    ).fetchall()

    cursor = db.execute(
        """
        INSERT INTO attempts (user_id, subject_id, total_questions)
        VALUES (?, ?, ?)
        """,
        (g.user["id"], subject_id, question_count),
    )
    attempt_id = cursor.lastrowid
    db.executemany(
        """
        INSERT INTO attempt_questions (attempt_id, question_id, position)
        VALUES (?, ?, ?)
        """,
        [
            (attempt_id, question["id"], position)
            for position, question in enumerate(questions, start=1)
        ],
    )
    db.commit()

    result = _attempt_detail(attempt_id, g.user["id"])
    payload = result.get_json()
    payload["subject"] = {
        "id": subject["id"],
        "name": subject["name"],
    }
    return jsonify(payload), 201


@bp.get("/exams")
@login_required
def list_exams():
    page, page_size = pagination_args(default_size=10)
    db = get_db()
    total = db.execute(
        "SELECT COUNT(*) AS count FROM attempts WHERE user_id = ?", (g.user["id"],)
    ).fetchone()["count"]
    rows = db.execute(
        """
        SELECT a.*, s.name AS subject_name,
            (SELECT COUNT(*) FROM attempt_questions aq
             WHERE aq.attempt_id = a.id AND aq.selected IS NOT NULL AND aq.selected != '[]') AS answered_count
        FROM attempts a
        JOIN subjects s ON s.id = a.subject_id
        WHERE a.user_id = ?
        ORDER BY a.id DESC
        LIMIT ? OFFSET ?
        """,
        (g.user["id"], page_size, (page - 1) * page_size),
    ).fetchall()
    return paginated_response(
        [_serialize_attempt(row) for row in rows], total, page, page_size
    )


@bp.get("/exams/<int:attempt_id>")
@login_required
def get_exam(attempt_id):
    return _attempt_detail(attempt_id, g.user["id"])


@bp.patch("/exams/<int:attempt_id>/progress")
@login_required
def save_progress(attempt_id):
    data = json_body()
    answers = data.get("answers")
    if not isinstance(answers, dict):
        raise ApiError("answers 必须是题目编号到答案的对象", 422)

    db = get_db()
    attempt = _attempt_row(attempt_id, g.user["id"])
    if attempt["status"] == "submitted":
        raise ApiError("该场考试已经提交", 409)

    rows = _question_rows(attempt_id)
    answer_map = {str(row["id"]): row["id"] for row in rows}
    for raw_id, raw_selected in answers.items():
        question_id = answer_map.get(str(raw_id))
        if question_id is None:
            continue
        selected = _normalize_selected(raw_selected)
        db.execute(
            """
            UPDATE attempt_questions
            SET selected = ?, is_correct = NULL
            WHERE attempt_id = ? AND question_id = ?
            """,
            (
                json.dumps(selected, ensure_ascii=False),
                attempt_id,
                question_id,
            ),
        )
    db.commit()
    return jsonify({"message": "答题进度已保存"})


@bp.post("/exams/<int:attempt_id>/submit")
@login_required
def submit_exam(attempt_id):
    data = json_body()
    answers = data.get("answers")
    if not isinstance(answers, dict):
        raise ApiError("answers 必须是题目编号到答案的对象", 422)

    db = get_db()
    attempt = _attempt_row(attempt_id, g.user["id"])
    if attempt["status"] == "submitted":
        raise ApiError("该场考试已经提交", 409)

    rows = _question_rows(attempt_id)
    correct_count = 0

    for row in rows:
        raw_selected = answers.get(str(row["id"]), answers.get(row["id"], []))
        selected = _normalize_selected(raw_selected)

        try:
            correct_answer = json.loads(row["answer"])
        except (TypeError, ValueError):
            correct_answer = []
        is_correct = sorted(selected) == sorted(correct_answer)
        if is_correct:
            correct_count += 1

        db.execute(
            """
            UPDATE attempt_questions
            SET selected = ?, is_correct = ?
            WHERE attempt_id = ? AND question_id = ?
            """,
            (
                json.dumps(selected, ensure_ascii=False),
                int(is_correct),
                attempt_id,
                row["id"],
            ),
        )

    total_questions = len(rows)
    score = round(correct_count / total_questions * 100, 2) if total_questions else 0
    db.execute(
        """
        UPDATE attempts
        SET status = 'submitted', correct_count = ?, score = ?,
            submitted_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (correct_count, score, attempt_id),
    )
    db.commit()
    return _attempt_detail(attempt_id, g.user["id"])
