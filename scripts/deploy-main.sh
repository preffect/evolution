#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy-main.sh — redeploy a running checkout from origin/main (#291).
#
#   scripts/deploy-main.sh           # deploy once; a no-op when already deployed at origin/main
#   scripts/deploy-main.sh --watch   # poll origin/main and deploy every time it moves (./run.sh starts this)
#
# A deploy fast-forwards the target to origin/main, runs `pnpm install --frozen-lockfile` only when
# pnpm-lock.yaml changed in the deployed range, builds the shared package, deletes the Angular
# dependency prebundle (packages/client/.angular/cache: it is built from the OLD shared package, and
# without deleting it the browser loads a module missing the new exports), then restarts the stack
# with `./run.sh --no-deploy-watch`. The human hard-refreshes the browser afterwards.
#
# It refuses, and logs why, when the target's branch does not track origin/main, has tracked
# changes, or cannot fast-forward. Untracked files are fine. It never resets or forces anything.
# Every step is logged with an ISO timestamp to <target>/.game-logs/deploy.log; deploy.lock beside it
# keeps two deploys from overlapping; deployed-sha records the last COMPLETE deploy, so one that failed
# half way is retried by the next manual run rather than looking done (--watch waits for the next
# commit instead of retrying the same one every poll).
#
# Environment:
#   DEPLOY_TARGET_DIR              checkout to deploy (default: the main checkout of this repository)
#   DEPLOY_WATCH_INTERVAL_SECONDS  --watch poll interval (default 60)
#   DEPLOY_INSTALL_COMMAND, DEPLOY_BUILD_COMMAND, DEPLOY_RESTART_COMMAND
#                                  replace a step's command (the tests stub them so no server starts)
# Ports: the restart inherits PORT / CLIENT_PORT, which run.sh reads.
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

UPSTREAM_REMOTE=origin
UPSTREAM_BRANCH=main
UPSTREAM="$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
DEFAULT_WATCH_INTERVAL_SECONDS=60
LOCKFILE_PATH=pnpm-lock.yaml
ANGULAR_PREBUNDLE_CACHE_DIR=packages/client/.angular/cache
SHORT_SHA_LENGTH=12
EXIT_USAGE=1
EXIT_REFUSED=2
EXIT_FAILED=3

main_checkout_dir() { # the parent of the shared .git directory: the main checkout, even from a worktree
  dirname "$(git -C "$(dirname "$SCRIPT_PATH")" rev-parse --path-format=absolute --git-common-dir)"
}

TARGET_DIR="${DEPLOY_TARGET_DIR:-$(main_checkout_dir)}"
WATCH_INTERVAL_SECONDS="${DEPLOY_WATCH_INTERVAL_SECONDS:-$DEFAULT_WATCH_INTERVAL_SECONDS}"
INSTALL_COMMAND="${DEPLOY_INSTALL_COMMAND:-pnpm install --frozen-lockfile}"
BUILD_COMMAND="${DEPLOY_BUILD_COMMAND:-pnpm --filter @evolution/shared build}"
RESTART_COMMAND="${DEPLOY_RESTART_COMMAND:-./run.sh --no-deploy-watch}"

LOG_DIR="$TARGET_DIR/.game-logs"
LOG_FILE="$LOG_DIR/deploy.log"
LOCK_FILE="$LOG_DIR/deploy.lock"
DEPLOYED_SHA_FILE="$LOG_DIR/deployed-sha"

last_notice=""       # --watch repeats a refusal on every poll; it is logged once until it changes
failed_target_sha="" # --watch does not retry a commit whose deploy failed
deployed_now=false

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

deploy_steps() { # <from-sha> <to-sha>
  run_step fast-forward "git merge --ff-only --quiet $2" || return
  if git -C "$TARGET_DIR" diff --quiet "$1" "$2" -- "$LOCKFILE_PATH" 2>/dev/null; then
    log "step install: skipped, $LOCKFILE_PATH unchanged"
  else
    run_step install "$INSTALL_COMMAND" || return
  fi
  run_step build-shared "$BUILD_COMMAND" || return
  run_step clear-prebundle "rm -rf $ANGULAR_PREBUNDLE_CACHE_DIR" || return
  run_step restart "$RESTART_COMMAND"
}

refusal_reason() { # <head> <target-sha> — prints why the target cannot be deployed, nothing when it can
  if [[ -n "$(git -C "$TARGET_DIR" status --porcelain --untracked-files=no)" ]]; then
    echo "$TARGET_DIR has tracked changes; commit or stash them (untracked files are fine)"
  elif ! git -C "$TARGET_DIR" merge-base --is-ancestor "$1" "$2"; then
    echo "$(short "$1") cannot fast-forward to $UPSTREAM $(short "$2")"
  fi
}

deploy_locked() {
  local branch upstream fetch_error head target_sha deployed_sha reason
  if ! branch="$(git -C "$TARGET_DIR" symbolic-ref --quiet --short HEAD)"; then
    notice "refused: $TARGET_DIR is on a detached HEAD, not a branch tracking $UPSTREAM"
    return "$EXIT_REFUSED"
  fi
  upstream="$(git -C "$TARGET_DIR" rev-parse --abbrev-ref "$branch@{upstream}" 2>/dev/null)" || upstream="no upstream"
  if [[ "$upstream" != "$UPSTREAM" ]]; then
    notice "refused: $TARGET_DIR is on $branch ($upstream), not a branch tracking $UPSTREAM"
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
  if [[ "$target_sha" == "$failed_target_sha" ]]; then
    return "$EXIT_FAILED"
  fi
  reason="$(refusal_reason "$head" "$target_sha")"
  if [[ -n "$reason" ]]; then
    notice "refused: $reason"
    return "$EXIT_REFUSED"
  fi

  [[ -f "$DEPLOYED_SHA_FILE" ]] || echo "$deployed_sha" > "$DEPLOYED_SHA_FILE"
  last_notice=""
  log "deploying $(short "$deployed_sha") -> $(short "$target_sha") in $TARGET_DIR"
  if ! deploy_steps "$deployed_sha" "$target_sha"; then
    failed_target_sha="$target_sha"
    log "deploy of $(short "$target_sha") FAILED; the stack may be stale (run scripts/deploy-main.sh to retry)"
    return "$EXIT_FAILED"
  fi
  echo "$target_sha" > "$DEPLOYED_SHA_FILE"
  deployed_now=true
  log "deployed $(short "$target_sha"); hard-refresh the browser"
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
  mkdir -p "$LOG_DIR"
  log "watching $UPSTREAM every ${WATCH_INTERVAL_SECONDS}s for $TARGET_DIR (pid $$)"
  while true; do
    deploy_once || true
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
  *) sed -n '3,6p' "$SCRIPT_PATH"; exit "$EXIT_USAGE" ;;
esac
