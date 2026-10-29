#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

IMAGE_NAME="${IMAGE_NAME:-exam-system}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
FRONTEND_PORT="${FRONTEND_PORT:-8000}"
BACKEND_PORT="${BACKEND_PORT:-5001}"

usage() {
    cat <<'EOF'
用法: ./build-docker.sh [选项] [前端端口] [后端端口]

选项:
  -f, --frontend-port PORT   前端端口，默认 8000
  -b, --backend-port PORT    后端端口，默认 5001
  -i, --image NAME           镜像名称，默认 exam-system
  -t, --tag TAG              镜像标签，默认 latest
  -h, --help                 显示帮助

示例:
  ./build-docker.sh
  ./build-docker.sh 8080 5002
  ./build-docker.sh -f 8080 -b 5002 -t v1.0.0
EOF
}

positional=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        -f|--frontend-port)
            FRONTEND_PORT="${2:?缺少前端端口}"
            shift 2
            ;;
        -b|--backend-port)
            BACKEND_PORT="${2:?缺少后端端口}"
            shift 2
            ;;
        -i|--image)
            IMAGE_NAME="${2:?缺少镜像名称}"
            shift 2
            ;;
        -t|--tag)
            IMAGE_TAG="${2:?缺少镜像标签}"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            positional+=("$1")
            shift
            ;;
    esac
done

if [[ ${#positional[@]} -ge 1 ]]; then
    FRONTEND_PORT="${positional[0]}"
fi
if [[ ${#positional[@]} -ge 2 ]]; then
    BACKEND_PORT="${positional[1]}"
fi
if [[ ${#positional[@]} -gt 2 ]]; then
    echo "参数过多，请使用 -h 查看用法。" >&2
    exit 1
fi

validate_port() {
    local port="$1"
    local name="$2"
    if [[ ! "$port" =~ ^[0-9]+$ ]] || ((port < 1 || port > 65535)); then
        echo "${name}无效：${port}（应为 1-65535）" >&2
        exit 1
    fi
}

validate_port "$FRONTEND_PORT" "前端端口"
validate_port "$BACKEND_PORT" "后端端口"

IMAGE_REF="${IMAGE_NAME}:${IMAGE_TAG}"

echo "正在构建镜像 ${IMAGE_REF}"
echo "  前端端口: ${FRONTEND_PORT}"
echo "  后端端口: ${BACKEND_PORT}"
echo ""

docker build \
    --build-arg FRONTEND_PORT="$FRONTEND_PORT" \
    --build-arg BACKEND_PORT="$BACKEND_PORT" \
    -t "$IMAGE_REF" \
    .

echo ""
echo "镜像构建完成：${IMAGE_REF}"
echo ""
echo "运行参考："
echo "  docker run -d --name exam-system \\"
echo "    -p ${FRONTEND_PORT}:${FRONTEND_PORT} -p ${BACKEND_PORT}:${BACKEND_PORT} \\"
echo "    -e EXAM_SECRET_KEY='请替换为随机密钥' \\"
echo "    -v exam-system-data:/app/data \\"
echo "    ${IMAGE_REF}"
