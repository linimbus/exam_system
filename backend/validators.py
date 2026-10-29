import json
import re

from .utils import ApiError


USERNAME_PATTERN = re.compile(r"^\S{3,32}$")


def validate_username(value):
    username = str(value or "").strip()
    if not USERNAME_PATTERN.fullmatch(username):
        raise ApiError("用户名需为 3-32 个字符，且不能包含空格", 422)
    return username


def validate_password(value):
    password = str(value or "")
    if not 6 <= len(password) <= 64:
        raise ApiError("密码长度需为 6-64 位", 422)
    return password


def validate_subject_name(value):
    name = str(value or "").strip()
    if not 1 <= len(name) <= 50:
        raise ApiError("科目名称需为 1-50 个字符", 422)
    return name


def validate_question_options(qtype, options, answer):
    if qtype not in {"single", "multiple", "judge"}:
        raise ApiError("题型无效", 422)

    if qtype == "judge":
        normalized_options = [
            {"key": "T", "text": "正确"},
            {"key": "F", "text": "错误"},
        ]
        if isinstance(answer, str):
            answer = [answer]
        answer_keys = [str(item).strip().upper() for item in (answer or [])]
        if len(answer_keys) != 1 or answer_keys[0] not in {"T", "F"}:
            raise ApiError("是非题必须且只能设置一个正确答案", 422)
        return (
            json.dumps(normalized_options, ensure_ascii=False),
            json.dumps(answer_keys, ensure_ascii=False),
        )

    if not isinstance(options, list) or not 2 <= len(options) <= 8:
        raise ApiError("选择题需提供 2-8 个选项", 422)

    texts = []
    for option in options:
        text = option.get("text") if isinstance(option, dict) else option
        text = str(text or "").strip()
        if not text:
            raise ApiError("选项内容不能为空", 422)
        if len(text) > 500:
            raise ApiError("单个选项不能超过 500 个字符", 422)
        texts.append(text)

    normalized_options = [
        {"key": chr(65 + index), "text": text} for index, text in enumerate(texts)
    ]
    valid_keys = {item["key"] for item in normalized_options}

    if isinstance(answer, str):
        answer = [answer]
    answer_keys = []
    for item in answer or []:
        key = str(item).strip().upper()
        if key and key not in answer_keys:
            answer_keys.append(key)

    if not answer_keys or any(key not in valid_keys for key in answer_keys):
        raise ApiError("请选择有效的正确答案", 422)
    if qtype == "single" and len(answer_keys) != 1:
        raise ApiError("单选题必须且只能设置一个正确答案", 422)
    if qtype == "multiple" and len(answer_keys) < 1:
        raise ApiError("多选题至少设置一个正确答案", 422)

    return (
        json.dumps(normalized_options, ensure_ascii=False),
        json.dumps(answer_keys, ensure_ascii=False),
    )
