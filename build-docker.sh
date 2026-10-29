#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

IMAGE_NAME="${IMAGE_NAME:-exam-system}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
PORT="${PORT:-5001}"

usage() {
    cat <<'EOF'
用法: ./build-docker.sh [选项] [端口]

选项:
  -p, --port PORT            服务端口，默认 5001
  -i, --image NAME           镜像名称，默认 exam-system
  -t, --tag TAG              镜像标签，默认 latest
  -h, --help                 显示帮助

示例:
  ./build-docker.sh
  ./build-docker.sh 8080
  ./build-docker.sh -p 8080 -t v1.0.0
EOF
}

positional=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|--port)
            PORT="${2:?缺少服务端口}"
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
    PORT="${positional[0]}"
fi
if [[ ${#positional[@]} -gt 1 ]]; then
    echo "参数过多，请使用 -h 查看用法。" >&2
    exit 1
fi

if [[ ! "$PORT" =~ ^[0-9]+$ ]] || ((PORT < 1 || PORT > 65535)); then
    echo "端口无效：${PORT}（应为 1-65535）" >&2
    exit 1
fi

IMAGE_REF="${IMAGE_NAME}:${IMAGE_TAG}"

echo "正在构建镜像 ${IMAGE_REF}"
echo "  服务端口: ${PORT}"
echo ""

docker build \
    --build-arg PORT="$PORT" \
    -t "$IMAGE_REF" \
    .

echo ""
echo "镜像构建完成：${IMAGE_REF}"
echo ""
echo "运行参考："
echo "  docker run -d --name exam-system \\"
echo "    -p ${PORT}:${PORT} \\"
echo "    -e EXAM_SECRET_KEY='请替换为随机密钥' \\"
echo "    -v exam-system-data:/app/data \\"
echo "    ${IMAGE_REF}"
