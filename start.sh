#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-python3}"
API_PORT="${EXAM_PORT:-5001}"
WEB_PORT="${WEB_PORT:-8000}"

if ! "$PYTHON_BIN" -c "import flask, flask_cors" >/dev/null 2>&1; then
    echo "缺少 Python 依赖，正在安装..."
    "$PYTHON_BIN" -m pip install -r requirements.txt
fi

export EXAM_HOST="${EXAM_HOST:-127.0.0.1}"
export EXAM_PORT="$API_PORT"
export FLASK_DEBUG="${FLASK_DEBUG:-0}"

cleanup() {
    if [[ -n "${BACKEND_PID:-}" ]]; then
        kill "$BACKEND_PID" >/dev/null 2>&1 || true
    fi
    if [[ -n "${FRONTEND_PID:-}" ]]; then
        kill "$FRONTEND_PID" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT INT TERM

"$PYTHON_BIN" run.py &
BACKEND_PID=$!

(
    cd frontend
    "$PYTHON_BIN" -m http.server "$WEB_PORT" --bind 127.0.0.1
) &
FRONTEND_PID=$!

echo ""
echo "知考在线考试系统已启动"
echo "  前端地址: http://127.0.0.1:${WEB_PORT}"
echo "  后端接口: http://127.0.0.1:${API_PORT}/api"
echo "  管理员账号: ${EXAM_ADMIN_USERNAME:-admin} / ${EXAM_ADMIN_PASSWORD:-admin123}"
echo ""
echo "按 Ctrl+C 停止服务。"

wait "$BACKEND_PID" "$FRONTEND_PID"
