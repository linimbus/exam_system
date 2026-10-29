#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-${EXAM_PORT:-5001}}"

export PORT
export EXAM_HOST="${EXAM_HOST:-0.0.0.0}"
export EXAM_PORT="$PORT"
export EXAM_DATABASE="${EXAM_DATABASE:-/app/data/exam.db}"
export FLASK_DEBUG="${FLASK_DEBUG:-0}"

echo ""
echo "知考在线考试系统已启动"
echo "  访问地址: http://0.0.0.0:${PORT}"
echo "  后端接口: http://0.0.0.0:${PORT}/api"
echo ""

exec python3 run.py
