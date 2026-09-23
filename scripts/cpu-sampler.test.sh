#!/usr/bin/env bash
# cpu-sampler.test.sh — exercises scripts/lib/cpu_sampler.py and cpu_report.py (#521) against a fake /proc in a sandbox: a live
# process is charged its own delta, a new one its whole time, a child reaped between two scans is charged
# to its parent minus what was already counted while it lived, and a reused pid starts over; a vitest
# worker in a worktree is "client tests" of that worktree, an esbuild under ng serve is "ng serve", a
# command claude ran is "other" and claude itself "claude"; the report ranks kinds with shares of the
# attributed total and prints the machine rows; the wrapper's start / status / stop drive a real sampler
# that writes rows, and stop leaves nothing running.
#
#   scripts/cpu-sampler.test.sh        # exit 0 when every case passes
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sandbox="$(mktemp -d)"
cleanup() {
  CPU_SAMPLER_LOG="$sandbox/log/cpu.csv" "$repo_root/scripts/cpu-sampler.sh" stop >/dev/null 2>&1 || true
  rm -rf "$sandbox"
}
trap cleanup EXIT
source "$repo_root/scripts/lib/shell-test.sh"

# --- the attribution and the report, in python against a fake /proc ------------------------------
python_output="$(CPU_SAMPLER_PROC="$sandbox/proc" SANDBOX="$sandbox" PYTHONPATH="$repo_root/scripts/lib" python3 - <<'PY'
import os
import cpu_sampler as sampler

sandbox = os.environ["SANDBOX"]
proc = f"{sandbox}/proc"
repo = f"{sandbox}/repo"
worktree = f"{repo}/.worktrees/feat/1-thing"
os.makedirs(f"{worktree}/packages/client")
open(f"{worktree}/.git", "w").write("gitdir: elsewhere\n")

def verdict(description, holds):
    print(("ok   " if holds else "FAIL ") + description)

def fake_process(pid, ppid, command, cwd, own=0, children=0, starttime=100):
    os.makedirs(f"{proc}/{pid}", exist_ok=True)
    fields = ["S", ppid] + [0] * 9 + [own, 0, children, 0] + [0] * 4 + [starttime]
    open(f"{proc}/{pid}/stat", "w").write(f"{pid} (comm with ) paren) " + " ".join(map(str, fields)) + "\n")
    open(f"{proc}/{pid}/cmdline", "wb").write(command.replace(" ", "\0").encode() + b"\0")
    link = f"{proc}/{pid}/cwd"
    if os.path.lexists(link):
        os.remove(link)
    os.symlink(cwd, link)

# interval_usage on hand-made scans
entry = lambda ppid, own, children, pid, start=1: {"ppid": ppid, "own": own, "children": children, "key": (pid, start)}
previous = {10: entry(1, 100, 0, 10), 11: entry(10, 40, 0, 11), 12: entry(1, 500, 0, 12)}
current = {10: entry(1, 105, 70, 10), 13: entry(10, 30, 5, 13), 12: entry(1, 7, 0, 12, start=2)}
usage = sampler.interval_usage(previous, current)
verdict("a live process is charged its own delta plus the unseen part of a reaped child (5 + 70 - 40)", usage[10] == 35)
verdict("a process new since the last scan is charged its whole time, reaped children included", usage[13] == 35)
verdict("a reused pid (new starttime) starts over instead of going negative", usage[12] == 7)

# classification on a fake /proc
fake_process(1, 0, "/sbin/init", "/")
fake_process(20, 1, "claude --resume abc", repo)
fake_process(21, 20, "/usr/bin/zsh -c eval grep x", repo)
fake_process(22, 21, "bash ./validate.sh test --scope client", worktree)
fake_process(23, 22, "node /usr/bin/pnpm --filter @evolution/client test", f"{worktree}/packages/client")
fake_process(24, 23, "ng test (client)", f"{worktree}/packages/client")
fake_process(25, 24, "node (vitest 1)", f"{worktree}/packages/client")
fake_process(30, 1, "ng serve --port 4402", f"{repo}/packages/client")
fake_process(31, 30, "/node_modules/esbuild --service=0.28.2", f"{repo}/packages/client")
fake_process(32, 22, "node node_modules/.bin/eslint packages/client", worktree)
table = sampler.ProcessTable()
attributor = sampler.Attributor(repo)
kind_of = lambda pid: attributor.attribute(table, pid)[:2]
verdict("the comm field may hold ') ' and still parses", table.entries[25]["ppid"] == 24)
verdict("a vitest worker in a worktree is that worktree's client tests", kind_of(25) == ("feat/1-thing", "client tests"))
verdict("esbuild under ng serve in the main checkout is ng serve", kind_of(31) == (sampler.MAIN_CHECKOUT, "ng serve"))
verdict("a command claude ran is other, not claude", kind_of(21) == (sampler.MAIN_CHECKOUT, "other"))
verdict("claude itself is claude", kind_of(20)[1] == "claude")
verdict("eslint is lint/prettier", kind_of(32)[1] == "lint/prettier")
verdict("validate.sh itself is its orchestration", kind_of(22)[1] == "validate.sh (orchestration)")
verdict("a cwd outside the repository is outside it", attributor.worktree("/tmp") == sampler.OUTSIDE_REPO)
PY
)"
echo "$python_output"
PYTHON_CASES=11
check "the $PYTHON_CASES python cases all ran and passed" \
  "$(( $(grep -c '^ok ' <<<"$python_output") == PYTHON_CASES && $(grep -c '^FAIL' <<<"$python_output" || true) == 0 ))"

# --- the report on a fixture log ---------------------------------------------------------------
fixture="$sandbox/fixture.csv"
now="$(date +%s)"
{
  echo "epoch,iso_time,interval_seconds,worktree,kind,core_seconds,processes,top_command"
  echo "$((now - 10)),t,10.00,feat/a,client tests,30.0,4,node (vitest 1)"
  echo "$((now - 10)),t,10.00,(main checkout),ng serve,10.0,1,ng serve"
  echo "$((now - 10)),t,10.00,(machine),attributed,40.0,9,"
  echo "$((now - 10)),t,10.00,(machine),host-busy,45.0,0,"
  echo "$now,t,10.00,feat/a,client tests,30.0,4,node (vitest 1)"
  echo "$now,t,10.00,(machine),attributed,30.0,9,"
  echo "$((now - 99999)),t,10.00,feat/old,typecheck,999.0,1,tsc"
} >"$fixture"
report="$(CPU_SAMPLER_LOG="$fixture" "$repo_root/scripts/cpu-report.sh" 1)"
echo "$report"
check "the report ranks client tests first with 60 of 70 core-seconds (85.7%)" "$(holds grep -Eq '^ +60 +3\.00 +85\.7%  client tests' <<<"$report")"
check "the report leaves out samples older than the window" "$(holds bash -c '! grep -q typecheck' <<<"$report")"
check "the report prints the machine rows" "$(holds grep -Eq '^  host-busy +45 core-s' <<<"$report")"
check "an empty window says so and fails" "$(holds bash -c "! CPU_SAMPLER_LOG='$sandbox/none.csv' '$repo_root/scripts/cpu-report.sh' 1 >/dev/null")"

# --- the wrapper: start, status, stop ------------------------------------------------------------
export CPU_SAMPLER_LOG="$sandbox/log/cpu.csv" CPU_SAMPLER_INTERVAL_SECONDS=0.2
started="$("$repo_root/scripts/cpu-sampler.sh" start)"
check "start reports the pid and the log" "$(holds grep -q 'cpu sampler started (pid' <<<"$started")"
check "a second start finds the running sampler" "$(holds grep -q 'already running' <<<"$("$repo_root/scripts/cpu-sampler.sh" start)")"
check "the sampler writes attributed rows" "$(holds wait_for grep -q '(machine),attributed' "$CPU_SAMPLER_LOG")"
check "status says it runs" "$(holds grep -q 'cpu sampler running' <<<"$("$repo_root/scripts/cpu-sampler.sh" status)")"
sampler_pid="$(cat "$sandbox/log/cpu-sampler.pid")"
"$repo_root/scripts/cpu-sampler.sh" stop >/dev/null
check "stop ends the sampler" "$(holds wait_for bash -c "! kill -0 $sampler_pid")"
check "status then says it does not run" "$(holds grep -q 'not running' <<<"$("$repo_root/scripts/cpu-sampler.sh" status)")"

finish_suite cpu-sampler.test.sh
