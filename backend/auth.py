from functools import wraps

from flask import current_app, g, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from .db import get_db
from .utils import error_response, ApiError


def _serializer():
    return URLSafeTimedSerializer(
        current_app.config["SECRET_KEY"], salt="exam-system-auth"
    )


def create_token(user_id):
    return _serializer().dumps({"uid": user_id})


def _token_from_request():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header[7:].strip()
    return token or None


def load_user_from_token(token):
    if not token:
        raise ApiError("请先登录", 401)

    try:
        payload = _serializer().loads(
            token, max_age=current_app.config["TOKEN_MAX_AGE"]
        )
    except SignatureExpired:
        raise ApiError("登录已过期，请重新登录", 401) from None
    except BadSignature:
        raise ApiError("无效的登录凭证", 401) from None

    user_id = payload.get("uid")
    if not isinstance(user_id, int):
        raise ApiError("无效的登录凭证", 401)

    user = get_db().execute(
        "SELECT id, username, nickname, role, is_active, created_at FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    if not user:
        raise ApiError("用户不存在", 401)
    if not user["is_active"]:
        raise ApiError("账号已被停用，请联系管理员", 403)
    return user


def load_user_from_request():
    return load_user_from_token(_token_from_request())


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        try:
            g.user = load_user_from_request()
        except ApiError as error:
            return error_response(error)
        return view(*args, **kwargs)

    return wrapped


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        try:
            g.user = load_user_from_request()
        except ApiError as error:
            return error_response(error)
        if g.user["role"] != "admin":
            return error_response(ApiError("需要管理员权限", 403))
        return view(*args, **kwargs)

    return wrapped


def require_json_auth(view):
    return login_required(view)
