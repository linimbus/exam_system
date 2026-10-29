#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-python3}"
PORT="${PORT:-${EXAM_PORT:-5001}}"

if ! "$PYTHON_BIN" -c "import flask, flask_cors" >/dev/null 2>&1; then
    echo "缺少 Python 依赖，正在安装..."
    "$PYTHON_BIN" -m pip install -r requirements.txt
fi

export PORT
export EXAM_HOST="${EXAM_HOST:-127.0.0.1}"
export EXAM_PORT="$PORT"
export FLASK_DEBUG="${FLASK_DEBUG:-0}"

echo ""
echo "知考在线考试系统已启动"
echo "  访问地址: http://127.0.0.1:${PORT}"
echo "  后端接口: http://127.0.0.1:${PORT}/api"
echo "  管理员账号: ${EXAM_ADMIN_USERNAME:-admin} / ${EXAM_ADMIN_PASSWORD:-admin123}"
echo ""
echo "按 Ctrl+C 停止服务。"
echo ""

exec "$PYTHON_BIN" run.py
