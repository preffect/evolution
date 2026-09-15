#!/usr/bin/env bash
# gate-lock.test.sh — exercises validate.sh's machine-wide gate slots (scripts/lib/gate-lock.sh, #380) in a
# temporary lock dir (VALIDATE_GATE_LOCK_DIR), never the machine's own: a slot count comes from its override or
# from cores and memory, at least 1; light runs up to their slot count run together and the next one waits,
# naming every holder's pid, cwd and command, then takes the slot a holder frees; a heavy run never waits on
# light ones, nor a light run on a heavy one; class none and VALIDATE_NO_GATE_LOCK=1 never wait; a branch's old
# validate.sh holding gate.lock takes heavy slot 0 (an unnamed holder), and a holder file whose pid is gone is
# named stale; a release removes only its own holder file.
#
#   scripts/gate-lock.test.sh        # exit 0 when every case passes
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sandbox="$(mktemp -d)"
holder_pids=()
cleanup() {
  local pid
  for pid in "${holder_pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  rm -rf "$sandbox"
}
trap cleanup EXIT
source "$repo_root/scripts/lib/shell-test.sh"

HOLDER_LIFETIME_SECONDS=60
export VALIDATE_GATE_LOCK_DIR="$sandbox/locks" VALIDATE_HEAVY_SLOTS=1 VALIDATE_LIGHT_SLOTS=2
unset VALIDATE_NO_GATE_LOCK
library="$repo_root/scripts/lib/gate-lock.sh"

# A run that takes a slot of <class>, writes <name>.acquired, then holds it; its output goes to <name>.log.
start_run() { # <class> <name> -> $run_pid
  bash -c 'source "$1"; gate_lock_acquire "$2" "$3" "$4" "holder $4"; touch "$2/$4.acquired"; exec sleep "$5"' \
    _ "$library" "$sandbox" "$1" "$2" "$HOLDER_LIFETIME_SECONDS" > "$sandbox/$2.log" 2>&1 &
  run_pid=$!
  holder_pids+=("$run_pid")
}
acquired() { [[ -e "$sandbox/$1.acquired" ]]; }
logged() { grep -q -- "$2" "$sandbox/$1.log"; } # <name> <pattern>
slot_count() { (source "$library"; gate_slot_count "$1"); }

# --- slot counts ------------------------------------------------------------------------------------
cores="$(nproc)"
check "an override sets the slot count" $(( $(VALIDATE_HEAVY_SLOTS=3 slot_count heavy) == 3 ))
check "a zero override still leaves one slot" $(( $(VALIDATE_LIGHT_SLOTS=0 slot_count light) == 1 ))
auto_heavy="$(VALIDATE_HEAVY_SLOTS='' slot_count heavy)"
auto_light="$(VALIDATE_LIGHT_SLOTS='' slot_count light)"
check "without an override heavy gets one slot per 4 cores, at least 1 (got $auto_heavy on $cores cores)" $(( auto_heavy >= 1 && auto_heavy <= (cores / 4 > 1 ? cores / 4 : 1) ))
check "without an override light gets one slot per 2 cores, at least 1 (got $auto_light)" $(( auto_light >= 1 && auto_light <= (cores / 2 > 1 ? cores / 2 : 1) ))
override_warning="$(VALIDATE_LIGHT_SLOTS=two slot_count light 2>&1 >/dev/null)"
check "a non-numeric override is warned about and ignored" $(( $(holds grep -q 'VALIDATE_LIGHT_SLOTS=two is not a number' <<<"$override_warning") && $(VALIDATE_LIGHT_SLOTS=two slot_count light 2>/dev/null) == auto_light ))

# --- light slots fill, then the next run waits and names the holders ----------------------------------
start_run light lint-one
lint_one_pid=$run_pid
start_run light lint-two
check "light runs up to the slot count take slots at once" $(( $(holds wait_for acquired lint-one) && $(holds wait_for acquired lint-two) && ! $(holds logged lint-one waiting) && ! $(holds logged lint-two waiting) ))
start_run light lint-three
check "the next light run waits" $(( $(holds wait_for logged lint-three '^waiting for a light gate slot before lint-three (2 slots') && ! $(holds acquired lint-three) ))
check "its waiting line names each holder's pid, cwd and command" $(( $(holds logged lint-three "pid $lint_one_pid in $PWD: holder lint-one, since ") && $(holds logged lint-three 'holder lint-two') ))
start_run heavy test-one
test_one_pid=$run_pid
check "a heavy run never waits on light slots" $(( $(holds wait_for acquired test-one) && ! $(holds logged test-one waiting) ))
kill "$lint_one_pid"
check "a freed slot goes to the waiting run" $(( $(holds wait_for acquired lint-three) && $(holds logged lint-three '^got a light gate slot after [0-9]* s$') ))

# --- heavy: a light run never waits on it; the next heavy one does ----------------------------------
start_run heavy test-two
check "a second heavy run waits for the single heavy slot" $(( $(holds wait_for logged test-two "held by: pid $test_one_pid in $PWD: holder test-one") && ! $(holds acquired test-two) ))
kill "$test_one_pid"
check "and runs once it is freed" $(( $(holds wait_for acquired test-two) ))

# --- first come first served, including the runs that arrive during another's grace second -------------
queue_holder_pid=$run_pid
queued=()
for index in 1 2 3 4 5; do
  start_run heavy "queued-$index"
  queued+=("$run_pid")
  sleep 0.3
done
served_in_order=1
kill "$queue_holder_pid"
for index in 1 2 3 4 5; do
  wait_for acquired "queued-$index" || served_in_order=0
  for later in $(seq $((index + 1)) 5); do ! acquired "queued-$later" || served_in_order=0; done
  kill "${queued[index - 1]}"
done
check "waiters arriving 0.3 s apart are served in arrival order" $served_in_order

rc=0
(source "$library"; gate_lock_acquire "$sandbox" none lint-none "holder none") > "$sandbox/none.log" 2>&1 || rc=$?
check "class none returns at once while every slot is held" $(( rc == 0 && ! $(holds logged none waiting) ))
(VALIDATE_NO_GATE_LOCK=1; source "$library"; gate_lock_acquire "$sandbox" heavy unlocked "holder unlocked") > "$sandbox/unlocked.log" 2>&1
check "VALIDATE_NO_GATE_LOCK=1 never waits" $(( ! $(holds logged unlocked waiting) ))
for pid in "${holder_pids[@]}"; do kill "$pid" 2>/dev/null || true; done
wait 2>/dev/null || true

# --- an old validate.sh on gate.lock, stale entries, release -----------------------------------------
rm -f "$VALIDATE_GATE_LOCK_DIR"/*.holder # the killed runs above never released: their entries are stale
bash -c 'exec 9>>"$1"; flock 9; exec sleep "$2"' _ "$VALIDATE_GATE_LOCK_DIR/gate.lock" "$HOLDER_LIFETIME_SECONDS" &
legacy_pid=$!
holder_pids+=("$legacy_pid")
wait_for eval '! flock -n "$VALIDATE_GATE_LOCK_DIR/gate.lock" true'
start_run heavy after-legacy
check "an old validate.sh holding gate.lock holds heavy slot 0, as an unnamed holder" $(( $(holds wait_for logged after-legacy 'held by: an unnamed holder$') && ! $(holds acquired after-legacy) ))
start_run light light-beside-legacy
check "a light run does not wait on it" $(( $(holds wait_for acquired light-beside-legacy) && ! $(holds logged light-beside-legacy waiting) ))
bash -c 'exit 0' &
gone_pid=$!
wait "$gone_pid" || true
echo "pid $gone_pid in /elsewhere: ./validate.sh test, since 00:00:00" > "$VALIDATE_GATE_LOCK_DIR/gate.lock.holder"
start_run heavy after-stale
check "a holder entry whose pid is gone is named stale" $(( $(holds wait_for logged after-stale "a stale holder entry (pid $gone_pid in /elsewhere: ./validate.sh test, since 00:00:00; that pid is gone)") ))
kill "$legacy_pid"
check "the head of the queue takes the slot once the old gate ends" $(( $(holds wait_for acquired after-legacy) && ! $(holds acquired after-stale) ))
for pid in "${holder_pids[@]}"; do kill "$pid" 2>/dev/null || true; done
wait 2>/dev/null || true

(source "$library"; gate_lock_acquire "$sandbox" light release "holder release"; test -s "$GATE_SLOT_PATH.holder"; gate_lock_release; test ! -e "$VALIDATE_GATE_LOCK_DIR/gate-light-0.lock.holder") && rc=0 || rc=$?
check "a release removes its own holder file" $(( rc == 0 ))
(source "$library"; gate_lock_acquire "$sandbox" light keep "holder keep"; echo "pid 1 in /other: newer holder, since 00:00:00" > "$GATE_SLOT_PATH.holder"; gate_lock_release; test -s "$VALIDATE_GATE_LOCK_DIR/gate-light-0.lock.holder") && rc=0 || rc=$?
check "and never another holder's" $(( rc == 0 ))

finish_suite gate-lock.test.sh
