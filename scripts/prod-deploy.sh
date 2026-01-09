#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${SCREENFISH_BACKEND_DIR:-$(cd "${FRONTEND_DIR}/../screenfish" && pwd)}"

REMOTE="${SCREENFISH_PROD_REMOTE:-prod}"
BRANCH="${SCREENFISH_PROD_BRANCH:-main}"
RUN_CHECKS=1
CHECK_ONLY=0
DEPLOY_BACKEND=1
DEPLOY_FRONTEND=1

HOST="${SCREENFISH_PROD_HOST:-127.0.0.1}"
BACKEND_PORT="${SCREENFISH_PROD_BACKEND_PORT:-8001}"
GATEWAY_PORT="${SCREENFISH_PROD_GATEWAY_PORT:-5174}"
WAIT_SECONDS="${SCREENFISH_PROD_WAIT_SECONDS:-60}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Deploy ScreenFish backend+frontend to screenfish-prod (server-side).

Options:
  --backend-only           Deploy backend only
  --frontend-only          Deploy frontend only
  --no-check               Skip local checks (pytest / npm build)
  --check-only             Run checks only, do not deploy
  --remote <name>          Git remote to push (default: ${REMOTE})
  --branch <name>          Branch to deploy (default: ${BRANCH}; must be main for prod hooks)
  --wait <seconds>         Health check wait timeout (default: ${WAIT_SECONDS})
  -h, --help               Show help

Env:
  SCREENFISH_BACKEND_DIR         Backend repo path (default: ../screenfish)
  SCREENFISH_PROD_REMOTE         Git remote to push (default: prod)
  SCREENFISH_PROD_BRANCH         Branch to deploy (default: main)
  SCREENFISH_PROD_HOST           Health check host (default: 127.0.0.1)
  SCREENFISH_PROD_BACKEND_PORT   Health check backend port (default: 8001)
  SCREENFISH_PROD_GATEWAY_PORT   Health check gateway port (default: 5174)
  SCREENFISH_PROD_WAIT_SECONDS   Health check timeout (default: 60)
EOF
}

die() {
  echo "[prod-deploy] $*" >&2
  exit 1
}

info() {
  echo "[prod-deploy] $*" >&2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --backend-only)
      DEPLOY_BACKEND=1
      DEPLOY_FRONTEND=0
      shift
      ;;
    --frontend-only)
      DEPLOY_BACKEND=0
      DEPLOY_FRONTEND=1
      shift
      ;;
    --no-check)
      RUN_CHECKS=0
      shift
      ;;
    --check-only)
      CHECK_ONLY=1
      shift
      ;;
    --remote)
      REMOTE="${2:-}"
      [ -n "${REMOTE}" ] || die "missing value for --remote"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-}"
      [ -n "${BRANCH}" ] || die "missing value for --branch"
      shift 2
      ;;
    --wait)
      WAIT_SECONDS="${2:-}"
      [ -n "${WAIT_SECONDS}" ] || die "missing value for --wait"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown arg: $1 (use --help)"
      ;;
  esac
done

if [ "${DEPLOY_BACKEND}" -eq 0 ] && [ "${DEPLOY_FRONTEND}" -eq 0 ]; then
  die "nothing to do (both backend and frontend disabled)"
fi

if [ ! -d "${BACKEND_DIR}/.git" ]; then
  die "backend repo not found at: ${BACKEND_DIR} (set SCREENFISH_BACKEND_DIR)"
fi
if [ ! -d "${FRONTEND_DIR}/.git" ]; then
  die "frontend repo not found at: ${FRONTEND_DIR}"
fi

ensure_clean_and_on_branch() {
  local dir="$1"
  local label="$2"

  local branch
  branch="$(git -C "${dir}" rev-parse --abbrev-ref HEAD)"
  if [ "${branch}" != "${BRANCH}" ]; then
    die "${label} is on branch '${branch}', expected '${BRANCH}' (checkout ${BRANCH} before deploying)"
  fi

  if [ -n "$(git -C "${dir}" status --porcelain)" ]; then
    die "${label} repo has uncommitted changes; commit/stash first"
  fi

  if ! git -C "${dir}" remote | grep -qx "${REMOTE}"; then
    die "${label} missing git remote '${REMOTE}' (run: git remote -v)"
  fi
}

if [ "${DEPLOY_BACKEND}" -eq 1 ]; then
  ensure_clean_and_on_branch "${BACKEND_DIR}" "backend"
fi
if [ "${DEPLOY_FRONTEND}" -eq 1 ]; then
  ensure_clean_and_on_branch "${FRONTEND_DIR}" "frontend"
fi

if [ "${RUN_CHECKS}" -eq 1 ]; then
  if [ "${DEPLOY_BACKEND}" -eq 1 ]; then
    info "backend checks: pytest"
    if [ -x "${BACKEND_DIR}/.venv/bin/python" ]; then
      (cd "${BACKEND_DIR}" && .venv/bin/python -m pytest)
    else
      (cd "${BACKEND_DIR}" && python3 -m pytest)
    fi
  fi
  if [ "${DEPLOY_FRONTEND}" -eq 1 ]; then
    info "frontend checks: npm run build"
    (cd "${FRONTEND_DIR}" && npm run build)
  fi
fi

if [ "${CHECK_ONLY}" -eq 1 ]; then
  info "checks OK (check-only)"
  exit 0
fi

if [ "${DEPLOY_BACKEND}" -eq 1 ]; then
  info "deploy backend: git push ${REMOTE} ${BRANCH}"
  (cd "${BACKEND_DIR}" && git push "${REMOTE}" "${BRANCH}")
  info "backend HEAD: $(cd "${BACKEND_DIR}" && git show -s --oneline HEAD)"
fi
if [ "${DEPLOY_FRONTEND}" -eq 1 ]; then
  info "deploy frontend: git push ${REMOTE} ${BRANCH}"
  (cd "${FRONTEND_DIR}" && git push "${REMOTE}" "${BRANCH}")
  info "frontend HEAD: $(cd "${FRONTEND_DIR}" && git show -s --oneline HEAD)"
fi

info "waiting for health (timeout: ${WAIT_SECONDS}s)..."
python3 - <<PY
import json
import time
import urllib.request

host = ${HOST!r}
backend_port = int(${BACKEND_PORT!r})
gateway_port = int(${GATEWAY_PORT!r})
wait_seconds = float(${WAIT_SECONDS!r})

urls = []
if ${DEPLOY_BACKEND}:
    urls.append(("backend", f"http://{host}:{backend_port}/v1/health"))
if ${DEPLOY_FRONTEND}:
    urls.append(("gateway", f"http://{host}:{gateway_port}/api/v1/health"))

deadline = time.time() + wait_seconds
last_err = None
while True:
    ok = True
    for name, url in urls:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            if payload.get("status") != "ok":
                raise RuntimeError(f"status != ok: {payload!r}")
        except Exception as e:  # noqa: BLE001
            ok = False
            last_err = f"{name} {url}: {e}"
            break

    if ok:
        print("[prod-deploy] health OK")
        break

    if time.time() >= deadline:
        raise SystemExit(f"[prod-deploy] health check timeout: {last_err}")

    time.sleep(1.0)
PY

info "done. Local view (on your laptop):"
info "  ssh -L ${GATEWAY_PORT}:127.0.0.1:${GATEWAY_PORT} <user>@<server>"
info "  open: http://localhost:${GATEWAY_PORT}"

