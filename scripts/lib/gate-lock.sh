#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# gate-lock.sh — the repo's slug and its one-gate-at-a-time lock, shared by validate.sh and run.sh (#329).
# Sourced.
#
#   repo_slug <root>                  SLUG from PORTS.env, else the main checkout's directory name (the same
#                                     for every worktree of the repo), else the root's own name
#   gate_lock_acquire <root> <what>   an exclusive lock on $HOME/.cache/<slug>-validate/gate.lock (falling
#                                     back to ${TMPDIR:-/tmp}) on fd 9, printing a line when it has to wait;
#                                     nothing with VALIDATE_NO_GATE_LOCK=1, unlocked with a note without flock
#   gate_lock_release                 unlocks and closes fd 9
# ---------------------------------------------------------------------------

GATE_LOCK_FD=""

repo_slug() { # <root>
  local slug common_dir
  slug="$(sed -n 's/^SLUG=//p' "$1/PORTS.env" 2>/dev/null | head -n 1 || true)"
  if [[ -z "$slug" ]]; then
    common_dir="$(git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
    [[ -z "$common_dir" ]] || slug="$(basename "$(dirname "$common_dir")")"
  fi
  [[ -n "$slug" ]] || slug="$(basename "$1")"
  echo "$slug"
}

# Machine-wide per repo: never under VALIDATE_CACHE_DIR, which a CI run points at scratch.
gate_lock_path() { # <root>
  local slug dir
  slug="$(repo_slug "$1")"
  dir="$HOME/.cache/$slug-validate"
  if mkdir -p "$dir" 2>/dev/null && [[ -w "$dir" ]]; then echo "$dir/gate.lock"; else echo "${TMPDIR:-/tmp}/$slug-validate-gate.lock"; fi
}

gate_lock_acquire() { # <root> <what>
  local path script="${0##*/}"
  [[ "${VALIDATE_NO_GATE_LOCK:-0}" != "1" ]] || return 0
  command -v flock >/dev/null 2>&1 || { echo "$script: flock not found; running unlocked" >&2; return 0; }
  path="$(gate_lock_path "$1")"
  exec 9>>"$path" || { echo "$script: gate lock unavailable ($path); running unlocked" >&2; return 0; }
  GATE_LOCK_FD=9
  if ! flock -n 9; then
    echo "waiting for another gate to finish before $2 (lock $path)"
    flock 9
  fi
}

gate_lock_release() { [[ -z "$GATE_LOCK_FD" ]] || { flock -u 9; exec 9>&-; GATE_LOCK_FD=""; }; }
