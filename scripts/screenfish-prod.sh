#!/usr/bin/env bash
set -euo pipefail

BASE="${SCREENFISH_PROD_BASE:-${HOME}/services/screenfish-prod}"
BIN="${BASE}/bin"

usage() {
  cat <<EOF
Usage: $(basename "$0") <command> [args]

Commands:
  deploy                       Deploy backend + frontend (build + restart)
  deploy-backend               Deploy backend only
  deploy-frontend              Deploy frontend only
  start                        Start user services
  restart                      Restart user services
  stop                         Stop user services
  status                       Show user service status
  logs <backend|gateway> [-f]  Show logs (use -f to follow)

Env:
  SCREENFISH_PROD_BASE   Default: \$HOME/services/screenfish-prod
EOF
}

die() {
  echo "[screenfish-prod] $*" >&2
  exit 1
}

require_executable() {
  local path="$1"
  [ -x "$path" ] || die "Missing executable: $path (set SCREENFISH_PROD_BASE if needed)"
}

systemctl_user() {
  export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
  systemctl --user "$@"
}

journalctl_user() {
  export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
  journalctl --user "$@"
}

cmd="${1:-help}"

case "$cmd" in
  help|-h|--help)
    usage
    ;;

  deploy)
    require_executable "${BIN}/deploy-backend.sh"
    require_executable "${BIN}/deploy-frontend.sh"
    "${BIN}/deploy-backend.sh"
    "${BIN}/deploy-frontend.sh"
    ;;

  deploy-backend)
    require_executable "${BIN}/deploy-backend.sh"
    "${BIN}/deploy-backend.sh"
    ;;

  deploy-frontend)
    require_executable "${BIN}/deploy-frontend.sh"
    "${BIN}/deploy-frontend.sh"
    ;;

  start|restart|stop)
    action="$cmd"
    systemctl_user daemon-reload
    systemctl_user "${action}" screenfish-backend.service screenfish-gateway.service
    systemctl_user --no-pager --full status screenfish-backend.service screenfish-gateway.service || true
    ;;

  status)
    systemctl_user --no-pager --full status screenfish-backend.service screenfish-gateway.service || true
    ;;

  logs)
    target="${2:-}"
    follow="${3:-}"
    case "$target" in
      backend)
        unit="screenfish-backend.service"
        ;;
      gateway|caddy)
        unit="screenfish-gateway.service"
        ;;
      *)
        usage
        die "Unknown logs target: ${target:-<empty>}"
        ;;
    esac

    if [ "${follow:-}" = "-f" ] || [ "${follow:-}" = "--follow" ]; then
      journalctl_user -u "${unit}" -f --no-pager --output cat
    else
      journalctl_user -u "${unit}" --no-pager --output cat -n 200
    fi
    ;;

  *)
    usage
    die "Unknown command: $cmd"
    ;;
esac

