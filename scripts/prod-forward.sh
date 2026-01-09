#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"

CACHE_DIR="${XDG_CACHE_HOME:-${HOME}/.cache}"
PID_FILE="${CACHE_DIR}/screenfish-prod-forward.pid"

LOCAL_PORT="${SCREENFISH_FORWARD_LOCAL_PORT:-5174}"
REMOTE_HOST="${SCREENFISH_FORWARD_REMOTE_HOST:-127.0.0.1}"
REMOTE_PORT="${SCREENFISH_FORWARD_REMOTE_PORT:-5174}"

WITH_BACKEND=0
BACKEND_PORT="${SCREENFISH_FORWARD_BACKEND_PORT:-8001}"

DAEMON=0
OPEN=0

usage() {
  cat <<EOF
Usage:
  ${SCRIPT_NAME} <ssh_target> [options]
  ${SCRIPT_NAME} --stop

Create an SSH port-forward so you can open ScreenFish in your local browser.

Examples:
  ${SCRIPT_NAME} biglone@your-server
  ${SCRIPT_NAME} biglone@your-server --open
  ${SCRIPT_NAME} biglone@your-server --daemon
  ${SCRIPT_NAME} --stop

Options:
  --local-port <n>     Local listen port (default: ${LOCAL_PORT})
  --remote-host <h>    Remote host (default: ${REMOTE_HOST})
  --remote-port <n>    Remote port (default: ${REMOTE_PORT})
  --with-backend       Also forward backend port ${BACKEND_PORT}
  --backend-port <n>   Backend port (default: ${BACKEND_PORT})
  --open               Open browser after starting (implies --daemon)
  --daemon             Run in background and write pid to ${PID_FILE}
  --stop               Stop background tunnel started by this script
  -h, --help           Show help

Env:
  SCREENFISH_FORWARD_LOCAL_PORT
  SCREENFISH_FORWARD_REMOTE_HOST
  SCREENFISH_FORWARD_REMOTE_PORT
  SCREENFISH_FORWARD_BACKEND_PORT
EOF
}

die() {
  echo "[prod-forward] $*" >&2
  exit 1
}

info() {
  echo "[prod-forward] $*" >&2
}

stop_tunnel() {
  if [ ! -f "${PID_FILE}" ]; then
    die "no pid file found: ${PID_FILE}"
  fi
  pid="$(cat "${PID_FILE}" | tr -d '[:space:]')"
  if [ -z "${pid}" ]; then
    rm -f "${PID_FILE}" || true
    die "empty pid file: ${PID_FILE}"
  fi
  if ! kill -0 "${pid}" 2>/dev/null; then
    rm -f "${PID_FILE}" || true
    die "process not running: ${pid}"
  fi
  info "stopping tunnel pid=${pid}"
  kill "${pid}" 2>/dev/null || true
  rm -f "${PID_FILE}" || true
  info "stopped"
}

open_url() {
  local url="$1"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "${url}" >/dev/null 2>&1 || true
    return
  fi
  if command -v open >/dev/null 2>&1; then
    open "${url}" >/dev/null 2>&1 || true
    return
  fi
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "Start-Process '${url}'" >/dev/null 2>&1 || true
    return
  fi
}

SSH_TARGET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --stop)
      stop_tunnel
      exit 0
      ;;
    --local-port)
      LOCAL_PORT="${2:-}"
      [ -n "${LOCAL_PORT}" ] || die "missing value for --local-port"
      shift 2
      ;;
    --remote-host)
      REMOTE_HOST="${2:-}"
      [ -n "${REMOTE_HOST}" ] || die "missing value for --remote-host"
      shift 2
      ;;
    --remote-port)
      REMOTE_PORT="${2:-}"
      [ -n "${REMOTE_PORT}" ] || die "missing value for --remote-port"
      shift 2
      ;;
    --with-backend)
      WITH_BACKEND=1
      shift
      ;;
    --backend-port)
      BACKEND_PORT="${2:-}"
      [ -n "${BACKEND_PORT}" ] || die "missing value for --backend-port"
      shift 2
      ;;
    --open)
      OPEN=1
      DAEMON=1
      shift
      ;;
    --daemon)
      DAEMON=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -n "${SSH_TARGET}" ]; then
        die "unexpected extra arg: $1"
      fi
      SSH_TARGET="$1"
      shift
      ;;
  esac
done

if [ -z "${SSH_TARGET}" ]; then
  usage
  exit 2
fi

if [ "${DAEMON}" -eq 1 ] && [ -f "${PID_FILE}" ]; then
  pid="$(cat "${PID_FILE}" | tr -d '[:space:]' || true)"
  if [ -n "${pid}" ] && kill -0 "${pid}" 2>/dev/null; then
    die "tunnel already running (pid ${pid}); stop first with: ${SCRIPT_NAME} --stop"
  fi
  rm -f "${PID_FILE}" || true
fi

mkdir -p "${CACHE_DIR}"

cmd=(
  ssh
  -N
  -o ExitOnForwardFailure=yes
  -o ServerAliveInterval=60
  -o ServerAliveCountMax=3
  -L "${LOCAL_PORT}:${REMOTE_HOST}:${REMOTE_PORT}"
)
if [ "${WITH_BACKEND}" -eq 1 ]; then
  cmd+=(-L "${BACKEND_PORT}:${REMOTE_HOST}:${BACKEND_PORT}")
fi
cmd+=("${SSH_TARGET}")

url="http://localhost:${LOCAL_PORT}"

if [ "${DAEMON}" -eq 1 ]; then
  info "starting tunnel in background..."
  "${cmd[@]}" &
  pid="$!"
  echo "${pid}" > "${PID_FILE}"
  sleep 0.3
  if ! kill -0 "${pid}" 2>/dev/null; then
    rm -f "${PID_FILE}" || true
    die "ssh tunnel failed to start"
  fi

  info "tunnel started pid=${pid}"
  info "open: ${url}"
  if [ "${WITH_BACKEND}" -eq 1 ]; then
    info "backend: http://localhost:${BACKEND_PORT}"
  fi
  info "stop: ${SCRIPT_NAME} --stop"
  if [ "${OPEN}" -eq 1 ]; then
    open_url "${url}"
  fi
  exit 0
fi

info "forwarding ${url} -> ${REMOTE_HOST}:${REMOTE_PORT} via ${SSH_TARGET}"
info "press Ctrl+C to stop"
exec "${cmd[@]}"

