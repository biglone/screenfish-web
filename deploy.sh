#!/bin/bash

# ScreenFish 部署脚本
# 使用开发模式启动（支持 API 代理）并配置 Cloudflare Tunnel

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$(cd "$SCRIPT_DIR/../screenfish" && pwd)}"
FRONTEND_DIR="$SCRIPT_DIR"

# 端口配置（可通过环境变量覆盖）
BACKEND_PORT="${BACKEND_PORT:-8000}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
DEFAULT_PROXY_TARGET="http://localhost:$BACKEND_PORT"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_blue() { echo -e "${BLUE}[URL]${NC} $1"; }

cleanup() {
    log_info "正在停止服务..."
    [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null || true
    [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null || true
    [ -n "$TUNNEL_PID" ] && kill $TUNNEL_PID 2>/dev/null || true
    log_info "服务已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

echo ""
log_info "=========================================="
log_info "    ScreenFish 服务部署"
log_info "=========================================="
echo ""

# 检查后端目录
if [ ! -d "$BACKEND_DIR" ]; then
    log_error "后端目录不存在: $BACKEND_DIR"
    exit 1
fi

# 检查 cloudflared
if ! command -v cloudflared &> /dev/null; then
    log_error "cloudflared 未安装"
    exit 1
fi

# 1. 启动后端服务
log_info "[1/3] 启动后端服务 (端口 $BACKEND_PORT)..."
cd "$BACKEND_DIR"

# CORS：使用 Vite proxy（/api -> backend）时通常不需要配置。
# 如需浏览器直接访问后端（跨域），请显式设置为你的前端域名列表（不要用 *）。
export STOCK_SCREENER_CORS_ORIGINS="${STOCK_SCREENER_CORS_ORIGINS:-}"

# 激活虚拟环境（如果存在）
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
    log_info "已激活 Python 虚拟环境"
fi

# 启动 uvicorn（后台运行，输出到日志文件）
nohup python -m uvicorn stock_screener.server:create_app_from_env \
    --factory --host "$BACKEND_HOST" --port $BACKEND_PORT \
    > "$FRONTEND_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
log_info "后端 PID: $BACKEND_PID"

# 等待后端启动
sleep 3
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    log_error "后端服务启动失败，查看日志: $FRONTEND_DIR/backend.log"
    cat "$FRONTEND_DIR/backend.log"
    exit 1
fi
log_info "后端服务已启动"

# 2. 启动前端开发服务器（带代理）
log_info "[2/3] 启动前端服务 (端口 $FRONTEND_PORT)..."
cd "$FRONTEND_DIR"

# 默认让 Vite proxy 指向本次启动的后端端口（可通过环境变量覆盖）
export VITE_PROXY_TARGET="${VITE_PROXY_TARGET:-$DEFAULT_PROXY_TARGET}"

# 使用 vite dev 模式运行（支持代理）
nohup npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT \
    > "$FRONTEND_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
log_info "前端 PID: $FRONTEND_PID"

# 等待前端启动
sleep 5
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    log_error "前端服务启动失败，查看日志: $FRONTEND_DIR/frontend.log"
    cat "$FRONTEND_DIR/frontend.log"
    cleanup
fi
log_info "前端服务已启动"

# 3. 启动 Cloudflare Tunnel
log_info "[3/3] 启动 Cloudflare Tunnel..."
echo ""

# 创建临时文件存储 tunnel URL
TUNNEL_OUTPUT="$FRONTEND_DIR/tunnel.log"

# 使用 cloudflared quick tunnel
cloudflared tunnel --url http://localhost:$FRONTEND_PORT 2>&1 | tee "$TUNNEL_OUTPUT" &
TUNNEL_PID=$!

# 等待获取 URL
sleep 5

echo ""
log_info "=========================================="
log_info "服务已全部启动!"
log_info "=========================================="
echo ""
log_info "本地访问:"
log_info "  后端监听: $BACKEND_HOST:$BACKEND_PORT"
log_info "  后端 API: http://localhost:$BACKEND_PORT"
log_info "  前端页面: http://localhost:$FRONTEND_PORT"
echo ""
log_info "公网访问: 请查看上方 cloudflared 输出的 trycloudflare.com URL"
echo ""
log_info "日志文件:"
log_info "  后端日志: $FRONTEND_DIR/backend.log"
log_info "  前端日志: $FRONTEND_DIR/frontend.log"
log_info "  Tunnel日志: $TUNNEL_OUTPUT"
echo ""
log_warn "按 Ctrl+C 停止所有服务"
log_info "=========================================="

# 等待 tunnel 进程
wait $TUNNEL_PID
