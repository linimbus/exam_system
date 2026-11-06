import json

from flask import Blueprint, current_app, jsonify, request
from werkzeug.security import check_password_hash

from ..auth import create_token, load_user_from_token
from ..catalog import (
    create_question,
    create_subject,
    delete_question,
    delete_subject,
    get_question_or_404,
    list_questions,
    list_subjects,
    update_question,
    update_subject,
)
from ..db import get_db
from ..utils import ApiError, parse_int, serialize_question, serialize_user


bp = Blueprint("mcp", __name__)

LATEST_PROTOCOL_VERSION = "2025-06-18"
SUPPORTED_PROTOCOL_VERSIONS = {
    "2024-11-05",
    "2025-03-26",
    "2025-06-18",
}

TOKEN_SCHEMA = {
    "type": "string",
    "description": "管理员登录返回的 token；也可通过 Authorization: Bearer <token> 请求头传入",
}


def _get_bearer_token():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header[7:].strip()
    return token or None


def _require_admin(args):
    token = str(args.get("token") or "").strip() or _get_bearer_token()
    user = load_user_from_token(token)
    if user["role"] != "admin":
        raise ApiError("需要管理员权限", 403)
    return user


def _id_arg(args, name, label):
    return parse_int(args.get(name), label, minimum=1)


def _tool_admin_login(args):
    username = str(args.get("username") or "").strip()
    password = str(args.get("password") or "")
    if not username or not password:
        raise ApiError("请输入用户名和密码", 422)

    user = get_db().execute(
        "SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username,)
    ).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        raise ApiError("用户名或密码错误", 401)
    if not user["is_active"]:
        raise ApiError("账号已被停用，请联系管理员", 403)
    if user["role"] != "admin":
        raise ApiError("需要管理员权限", 403)

    return {"token": create_token(user["id"]), "user": serialize_user(user)}


def _tool_list_subjects(args):
    _require_admin(args)
    items = list_subjects()
    return {"items": items, "total": len(items)}


def _tool_list_questions(args):
    _require_admin(args)
    return list_questions(
        subject_id=args.get("subject_id"),
        qtype=args.get("qtype") or args.get("type"),
        search=args.get("search"),
        page=args.get("page", 1),
        page_size=args.get("page_size", 20),
    )


def _tool_get_question(args):
    _require_admin(args)
    question_id = _id_arg(args, "question_id", "题目 ID")
    return {
        "question": serialize_question(
            get_question_or_404(question_id), include_answer=True
        )
    }


def _tool_create_subject(args):
    _require_admin(args)
    return {"subject": create_subject(args)}


def _tool_update_subject(args):
    _require_admin(args)
    subject_id = _id_arg(args, "subject_id", "科目 ID")
    return {"subject": update_subject(subject_id, args)}


def _tool_delete_subject(args):
    _require_admin(args)
    subject_id = _id_arg(args, "subject_id", "科目 ID")
    return delete_subject(subject_id)


def _tool_create_question(args):
    _require_admin(args)
    return {"question": create_question(args)}


def _tool_update_question(args):
    _require_admin(args)
    question_id = _id_arg(args, "question_id", "题目 ID")
    return {"question": update_question(question_id, args)}


def _tool_delete_question(args):
    _require_admin(args)
    question_id = _id_arg(args, "question_id", "题目 ID")
    return delete_question(question_id)


TOOLS = [
    {
        "name": "admin_login",
        "description": "管理员登录。成功后返回 token，后续管理工具可通过 token 参数或 Authorization 请求头使用该凭证。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "username": {"type": "string", "description": "管理员用户名"},
                "password": {"type": "string", "description": "管理员密码"},
            },
            "required": ["username", "password"],
        },
    },
    {
        "name": "list_subjects",
        "description": "查询所有可用科目信息，包括科目名称、描述、排序、题目总数和题型分布。",
        "inputSchema": {
            "type": "object",
            "properties": {"token": TOKEN_SCHEMA},
        },
    },
    {
        "name": "list_questions",
        "description": "分页查询题库信息，可按科目、题型和关键词筛选，返回题目、选项、答案与解析。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "token": TOKEN_SCHEMA,
                "subject_id": {"type": "integer", "description": "科目 ID"},
                "qtype": {
                    "type": "string",
                    "enum": ["single", "multiple", "judge"],
                    "description": "题型：单选/多选/是非",
                },
                "search": {"type": "string", "description": "按题目内容搜索"},
                "page": {"type": "integer", "minimum": 1, "default": 1},
                "page_size": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 100,
                    "default": 20,
                },
            },
        },
    },
    {
        "name": "get_question",
        "description": "按题目 ID 查询单道题目详情，包含正确答案与解析。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "token": TOKEN_SCHEMA,
                "question_id": {"type": "integer", "description": "题目 ID"},
            },
            "required": ["question_id"],
        },
    },
    {
        "name": "create_subject",
        "description": "新增考试科目。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "token": TOKEN_SCHEMA,
                "name": {"type": "string", "description": "科目名称，1-50 个字符"},
                "description": {
                    "type": "string",
                    "description": "科目描述，最多 500 个字符",
                },
                "sort_order": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 9999,
                    "default": 0,
                    "description": "排序值，数字越小越靠前",
                },
            },
            "required": ["name"],
        },
    },
    {
        "name": "update_subject",
        "description": "修改科目信息，可更新名称、描述和排序。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "token": TOKEN_SCHEMA,
                "subject_id": {"type": "integer", "description": "科目 ID"},
                "name": {"type": "string", "description": "新的科目名称"},
                "description": {"type": "string", "description": "新的科目描述"},
                "sort_order": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 9999,
                },
            },
            "required": ["subject_id"],
        },
    },
    {
        "name": "delete_subject",
        "description": "删除科目。科目下的题目会同步软删除，历史考试记录仍会保留。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "token": TOKEN_SCHEMA,
                "subject_id": {"type": "integer", "description": "科目 ID"},
            },
            "required": ["subject_id"],
        },
    },
    {
        "name": "create_question",
        "description": "新增题目并配置所属科目。选择题 options 为选项文本列表，answer 为正确选项标识；是非题 answer 使用 T/F。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "token": TOKEN_SCHEMA,
                "subject_id": {"type": "integer", "description": "所属科目 ID"},
                "qtype": {
                    "type": "string",
                    "enum": ["single", "multiple", "judge"],
                    "description": "题型",
                },
                "content": {
                    "type": "string",
                    "description": "题目内容，1-2000 个字符",
                },
                "options": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "选择题选项文本列表，2-8 个；是非题可省略",
                },
                "answer": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "正确答案标识，如 [\"A\"]、[\"A\",\"B\"] 或 [\"T\"]",
                },
                "explanation": {
                    "type": "string",
                    "description": "答案解析，最多 2000 个字符",
                },
            },
            "required": ["subject_id", "qtype", "content", "answer"],
        },
    },
    {
        "name": "update_question",
        "description": "修改题目信息或调整题目所属科目。未提供的字段保持原值。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "token": TOKEN_SCHEMA,
                "question_id": {"type": "integer", "description": "题目 ID"},
                "subject_id": {"type": "integer", "description": "新的所属科目 ID"},
                "qtype": {
                    "type": "string",
                    "enum": ["single", "multiple", "judge"],
                },
                "content": {"type": "string", "description": "新的题目内容"},
                "options": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "新的选项文本列表",
                },
                "answer": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "新的正确答案标识",
                },
                "explanation": {"type": "string", "description": "新的答案解析"},
            },
            "required": ["question_id"],
        },
    },
    {
        "name": "delete_question",
        "description": "删除题目（软删除），不会破坏已有考试记录。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "token": TOKEN_SCHEMA,
                "question_id": {"type": "integer", "description": "题目 ID"},
            },
            "required": ["question_id"],
        },
    },
]

TOOL_HANDLERS = {
    "admin_login": _tool_admin_login,
    "list_subjects": _tool_list_subjects,
    "list_questions": _tool_list_questions,
    "get_question": _tool_get_question,
    "create_subject": _tool_create_subject,
    "update_subject": _tool_update_subject,
    "delete_subject": _tool_delete_subject,
    "create_question": _tool_create_question,
    "update_question": _tool_update_question,
    "delete_question": _tool_delete_question,
}


def _jsonrpc_result(request_id, result):
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _jsonrpc_error(request_id, code, message, data=None):
    error = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


def _tool_result(payload, is_error=False):
    if isinstance(payload, str):
        text = payload
    else:
        text = json.dumps(payload, ensure_ascii=False, indent=2)
    result = {
        "content": [{"type": "text", "text": text}],
        "isError": is_error,
    }
    if not is_error and isinstance(payload, dict):
        result["structuredContent"] = payload
    return result


def _handle_initialize(payload):
    params = payload.get("params") or {}
    requested = params.get("protocolVersion")
    protocol_version = (
        requested
        if requested in SUPPORTED_PROTOCOL_VERSIONS
        else LATEST_PROTOCOL_VERSION
    )
    return {
        "protocolVersion": protocol_version,
        "capabilities": {"tools": {"listChanged": False}},
        "serverInfo": {"name": "exam-system-mcp", "version": "1.0.0"},
        "instructions": (
            "知考在线考试系统 MCP 服务。先调用 admin_login 获取 token，"
            "再使用科目和题库管理工具。token 可通过参数或 Authorization 请求头传递。"
        ),
    }


def _handle_tools_call(request_id, params):
    if not isinstance(params, dict):
        return _jsonrpc_error(request_id, -32602, "tools/call 参数无效")
    name = params.get("name")
    arguments = params.get("arguments") or {}
    if not isinstance(name, str) or not name:
        return _jsonrpc_error(request_id, -32602, "缺少工具名称")
    if not isinstance(arguments, dict):
        return _jsonrpc_error(request_id, -32602, "工具参数必须是 JSON 对象")

    handler = TOOL_HANDLERS.get(name)
    if not handler:
        return _jsonrpc_error(request_id, -32602, f"未知工具：{name}")

    try:
        payload = handler(arguments)
    except ApiError as error:
        return _jsonrpc_result(
            request_id, _tool_result(error.message, is_error=True)
        )
    except Exception as error:  # noqa: BLE001
        current_app.logger.exception("MCP 工具执行失败：%s", name)
        return _jsonrpc_result(
            request_id,
            _tool_result(f"工具执行失败：{error}", is_error=True),
        )
    return _jsonrpc_result(request_id, _tool_result(payload))


def _handle_message(payload):
    if not isinstance(payload, dict):
        return _jsonrpc_error(None, -32600, "无效的 JSON-RPC 请求")

    request_id = payload.get("id")
    method = payload.get("method")
    if not isinstance(method, str):
        return _jsonrpc_error(request_id, -32600, "缺少 JSON-RPC 方法名")

    if method == "initialize":
        return _jsonrpc_result(request_id, _handle_initialize(payload))

    if method == "ping":
        return _jsonrpc_result(request_id, {})

    if method == "tools/list":
        return _jsonrpc_result(request_id, {"tools": TOOLS})

    if method == "tools/call":
        return _handle_tools_call(request_id, payload.get("params"))

    return _jsonrpc_error(request_id, -32601, f"不支持的方法：{method}")


@bp.post("/mcp")
def mcp_post():
    payload = request.get_json(silent=True)
    if payload is None:
        return (
            jsonify(_jsonrpc_error(None, -32700, "无法解析 JSON-RPC 请求")),
            400,
        )

    if isinstance(payload, list):
        if not payload:
            return jsonify(_jsonrpc_error(None, -32600, "空的 JSON-RPC 批量请求")), 400
        responses = []
        for item in payload:
            if isinstance(item, dict) and "id" not in item:
                continue
            responses.append(_handle_message(item))
        if not responses:
            return "", 202
        return jsonify(responses)

    if isinstance(payload, dict) and "id" not in payload:
        return "", 202

    return jsonify(_handle_message(payload))


@bp.get("/mcp")
def mcp_get():
    return (
        jsonify(
            {
                "error": "MCP SSE 流未启用，请使用 POST 发送 JSON-RPC 请求。",
            }
        ),
        405,
        {"Allow": "POST"},
    )


@bp.delete("/mcp")
def mcp_delete():
    return (
        jsonify({"error": "无状态 MCP 服务不支持删除会话。"}),
        405,
        {"Allow": "POST"},
    )
