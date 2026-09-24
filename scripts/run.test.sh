#!/usr/bin/env bash
# run.test.sh — exercises run.sh's process ownership (#291) on a throwaway stack: a clone of a local bare
# origin on main, in a directory whose path contains a space, with this run.sh and scripts/deploy-main.sh
# copied in. A fake pnpm runs python listeners in packages/server and packages/client. A fake `ss` passes
# through to the real one and can add stubbed listener lines or fail (to force the lsof fallback). A fake
# `lsof` is BLIND to listeners, as this box's lsof is to the human's live `ng serve`, except in the
# fallback case, so every port kill and --wait-ready below finds real listeners through ss alone.
# Covered: the watcher starts from a path containing a space; the orphan sweep reaps this checkout's tsx
# server and spares another checkout's; the port kill stops this checkout's stale and lsof-invisible
# listeners and spares another checkout's listener and a process merely connected to the port; lsof is
# the fallback without ss; --clear-prebundle runs after the stop and before the start; --wait-ready
# passes when both ports get NEW listeners and fails with the log tails when they do not, including when
# only a listener from before the start (one that ignored the stop) holds the port; the watcher is not in
# .game.pid, survives the restart a deploy runs and is never started twice; --stop stops it but not
# another checkout's watcher behind a stale PID file; the client gets CLIENT_PORT and a proxy to PORT;
# run.env records the run; a one-shot scripts/deploy-main.sh of a stack without a watcher leaves one;
# a checkout without node_modules or a shared build is installed and built before the start, and a ready
# one is neither (#329); that setup runs before the cleanup, so a failed install leaves the running stack
# serving; a deploy whose setup has work completes while another checkout holds the machine-wide gate lock;
# a setup waiting on this checkout's own setup lock past its timeout fails loudly and leaves the stack up.
# Refused and failed starts (#444): a port held by another checkout refuses the start (non-zero, naming the
# port and the holder, no banner, nothing started, this checkout's running stack left alone), and so does a
# client-only start beside another checkout's server, and neither starts a watcher; a listener of this
# checkout that releases the port within the grace is waited for, one that ignores TERM is killed after it;
# a server that exits on start fails fast and stops the client it started; a stack not ready in time is
# left running; both failures still start the watcher, so the fix merge deploys; every start waits for
# its listeners, --wait-ready or not. SERVER_PORT is an alias of PORT (#474): alone it sets the server port,
# equal to PORT it starts, different from PORT it refuses the start (not --help or --status); run.env records both, and the usage names both.
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
SETUP_LOCK_TIMEOUT_SECONDS=1
STOP_GRACE_SECONDS=1
TERM_LINGER_SECONDS=2  # a listener that takes this long to exit after TERM...
LINGER_GRACE_SECONDS=6 # ...within this grace
REAL_SS="$(command -v ss)"
REAL_LSOF="$(command -v lsof)"

ss_pids() { "$REAL_SS" -Hltnp "sport = :$1" | grep -o 'pid=[0-9]*' | cut -d= -f2 || true; } # <port>
for port in "$STACK_SERVER_PORT" "$STACK_CLIENT_PORT"; do
  if [[ -n "$(ss_pids "$port")" ]]; then echo "run.test.sh: port $port is in use; not running"; exit 1; fi
done

# --- fixture: the stack checkout, another checkout, fake pnpm / ss / lsof -----------------------
make_origin
stack="$sandbox/stack checkout" # the space is deliberate: run.sh must quote the checkout path
other="$sandbox/other"
git clone -q "$origin" "$stack"
mkdir -p "$stack/scripts/lib" "$stack/packages/server" "$stack/packages/client" "$stack/node_modules/.pnpm" \
  "$other/packages/server" "$other/scripts" "$sandbox/bin"
cp "$stack/pnpm-lock.yaml" "$stack/node_modules/.pnpm/lock.yaml" # installed from the lockfile
cp "$repo_root/run.sh" "$stack/run.sh"
cp "$repo_root/scripts/lib/workspace-ready.sh" "$stack/scripts/lib/workspace-ready.sh"
cp "$repo_root/scripts/deploy-main.sh" "$stack/scripts/deploy-main.sh"
cp "$repo_root/packages/client/proxy.conf.json" "$stack/packages/client/proxy.conf.json"
pnpm_args="$sandbox/pnpm-args"
no_listen_file="$sandbox/fake-pnpm-no-listen" # when present: the fake dev servers never listen
install_fail_file="$sandbox/fake-pnpm-install-fails" # when present: the fake pnpm install fails
server_dies_file="$sandbox/fake-pnpm-server-dies" # when present: the fake dev server exits on start
ss_stub_file="$sandbox/ss-stub"               # "<port> <pid>" lines the fake ss reports as listeners
ss_fail_file="$sandbox/ss-fail"               # when present: the fake ss fails, as if missing
lsof_sees_file="$sandbox/lsof-sees"           # when present: the fake lsof sees listeners (the fallback case)
: > "$ss_stub_file"
cat > "$sandbox/bin/pnpm" <<PNPM
#!/usr/bin/env bash
[[ "\$1" != -v ]] || { echo 10.0.0; exit 0; }
echo "\$*" >> "$pnpm_args"
case "\$1" in
  install) [[ ! -e "$install_fail_file" ]] || exit 1; mkdir -p node_modules/.pnpm && cp pnpm-lock.yaml node_modules/.pnpm/lock.yaml; exit 0 ;;
  --filter) mkdir -p packages/shared/dist && touch packages/shared/dist/index.d.ts packages/shared/tsconfig.build.tsbuildinfo; exit 0 ;;
esac
case "\$1" in
  dev:server) [[ ! -e "$server_dies_file" ]] || { echo 'server crashed on start'; exit 1; }; cd "$stack/packages/server"; port="\$PORT" ;;
  dev:client) cd "$stack/packages/client"; port="\$3" ;;
esac
[[ ! -e "$no_listen_file" ]] || exec sleep $PROBE_LIFETIME_SECONDS
exec python3 -m http.server "\$port" --bind 127.0.0.1
PNPM
cat > "$sandbox/bin/ss" <<SS
#!/usr/bin/env bash
[[ ! -e "$ss_fail_file" ]] || exit 1
"$REAL_SS" "\$@"
port="\${!#}"
port="\${port##*:}"
while read -r stub_port stub_pid; do
  [[ "\$stub_port" != "\$port" ]] || echo "LISTEN 0 511 0.0.0.0:\$stub_port 0.0.0.0:* users:((\"stub\",pid=\$stub_pid,fd=3))"
done < "$ss_stub_file"
exit 0
SS
cat > "$sandbox/bin/lsof" <<LSOF
#!/usr/bin/env bash
[[ ! -e "$lsof_sees_file" ]] || exec "$REAL_LSOF" "\$@"
exit 1
LSOF
printf '#!/usr/bin/env bash\nexec sleep %s\n' "$PROBE_LIFETIME_SECONDS" > "$other/scripts/deploy-main.sh"
chmod +x "$sandbox/bin/pnpm" "$sandbox/bin/ss" "$sandbox/bin/lsof" "$other/scripts/deploy-main.sh"

mkdir -p "$sandbox/home" # the gate lock lives under $HOME/.cache
export PATH="$sandbox/bin:$PATH" PORT="$STACK_SERVER_PORT" CLIENT_PORT="$STACK_CLIENT_PORT" HOME="$sandbox/home"
export RUN_READY_TIMEOUT_SECONDS="$READY_TIMEOUT_SECONDS" DEPLOY_WATCH_INTERVAL_SECONDS="$LONG_WATCH_INTERVAL_SECONDS"
export RUN_STOP_GRACE_SECONDS="$STOP_GRACE_SECONDS"
unset DEPLOY_TARGET_DIR DEPLOY_RUN_SCRIPT DEPLOY_SETUP_COMMAND WORKSPACE_SETUP_LOCK_TIMEOUT_SECONDS # the real setup, on the fake pnpm

probe_pids=()
cleanup() {
  local pid
  rm -f "$ss_fail_file"
  : > "$ss_stub_file"
  (cd "$stack" && ./run.sh --stop) > /dev/null 2>&1 || true
  for pid in "${probe_pids[@]}"; do kill -9 "$pid" 2>/dev/null || true; done
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
start_term_listener() { # <cwd> <port> <seconds to linger after TERM | ignore> -> $probe_pid
  start_probe "$1" python3 -c '
import signal, socket, sys, time
server = socket.socket()
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind(("127.0.0.1", int(sys.argv[1])))
server.listen()
def linger(*_):
    time.sleep(float(sys.argv[2]))
    sys.exit(0)
signal.signal(signal.SIGTERM, signal.SIG_IGN if sys.argv[2] == "ignore" else linger)
time.sleep(float(sys.argv[3]))
' "$2" "$3" "$PROBE_LIFETIME_SECONDS"
}
alive() { kill -0 "$1" 2>/dev/null; }
all_recorded_alive() { # every PID in .game.pid is running
  local pid
  [[ -s "$stack/.game.pid" ]] || return 1
  while read -r pid; do alive "$pid" || return 1; done < "$stack/.game.pid"
}
listening() { [[ -n "$(ss_pids "$1")" ]]; }
connected() { "$REAL_LSOF" -a -p "$1" -i TCP -sTCP:ESTABLISHED >/dev/null 2>&1; }
# grep without -q in a pipe: under pipefail, -q exits at the first match and the SIGPIPE'd writer fails the pipe
real_lsof_sees() { "$REAL_LSOF" -ti :"$1" -sTCP:LISTEN 2>/dev/null | grep -x "$2" > /dev/null; } # <port> <pid>
fake_lsof_sees_a_listener() { [[ -n "$(lsof -ti :"$1" -sTCP:LISTEN 2>/dev/null)" ]]; } # <port>
watcher_pid() { cat "$stack/.game-logs/deploy-watch.pid"; }
# The watcher runs the script, not the nohup it was started through: --stop only stops the former
watcher_running() { runs_script "$(watcher_pid)" --watch; }
watcher_polled() { sed -n "/(pid $1)\$/,\$p" "$stack/.game-logs/deploy.log" | grep -e 'skipping$' -e 'nothing to do$' > /dev/null; } # <pid>
stack_watchers() { pgrep -fc " $stack/scripts/deploy-main.sh --watch" || true; }
runs_script() { tr '\0' '\n' < "/proc/$1/cmdline" | grep -xF -- "$2" > /dev/null; } # <pid> <whole argument>
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
check "the fake lsof is blind to a real listener that ss sees" $(( ! $(holds fake_lsof_sees_a_listener "$STACK_SERVER_PORT") && $(holds listening "$STACK_SERVER_PORT") ))

run_stack --clear-prebundle --wait-ready
check "./run.sh --wait-ready starts the stack and finds both new listeners through ss alone (rc $rc)" $(( rc == 0 && $(holds grep -q 'Ready: this checkout listens' <<<"$out") && $(holds grep -q 'Evolution is running!' <<<"$out") ))
check "the orphan sweep reaps this checkout's tsx server" $(( ! $(holds alive "$own_orphan") ))
check "the orphan sweep spares another checkout's tsx server" $(holds alive "$foreign_orphan")
check "the port kill stops this checkout's stale listener that lsof cannot see" $(( ! $(holds alive "$stale_listener") ))
check "the prebundle cache is cleared after the stop and before the start" $(( ! $(holds test -e "$stack/packages/client/.angular/cache") && $(line_of 'Cleaning up old processes') < $(line_of 'Cleared the Angular prebundle') && $(line_of 'Cleared the Angular prebundle') < $(line_of 'Starting game server') ))
check "the client is served on CLIENT_PORT with a proxy to PORT" $(( $(holds grep -qF "dev:client --port $STACK_CLIENT_PORT --proxy-config $stack/.game-logs/proxy.conf.json" "$pnpm_args") && $(holds grep -q "localhost:$STACK_SERVER_PORT" "$stack/.game-logs/proxy.conf.json") ))
check "run.env records the ports and the mode" $(( $(holds grep -qx "PORT=$STACK_SERVER_PORT" "$stack/.game-logs/run.env") && $(holds grep -qx 'RUN_MODE=' "$stack/.game-logs/run.env") ))
first_watcher="$(watcher_pid)"
check "./run.sh starts the deploy watcher, and its PID is not in .game.pid" $(( $(holds alive "$first_watcher") && ! $(holds grep -qx "$first_watcher" "$stack/.game.pid") ))
check "the watcher runs the script at a checkout path containing a space, as one argument" $(( $(holds runs_script "$first_watcher" "$stack/scripts/deploy-main.sh") && $(holds runs_script "$first_watcher" --watch) ))

run_stack --no-deploy-watch --wait-ready
check "the restart a deploy's watcher runs leaves that watcher alone" $(( rc == 0 && $(holds alive "$first_watcher") && $(holds test "$(watcher_pid)" = "$first_watcher") ))
run_stack --wait-ready
check "./run.sh with a live watcher (at a path with a space) does not start a second one" $(( rc == 0 && $(holds grep -q 'Deploy watcher already running' <<<"$out") && $(stack_watchers) == 1 ))

# --- stop: connected clients and other checkouts are spared -------------------------------------
server_listener="$(ss_pids "$STACK_SERVER_PORT")"
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

# --- the listener source: ss first, lsof only without ss -----------------------------------------
start_probe "$stack/packages/client" sleep "$PROBE_LIFETIME_SECONDS"
invisible_listener="$probe_pid"
start_probe "$other" sleep "$PROBE_LIFETIME_SECONDS"
invisible_foreign_listener="$probe_pid"
printf '%s %s\n%s %s\n' "$STACK_CLIENT_PORT" "$invisible_listener" "$STACK_SERVER_PORT" "$invisible_foreign_listener" > "$ss_stub_file"
run_stack --stop
check "a listener only ss reports is stopped when it is this checkout's" $(( ! $(holds real_lsof_sees "$STACK_CLIENT_PORT" "$invisible_listener") && ! $(holds alive "$invisible_listener") ))
check "a listener only ss reports is spared when it is another checkout's" $(( $(holds alive "$invisible_foreign_listener") && $(holds grep -q "held by PID $invisible_foreign_listener" <<<"$out") ))
: > "$ss_stub_file"
kill "$invisible_foreign_listener"

start_probe "$stack/packages/server" python3 -m http.server "$STACK_SERVER_PORT" --bind 127.0.0.1
fallback_listener="$probe_pid"
wait_for listening "$STACK_SERVER_PORT"
touch "$ss_fail_file" "$lsof_sees_file"
run_stack --stop
rm "$ss_fail_file" "$lsof_sees_file"
check "without ss, lsof is the fallback that still finds this checkout's listener" $(( ! $(holds alive "$fallback_listener") ))

# --- wait-ready failures ------------------------------------------------------------------------
touch "$no_listen_file"
RUN_READY_TIMEOUT_SECONDS="$FAILED_READY_TIMEOUT_SECONDS" run_stack --wait-ready
check "--wait-ready fails with the log tails when the stack does not listen (rc $rc)" $(( rc != 0 && $(holds grep -q "start failed: not ready after ${FAILED_READY_TIMEOUT_SECONDS}s, no new listener from this checkout.*left running" <<<"$out") && $(holds grep -q 'lines of .*server.log' <<<"$out") ))
check "a stack that is not ready in time is left running, without the banner" $(( $(holds all_recorded_alive) && ! $(holds grep -q 'Evolution is running' <<<"$out") ))
check "a stack that is not ready in time still starts the deploy watcher" $(holds wait_for watcher_running)
rm "$no_listen_file"
run_stack --stop

# --- the stopped stack's grace: a slow release is waited for, an ignored TERM is killed -----------
start_term_listener "$stack/packages/server" "$STACK_SERVER_PORT" "$TERM_LINGER_SECONDS"
slow_listener="$probe_pid"
wait_for listening "$STACK_SERVER_PORT"
RUN_STOP_GRACE_SECONDS="$LINGER_GRACE_SECONDS" run_stack --server-only --no-deploy-watch
check "a listener of this checkout that releases the port within the grace is waited for (rc $rc)" $(( rc == 0 && ! $(holds alive "$slow_listener") && ! $(holds grep -q 'Killed process' <<<"$out") && $(holds grep -q 'Ready: this checkout listens' <<<"$out") ))
run_stack --stop

start_term_listener "$stack/packages/client" "$STACK_CLIENT_PORT" ignore
deaf_listener="$probe_pid"
wait_for listening "$STACK_CLIENT_PORT"
{ # run.sh kill -9s it: stderr off here, so bash prints no job-control "Killed" line when it reaps it
  run_stack --client-only --no-deploy-watch
  deaf_listener_killed="$(holds grep -q "Killed process $deaf_listener on port $STACK_CLIENT_PORT: it outlived the stop by ${STOP_GRACE_SECONDS}s" <<<"$out")"
  [[ $deaf_listener_killed -eq 0 ]] || wait "$deaf_listener" || true
} 2>/dev/null
check "a listener of this checkout that ignores TERM is killed after the grace and the start proceeds (rc $rc)" $(( rc == 0 && deaf_listener_killed && ! $(holds alive "$deaf_listener") ))
run_stack --stop

# --- refused and failed starts (#444) -----------------------------------------------------------
start_probe "$other" python3 -m http.server "$STACK_SERVER_PORT" --bind 127.0.0.1
foreign_server="$probe_pid"
wait_for listening "$STACK_SERVER_PORT"
: > "$pnpm_args"
run_stack
check "a start beside another checkout's server fails, naming the port and the holder (rc $rc)" $(( rc != 0 && $(holds grep -qF "port $STACK_SERVER_PORT is held by PID $foreign_server ($other), not by this checkout; not starting" <<<"$out") && ! $(holds grep -q 'Evolution is running' <<<"$out") ))
check "the refused start started nothing, no watcher either, and left the other checkout's server up" $(( ! $(holds grep -q 'dev:' "$pnpm_args") && ! $(holds listening "$STACK_CLIENT_PORT") && ! $(holds test -e "$stack/.game-logs/deploy-watch.pid") && $(holds alive "$foreign_server") ))
run_stack --client-only --no-deploy-watch
check "a client-only start refuses to proxy to another checkout's server (rc $rc)" $(( rc != 0 && $(holds grep -q "port $STACK_SERVER_PORT is held by PID $foreign_server" <<<"$out") && ! $(holds grep -q 'dev:' "$pnpm_args") ))
kill "$foreign_server"
wait_for eval '! listening "$STACK_SERVER_PORT"'

run_stack --server-only --no-deploy-watch
own_server="$(ss_pids "$STACK_SERVER_PORT")"
start_probe "$other" python3 -m http.server "$STACK_CLIENT_PORT" --bind 127.0.0.1
foreign_client="$probe_pid"
wait_for listening "$STACK_CLIENT_PORT"
run_stack --no-deploy-watch
check "a start refused over the client port leaves this checkout's running server alone (rc $rc)" $(( rc != 0 && $(holds grep -q "port $STACK_CLIENT_PORT is held by PID $foreign_client" <<<"$out") && $(holds alive "$own_server") && ! $(holds grep -q 'Cleaning up old processes' <<<"$out") ))
kill "$foreign_client"
run_stack --stop

touch "$server_dies_file"
start_seconds=$SECONDS
run_stack
rm "$server_dies_file"
check "a server that exits on start fails the start before the ready timeout, without the banner (rc $rc)" $(( rc != 0 && $(holds grep -q "start failed: the server exited before listening on port $STACK_SERVER_PORT" <<<"$out") && $(holds grep -q 'server crashed on start' <<<"$out") && SECONDS - start_seconds < READY_TIMEOUT_SECONDS && ! $(holds grep -q 'Evolution is running' <<<"$out") ))
check "the failed start stops the client it started and still starts the deploy watcher" $(( $(holds wait_for eval '! listening "$STACK_CLIENT_PORT"') && ! $(holds test -e "$stack/.game.pid") && $(holds wait_for watcher_running) ))
run_stack --stop

# --- SERVER_PORT, PORTS.env's name for the server port, is an alias of PORT (#474) ---------------
SERVER_PORT="$STACK_CLIENT_PORT" run_stack --status
check "--status is not refused over PORT and SERVER_PORT disagreeing (rc $rc)" $(( rc == 0 && ! $(holds grep -q disagree <<<"$out") ))
SERVER_PORT="$STACK_CLIENT_PORT" run_stack --help
check "the usage text names PORT, SERVER_PORT and CLIENT_PORT, whatever they are set to (rc $rc)" $(( rc == 0 && $(holds grep -q '^  PORT or SERVER_PORT ' <<<"$out") && $(holds grep -q '^  CLIENT_PORT ' <<<"$out") ))
unset PORT
: > "$pnpm_args"
SERVER_PORT="$STACK_SERVER_PORT" run_stack --server-only --no-deploy-watch
check "SERVER_PORT without PORT starts the server on SERVER_PORT (rc $rc)" $(( rc == 0 && $(holds listening "$STACK_SERVER_PORT") && $(holds grep -qx "SERVER_PORT=$STACK_SERVER_PORT" "$stack/.game-logs/run.env") && $(holds grep -qx "PORT=$STACK_SERVER_PORT" "$stack/.game-logs/run.env") ))
run_stack --stop
export PORT="$STACK_SERVER_PORT"
: > "$pnpm_args"
SERVER_PORT="$STACK_CLIENT_PORT" run_stack --server-only --no-deploy-watch
check "PORT and SERVER_PORT set to different ports refuse the start, naming both (rc $rc)" $(( rc != 0 && $(holds grep -qF "PORT=$STACK_SERVER_PORT and SERVER_PORT=$STACK_CLIENT_PORT disagree" <<<"$out") && ! $(holds grep -q 'dev:' "$pnpm_args") && ! $(holds listening "$STACK_SERVER_PORT") ))
SERVER_PORT="$STACK_SERVER_PORT" run_stack --server-only --no-deploy-watch
check "PORT and SERVER_PORT set to the same port start the server there (rc $rc)" $(( rc == 0 && $(holds listening "$STACK_SERVER_PORT") ))
run_stack --stop

# --- a one-shot deploy of a stack without a watcher ---------------------------------------------
run_stack --no-deploy-watch --wait-ready
merge_to_main game.txt v2
rc=0
out="$(DEPLOY_TARGET_DIR="$stack" "$stack/scripts/deploy-main.sh" 2>&1)" || rc=$?
check "a one-shot deploy restarts the stack and records the deploy (rc $rc)" $(( rc == 0 && $(holds test "$(cat "$stack/.game-logs/deployed-sha")" = "$(origin_head)") ))
# run.sh starts the watcher once the stack serves, just before the deploy ends. Its first poll must be over
# before the count (its command substitutions are forked copies that pgrep counts too) and before the next
# merge (or it deploys that merge itself, beside the one-shot deploy below).
check "a one-shot deploy leaves exactly one watcher running" $(( $(holds wait_for watcher_polled "$(watcher_pid)") && $(stack_watchers) == 1 ))
deployed_watcher="$(watcher_pid)"
merge_to_main game.txt v3
rc=0
out="$(DEPLOY_TARGET_DIR="$stack" "$stack/scripts/deploy-main.sh" 2>&1)" || rc=$?
check "a one-shot deploy with a watcher running does not start a second (rc $rc)" $(( rc == 0 && $(holds test "$(watcher_pid)" = "$deployed_watcher") && $(stack_watchers) == 1 ))

# --- a fresh worktree (#329): install and shared build before the start, nothing once ready -------
mkdir -p "$stack/packages/shared/src"
touch "$stack/packages/shared/src/index.ts"
rm -rf "$stack/node_modules"
: > "$pnpm_args"
run_stack --server-only --no-deploy-watch --wait-ready
check "a checkout without node_modules or a shared build installs, then builds, before the start (rc $rc)" $(( rc == 0 && $(holds grep -qx 'install --frozen-lockfile --prefer-offline' "$pnpm_args") && $(holds grep -qx -- '--filter @evolution/shared build' "$pnpm_args") && $(line_of 'installing dependencies') < $(line_of 'building @evolution/shared (no packages/shared/dist/index.d.ts)') && $(line_of 'building @evolution/shared') < $(line_of 'Starting game server') ))
: > "$pnpm_args"
run_stack --server-only --no-deploy-watch --wait-ready
check "a ready checkout starts without installing or building (rc $rc)" $(( rc == 0 && ! $(holds grep -q 'install\|--filter' "$pnpm_args") ))

running_server="$(ss_pids "$STACK_SERVER_PORT")"
rm "$stack/node_modules/.pnpm/lock.yaml"
touch "$install_fail_file"
run_stack --server-only --no-deploy-watch --wait-ready
rm "$install_fail_file"
check "a failed setup exits before the cleanup and leaves the running stack serving (rc $rc)" $(( rc != 0 && $(holds grep -q 'the dependency install failed' <<<"$out") && ! $(holds grep -q 'Cleaning up old processes' <<<"$out") && $(holds alive "$running_server") ))

lock_held() { ! flock -n "$1" true; } # <lock file>
hold_lock() { # <lock file> -> $probe_pid, a process holding the lock until killed
  start_probe "$sandbox" bash -c 'exec 8>>"$1"; flock 8; exec sleep "$2"' _ "$1" "$PROBE_LIFETIME_SECONDS"
  wait_for lock_held "$1"
}

# Another checkout's validate.sh holds the machine-wide gate lock: a deploy's setup and restart never wait on it.
gate_lock="$HOME/.cache/$(basename "$stack")-validate/gate.lock"
mkdir -p "$(dirname "$gate_lock")"
hold_lock "$gate_lock"
gate_holder="$probe_pid"
merge_to_main game.txt v4
: > "$pnpm_args"
rc=0
out="$(DEPLOY_TARGET_DIR="$stack" "$stack/scripts/deploy-main.sh" 2>&1)" || rc=$?
check "a deploy whose setup has work completes while another checkout holds the gate lock (rc $rc)" $(( rc == 0 && $(holds test "$(cat "$stack/.game-logs/deployed-sha")" = "$(origin_head)") && $(holds grep -qx 'install --frozen-lockfile --prefer-offline' "$pnpm_args") && ! $(holds grep -q 'waiting for another' "$stack/.game-logs/deploy.log") ))
kill "$gate_holder"

# Another setup of THIS checkout holds its setup lock: the wait is bounded and fails loudly.
setup_lock="$(git -C "$stack" rev-parse --absolute-git-dir)/workspace-setup.lock"
hold_lock "$setup_lock"
setup_holder="$probe_pid"
rm "$stack/node_modules/.pnpm/lock.yaml"
running_server="$(ss_pids "$STACK_SERVER_PORT")"
WORKSPACE_SETUP_LOCK_TIMEOUT_SECONDS="$SETUP_LOCK_TIMEOUT_SECONDS" run_stack --server-only --no-deploy-watch --wait-ready
check "a setup waiting past its timeout on this checkout's setup lock fails loudly and leaves the stack serving (rc $rc)" $(( rc != 0 && $(holds grep -q "waiting for another setup of this checkout" <<<"$out") && $(holds grep -q "timed out after ${SETUP_LOCK_TIMEOUT_SECONDS}s waiting for another setup of this checkout" <<<"$out") && ! $(holds grep -q 'Cleaning up old processes' <<<"$out") && $(holds alive "$running_server") ))
kill "$setup_holder"
wait_for eval '! lock_held "$setup_lock"'
: > "$pnpm_args"
run_stack --server-only --no-deploy-watch --wait-ready
check "once the other setup is done the next start installs and starts (rc $rc)" $(( rc == 0 && $(holds grep -qx 'install --frozen-lockfile --prefer-offline' "$pnpm_args") ))
run_stack --stop

finish_suite run.test.sh
