#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# main-gate.sh — the timed gate on main (ticket #494, docs/WORKFLOW.md §5.1).
#
# Lane-1 and lane-2 PRs merge on scoped checks, so `./validate.sh all` runs here, against origin/main,
# instead of once per PR. Each run: fetch, and if origin/main moved since the last run, check it out
# detached in its own worktree (never the main checkout — that is the human's game) and gate it.
# Green records the sha; red logs every commit since the last green, which is the suspect list for
# the revert §5.1 asks for. `--watch` repeats every MAIN_GATE_INTERVAL_SECONDS (default 3600).
# Log: <repo>/.game-logs/main-gate.log. State: <repo>/.game-logs/main-gate.last-green / .last-run.
# ---------------------------------------------------------------------------
set -uo pipefail

UPSTREAM=origin/main
DEFAULT_INTERVAL_SECONDS=3600
INTERVAL_SECONDS="${MAIN_GATE_INTERVAL_SECONDS:-$DEFAULT_INTERVAL_SECONDS}"

REPO_ROOT="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
LOG_DIR="$REPO_ROOT/.game-logs"
LOG="$LOG_DIR/main-gate.log"
LAST_GREEN="$LOG_DIR/main-gate.last-green"
LAST_RUN="$LOG_DIR/main-gate.last-run"
WORKTREE="$REPO_ROOT/.worktrees/main-gate"
mkdir -p "$LOG_DIR"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG"; }

gate_once() {
  git -C "$REPO_ROOT" fetch origin main --quiet || { log "fetch failed"; return 1; }
  local head; head="$(git -C "$REPO_ROOT" rev-parse "$UPSTREAM")"
  if [[ -f "$LAST_RUN" && "$(cat "$LAST_RUN")" == "$head" ]]; then
    log "unchanged at ${head:0:12}; nothing to gate"
    return 0
  fi

  if [[ -e "$WORKTREE" ]] || git -C "$REPO_ROOT" worktree list | grep -q " $WORKTREE "; then
    git -C "$REPO_ROOT" worktree remove --force "$WORKTREE" 2>/dev/null; rm -rf "$WORKTREE"
    git -C "$REPO_ROOT" worktree prune
  fi
  git -C "$REPO_ROOT" worktree add --detach "$WORKTREE" "$head" >/dev/null 2>&1 || { log "worktree add failed"; return 1; }

  log "gating ${head:0:12}"
  local rc
  (cd "$WORKTREE" && ./validate.sh all >>"$LOG" 2>&1); rc=$?
  echo "$head" >"$LAST_RUN"
  if [[ $rc -eq 0 ]]; then
    echo "$head" >"$LAST_GREEN"
    log "GREEN ${head:0:12}"
  else
    local since=""; [[ -f "$LAST_GREEN" ]] && since="$(cat "$LAST_GREEN").."
    log "RED ${head:0:12} (validate rc $rc) — commits since last green, newest first:"
    git -C "$REPO_ROOT" log --oneline "${since}${head}" | tee -a "$LOG"
  fi
  git -C "$REPO_ROOT" worktree remove --force "$WORKTREE" 2>/dev/null
  return $rc
}

if [[ "${1:-}" == "--watch" ]]; then
  while true; do gate_once; sleep "$INTERVAL_SECONDS"; done
else
  gate_once
fi
