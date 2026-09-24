#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/scripts/lib/workspace-ready.sh"
PID_FILE="$SCRIPT_DIR/.game.pid"
LOG_DIR="$SCRIPT_DIR/.game-logs"
PACKAGES_DIR="$SCRIPT_DIR/packages"
# The deploy watcher's PID lives in its own file, which stop_processes never reads: a deploy restarts
# the stack through this script and must not stop the watcher that is running the deploy (#291).
DEPLOY_WATCH_PID_FILE="$LOG_DIR/deploy-watch.pid"
DEPLOY_WATCH_SCRIPT="$SCRIPT_DIR/scripts/deploy-main.sh" # one word: the checkout path may contain a space
DEPLOY_WATCH_FLAG=--watch
# What this run started (ports and mode), for scripts/deploy-main.sh to restart the same stack. Both port
# names: the watcher may have inherited either from the run that started it, and sourcing both overrides it.
RUN_ENV_FILE="$LOG_DIR/run.env"
CLIENT_PROXY_TEMPLATE="$PACKAGES_DIR/client/proxy.conf.json"
CLIENT_PROXY_FILE="$LOG_DIR/proxy.conf.json"
ANGULAR_PREBUNDLE_CACHE_DIR="$PACKAGES_DIR/client/.angular/cache"
DEFAULT_READY_TIMEOUT_SECONDS=300
READY_TIMEOUT_SECONDS="${RUN_READY_TIMEOUT_SECONDS:-$DEFAULT_READY_TIMEOUT_SECONDS}"
READY_POLL_SECONDS=1
READY_LOG_TAIL_LINES=20
# wait_ready's outcomes besides ready (0)
READY_FAILED_EXITED=1
READY_FAILED_TIMEOUT=2
# How long the ports may stay held by this checkout's own stopped stack before the start refuses (#444)
DEFAULT_STOP_GRACE_SECONDS=10
STOP_GRACE_SECONDS="${RUN_STOP_GRACE_SECONDS:-$DEFAULT_STOP_GRACE_SECONDS}"
STOP_POLLS_PER_SECOND=10
STOP_POLL_SECONDS=0.1

# The server port is PORT, or SERVER_PORT as PORTS.env and the docs name it (#474); set both, they must agree
if [[ -n "${PORT:-}" && -n "${SERVER_PORT:-}" && "$PORT" != "$SERVER_PORT" ]]; then
  echo "ERROR: PORT=$PORT and SERVER_PORT=$SERVER_PORT disagree; both name the game server port. Set only one."
  exit 1
fi
SERVER_PORT="${PORT:-${SERVER_PORT:-4400}}"
CLIENT_PORT="${CLIENT_PORT:-4402}"

# PIDs already listening on this run's ports once the old stack is stopped: never the new stack
LISTENERS_BEFORE_START=" "
# What this run started, stopped again when the start fails (#444)
SERVER_PID=""
CLIENT_PID=""
# A listener of this checkout still on a needed port after the stop (find_held_port)
HELD_PORT=""
HELD_PID=""

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
  --install          Run pnpm install before starting (without it, a checkout whose node_modules does
                     not match pnpm-lock.yaml is installed, and a stale @evolution/shared is built)
  --server-only      Start only the game server
  --client-only      Start only the client dev server
  --no-deploy-watch  Do not start the deploy watcher (scripts/deploy-main.sh --watch,
                     which redeploys this checkout whenever origin/main moves)
  --clear-prebundle  Delete the Angular prebundle cache after stopping and before starting
  --wait-ready       Accepted for older callers: every start now waits until NEW listeners from this
                     checkout appear on the started ports. A server or client that exits first is a
                     failed start: what it started is stopped. A stack still not listening after the
                     ready timeout is left running (a slow client may still come up). Both exit
                     non-zero without the "running" banner, and both still start the deploy watcher,
                     so the next merge (the fix) is deployed; only a port refusal starts none
  --stop             Stop running processes and the deploy watcher
  --status           Check if services are running
  --logs             Tail the server, client and deploy logs

Environment variables:
  PORT or SERVER_PORT        Game server port    (default: 4400; SERVER_PORT as PORTS.env names it,
                             and when both are set they must be equal)
  CLIENT_PORT                Angular client port (default: 4402)
  RUN_READY_TIMEOUT_SECONDS  ready timeout (default: ${DEFAULT_READY_TIMEOUT_SECONDS})
  RUN_STOP_GRACE_SECONDS     how long the stopped stack may keep the ports (default: ${DEFAULT_STOP_GRACE_SECONDS})

A port held by another checkout (or by anything but this checkout's stack) is never taken over: the
start refuses with exit code 1 and names the holder. Pick free ports with PORT and CLIENT_PORT.

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

# True when the process runs in one of this checkout's packages. Never the checkout root, where
# agents' shells sit, and never a nested worktree (/workspace/.worktrees/... is another checkout).
owned_by_this_checkout() { # <pid>
  local cwd package
  cwd="$(readlink "/proc/$1/cwd" 2>/dev/null)" || return 1
  package="${cwd#"$PACKAGES_DIR"/}"
  [[ "$package" != "$cwd" && -n "$package" && "$package" != */* ]]
}

# PIDs listening on a port. `ss -ltnp` is the source; lsof is only the fallback when ss is missing,
# because lsof silently skips some listeners: it never reported the live `ng serve (client)` on 4402
# that ss shows, not even with `-p <pid>`.
listener_pids() { # <port>
  local listing
  if listing="$(ss -Hltnp "sport = :$1" 2>/dev/null)"; then
    grep -o 'pid=[0-9]*' <<<"$listing" | cut -d= -f2 | sort -un || true
  else
    lsof -ti :"$1" -sTCP:LISTEN 2>/dev/null || true
  fi
}

wait_until_gone() { # <pid> — at most the stop grace, so a stop returns with the process gone
  local step
  for ((step = 0; step < STOP_GRACE_SECONDS * STOP_POLLS_PER_SECOND; step++)); do
    kill -0 "$1" 2>/dev/null || return 0
    sleep "$STOP_POLL_SECONDS"
  done
}

stop_recorded_processes() { # kill recorded PIDs and their entire process trees
  local pid stopped=1
  [[ -f "$PID_FILE" ]] || return 1
  while read -r pid; do
    if kill -0 "$pid" 2>/dev/null; then
      kill_tree "$pid"
      echo "    Stopped process tree for PID $pid"
      stopped=0
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"
  return $stopped
}

stop_orphaned_servers() { # tsx watch servers of THIS checkout only (other checkouts on the box run their own)
  local pid orphans stopped=1
  orphans=$(pgrep -f 'tsx.*watch.*src/index\.ts' 2>/dev/null) || true
  for pid in $orphans; do
    owned_by_this_checkout "$pid" || continue
    kill_tree "$pid"
    echo "    Stopped orphaned server process $pid"
    stopped=0
  done
  return $stopped
}

# Listeners only: a bare `lsof -ti :PORT` also matches every client connected to the port, and has
# killed Claude's own connections. And only this checkout's: the port may be another checkout's stack.
stop_port_listeners() {
  local port pid stopped=1
  for port in "$SERVER_PORT" "$CLIENT_PORT"; do
    for pid in $(listener_pids "$port"); do
      if ! owned_by_this_checkout "$pid"; then
        echo "    Port $port is held by PID $pid ($(readlink "/proc/$pid/cwd" 2>/dev/null || echo 'cwd unknown')), not this checkout; leaving it"
        continue
      fi
      kill "$pid" 2>/dev/null && echo "    Stopped process $pid listening on port $port"
      stopped=0
    done
  done
  return $stopped
}

stop_processes() {
  local any_stopped=false
  stop_recorded_processes && any_stopped=true
  stop_orphaned_servers && any_stopped=true
  stop_port_listeners && any_stopped=true

  if $any_stopped; then
    # Give processes a moment to exit
    sleep 0.5
    return 0
  fi
  return 1
}

running_deploy_watch_pid() { # prints the watcher's PID when its PID file names THIS checkout's live watcher
  [[ -f "$DEPLOY_WATCH_PID_FILE" ]] || return 1
  local pid argument previous=""
  pid="$(cat "$DEPLOY_WATCH_PID_FILE")"
  [[ "$pid" =~ ^[0-9]+$ && -r "/proc/$pid/cmdline" ]] || return 1
  # Whole NUL-separated arguments, so a checkout path containing a space still matches exactly
  while IFS= read -r -d '' argument; do
    if [[ "$previous" == "$DEPLOY_WATCH_SCRIPT" && "$argument" == "$DEPLOY_WATCH_FLAG" ]]; then
      echo "$pid"
      return 0
    fi
    previous="$argument"
  done < "/proc/$pid/cmdline"
  return 1
}

start_deploy_watch() {
  local pid
  if pid="$(running_deploy_watch_pid)"; then
    echo "==> Deploy watcher already running (PID $pid)"
    return 0
  fi
  echo "==> Starting deploy watcher (redeploys from origin/main, log: .game-logs/deploy.log)..."
  DEPLOY_TARGET_DIR="$SCRIPT_DIR" nohup "$DEPLOY_WATCH_SCRIPT" "$DEPLOY_WATCH_FLAG" > /dev/null 2>> "$LOG_DIR/deploy.log" &
  echo $! > "$DEPLOY_WATCH_PID_FILE"
}

stop_deploy_watch() {
  local pid
  pid="$(running_deploy_watch_pid)" || { rm -f "$DEPLOY_WATCH_PID_FILE"; return 1; }
  kill_tree "$pid"
  rm -f "$DEPLOY_WATCH_PID_FILE"
  wait_until_gone "$pid"
  echo "    Stopped deploy watcher PID $pid"
}

describe_holder() { # <pid>
  echo "PID $1 ($(readlink "/proc/$1/cwd" 2>/dev/null || echo 'cwd unknown'))"
}

# The ports this run needs free of anything but its own stack: the server's, which the client also
# proxies to (so a client-only run next to another checkout's server would drive that stack), and the
# client's when it starts one.
needed_ports() {
  echo "$SERVER_PORT"
  if $RUN_CLIENT; then echo "$CLIENT_PORT"; fi
}

refuse_port() { # <port> <pid> <why> — exits: nothing was started
  echo "ERROR: port $1 is held by $(describe_holder "$2"), $3; not starting."
  echo "  Choose free ports: PORT=<server port> CLIENT_PORT=<client port> ./run.sh"
  exit 1
}

# True for a listener in another checkout (or anywhere else). Not for one whose cwd cannot be read: that
# process is exiting (a stopped server of this checkout, most likely), and the grace waits for it.
foreign_listener() { # <pid>
  readlink "/proc/$1/cwd" > /dev/null 2>&1 && ! owned_by_this_checkout "$1"
}

# Before the cleanup, so a refused start leaves this checkout's running stack alone too
refuse_foreign_port_holders() {
  local port pid
  for port in $(needed_ports); do
    for pid in $(listener_pids "$port"); do
      ! foreign_listener "$pid" || refuse_port "$port" "$pid" "not by this checkout"
    done
  done
}

# Sets HELD_PORT and HELD_PID to a remaining listener of this checkout; refuses on another checkout's
find_held_port() {
  local port pid
  for port in $(needed_ports); do
    for pid in $(listener_pids "$port"); do
      ! foreign_listener "$pid" || refuse_port "$port" "$pid" "not by this checkout"
      HELD_PORT="$port"
      HELD_PID="$pid"
      return 0
    done
  done
  return 1
}

# After the cleanup: the stopped stack gets a grace period to release the ports. This checkout's listeners
# that ignored TERM are then killed outright (owned_by_this_checkout: never another checkout's), and a
# listener that survives even that refuses the start.
refuse_held_ports_after_stop() {
  local waited=0 port pid
  find_held_port || return 0
  while (( waited < STOP_GRACE_SECONDS )); do
    sleep "$READY_POLL_SECONDS"
    waited=$((waited + READY_POLL_SECONDS))
    find_held_port || return 0
  done
  for port in $(needed_ports); do
    for pid in $(listener_pids "$port"); do
      owned_by_this_checkout "$pid" || continue
      kill -9 "$pid" 2>/dev/null && echo "    Killed process $pid on port $port: it outlived the stop by ${STOP_GRACE_SECONDS}s"
    done
  done
  sleep "$READY_POLL_SECONDS"
  find_held_port || return 0
  refuse_port "$HELD_PORT" "$HELD_PID" "still listening after the stop, the ${STOP_GRACE_SECONDS}s grace and a kill -9"
}

record_listeners_before_start() {
  local port
  LISTENERS_BEFORE_START=" "
  for port in "$SERVER_PORT" "$CLIENT_PORT"; do
    LISTENERS_BEFORE_START+="$(listener_pids "$port" | tr '\n' ' ')"
  done
}

new_listener_here() { # <port> — a listener from this checkout that was not already there before the start
  local pid
  for pid in $(listener_pids "$1"); do
    [[ "$LISTENERS_BEFORE_START" != *" $pid "* ]] || continue
    owned_by_this_checkout "$pid" && return 0
  done
  return 1
}

exited_process() { # prints the first started process that is gone, as "<name> <port>"
  if [[ -n "$SERVER_PID" ]] && ! kill -0 "$SERVER_PID" 2>/dev/null; then echo "server $SERVER_PORT"; return 0; fi
  if [[ -n "$CLIENT_PID" ]] && ! kill -0 "$CLIENT_PID" 2>/dev/null; then echo "client $CLIENT_PORT"; return 0; fi
  return 1
}

print_log_tails() {
  local log
  for log in "$LOG_DIR/server.log" "$LOG_DIR/client.log"; do
    [[ -f "$log" ]] || continue
    echo "--- last $READY_LOG_TAIL_LINES lines of $log"
    tail -n "$READY_LOG_TAIL_LINES" "$log"
  done
}

wait_ready() {
  local ports=() pending=() port waited=0 exited name
  if $RUN_SERVER; then ports+=("$SERVER_PORT"); fi
  if $RUN_CLIENT; then ports+=("$CLIENT_PORT"); fi
  while true; do
    pending=()
    for port in "${ports[@]}"; do new_listener_here "$port" || pending+=("$port"); done
    if [[ ${#pending[@]} -eq 0 ]]; then
      echo "==> Ready: this checkout listens on ${ports[*]}"
      return 0
    fi
    if exited="$(exited_process)"; then
      read -r name port <<<"$exited"
      echo "start failed: the $name exited before listening on port $port"
      print_log_tails
      return "$READY_FAILED_EXITED"
    fi
    (( waited < READY_TIMEOUT_SECONDS )) || break
    sleep "$READY_POLL_SECONDS"
    waited=$((waited + READY_POLL_SECONDS))
  done
  echo "start failed: not ready after ${READY_TIMEOUT_SECONDS}s, no new listener from this checkout on port ${pending[*]}; left running (./run.sh --stop stops it)"
  for port in "${pending[@]}"; do
    echo "    port $port listeners now: $(listener_pids "$port" | tr '\n' ' ')(already there before the start:${LISTENERS_BEFORE_START})"
  done
  print_log_tails
  return "$READY_FAILED_TIMEOUT"
}

stop_started_processes() { # a failed start leaves nothing of its own running
  echo "==> Stopping what this start launched..."
  stop_recorded_processes || true
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
RUN_MODE=""
DEPLOY_WATCH=true
CLEAR_PREBUNDLE=false

for arg in "$@"; do
  case "$arg" in
    --help)            usage ;;
    --stop)            do_stop ;;
    --status)          do_status ;;
    --logs)            do_logs ;;
    --install)         DO_INSTALL=true ;;
    --server-only)     RUN_CLIENT=false; RUN_MODE="$arg" ;;
    --client-only)     RUN_SERVER=false; RUN_MODE="$arg" ;;
    --no-deploy-watch) DEPLOY_WATCH=false ;;
    --clear-prebundle) CLEAR_PREBUNDLE=true ;;
    --wait-ready)      ;; # the default since #444
    *)
      echo "Unknown option: $arg"
      echo "Run ./run.sh --help for usage."
      exit 1
      ;;
  esac
done

# Verify required tools are available before starting
check_deps

if $DO_INSTALL; then
  echo "==> Installing dependencies..."
  pnpm install
fi

# A fresh worktree or a merge: install when node_modules does not match the lockfile, build shared when
# stale. Before the cleanup, so the running stack keeps serving meanwhile and a failure (or a timed-out
# wait on this checkout's setup lock) leaves it up. Never waits on another worktree's gate.
workspace_ensure_ready "$SCRIPT_DIR" "==>" continue || exit 1

# Never start beside another checkout's listener: this run would drive (or proxy to) its stack (#444)
refuse_foreign_port_holders

# Always clean up any existing server processes before starting (never the deploy watcher)
echo "==> Cleaning up old processes..."
if stop_processes; then
  echo "    Cleaned up old processes."
fi
refuse_held_ports_after_stop

if $CLEAR_PREBUNDLE; then
  # After the old stack is down, so no old dev server writes into the fresh cache
  rm -rf "$ANGULAR_PREBUNDLE_CACHE_DIR"
  echo "==> Cleared the Angular prebundle cache"
fi

mkdir -p "$LOG_DIR"
> "$PID_FILE"
printf 'PORT=%s\nSERVER_PORT=%s\nCLIENT_PORT=%s\nRUN_MODE=%s\n' "$SERVER_PORT" "$SERVER_PORT" "$CLIENT_PORT" "$RUN_MODE" > "$RUN_ENV_FILE"
record_listeners_before_start

if $RUN_SERVER; then
  echo "==> Starting game server on port ${SERVER_PORT}..."
  PORT="$SERVER_PORT" pnpm dev:server > "$LOG_DIR/server.log" 2>&1 &
  SERVER_PID=$!
  echo "$SERVER_PID" >> "$PID_FILE"
fi

if $RUN_CLIENT; then
  echo "==> Starting Angular client on port ${CLIENT_PORT}..."
  # The proxy targets this run's server port rather than the one baked into proxy.conf.json
  sed -E "s#localhost:[0-9]+#localhost:${SERVER_PORT}#g" "$CLIENT_PROXY_TEMPLATE" > "$CLIENT_PROXY_FILE"
  pnpm dev:client --port "$CLIENT_PORT" --proxy-config "$CLIENT_PROXY_FILE" > "$LOG_DIR/client.log" 2>&1 &
  CLIENT_PID=$!
  echo "$CLIENT_PID" >> "$PID_FILE"
fi

ready_outcome=0
wait_ready || ready_outcome=$?
# A timed-out stack is left running: a slow client on a loaded box may still come up
if [[ $ready_outcome -eq $READY_FAILED_EXITED ]]; then
  stop_started_processes
fi

# Even after a failed start, so the next merge (the fix) is deployed; only a port refusal starts none
if $DEPLOY_WATCH; then
  start_deploy_watch
fi

[[ $ready_outcome -eq 0 ]] || exit 1

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
