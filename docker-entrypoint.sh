#!/usr/bin/env bash
set -euo pipefail

FRONTEND_PORT="${FRONTEND_PORT:-8000}"
BACKEND_PORT="${BACKEND_PORT:-5001}"

export EXAM_HOST="${EXAM_HOST:-0.0.0.0}"
export EXAM_PORT="$BACKEND_PORT"
export EXAM_DATABASE="${EXAM_DATABASE:-/app/data/exam.db}"
export EXAM_CORS_ORIGINS="${EXAM_CORS_ORIGINS:-http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT}}"
export FLASK_DEBUG="${FLASK_DEBUG:-0}"

cat > /app/frontend/js/config.js <<EOF
(function () {
    const host = window.location.hostname || "127.0.0.1";
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    window.EXAM_CONFIG = {
        apiBase:
            window.EXAM_API_BASE ||
            \`\${protocol}//\${host}:${BACKEND_PORT}/api\`,
    };
})();
EOF

cleanup() {
    if [[ -n "${BACKEND_PID:-}" ]]; then
        kill "$BACKEND_PID" >/dev/null 2>&1 || true
    fi
    if [[ -n "${FRONTEND_PID:-}" ]]; then
        kill "$FRONTEND_PID" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT INT TERM

python3 run.py &
BACKEND_PID=$!

(
    cd /app/frontend
    exec python3 -m http.server "$FRONTEND_PORT" --bind 0.0.0.0
) &
FRONTEND_PID=$!

echo ""
echo "知考在线考试系统已启动"
echo "  前端地址: http://0.0.0.0:${FRONTEND_PORT}"
echo "  后端接口: http://0.0.0.0:${BACKEND_PORT}/api"
echo ""

wait -n "$BACKEND_PID" "$FRONTEND_PID"
