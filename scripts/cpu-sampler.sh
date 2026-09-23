#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# cpu-sampler.sh — record who uses the dev box's cores, every 10 s (ticket #521).
#
#   scripts/cpu-sampler.sh start     start the machine-wide sampler in the background (one per machine)
#   scripts/cpu-sampler.sh stop      stop it
#   scripts/cpu-sampler.sh status    say whether it runs, and the log's size
#   scripts/cpu-sampler.sh run       sample in the foreground (CPU_SAMPLER_SAMPLES=N stops after N samples)
#
# One python process reads /proc each interval (scripts/lib/cpu_sampler.py: no fork per sample, under 1%
# of a core) and appends a row per (worktree, kind) that used CPU to <main checkout>/.game-logs/cpu.csv,
# whichever worktree starts it; the log rotates to cpu.csv.1 at 64 MiB. scripts/cpu-report.sh reads it.
# The sampler outlives the shell that started it on purpose: it is the one long-lived process that is
# meant to (rule 8 of .claude/roles/_common.md does not cover it). Stop it with `stop`.
# Environment: CPU_SAMPLER_INTERVAL_SECONDS (10), CPU_SAMPLER_LOG (the csv path).
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$(git -C "$SCRIPT_DIR" rev-parse --path-format=absolute --git-common-dir)")"
LOG_DIR="$REPO_ROOT/.game-logs"
export CPU_SAMPLER_REPO_ROOT="$REPO_ROOT"
export CPU_SAMPLER_LOG="${CPU_SAMPLER_LOG:-$LOG_DIR/cpu.csv}"
PID_FILE="${CPU_SAMPLER_LOG%.csv}-sampler.pid"
SAMPLER="$SCRIPT_DIR/lib/cpu_sampler.py"
SAMPLER_MARKER=cpu_sampler.py

running_pid() { # prints the sampler's pid when the pid file names a live sampler
  local pid
  [[ -f "$PID_FILE" ]] || return 1
  pid="$(cat "$PID_FILE")"
  [[ "$pid" =~ ^[0-9]+$ ]] && grep -qa "$SAMPLER_MARKER" "/proc/$pid/cmdline" 2>/dev/null || return 1
  echo "$pid"
}

mkdir -p "$(dirname "$CPU_SAMPLER_LOG")"
case "${1:-status}" in
  run) exec python3 "$SAMPLER" ;;
  start)
    if pid="$(running_pid)"; then echo "cpu sampler already running (pid $pid) -> $CPU_SAMPLER_LOG"; exit 0; fi
    nohup setsid python3 "$SAMPLER" >>"${CPU_SAMPLER_LOG%.csv}-sampler.log" 2>&1 </dev/null &
    echo $! >"$PID_FILE"
    echo "cpu sampler started (pid $!) -> $CPU_SAMPLER_LOG; stop it with scripts/cpu-sampler.sh stop"
    ;;
  stop)
    if pid="$(running_pid)"; then kill "$pid"; echo "cpu sampler stopped (pid $pid)"; else echo "cpu sampler not running"; fi
    rm -f "$PID_FILE"
    ;;
  status)
    if pid="$(running_pid)"; then echo "cpu sampler running (pid $pid)"; else echo "cpu sampler not running"; fi
    [[ ! -f "$CPU_SAMPLER_LOG" ]] || echo "log: $CPU_SAMPLER_LOG ($(wc -l <"$CPU_SAMPLER_LOG") rows)"
    ;;
  *) echo "usage: scripts/cpu-sampler.sh start|stop|status|run" >&2; exit 2 ;;
esac
