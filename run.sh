#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.game.pid"
LOG_DIR="$SCRIPT_DIR/.game-logs"
# The deploy watcher's PID lives in its own file, which stop_processes never reads: a deploy restarts
# the stack through this script and must not stop the watcher that is running the deploy (#291).
DEPLOY_WATCH_PID_FILE="$LOG_DIR/deploy-watch.pid"
SERVER_PACKAGE_DIR="$SCRIPT_DIR/packages/server"
CLIENT_PROXY_TEMPLATE="$SCRIPT_DIR/packages/client/proxy.conf.json"
CLIENT_PROXY_FILE="$LOG_DIR/proxy.conf.json"

SERVER_PORT="${PORT:-4400}"
CLIENT_PORT="${CLIENT_PORT:-4402}"

# ================================================
# Dependency checks
# ================================================

check_deps() {
  local missing=false

  if ! command -v node &>/dev/null; then
    echo "ERROR: node is not installed."
    echo "  Install Node.js >= 24: https://nodejs.org/ or use nvm:"
    echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
    echo "    nvm install 24"
    echo ""
    missing=true
  else
    local node_major
    node_major=$(node -v | sed 's/v\([0-9]*\).*/\1/')
    if (( node_major < 24 )); then
      echo "ERROR: Node.js >= 24 is required (found $(node -v))."
      echo "  Update with nvm: nvm install 24"
      echo ""
      missing=true
    fi
  fi

  if ! command -v pnpm &>/dev/null; then
    echo "ERROR: pnpm is not installed."
    echo "  Install pnpm >= 10:"
    echo "    corepack enable && corepack prepare pnpm@latest --activate"
    echo "  Or: npm install -g pnpm"
    echo "  Or: https://pnpm.io/installation"
    echo ""
    missing=true
  else
    local pnpm_major
    pnpm_major=$(pnpm -v | sed 's/\([0-9]*\).*/\1/')
    if (( pnpm_major < 10 )); then
      echo "ERROR: pnpm >= 10 is required (found $(pnpm -v))."
      echo "  Update: corepack prepare pnpm@latest --activate"
      echo "  Or: npm install -g pnpm@latest"
      echo ""
      missing=true
    fi
  fi

  if $missing; then
    echo "Fix the above and try again."
    exit 1
  fi

}

usage() {
  cat <<EOF
Evolution - run.sh

Usage: ./run.sh [OPTIONS]

Options:
  --help             Show this help message
  --install          Run pnpm install before starting
  --server-only      Start only the game server
  --client-only      Start only the client dev server
  --no-deploy-watch  Do not start the deploy watcher (scripts/deploy-main.sh --watch,
                     which redeploys this checkout whenever origin/main moves)
  --stop             Stop running processes and the deploy watcher
  --status           Check if services are running
  --logs             Tail the server, client and deploy logs

Environment variables:
  PORT            Game server port    (default: 4400)
  CLIENT_PORT     Angular client port (default: 4402)

EOF
  exit 0
}

kill_tree() {
  local pid="$1"
  # Kill all descendants first (children, grandchildren, etc.)
  local children
  children=$(pgrep -P "$pid" 2>/dev/null) || true
  for child in $children; do
    kill_tree "$child"
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null
  fi
}

stop_processes() {
  local any_stopped=false

  # 1. Kill recorded PIDs and their entire process trees
  if [[ -f "$PID_FILE" ]]; then
    while read -r pid; do
      if kill -0 "$pid" 2>/dev/null; then
        kill_tree "$pid"
        echo "    Stopped process tree for PID $pid"
        any_stopped=true
      fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi

  # 2. Kill orphaned tsx watch servers started from THIS checkout (other checkouts on the box run their own)
  local orphans
  orphans=$(pgrep -f 'tsx.*watch.*src/index\.ts' 2>/dev/null) || true
  for pid in $orphans; do
    [[ "$(readlink "/proc/$pid/cwd" 2>/dev/null)" == "$SERVER_PACKAGE_DIR" ]] || continue
    kill_tree "$pid"
    echo "    Stopped orphaned server process $pid"
    any_stopped=true
  done

  # 3. Kill whatever still listens on our ports. Listeners only: a bare `lsof -ti :PORT` also
  #    matches every client connected to the port, and has killed Claude's own connections.
  local port port_pids
  for port in "$SERVER_PORT" "$CLIENT_PORT"; do
    port_pids=$(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null) || true
    for pid in $port_pids; do
      kill "$pid" 2>/dev/null && echo "    Stopped process $pid listening on port $port"
      any_stopped=true
    done
  done

  if $any_stopped; then
    # Give processes a moment to exit
    sleep 0.5
    return 0
  fi
  return 1
}

running_deploy_watch_pid() { # prints the watcher's PID when its PID file names a live watcher
  [[ -f "$DEPLOY_WATCH_PID_FILE" ]] || return 1
  local pid
  pid="$(cat "$DEPLOY_WATCH_PID_FILE")"
  [[ "$pid" =~ ^[0-9]+$ && -r "/proc/$pid/cmdline" ]] || return 1
  tr '\0' ' ' < "/proc/$pid/cmdline" | grep -q 'deploy-main\.sh --watch' || return 1
  echo "$pid"
}

start_deploy_watch() {
  local pid
  if pid="$(running_deploy_watch_pid)"; then
    echo "==> Deploy watcher already running (PID $pid)"
    return 0
  fi
  echo "==> Starting deploy watcher (redeploys from origin/main, log: .game-logs/deploy.log)..."
  DEPLOY_TARGET_DIR="$SCRIPT_DIR" nohup "$SCRIPT_DIR/scripts/deploy-main.sh" --watch \
    > /dev/null 2>> "$LOG_DIR/deploy.log" &
  echo $! > "$DEPLOY_WATCH_PID_FILE"
}

stop_deploy_watch() {
  local pid
  pid="$(running_deploy_watch_pid)" || { rm -f "$DEPLOY_WATCH_PID_FILE"; return 1; }
  kill_tree "$pid"
  rm -f "$DEPLOY_WATCH_PID_FILE"
  echo "    Stopped deploy watcher PID $pid"
}

do_stop() {
  echo "==> Stopping Evolution..."
  local stopped=false
  stop_processes && stopped=true
  stop_deploy_watch && stopped=true
  if $stopped; then
    echo "    Done."
  else
    echo "Evolution is not running."
  fi
  exit 0
}

do_status() {
  local watch_pid
  if watch_pid="$(running_deploy_watch_pid)"; then
    echo "Deploy watcher: PID $watch_pid"
  fi

  if [[ ! -f "$PID_FILE" ]]; then
    echo "Evolution is not running."
    exit 0
  fi

  all_dead=true
  while read -r pid; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "Running: PID $pid"
      all_dead=false
    else
      echo "Dead:    PID $pid"
    fi
  done < "$PID_FILE"

  if $all_dead; then
    rm -f "$PID_FILE"
    echo "Evolution is not running (stale PID file cleaned up)."
  fi
  exit 0
}

do_logs() {
  if [[ ! -d "$LOG_DIR" ]]; then
    echo "No logs found. Is Evolution running?"
    exit 1
  fi
  tail -f "$LOG_DIR"/*.log
  exit 0
}

DO_INSTALL=false
RUN_SERVER=true
RUN_CLIENT=true
DEPLOY_WATCH=true

for arg in "$@"; do
  case "$arg" in
    --help)            usage ;;
    --stop)            do_stop ;;
    --status)          do_status ;;
    --logs)            do_logs ;;
    --install)         DO_INSTALL=true ;;
    --server-only)     RUN_CLIENT=false ;;
    --client-only)     RUN_SERVER=false ;;
    --no-deploy-watch) DEPLOY_WATCH=false ;;
    *)
      echo "Unknown option: $arg"
      echo "Run ./run.sh --help for usage."
      exit 1
      ;;
  esac
done

# Verify required tools are available before starting
check_deps

# Always clean up any existing server processes before starting (never the deploy watcher)
echo "==> Cleaning up old processes..."
if stop_processes; then
  echo "    Cleaned up old processes."
fi

if $DO_INSTALL; then
  echo "==> Installing dependencies..."
  pnpm install
fi

if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
  echo "ERROR: node_modules not found. Dependencies have not been installed."
  echo "  Run: pnpm install"
  echo "  Or:  ./run.sh --install"
  exit 1
fi

mkdir -p "$LOG_DIR"
> "$PID_FILE"

if $RUN_SERVER; then
  echo "==> Starting game server on port ${SERVER_PORT}..."
  PORT="$SERVER_PORT" pnpm dev:server > "$LOG_DIR/server.log" 2>&1 &
  echo $! >> "$PID_FILE"
fi

if $RUN_CLIENT; then
  echo "==> Starting Angular client on port ${CLIENT_PORT}..."
  # The proxy targets this run's server port rather than the one baked into proxy.conf.json
  sed -E "s#localhost:[0-9]+#localhost:${SERVER_PORT}#g" "$CLIENT_PROXY_TEMPLATE" > "$CLIENT_PROXY_FILE"
  pnpm dev:client --port "$CLIENT_PORT" --proxy-config "$CLIENT_PROXY_FILE" > "$LOG_DIR/client.log" 2>&1 &
  echo $! >> "$PID_FILE"
fi

if $DEPLOY_WATCH; then
  start_deploy_watch
fi

echo ""
echo "============================================"
echo "  Evolution is running!"
echo ""
if $RUN_SERVER; then
echo "  Server (API/WS): http://localhost:${SERVER_PORT}"
fi
if $RUN_CLIENT; then
echo "  Game URL:         http://localhost:${CLIENT_PORT}"
fi
echo ""
echo "  ./run.sh --stop     Stop the game"
echo "  ./run.sh --status   Check status"
echo "  ./run.sh --logs     Tail logs"
echo "============================================"
