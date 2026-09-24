#!/usr/bin/env bash
# deploy-main.test.sh — exercises scripts/deploy-main.sh (#291) against a throwaway target clone of a
# local bare "origin", with install / build / run.sh stubbed to append to a calls file so no server
# starts: a no-op on the same SHA; a fast-forward that runs the setup step and restarts through run.sh with
# --clear-prebundle --wait-ready (no --no-deploy-watch when one-shot), in the recorded mode and ports,
# logging every step with an ISO timestamp; the recorded port wins over an inherited SERVER_PORT (#474);
# with the real workspace setup (#329, a fake pnpm), a lockfile
# change installs, a shared package.json-only change builds and leaves the restart's setup nothing to do,
# and a failed build fails the deploy before the restart; untracked files allowed; refusal on tracked changes, a feature branch tracking origin/main, detached HEAD, main without
# the upstream, and a diverged branch; a failed build or restart not recorded and retried; an unreachable
# origin; a held lock skips; a server the restart leaves running does not keep the lock; --watch deploys
# with --no-deploy-watch, re-executes itself, logs a repeated refusal or fetch failure once and stops
# when the checkout leaves main; its git status never takes the optional index.lock (#574). run.sh's side is
# scripts/run.test.sh.
#
#   scripts/deploy-main.test.sh        # exit 0 when every case passes
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
deploy="$repo_root/scripts/deploy-main.sh"
sandbox="$(mktemp -d)"
source "$repo_root/scripts/lib/shell-test.sh"
started_pids=()
cleanup() {
  local pid
  for pid in "${started_pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  rm -rf "$sandbox"
}
trap cleanup EXIT

WATCH_INTERVAL_SECONDS=1
WATCH_POLLS_TO_OBSERVE=3
ISO_TIMESTAMP_PATTERN='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2} '
EXIT_REFUSED=2
EXIT_FAILED=3
STUB_FAILURE_EXIT=7
RECORDED_SERVER_PORT=45001
RECORDED_CLIENT_PORT=45003

# --- fixture: origin + author (lib), the target checkout, stubs --------------------------------
make_origin
# The deployed checkout's own setup library and a shared package, as the real repository has them.
mkdir -p "$author/scripts/lib" "$author/packages/shared/src"
cp "$repo_root/scripts/lib/workspace-ready.sh" "$author/scripts/lib/workspace-ready.sh"
echo '{}' > "$author/packages/shared/package.json"
touch "$author/packages/shared/src/index.ts"
printf 'dist/\n*.tsbuildinfo\n' >> "$author/.gitignore"
git -C "$author" add -A
git_as_test -C "$author" commit -q -m 'setup library and shared package'
git -C "$author" push -q origin main
target="$sandbox/target"
git clone -q "$origin" "$target"
calls="$sandbox/calls"
build_fail_file="$sandbox/fake-pnpm-build-fails" # when present: the fake shared build fails
restart_rc_file="$sandbox/restart-rc"
restart_spawn_file="$sandbox/restart-spawn" # when non-empty: the stub leaves a background process and writes its PID here
echo 0 > "$restart_rc_file"
: > "$restart_spawn_file"
mkdir -p "$sandbox/bin"
cat > "$sandbox/bin/run-stub" <<STUB
#!/usr/bin/env bash
echo "restart SERVER_PORT=\${SERVER_PORT:-} PORT=\${PORT:-} CLIENT_PORT=\${CLIENT_PORT:-} \$*" >> "$calls"
spawn_pid_file="\$(cat "$restart_spawn_file")"
[[ -z "\$spawn_pid_file" ]] || { sleep 30 & echo \$! > "\$spawn_pid_file"; }
exit "\$(cat "$restart_rc_file")"
STUB
chmod +x "$sandbox/bin/run-stub"
# The real setup's pnpm: an install copies the lockfile as pnpm does; a build emits the types entry but,
# like tsc when the emitted content is unchanged, leaves the build record alone.
cat > "$sandbox/bin/pnpm" <<PNPM
#!/usr/bin/env bash
echo "pnpm \$*" >> "$calls"
case "\$*" in
  install*) mkdir -p node_modules/.pnpm && cp pnpm-lock.yaml node_modules/.pnpm/lock.yaml ;;
  *' build') [[ ! -e "$build_fail_file" ]] || exit 1; mkdir -p packages/shared/dist && touch packages/shared/dist/index.d.ts ;;
esac
PNPM
chmod +x "$sandbox/bin/pnpm"

export PATH="$sandbox/bin:$PATH"
export DEPLOY_TARGET_DIR="$target"
export DEPLOY_SETUP_COMMAND="echo setup >> '$calls'"
export DEPLOY_RUN_SCRIPT="$sandbox/bin/run-stub"
deploy_log="$target/.game-logs/deploy.log"
deployed_sha_file="$target/.game-logs/deployed-sha"

# --- helpers ------------------------------------------------------------------------------------
run_deploy() { # <args...> -> stdout in $out, exit code in $rc, step calls in $calls
  rc=0
  : > "$calls"
  out="$("$deploy" "$@" 2>&1)" || rc=$?
}
has() { grep -qE "$2" <<<"$1"; } # <text> <ere>
called() { grep -qx "$1" "$calls"; }
restarted_with() { grep -qE "^restart .*$1" "$calls"; } # <ere on the run.sh arguments>
no_calls() { [[ ! -s "$calls" ]]; }
target_head() { git -C "$target" rev-parse HEAD; }
deployed_sha() { cat "$deployed_sha_file"; }
refused_with() { has "$out" "refused: .*$1"; } # <ere>
start_watcher() { # <target dir> -> $watch_pid
  DEPLOY_TARGET_DIR="$1" DEPLOY_WATCH_INTERVAL_SECONDS="$WATCH_INTERVAL_SECONDS" "$deploy" --watch > /dev/null 2>&1 &
  watch_pid=$!
  started_pids+=("$watch_pid")
}

# --- deploy once --------------------------------------------------------------------------------
# A git shim on PATH records GIT_OPTIONAL_LOCKS for every `git status` the deploy runs (ticket #574).
git_shim_dir="$sandbox/git-shim"
status_locks_file="$sandbox/status-optional-locks"
mkdir -p "$git_shim_dir"
printf '#!/usr/bin/env bash\n[[ " $* " != *" status "* ]] || echo "${GIT_OPTIONAL_LOCKS:-unset}" >> %q\nexec %q "$@"\n' \
  "$status_locks_file" "$(command -v git)" > "$git_shim_dir/git"
chmod +x "$git_shim_dir/git"
run_deploy
check "same SHA is a no-op (rc $rc)" $(( rc == 0 && $(holds has "$out" 'already deployed') && $(holds no_calls) ))

merge_to_main game.txt v2
: > "$status_locks_file"
PATH="$git_shim_dir:$PATH" run_deploy
status_calls="$(grep -c . "$status_locks_file" || true)"
locking_status_calls="$(grep -cvx 0 "$status_locks_file" || true)"
check "the deploy's git status never takes the optional index.lock a concurrent checkout trips on (#574; $status_calls calls)" \
  $(( status_calls > 0 && locking_status_calls == 0 ))
check "a new commit fast-forwards the target (rc $rc)" $(( rc == 0 && $(holds test "$(target_head)" = "$(origin_head)") ))
check "it runs the setup step, then restarts" $(( $(holds called setup) && $(holds restarted_with '') && $(holds test "$(head -n 1 "$calls")" = setup) ))
check "the restart clears the prebundle between stop and start and waits for the stack" $(( $(holds restarted_with ' --clear-prebundle --wait-ready$') ))
check "a one-shot deploy lets run.sh start the watcher (no --no-deploy-watch)" $(( ! $(holds restarted_with '--no-deploy-watch') ))
check "the deployed SHA is recorded" $(( $(holds test "$(deployed_sha)" = "$(origin_head)") ))
step_lines="$(grep -cE "${ISO_TIMESTAMP_PATTERN}step (fast-forward|setup|restart)" "$deploy_log")"
check "deploy.log has every step with an ISO timestamp ($step_lines step lines)" $(( step_lines == 3 ))

run_deploy
check "running it again on the same SHA does nothing" $(( rc == 0 && $(holds has "$out" 'already deployed') && $(holds no_calls) ))

printf 'PORT=%s\nCLIENT_PORT=%s\nRUN_MODE=--server-only\n' "$RECORDED_SERVER_PORT" "$RECORDED_CLIENT_PORT" > "$target/.game-logs/run.env"
merge_to_main game.txt v3
PORT=1 CLIENT_PORT=2 run_deploy
check "the restart repeats the recorded mode and ports, not the caller's" $(( rc == 0 && $(holds restarted_with "PORT=$RECORDED_SERVER_PORT CLIENT_PORT=$RECORDED_CLIENT_PORT --server-only --clear-prebundle") ))

# SERVER_PORT is run.sh's alias of PORT (#474), which refuses the two when they differ: an inherited one never reaches the restart
printf 'PORT=%s\nCLIENT_PORT=%s\n' "$RECORDED_SERVER_PORT" "$RECORDED_CLIENT_PORT" > "$target/.game-logs/run.env"
merge_to_main game.txt v3b
SERVER_PORT=1 run_deploy
check "a run.env with PORT only drops the caller's SERVER_PORT, so the restart is not refused (rc $rc)" $(( rc == 0 && $(holds restarted_with "SERVER_PORT= PORT=$RECORDED_SERVER_PORT CLIENT_PORT=$RECORDED_CLIENT_PORT ") ))
printf 'PORT=%s\nSERVER_PORT=%s\nCLIENT_PORT=%s\n' "$RECORDED_SERVER_PORT" "$RECORDED_SERVER_PORT" "$RECORDED_CLIENT_PORT" > "$target/.game-logs/run.env"
merge_to_main game.txt v3c
PORT=1 SERVER_PORT=2 run_deploy
check "a run.env with both names restarts on the recorded port under both, not the caller's (rc $rc)" $(( rc == 0 && $(holds restarted_with "SERVER_PORT=$RECORDED_SERVER_PORT PORT=$RECORDED_SERVER_PORT CLIENT_PORT=$RECORDED_CLIENT_PORT ") ))
rm "$target/.game-logs/run.env"

echo scratch > "$target/untracked.txt"
merge_to_main game.txt v4
run_deploy
check "untracked files do not block a deploy" $(( rc == 0 && $(holds test "$(target_head)" = "$(origin_head)") && $(holds test -e "$target/untracked.txt") ))

echo local-edit > "$target/game.txt"
before="$(target_head)"
merge_to_main game.txt v5
run_deploy
check "tracked changes are refused (rc $rc)" $(( rc == EXIT_REFUSED && $(holds refused_with 'tracked changes') && $(holds no_calls) ))
check "the refused checkout is untouched and the refusal is logged" $(( $(holds test "$(target_head)" = "$before") && $(holds grep -qx local-edit "$target/game.txt") && $(holds grep -q 'refused: .*tracked changes' "$deploy_log") ))
git -C "$target" checkout -q -- game.txt

git -C "$target" checkout -q -b feature
git -C "$target" branch -q --set-upstream-to=origin/main
run_deploy
check "a feature branch tracking origin/main is refused (rc $rc)" $(( rc == EXIT_REFUSED && $(holds refused_with 'on feature, not main') && $(holds test "$(target_head)" = "$before") && $(holds no_calls) ))
git -C "$target" checkout -q --detach main
run_deploy
check "a detached HEAD is refused (rc $rc)" $(( rc == EXIT_REFUSED && $(holds refused_with 'detached HEAD') ))
git -C "$target" checkout -q main
git -C "$target" branch -q --unset-upstream
run_deploy
check "main without the origin/main upstream is refused (rc $rc)" $(( rc == EXIT_REFUSED && $(holds refused_with 'tracks no upstream') ))
git -C "$target" branch -q --set-upstream-to=origin/main

git_as_test -C "$target" commit -q --allow-empty -m local-only
diverged="$(target_head)"
run_deploy
check "a diverged branch is refused, never reset (rc $rc)" $(( rc == EXIT_REFUSED && $(holds refused_with 'cannot fast-forward') && $(holds test "$(target_head)" = "$diverged") ))
git -C "$target" reset -q --hard "$before"

DEPLOY_SETUP_COMMAND="echo setup >> '$calls'; exit $STUB_FAILURE_EXIT" run_deploy
check "a failing setup fails the deploy before the restart (rc $rc)" $(( rc == EXIT_FAILED && $(holds has "$out" "step setup failed \\(exit $STUB_FAILURE_EXIT\\)") && ! $(holds restarted_with '') ))
check "a failed deploy is not recorded as deployed" $(( $(holds test "$(deployed_sha)" = "$before") ))
echo "$STUB_FAILURE_EXIT" > "$restart_rc_file"
run_deploy
check "a restart whose stack does not come up fails as 'restart failed' (rc $rc)" $(( rc == EXIT_FAILED && $(holds has "$out" 'restart failed') && $(holds test "$(deployed_sha)" = "$before") ))
echo 0 > "$restart_rc_file"
run_deploy
check "the next run retries it to completion" $(( rc == 0 && $(holds called setup) && $(holds restarted_with '') && $(holds test "$(deployed_sha)" = "$(origin_head)") ))

merge_to_main game.txt v6
exec 8>>"$target/.game-logs/deploy.lock"
flock 8
before="$(target_head)"
run_deploy
exec 8>&-
check "a held deploy lock skips the run" $(( rc == 0 && $(holds has "$out" 'another deploy holds') && $(holds test "$(target_head)" = "$before") && $(holds no_calls) ))

echo "$sandbox/orphan-pid" > "$restart_spawn_file"
run_deploy
: > "$restart_spawn_file"
started_pids+=("$(cat "$sandbox/orphan-pid")")
check "a server the restart leaves running does not keep the lock" $(( rc == 0 && $(holds flock --nonblock "$target/.game-logs/deploy.lock" true) ))

unreachable="$sandbox/unreachable"
git clone -q "$origin" "$unreachable"
git -C "$unreachable" remote set-url origin "$sandbox/missing.git"
DEPLOY_TARGET_DIR="$unreachable" run_deploy
check "an unreachable origin fails the run and says so (rc $rc)" $(( rc == EXIT_FAILED && $(holds has "$out" 'fetch of origin/main failed') && $(holds no_calls) ))

# --- the real workspace setup (#329): scripts/lib/workspace-ready.sh with a fake pnpm -------------
# A ready target: installed from its lockfile, shared built after its sources.
mkdir -p "$target/node_modules/.pnpm" "$target/packages/shared/dist"
cp "$target/pnpm-lock.yaml" "$target/node_modules/.pnpm/lock.yaml"
find "$target/packages/shared" -exec touch -d '-1 hour' {} +
touch "$target/packages/shared/dist/index.d.ts" "$target/packages/shared/tsconfig.build.tsbuildinfo"
setup_work_left() { (source "$target/scripts/lib/workspace-ready.sh" && workspace_ready_needed "$target"); }
check "the ready target has no setup work" $(( ! $(holds setup_work_left) ))

merge_to_main pnpm-lock.yaml 'lockfileVersion: 2'
DEPLOY_SETUP_COMMAND='' run_deploy
check "a lockfile change installs through the setup, builds nothing, then restarts (rc $rc)" $(( rc == 0 && $(holds called 'pnpm install --frozen-lockfile --prefer-offline') && ! $(holds grep -q 'build$' "$calls") && $(holds restarted_with '') ))

merge_to_main packages/shared/package.json '{"version": 2}'
DEPLOY_SETUP_COMMAND='' run_deploy
check "a shared package.json-only change builds through the setup, then restarts (rc $rc)" $(( rc == 0 && $(holds called 'pnpm --filter @evolution/shared build') && $(holds restarted_with '') ))
check "and leaves the restart's own setup nothing to do, though tsc left the build record alone" $(( ! $(holds setup_work_left) ))

merge_to_main packages/shared/src/index.ts 'export {};'
touch "$build_fail_file"
DEPLOY_SETUP_COMMAND='' run_deploy
rm "$build_fail_file"
check "a failed shared build fails the deploy before the restart (rc $rc)" $(( rc == EXIT_FAILED && $(holds has "$out" 'step setup failed') && $(holds grep -q 'setup: the @evolution/shared build failed$' "$deploy_log") && ! $(holds restarted_with '') ))
DEPLOY_SETUP_COMMAND='' run_deploy
check "the next deploy rebuilds and restarts (rc $rc)" $(( rc == 0 && $(holds restarted_with '') && ! $(holds setup_work_left) ))

# --- deploy --watch -----------------------------------------------------------------------------
: > "$calls"
start_watcher "$target"
merge_to_main game.txt v7
deployed_at_origin() { [[ "$(deployed_sha)" == "$(origin_head)" ]]; }
check "--watch deploys a new commit within a few polls" $(holds wait_for deployed_at_origin)
check "a deploy the watcher runs restarts with --no-deploy-watch" $(( $(holds restarted_with '--clear-prebundle --wait-ready --no-deploy-watch$') ))
# The watcher records the deployed sha before it logs the re-exec, so the line may not be there yet.
reexecuted() { grep -q 're-executing the watcher' "$deploy_log" && kill -0 "$watch_pid"; }
check "--watch re-executes itself after a deploy and keeps running" $(holds wait_for reexecuted)

echo local-edit > "$target/game.txt"
merge_to_main game.txt v8
refusals_logged() { [[ "$(grep -c 'refused: .*tracked changes' "$deploy_log")" -ge 2 ]]; }
wait_for refusals_logged || true
sleep $((WATCH_INTERVAL_SECONDS * WATCH_POLLS_TO_OBSERVE))
refusals="$(grep -c 'refused: .*tracked changes' "$deploy_log")"
check "--watch logs a repeated refusal once, not every poll ($refusals total incl. the earlier case)" $(( refusals == 2 ))
git -C "$target" checkout -q -- game.txt

git -C "$target" checkout -q feature
watcher_gone() { ! kill -0 "$watch_pid"; }
check "--watch stops when the checkout leaves main" $(( $(holds wait_for watcher_gone) && $(holds grep -q 'stopping the watcher' "$deploy_log") ))
git -C "$target" checkout -q main

start_watcher "$unreachable"
sleep $((WATCH_INTERVAL_SECONDS * WATCH_POLLS_TO_OBSERVE))
fetch_failures="$(grep -c 'fetch of origin/main failed' "$unreachable/.game-logs/deploy.log")"
check "--watch with an unreachable origin logs it once per run and keeps polling ($fetch_failures lines incl. the one-shot)" $(( fetch_failures == 2 && $(holds kill -0 "$watch_pid") ))
kill "$watch_pid"

finish_suite deploy-main.test.sh
