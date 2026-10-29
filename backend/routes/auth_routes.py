import sqlite3

from flask import Blueprint, g, jsonify
from werkzeug.security import check_password_hash, generate_password_hash

from ..auth import create_token, login_required
from ..db import get_db
from ..utils import ApiError, json_body, serialize_user
from ..validators import validate_password, validate_username


bp = Blueprint("auth_routes", __name__)


@bp.post("/register")
def register():
    data = json_body()
    username = validate_username(data.get("username"))
    password = validate_password(data.get("password"))
    db = get_db()

    if db.execute(
        "SELECT id FROM users WHERE username = ? COLLATE NOCASE", (username,)
    ).fetchone():
        raise ApiError("该用户名已被注册", 409)

    try:
        cursor = db.execute(
            """
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES (?, ?, 'user', 1)
            """,
            (username, generate_password_hash(password)),
        )
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback()
        raise ApiError("该用户名已被注册", 409) from None

    user = db.execute(
        "SELECT id, username, role, is_active, created_at FROM users WHERE id = ?",
        (cursor.lastrowid,),
    ).fetchone()
    return jsonify({"token": create_token(user["id"]), "user": serialize_user(user)}), 201


@bp.post("/login")
def login():
    data = json_body()
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")
    if not username or not password:
        raise ApiError("请输入用户名和密码", 422)

    db = get_db()
    user = db.execute(
        "SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username,)
    ).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        raise ApiError("用户名或密码错误", 401)
    if not user["is_active"]:
        raise ApiError("账号已被停用，请联系管理员", 403)

    return jsonify({"token": create_token(user["id"]), "user": serialize_user(user)})


@bp.get("/me")
@login_required
def me():
    return jsonify({"user": serialize_user(g.user)})
