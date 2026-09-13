#!/usr/bin/env bash
# deploy-main.test.sh — exercises scripts/deploy-main.sh (#291) against a throwaway target clone of a
# local bare "origin", with the install / build / restart steps stubbed to append to a calls file so no
# server starts: a no-op on the same SHA; a fast-forward that builds, clears the Angular prebundle cache
# and restarts, logging every step with an ISO timestamp; install only when the lockfile changed;
# untracked files allowed; refusal on tracked changes, off main and on a diverged branch; a failed step
# retried by the next run; a held lock skips; a server the restart leaves running does not keep the
# lock; --watch deploys a new commit, re-executes itself and logs a repeated refusal once.
# Then run.sh's process ownership, with a fake pnpm: ./run.sh starts the watcher, the restart a deploy
# runs (./run.sh --no-deploy-watch) leaves it alone, ./run.sh --stop stops it, and the client gets the
# run's ports.
#
#   scripts/deploy-main.test.sh        # exit 0 when every case passes
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
deploy="$repo_root/scripts/deploy-main.sh"
sandbox="$(mktemp -d)"
started_pids=()
cleanup() {
  local pid
  for pid in "${started_pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  rm -rf "$sandbox"
}
trap cleanup EXIT

WATCH_INTERVAL_SECONDS=1
WAIT_STEPS_MAX=100 # x 0.2 s
ISO_TIMESTAMP_PATTERN='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2} '
EXIT_REFUSED=2
EXIT_FAILED=3
STUB_BUILD_FAILURE_EXIT=7

git_as_test() { git -c user.name=test -c user.email=test@example.com "$@"; }

# --- fixture: a bare origin, an author clone that "merges" to main, the target checkout -----------
origin="$sandbox/origin.git"
author="$sandbox/author"
target="$sandbox/target"
calls="$sandbox/calls"
git init -q --bare -b main "$origin"
git init -q -b main "$author"
git -C "$author" remote add origin "$origin"
printf '.game-logs/\n.angular/\n' > "$author/.gitignore"
echo 'lockfileVersion: 1' > "$author/pnpm-lock.yaml"
echo v1 > "$author/game.txt"
git -C "$author" add -A
git_as_test -C "$author" commit -q -m v1
git -C "$author" push -q -u origin main
git clone -q "$origin" "$target"

export DEPLOY_TARGET_DIR="$target"
export DEPLOY_INSTALL_COMMAND="echo install >> '$calls'"
export DEPLOY_BUILD_COMMAND="echo build >> '$calls'"
export DEPLOY_RESTART_COMMAND="echo restart >> '$calls'"
deploy_log="$target/.game-logs/deploy.log"
deployed_sha_file="$target/.game-logs/deployed-sha"
prebundle_cache="$target/packages/client/.angular/cache"

# --- helpers ------------------------------------------------------------------------------------
failures=0
check() { # <description> <arithmetic-truth: 1 passes, 0 fails>
  if [[ "$2" -ne 0 ]]; then echo "ok   $1"; else echo "FAIL $1"; failures=$((failures + 1)); fi
}
merge_to_main() { # <file> <content> — a new commit on origin/main
  echo "$2" > "$author/$1"
  git -C "$author" add -A
  git_as_test -C "$author" commit -q -m "$1: $2"
  git -C "$author" push -q origin main
}
run_deploy() { # <args...> -> stdout in $out, exit code in $rc, step calls in $calls
  rc=0
  : > "$calls"
  out="$("$deploy" "$@" 2>&1)" || rc=$?
}
has() { grep -qE "$2" <<<"$1"; }                    # <text> <ere>
called() { grep -qx "$1" "$calls"; }                # <step>
no_calls() { [[ ! -s "$calls" ]]; }
target_head() { git -C "$target" rev-parse HEAD; }
origin_head() { git -C "$author" rev-parse HEAD; }
holds() { "$@" 2>/dev/null && echo 1 || echo 0; } # <command...> -> 1 when it succeeds
wait_for() { # <command...> — polls until it succeeds; returns non-zero on timeout
  local step
  for ((step = 0; step < WAIT_STEPS_MAX; step++)); do "$@" && return 0; sleep 0.2; done
  return 1
}

# --- deploy once --------------------------------------------------------------------------------
run_deploy
check "same SHA is a no-op (rc $rc)" $(( rc == 0 && $(holds has "$out" 'already deployed') && $(holds no_calls) ))

mkdir -p "$prebundle_cache/deps"
merge_to_main game.txt v2
run_deploy
check "a new commit fast-forwards the target (rc $rc)" $(( rc == 0 && $(holds test "$(target_head)" = "$(origin_head)") ))
check "it builds and restarts, and skips install when the lockfile is unchanged" $(( $(holds called build) && $(holds called restart) && ! $(holds called install) ))
check "the Angular prebundle cache is removed" $(( ! $(holds test -e "$prebundle_cache") ))
check "the deployed SHA is recorded" $(( $(holds test "$(cat "$deployed_sha_file")" = "$(origin_head)") ))
step_lines="$(grep -cE "${ISO_TIMESTAMP_PATTERN}step (fast-forward|install|build-shared|clear-prebundle|restart)" "$deploy_log")"
check "deploy.log has every step with an ISO timestamp ($step_lines step lines)" $(( step_lines == 5 ))

run_deploy
check "running it again on the same SHA does nothing" $(( rc == 0 && $(holds has "$out" 'already deployed') && $(holds no_calls) ))

merge_to_main pnpm-lock.yaml 'lockfileVersion: 2'
run_deploy
check "a lockfile change runs install" $(( rc == 0 && $(holds called install) ))

echo scratch > "$target/untracked.txt"
merge_to_main game.txt v3
run_deploy
check "untracked files do not block a deploy" $(( rc == 0 && $(holds test "$(target_head)" = "$(origin_head)") && $(holds test -e "$target/untracked.txt") ))

echo local-edit > "$target/game.txt"
before="$(target_head)"
merge_to_main game.txt v4
run_deploy
check "tracked changes are refused (rc $rc)" $(( rc == EXIT_REFUSED && $(holds has "$out" 'refused: .*tracked changes') && $(holds no_calls) ))
check "the refused checkout is untouched and the refusal is logged" $(( $(holds test "$(target_head)" = "$before") && $(holds grep -qx local-edit "$target/game.txt") && $(holds grep -q 'refused: .*tracked changes' "$deploy_log") ))
git -C "$target" checkout -q -- game.txt

git -C "$target" checkout -q -b feature
run_deploy
check "a branch that does not track origin/main is refused (rc $rc)" $(( rc == EXIT_REFUSED && $(holds has "$out" 'not a branch tracking origin/main') && $(holds test "$(target_head)" = "$before") ))
git -C "$target" checkout -q main

git_as_test -C "$target" commit -q --allow-empty -m local-only
diverged="$(target_head)"
run_deploy
check "a diverged branch is refused, never reset (rc $rc)" $(( rc == EXIT_REFUSED && $(holds has "$out" 'cannot fast-forward') && $(holds test "$(target_head)" = "$diverged") ))
git -C "$target" reset -q --hard "$before"

DEPLOY_BUILD_COMMAND="echo build >> '$calls'; exit $STUB_BUILD_FAILURE_EXIT" run_deploy
check "a failing step fails the deploy before the restart (rc $rc)" $(( rc == EXIT_FAILED && $(holds has "$out" "step build-shared failed \\(exit $STUB_BUILD_FAILURE_EXIT\\)") && ! $(holds called restart) ))
check "a failed deploy is not recorded as deployed" $(( $(holds test "$(cat "$deployed_sha_file")" = "$before") ))
run_deploy
check "the next run retries it to completion" $(( rc == 0 && $(holds called build) && $(holds called restart) && $(holds test "$(cat "$deployed_sha_file")" = "$(origin_head)") ))

merge_to_main game.txt v5
exec 8>>"$target/.game-logs/deploy.lock"
flock 8
before="$(target_head)"
run_deploy
exec 8>&-
check "a held deploy lock skips the run" $(( rc == 0 && $(holds has "$out" 'another deploy holds') && $(holds test "$(target_head)" = "$before") && $(holds no_calls) ))

orphan_pid_file="$sandbox/orphan-pid"
DEPLOY_RESTART_COMMAND="(sleep 30 & echo \$! > '$orphan_pid_file')" run_deploy
orphan_pid="$(cat "$orphan_pid_file")"
started_pids+=("$orphan_pid")
check "a server the restart leaves running does not keep the lock" $(( rc == 0 && $(holds flock --nonblock "$target/.game-logs/deploy.lock" true) ))

# --- deploy --watch -----------------------------------------------------------------------------
DEPLOY_WATCH_INTERVAL_SECONDS="$WATCH_INTERVAL_SECONDS" "$deploy" --watch > "$sandbox/watch.out" 2>&1 &
watch_pid=$!
started_pids+=("$watch_pid")
merge_to_main game.txt v6
deployed_at_origin() { [[ "$(cat "$deployed_sha_file")" == "$(origin_head)" ]]; }
check "--watch deploys a new commit within a few polls" $(holds wait_for deployed_at_origin)
check "--watch re-executes itself after a deploy and keeps running" $(( $(holds grep -q 're-executing the watcher' "$deploy_log") && $(holds kill -0 "$watch_pid") ))

echo local-edit > "$target/game.txt"
merge_to_main game.txt v7
refusals_logged() { [[ "$(grep -c 'refused: .*tracked changes' "$deploy_log")" -ge 2 ]]; }
wait_for refusals_logged || true
sleep $((WATCH_INTERVAL_SECONDS * 3))
refusals="$(grep -c 'refused: .*tracked changes' "$deploy_log")"
check "--watch logs a repeated refusal once, not every poll ($refusals total incl. the earlier case)" $(( refusals == 2 ))
kill "$watch_pid"
git -C "$target" checkout -q -- game.txt

# --- run.sh process ownership -------------------------------------------------------------------
STACK_SERVER_PORT=45910
STACK_CLIENT_PORT=45912
for port in "$STACK_SERVER_PORT" "$STACK_CLIENT_PORT"; do
  if lsof -ti :"$port" -sTCP:LISTEN >/dev/null 2>&1; then echo "port $port is in use; cannot run the run.sh cases"; exit 1; fi
done
stack="$sandbox/stack"
mkdir -p "$stack/scripts" "$stack/packages/client" "$stack/node_modules" "$sandbox/bin"
cp "$repo_root/run.sh" "$stack/run.sh"
cp "$deploy" "$stack/scripts/deploy-main.sh"
cp "$repo_root/packages/client/proxy.conf.json" "$stack/packages/client/proxy.conf.json"
git init -q -b main "$stack" # no upstream: the watcher refuses and keeps polling
pnpm_args="$sandbox/pnpm-args"
cat > "$sandbox/bin/pnpm" <<PNPM
#!/usr/bin/env bash
[[ "\$1" != -v ]] || { echo 10.0.0; exit 0; }
echo "\$*" >> "$pnpm_args"
exec sleep 300
PNPM
chmod +x "$sandbox/bin/pnpm"

run_stack() { # <args...>
  (cd "$stack" && PATH="$sandbox/bin:$PATH" PORT="$STACK_SERVER_PORT" CLIENT_PORT="$STACK_CLIENT_PORT" \
    DEPLOY_WATCH_INTERVAL_SECONDS="$WATCH_INTERVAL_SECONDS" ./run.sh "$@" > "$sandbox/run.out" 2>&1)
}
live_pids() { local pid; while read -r pid; do kill -0 "$pid" 2>/dev/null && echo "$pid"; done < "$1"; }
unset DEPLOY_TARGET_DIR

run_stack
watcher_pid="$(cat "$stack/.game-logs/deploy-watch.pid")"
started_pids+=("$watcher_pid")
first_stack_pids="$(live_pids "$stack/.game.pid" | tr '\n' ' ')"
for pid in $first_stack_pids; do started_pids+=("$pid"); done
check "./run.sh starts the server, the client and the deploy watcher" $(( $(wc -w <<<"$first_stack_pids") == 2 && $(holds kill -0 "$watcher_pid") ))
check "the watcher's PID is not in .game.pid" $(( ! $(holds grep -qx "$watcher_pid" "$stack/.game.pid") ))
check "the client is served on CLIENT_PORT with a proxy to PORT" $(( $(holds grep -q "dev:client --port $STACK_CLIENT_PORT --proxy-config $stack/.game-logs/proxy.conf.json" "$pnpm_args") && $(holds grep -q "localhost:$STACK_SERVER_PORT" "$stack/.game-logs/proxy.conf.json") ))
watcher_targets_stack() { grep -q "for $stack " "$stack/.game-logs/deploy.log" 2>/dev/null; }
check "the watcher deploys the checkout run.sh lives in" $(holds wait_for watcher_targets_stack)

run_stack --no-deploy-watch
second_stack_pids="$(live_pids "$stack/.game.pid" | tr '\n' ' ')"
for pid in $second_stack_pids; do started_pids+=("$pid"); done
old_alive=0
for pid in $first_stack_pids; do kill -0 "$pid" 2>/dev/null && old_alive=$((old_alive + 1)); done
check "the restart a deploy runs replaces the stack ($old_alive old left)" $(( old_alive == 0 && $(wc -w <<<"$second_stack_pids") == 2 ))
check "and leaves the watcher running the deploy alone" $(( $(holds kill -0 "$watcher_pid") && $(holds test "$(cat "$stack/.game-logs/deploy-watch.pid")" = "$watcher_pid") ))

run_stack
check "./run.sh with a live watcher does not start a second one" $(( $(holds grep -q 'Deploy watcher already running' "$sandbox/run.out") && $(holds test "$(cat "$stack/.game-logs/deploy-watch.pid")" = "$watcher_pid") ))
for pid in $(live_pids "$stack/.game.pid"); do started_pids+=("$pid"); done

run_stack --stop
sleep 0.5
check "./run.sh --stop stops the watcher and the stack" $(( ! $(holds kill -0 "$watcher_pid") && ! $(holds test -e "$stack/.game.pid") && ! $(holds test -e "$stack/.game-logs/deploy-watch.pid") ))

if [[ $failures -gt 0 ]]; then
  echo "deploy-main.test.sh: $failures failure(s)"
  exit 1
fi
echo "deploy-main.test.sh: all cases passed"
