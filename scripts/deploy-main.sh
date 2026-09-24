#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy-main.sh — redeploy a running checkout from origin/main (#291).
#
# A deploy fast-forwards the target to origin/main, makes it runnable through the workspace setup
# (scripts/lib/workspace-ready.sh: `pnpm install --frozen-lockfile` when node_modules does not match
# pnpm-lock.yaml, the shared build when it is stale, stamping the build record so the restart's own setup
# finds nothing to do; a failed install or build fails the deploy before the restart), then restarts the stack
# with `./run.sh --clear-prebundle --wait-ready` in the mode and on the ports the stack was started
# with (.game-logs/run.env, written by run.sh). run.sh deletes the Angular dependency prebundle
# (packages/client/.angular/cache, built from the OLD shared package) after stopping the old stack and
# before starting the new one, and fails unless this checkout's server and client listen again. A
# one-shot deploy lets run.sh start the watcher; a deploy the watcher runs passes --no-deploy-watch.
# The human hard-refreshes the browser afterwards.
#
# It refuses, and logs why, unless the target is on `main` tracking origin/main with no tracked changes
# and can fast-forward. Untracked files are fine. It never resets or forces anything. --watch stops
# for good when the checkout is not on main (so a feature worktree never keeps a poller).
# Every step is logged with an ISO timestamp to <target>/.game-logs/deploy.log; deploy.lock beside it
# keeps two deploys from overlapping; deployed-sha records the last COMPLETE deploy, so one that failed
# half way is retried by the next manual run rather than looking done (--watch waits for the next
# commit instead of retrying the same one every poll).
#
# Environment:
#   DEPLOY_TARGET_DIR              checkout to deploy (default: the main checkout of this repository)
#   DEPLOY_WATCH_INTERVAL_SECONDS  --watch poll interval (default 60)
#   DEPLOY_SETUP_COMMAND, DEPLOY_RUN_SCRIPT
#                                  replace the setup step's command or run.sh (the tests stub them)
# ---------------------------------------------------------------------------
set -euo pipefail
# The watcher polls a checkout that people and agents work in: its `git status` must never take the optional
# index.lock a concurrent checkout or commit then fails on (ticket #574). The fast-forward still locks the index.
export GIT_OPTIONAL_LOCKS=0

SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

UPSTREAM_REMOTE=origin
UPSTREAM_BRANCH=main
UPSTREAM="$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
DEFAULT_WATCH_INTERVAL_SECONDS=60
RUN_ENV_PATH=.game-logs/run.env # written by run.sh: PORT, SERVER_PORT, CLIENT_PORT, RUN_MODE
SHORT_SHA_LENGTH=12
EXIT_USAGE=1
EXIT_REFUSED=2
EXIT_FAILED=3

usage() {
  cat <<'USAGE'
Usage: scripts/deploy-main.sh           deploy origin/main to the target once (a no-op when already deployed)
       scripts/deploy-main.sh --watch   poll origin/main and deploy every time it moves (./run.sh starts this)
USAGE
}

main_checkout_dir() { # the parent of the shared .git directory: the main checkout, even from a worktree
  dirname "$(git -C "$(dirname "$SCRIPT_PATH")" rev-parse --path-format=absolute --git-common-dir)"
}

TARGET_DIR="${DEPLOY_TARGET_DIR:-$(main_checkout_dir)}"
WATCH_INTERVAL_SECONDS="${DEPLOY_WATCH_INTERVAL_SECONDS:-$DEFAULT_WATCH_INTERVAL_SECONDS}"
# Run by run_step in the target, from the deployed checkout's own copy of the library.
SETUP_COMMAND="${DEPLOY_SETUP_COMMAND:-source scripts/lib/workspace-ready.sh && workspace_ensure_ready \"\$PWD\" setup: fail}"
RUN_SCRIPT="${DEPLOY_RUN_SCRIPT:-./run.sh}"

LOG_DIR="$TARGET_DIR/.game-logs"
LOG_FILE="$LOG_DIR/deploy.log"
LOCK_FILE="$LOG_DIR/deploy.lock"
DEPLOYED_SHA_FILE="$LOG_DIR/deployed-sha"

last_notice=""       # --watch repeats a refusal on every poll; it is logged once until it changes
failed_target_sha="" # --watch does not retry a commit whose deploy failed
deployed_now=false
watching=false
branch_refused=false

log() { # <message...>
  local line
  line="$(date -Iseconds) $*"
  echo "$line"
  echo "$line" >> "$LOG_FILE"
}

notice() { # <message...> — a log line that is not repeated while it stays the same
  [[ "$*" != "$last_notice" ]] || return 0
  last_notice="$*"
  log "$@"
}

short() { echo "${1:0:SHORT_SHA_LENGTH}"; }

run_step() { # <name> <command> — in the target, output into the log; fd 9 (the lock) is closed so a server it starts cannot hold it
  log "step $1: $2"
  local rc=0
  (cd "$TARGET_DIR" && bash -c "$2") >> "$LOG_FILE" 2>&1 9>&- || rc=$?
  [[ $rc -eq 0 ]] || log "step $1 failed (exit $rc)"
  return "$rc"
}

restart_command() { # run.sh again, in the stack's recorded mode and ports
  local watch_flag=""
  $watching && watch_flag=" --no-deploy-watch" # this watcher is running the deploy; a one-shot deploy lets run.sh start one
  echo "set -a; [ ! -f $RUN_ENV_PATH ] || . $RUN_ENV_PATH; set +a; $RUN_SCRIPT \${RUN_MODE:-} --clear-prebundle --wait-ready$watch_flag"
}

deploy_steps() { # <from-sha> <to-sha>
  run_step fast-forward "git merge --ff-only --quiet $2" || return
  run_step setup "$SETUP_COMMAND" || return
  if ! run_step restart "$(restart_command)"; then
    log "restart failed: the stack is not serving again (run.sh's output and the log tails are above)"
    return 1
  fi
}

branch_refusal() { # prints why the target's branch cannot be deployed, nothing when it can
  local branch upstream
  if ! branch="$(git -C "$TARGET_DIR" symbolic-ref --quiet --short HEAD)"; then
    echo "$TARGET_DIR is on a detached HEAD, not $UPSTREAM_BRANCH"
  elif [[ "$branch" != "$UPSTREAM_BRANCH" ]]; then
    echo "$TARGET_DIR is on $branch, not $UPSTREAM_BRANCH"
  else
    upstream="$(git -C "$TARGET_DIR" rev-parse --abbrev-ref "$branch@{upstream}" 2>/dev/null)" || upstream="no upstream"
    [[ "$upstream" == "$UPSTREAM" ]] || echo "$branch in $TARGET_DIR tracks $upstream, not $UPSTREAM"
  fi
}

tree_refusal() { # <head> <target-sha> — prints why the checkout cannot be fast-forwarded, nothing when it can
  if [[ -n "$(git -C "$TARGET_DIR" status --porcelain --untracked-files=no)" ]]; then
    echo "$TARGET_DIR has tracked changes; commit or stash them (untracked files are fine)"
  elif ! git -C "$TARGET_DIR" merge-base --is-ancestor "$1" "$2"; then
    echo "$(short "$1") cannot fast-forward to $UPSTREAM $(short "$2")"
  fi
}

deploy_range() { # <from-sha> <to-sha>
  [[ -f "$DEPLOYED_SHA_FILE" ]] || echo "$1" > "$DEPLOYED_SHA_FILE"
  last_notice=""
  log "deploying $(short "$1") -> $(short "$2") in $TARGET_DIR"
  if ! deploy_steps "$1" "$2"; then
    failed_target_sha="$2"
    log "deploy of $(short "$2") FAILED; the stack may be stale or down (run scripts/deploy-main.sh to retry)"
    return "$EXIT_FAILED"
  fi
  echo "$2" > "$DEPLOYED_SHA_FILE"
  deployed_now=true
  log "deployed $(short "$2"); hard-refresh the browser"
}

deploy_locked() {
  local reason fetch_error head target_sha deployed_sha
  reason="$(branch_refusal)"
  if [[ -n "$reason" ]]; then
    branch_refused=true
    notice "refused: $reason"
    return "$EXIT_REFUSED"
  fi
  if ! fetch_error="$(git -C "$TARGET_DIR" fetch --quiet "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH" 2>&1)"; then
    notice "fetch of $UPSTREAM failed: $fetch_error"
    return "$EXIT_FAILED"
  fi
  head="$(git -C "$TARGET_DIR" rev-parse HEAD)"
  target_sha="$(git -C "$TARGET_DIR" rev-parse "$UPSTREAM")"
  deployed_sha="$(cat "$DEPLOYED_SHA_FILE" 2>/dev/null || echo "$head")"
  if [[ "$head" == "$target_sha" && "$deployed_sha" == "$target_sha" ]]; then
    notice "already deployed at $(short "$target_sha"); nothing to do"
    return 0
  fi
  [[ "$target_sha" != "$failed_target_sha" ]] || return "$EXIT_FAILED"
  reason="$(tree_refusal "$head" "$target_sha")"
  if [[ -n "$reason" ]]; then
    notice "refused: $reason"
    return "$EXIT_REFUSED"
  fi
  deploy_range "$deployed_sha" "$target_sha"
}

deploy_once() {
  mkdir -p "$LOG_DIR"
  exec 9>>"$LOCK_FILE"
  if ! flock --nonblock 9; then
    notice "another deploy holds $LOCK_FILE; skipping"
    exec 9>&-
    return 0
  fi
  local rc=0
  deploy_locked || rc=$?
  exec 9>&-
  return "$rc"
}

watch_upstream() {
  watching=true
  mkdir -p "$LOG_DIR"
  log "watching $UPSTREAM every ${WATCH_INTERVAL_SECONDS}s for $TARGET_DIR (pid $$)"
  while true; do
    deploy_once || true
    if $branch_refused; then
      log "stopping the watcher: only a checkout on $UPSTREAM_BRANCH is redeployed (./run.sh there starts a new one)"
      exit "$EXIT_REFUSED"
    fi
    if $deployed_now; then
      log "re-executing the watcher from the deployed $SCRIPT_PATH"
      exec "$SCRIPT_PATH" --watch
    fi
    sleep "$WATCH_INTERVAL_SECONDS"
  done
}

case "${1:-}" in
  "") deploy_once ;;
  --watch) watch_upstream ;;
  *) usage; exit "$EXIT_USAGE" ;;
esac
