import json
import math

from flask import jsonify, request


class ApiError(Exception):
    def __init__(self, message, status_code=400, details=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


def error_response(error):
    payload = {"error": error.message}
    if error.details is not None:
        payload["details"] = error.details
    return jsonify(payload), error.status_code


def json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("请求内容必须是 JSON 对象", 400)
    return data


def parse_int(value, field_name, minimum=None, maximum=None, default=None):
    if value is None or value == "":
        if default is not None:
            return default
        raise ApiError(f"{field_name}不能为空", 422)
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ApiError(f"{field_name}必须是整数", 422) from None
    if minimum is not None and parsed < minimum:
        raise ApiError(f"{field_name}不能小于 {minimum}", 422)
    if maximum is not None and parsed > maximum:
        raise ApiError(f"{field_name}不能大于 {maximum}", 422)
    return parsed


def serialize_user(row):
    return {
        "id": row["id"],
        "username": row["username"],
        "role": row["role"],
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
    }


def _load_json(value, fallback):
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def serialize_question(row, include_answer=False):
    item = {
        "id": row["id"],
        "subject_id": row["subject_id"],
        "subject_name": row["subject_name"] if "subject_name" in row.keys() else None,
        "type": row["qtype"],
        "content": row["content"],
        "options": _load_json(row["options"], []),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
    if include_answer:
        item["answer"] = _load_json(row["answer"], [])
        item["explanation"] = row["explanation"]
    return item


def pagination_args(default_size=10, max_size=100):
    page = parse_int(request.args.get("page"), "页码", minimum=1, default=1)
    page_size = parse_int(
        request.args.get("page_size"),
        "每页数量",
        minimum=1,
        maximum=max_size,
        default=default_size,
    )
    return page, page_size


def paginated_response(items, total, page, page_size, extra=None):
    payload = {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size)) if total else 0,
    }
    if extra:
        payload.update(extra)
    return jsonify(payload)
