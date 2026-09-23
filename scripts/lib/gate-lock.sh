#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# gate-lock.sh — the repo's slug and validate.sh's machine-wide gate slots (#329, #380). Sourced. The workspace
# setup never takes them: it has its own per-checkout lock (scripts/lib/workspace-ready.sh).
#
# A run takes one slot of its phase's class, so a cheap phase never queues behind a heavy one:
#   heavy  test, integration, typecheck: multi-core runners (vitest and the Angular builder spawn about one
#          worker per core); VALIDATE_HEAVY_SLOTS, else one per GATE_HEAVY_RUN_CORES cores, capped by memory
#   light  lint, duplication: one core each (eslint, prettier, jscpd); VALIDATE_LIGHT_SLOTS, else one per
#          GATE_LIGHT_RUN_CORES cores (they run beside a heavy run that already fills every core), capped by memory
#   none   no lock (a lint that runs no eslint: prettier on docs and the audits)
#
#   repo_slug <root>                        SLUG from PORTS.env, else the main checkout's directory name (the
#                                           same for every worktree of the repo), else the root's own name
#   gate_lock_dir <root>                    VALIDATE_GATE_LOCK_DIR, else $HOME/.cache/<slug>-validate (falling
#                                           back to ${TMPDIR:-/tmp}/<slug>-validate)
#   gate_slot_count <heavy|light>           the slots of a class, at least 1; a non-numeric override is warned
#                                           about and ignored
#   gate_lock_acquire <root> <class> <what> <holder>
#                                           a free slot of <class> on fd 9, with a holder file naming this pid,
#                                           cwd and <holder>; waiters are served first come first served, and one
#                                           still waiting after GATE_QUEUE_GRACE_SECONDS prints who holds the
#                                           slots; nothing for class none or VALIDATE_NO_GATE_LOCK=1, unlocked
#                                           with a note without flock
#   gate_lock_release                       removes the holder file, unlocks and closes fd 9 (a no-op when no
#                                           slot is held, so traps may call it)
#
# Files in the lock dir: heavy slot 0 is gate.lock (the one lock of #329, so a branch still carrying the old
# validate.sh excludes a new heavy run), then gate-heavy-<i>.lock and gate-light-<i>.lock; each slot has a
# <slot>.holder, and each class a gate-<class>.queue.lock that orders the waiters.
# ---------------------------------------------------------------------------

GATE_CLASS_HEAVY="heavy"
GATE_CLASS_LIGHT="light"
GATE_CLASS_NONE="none"
GATE_HEAVY_RUN_CORES=2        # a heavy runner uses cores - 2 workers (#475): two runs share a 4-core box (#561)
GATE_LIGHT_RUN_CORES=2        # a light run uses one core, beside a heavy run that already fills them (#380)
GATE_HEAVY_RUN_MEMORY_MB=4096 # a heavy runner's processes were sampled near 1.1 GB; headroom for coverage (#380)
GATE_LIGHT_RUN_MEMORY_MB=1024 # eslint over the client peaks near 1 GB (#380)
GATE_SLOT_POLL_SECONDS=0.5
GATE_QUEUE_GRACE_SECONDS=1 # whole seconds a run waits silently before it announces the wait
GATE_LEGACY_LOCK_NAME="gate.lock"
GATE_SLOT_PATH="" # the held slot's lock file (on fd 9; the class queue is fd 8 while waiting)

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
gate_lock_dir() { # <root>
  local slug dir="${VALIDATE_GATE_LOCK_DIR:-}"
  if [[ -z "$dir" ]]; then
    slug="$(repo_slug "$1")"
    dir="$HOME/.cache/$slug-validate"
    { mkdir -p "$dir" 2>/dev/null && [[ -w "$dir" ]]; } || dir="${TMPDIR:-/tmp}/$slug-validate"
  fi
  mkdir -p "$dir" 2>/dev/null && [[ -w "$dir" ]] && echo "$dir"
}

gate_slot_path() { # <dir> <class> <index>
  if [[ "$2" == "$GATE_CLASS_HEAVY" && "$3" -eq 0 ]]; then echo "$1/$GATE_LEGACY_LOCK_NAME"; else echo "$1/gate-$2-$3.lock"; fi
}

# The slots one machine affords: an override, else cores per run, capped by the memory each run holds.
gate_slot_count() { # <heavy|light>
  local override_name cores memory_mb cores_per_run run_memory_mb count
  if [[ "$1" == "$GATE_CLASS_HEAVY" ]]; then
    override_name=VALIDATE_HEAVY_SLOTS cores_per_run=$GATE_HEAVY_RUN_CORES run_memory_mb=$GATE_HEAVY_RUN_MEMORY_MB
  else
    override_name=VALIDATE_LIGHT_SLOTS cores_per_run=$GATE_LIGHT_RUN_CORES run_memory_mb=$GATE_LIGHT_RUN_MEMORY_MB
  fi
  local override="${!override_name:-}"
  if [[ "$override" =~ ^[0-9]+$ ]]; then
    count=$override
  else
    [[ -z "$override" ]] || echo "${0##*/}: $override_name=$override is not a number; using the automatic slot count" >&2
    cores="$(nproc 2>/dev/null || echo 1)"
    memory_mb="$(awk '/^MemTotal:/ { printf "%d", $2 / 1024 }' /proc/meminfo 2>/dev/null || true)"
    count=$((cores / cores_per_run))
    [[ -z "$memory_mb" || $((memory_mb / run_memory_mb)) -ge $count ]] || count=$((memory_mb / run_memory_mb))
  fi
  echo $((count < 1 ? 1 : count))
}

# Takes the first free slot of <class> on fd 9 without waiting; fails when every slot is held.
gate_try_slots() { # <dir> <class> <count>
  local index path
  for ((index = 0; index < $3; index++)); do
    path="$(gate_slot_path "$1" "$2" "$index")"
    exec 9>>"$path" || continue
    if flock -n 9; then
      GATE_SLOT_PATH="$path"
      return 0
    fi
    exec 9>&-
  done
  return 1
}

# The queue head's wait for a slot. A single slot is waited on in the kernel, as an old validate.sh waits on
# gate.lock, so a stream of old runs cannot starve it; several slots are polled.
gate_wait_for_slot() { # <dir> <class> <count>
  if [[ "$3" -eq 1 ]]; then
    GATE_SLOT_PATH="$(gate_slot_path "$1" "$2" 0)"
    exec 9>>"$GATE_SLOT_PATH"
    flock 9
    return 0
  fi
  until gate_try_slots "$1" "$2" "$3"; do sleep "$GATE_SLOT_POLL_SECONDS"; done
}

# "pid P in CWD: HOLDER, since T" for each held slot; a holder file whose pid is gone says so, and a slot
# held without a readable holder file (a holder between its flock and its write, or just releasing) is "unnamed".
gate_holders() { # <dir> <class> <count>
  local index path line pid described=()
  for ((index = 0; index < $3; index++)); do
    path="$(gate_slot_path "$1" "$2" "$index")"
    ! flock -n "$path" true 2>/dev/null || continue
    line="$(head -n 1 "$path.holder" 2>/dev/null || true)"
    pid="${line#pid }"
    pid="${pid%% *}"
    if [[ -z "$line" || ! "$pid" =~ ^[0-9]+$ ]]; then
      described+=("an unnamed holder")
    elif kill -0 "$pid" 2>/dev/null; then
      described+=("$line")
    else
      described+=("a stale holder entry ($line; that pid is gone)")
    fi
  done
  local joined
  printf -v joined '%s; ' "${described[@]}"
  echo "${joined%; }"
}

gate_write_holder() { # <holder>
  printf 'pid %s in %s: %s, since %s\n' "$$" "$PWD" "$1" "$(date +%H:%M:%S)" > "$GATE_SLOT_PATH.holder.tmp.$$" \
    && mv "$GATE_SLOT_PATH.holder.tmp.$$" "$GATE_SLOT_PATH.holder"
}

gate_announce_wait() { # <dir> <class> <count> <what>
  local plural="s"
  [[ "$3" -ne 1 ]] || plural=""
  echo "waiting for a $2 gate slot before $4 ($3 slot$plural, lock dir $1), held by: $(gate_holders "$1" "$2" "$3")"
}

# Microseconds since the epoch, from bash's EPOCHREALTIME.
gate_now_microseconds() { local now="${EPOCHREALTIME/[.,]/}"; echo $((10#$now)); }

gate_lock_acquire() { # <root> <class> <what> <holder>
  local script="${0##*/}" class="$2" dir count waited_from announcer waited_microseconds
  [[ "${VALIDATE_NO_GATE_LOCK:-0}" != "1" && "$class" != "$GATE_CLASS_NONE" ]] || return 0
  command -v flock >/dev/null 2>&1 || { echo "$script: flock not found; running unlocked" >&2; return 0; }
  dir="$(gate_lock_dir "$1")" || { echo "$script: gate lock directory unavailable; running unlocked" >&2; return 0; }
  count="$(gate_slot_count "$class")"
  exec 8>>"$dir/gate-$class.queue.lock" || { echo "$script: gate queue unavailable ($dir); running unlocked" >&2; return 0; }
  # Every waiter blocks on the queue at once, so the kernel serves them in arrival order; the queue head then
  # waits for a slot. A timer announces the wait only when it outlasts the grace, so runs arriving together
  # print nothing. It closes the lock fds first: a forked copy would keep a lock alive.
  waited_from="$(gate_now_microseconds)"
  (
    exec 8>&- 9>&-
    sleep "$GATE_QUEUE_GRACE_SECONDS" >/dev/null 2>&1
    gate_announce_wait "$dir" "$class" "$count" "$3"
  ) &
  announcer=$!
  flock 8
  gate_try_slots "$dir" "$class" "$count" || gate_wait_for_slot "$dir" "$class" "$count"
  kill "$announcer" 2>/dev/null || true
  wait "$announcer" 2>/dev/null || true
  exec 8>&-
  waited_microseconds=$(($(gate_now_microseconds) - waited_from))
  if [[ $waited_microseconds -ge $((GATE_QUEUE_GRACE_SECONDS * 1000000)) ]]; then
    echo "got a $class gate slot after $((waited_microseconds / 1000000)) s"
  fi
  gate_write_holder "$4"
}

gate_lock_release() {
  [[ -n "$GATE_SLOT_PATH" ]] || return 0
  # Only our own entry: a stale reader never deletes a newer holder's file.
  ! grep -q "^pid $$ " "$GATE_SLOT_PATH.holder" 2>/dev/null || rm -f "$GATE_SLOT_PATH.holder"
  flock -u 9 2>/dev/null || true
  exec 9>&-
  GATE_SLOT_PATH=""
}
