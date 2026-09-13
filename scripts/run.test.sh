#!/usr/bin/env bash
# run.test.sh — exercises run.sh's process ownership (#291) on a throwaway stack: a clone of a local bare
# origin on main, with this run.sh and scripts/deploy-main.sh copied in and a fake pnpm whose dev
# servers are python listeners in packages/server and packages/client. Covered: the orphan sweep reaps
# this checkout's tsx server and spares another checkout's; the port kill stops this checkout's stale
# listener and spares another checkout's listener and a process merely connected to the port;
# --clear-prebundle runs after the stop and before the start; --wait-ready passes when both ports listen
# and fails with the log tails when they do not; the watcher starts, is not in .game.pid, survives the
# restart a deploy runs and is never started twice; --stop stops it but not another checkout's watcher
# behind a stale PID file; the client gets CLIENT_PORT and a proxy to PORT; run.env records the run; a
# one-shot scripts/deploy-main.sh of a stack without a watcher leaves exactly one.
#
#   scripts/run.test.sh        # exit 0 when every case passes
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sandbox="$(mktemp -d)"
source "$repo_root/scripts/lib/shell-test.sh"

STACK_SERVER_PORT=45910
STACK_CLIENT_PORT=45912
READY_TIMEOUT_SECONDS=30
FAILED_READY_TIMEOUT_SECONDS=2
LONG_WATCH_INTERVAL_SECONDS=3600
PROBE_LIFETIME_SECONDS=120

for port in "$STACK_SERVER_PORT" "$STACK_CLIENT_PORT"; do
  if lsof -ti :"$port" -sTCP:LISTEN >/dev/null 2>&1; then echo "run.test.sh: port $port is in use; not running"; exit 1; fi
done

# --- fixture: the stack checkout, another checkout, a fake pnpm ---------------------------------
make_origin
stack="$sandbox/stack"
other="$sandbox/other"
git clone -q "$origin" "$stack"
mkdir -p "$stack/scripts" "$stack/packages/server" "$stack/packages/client" "$stack/node_modules" \
  "$other/packages/server" "$other/scripts" "$sandbox/bin"
cp "$repo_root/run.sh" "$stack/run.sh"
cp "$repo_root/scripts/deploy-main.sh" "$stack/scripts/deploy-main.sh"
cp "$repo_root/packages/client/proxy.conf.json" "$stack/packages/client/proxy.conf.json"
pnpm_args="$sandbox/pnpm-args"
no_listen_file="$sandbox/fake-pnpm-no-listen" # when present: the fake dev servers never listen
cat > "$sandbox/bin/pnpm" <<PNPM
#!/usr/bin/env bash
[[ "\$1" != -v ]] || { echo 10.0.0; exit 0; }
echo "\$*" >> "$pnpm_args"
case "\$1" in
  dev:server) cd "$stack/packages/server"; port="\$PORT" ;;
  dev:client) cd "$stack/packages/client"; port="\$3" ;;
esac
[[ ! -e "$no_listen_file" ]] || exec sleep $PROBE_LIFETIME_SECONDS
exec python3 -m http.server "\$port" --bind 127.0.0.1
PNPM
printf '#!/usr/bin/env bash\nexec sleep %s\n' "$PROBE_LIFETIME_SECONDS" > "$other/scripts/deploy-main.sh"
chmod +x "$sandbox/bin/pnpm" "$other/scripts/deploy-main.sh"

export PATH="$sandbox/bin:$PATH" PORT="$STACK_SERVER_PORT" CLIENT_PORT="$STACK_CLIENT_PORT"
export RUN_READY_TIMEOUT_SECONDS="$READY_TIMEOUT_SECONDS" DEPLOY_WATCH_INTERVAL_SECONDS="$LONG_WATCH_INTERVAL_SECONDS"
export DEPLOY_INSTALL_COMMAND=true DEPLOY_BUILD_COMMAND=true
unset DEPLOY_TARGET_DIR DEPLOY_RUN_SCRIPT

probe_pids=()
cleanup() {
  local pid
  (cd "$stack" && ./run.sh --stop) > /dev/null 2>&1 || true
  for pid in "${probe_pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  rm -rf "$sandbox"
}
trap cleanup EXIT

# --- helpers ------------------------------------------------------------------------------------
run_stack() { # <args...> -> output in $out, exit code in $rc
  rc=0
  out="$(cd "$stack" && ./run.sh "$@" 2>&1)" || rc=$?
}
start_probe() { # <cwd> <command...> -> $probe_pid, a process running in <cwd>
  local dir="$1"
  shift
  (cd "$dir" && exec "$@") > /dev/null 2>&1 &
  probe_pid=$!
  probe_pids+=("$probe_pid")
}
start_fake_tsx() { # <cwd> -> $probe_pid, a process whose command line looks like the server's tsx watch
  (cd "$1" && exec -a 'tsx watch src/index.ts' sleep "$PROBE_LIFETIME_SECONDS") &
  probe_pid=$!
  probe_pids+=("$probe_pid")
}
alive() { kill -0 "$1" 2>/dev/null; }
listening() { lsof -ti :"$1" -sTCP:LISTEN >/dev/null 2>&1; }
connected() { lsof -a -p "$1" -i TCP -sTCP:ESTABLISHED >/dev/null 2>&1; }
watcher_pid() { cat "$stack/.game-logs/deploy-watch.pid"; }
stack_watchers() { pgrep -fc " $stack/scripts/deploy-main.sh --watch" || true; }
line_of() { grep -n -- "$1" <<<"$out" | head -n 1 | cut -d: -f1; } # <fixed text> -> its line number in $out

# --- start: sweep, port kill, prebundle, ready ---------------------------------------------------
start_probe "$stack/packages/server" python3 -m http.server "$STACK_SERVER_PORT" --bind 127.0.0.1
stale_listener="$probe_pid"
wait_for listening "$STACK_SERVER_PORT"
start_fake_tsx "$stack/packages/server"
own_orphan="$probe_pid"
start_fake_tsx "$other/packages/server"
foreign_orphan="$probe_pid"
mkdir -p "$stack/packages/client/.angular/cache/deps"

run_stack --clear-prebundle --wait-ready
check "./run.sh --wait-ready starts the stack and waits for both ports (rc $rc)" $(( rc == 0 && $(holds grep -q 'Ready: this checkout listens' <<<"$out") ))
check "the orphan sweep reaps this checkout's tsx server" $(( ! $(holds alive "$own_orphan") ))
check "the orphan sweep spares another checkout's tsx server" $(holds alive "$foreign_orphan")
check "the port kill stops this checkout's stale listener" $(( ! $(holds alive "$stale_listener") ))
check "the prebundle cache is cleared after the stop and before the start" $(( ! $(holds test -e "$stack/packages/client/.angular/cache") && $(line_of 'Cleaning up old processes') < $(line_of 'Cleared the Angular prebundle') && $(line_of 'Cleared the Angular prebundle') < $(line_of 'Starting game server') ))
check "the client is served on CLIENT_PORT with a proxy to PORT" $(( $(holds grep -q "dev:client --port $STACK_CLIENT_PORT --proxy-config $stack/.game-logs/proxy.conf.json" "$pnpm_args") && $(holds grep -q "localhost:$STACK_SERVER_PORT" "$stack/.game-logs/proxy.conf.json") ))
check "run.env records the ports and the mode" $(( $(holds grep -qx "PORT=$STACK_SERVER_PORT" "$stack/.game-logs/run.env") && $(holds grep -qx 'RUN_MODE=' "$stack/.game-logs/run.env") ))
first_watcher="$(watcher_pid)"
check "./run.sh starts the deploy watcher, and its PID is not in .game.pid" $(( $(holds alive "$first_watcher") && ! $(holds grep -qx "$first_watcher" "$stack/.game.pid") ))

run_stack --no-deploy-watch --wait-ready
check "the restart a deploy's watcher runs leaves that watcher alone" $(( rc == 0 && $(holds alive "$first_watcher") && $(holds test "$(watcher_pid)" = "$first_watcher") ))
run_stack --wait-ready
check "./run.sh with a live watcher does not start a second one" $(( rc == 0 && $(holds grep -q 'Deploy watcher already running' <<<"$out") && $(stack_watchers) == 1 ))

# --- stop: connected clients and other checkouts are spared -------------------------------------
server_listener="$(lsof -ti :"$STACK_SERVER_PORT" -sTCP:LISTEN)"
start_probe "$stack/packages/client" python3 -c "import socket, time; s = socket.create_connection(('127.0.0.1', $STACK_SERVER_PORT)); time.sleep($PROBE_LIFETIME_SECONDS)"
connected_client="$probe_pid"
wait_for connected "$connected_client"
run_stack --stop
check "--stop stops the stack and its watcher" $(( ! $(holds alive "$server_listener") && ! $(holds alive "$first_watcher") && ! $(holds test -e "$stack/.game.pid") ))
check "--stop spares a process of this checkout that is only connected to the port" $(holds alive "$connected_client")

start_probe "$other" python3 -m http.server "$STACK_SERVER_PORT" --bind 127.0.0.1
foreign_listener="$probe_pid"
wait_for listening "$STACK_SERVER_PORT"
start_probe "$other" "$other/scripts/deploy-main.sh" --watch
foreign_watcher="$probe_pid"
mkdir -p "$stack/.game-logs"
echo "$foreign_watcher" > "$stack/.game-logs/deploy-watch.pid"
run_stack --stop
check "--stop spares another checkout's listener on the port and says so" $(( $(holds alive "$foreign_listener") && $(holds grep -q "Port $STACK_SERVER_PORT is held by PID $foreign_listener" <<<"$out") ))
check "--stop spares another checkout's watcher behind a stale PID file" $(holds alive "$foreign_watcher")
kill "$foreign_listener" "$foreign_watcher"

# --- wait-ready failure -------------------------------------------------------------------------
touch "$no_listen_file"
RUN_READY_TIMEOUT_SECONDS="$FAILED_READY_TIMEOUT_SECONDS" run_stack --no-deploy-watch --wait-ready
check "--wait-ready fails with the log tails when the stack does not listen (rc $rc)" $(( rc != 0 && $(holds grep -q 'restart failed: nothing from this checkout listens' <<<"$out") && $(holds grep -q 'lines of .*server.log' <<<"$out") ))
rm "$no_listen_file"
run_stack --stop

# --- a one-shot deploy of a stack without a watcher ---------------------------------------------
run_stack --no-deploy-watch --wait-ready
merge_to_main game.txt v2
rc=0
out="$(DEPLOY_TARGET_DIR="$stack" "$stack/scripts/deploy-main.sh" 2>&1)" || rc=$?
check "a one-shot deploy restarts the stack and records the deploy (rc $rc)" $(( rc == 0 && $(holds test "$(cat "$stack/.game-logs/deployed-sha")" = "$(origin_head)") ))
check "a one-shot deploy leaves exactly one watcher running" $(( $(holds wait_for alive "$(watcher_pid)") && $(stack_watchers) == 1 ))
deployed_watcher="$(watcher_pid)"
merge_to_main game.txt v3
rc=0
out="$(DEPLOY_TARGET_DIR="$stack" "$stack/scripts/deploy-main.sh" 2>&1)" || rc=$?
check "a one-shot deploy with a watcher running does not start a second (rc $rc)" $(( rc == 0 && $(holds test "$(watcher_pid)" = "$deployed_watcher") && $(stack_watchers) == 1 ))

finish_suite run.test.sh
