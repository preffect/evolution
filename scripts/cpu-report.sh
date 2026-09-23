#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# cpu-report.sh — the top CPU consumers over the last N hours (ticket #521), from the samples
# scripts/cpu-sampler.sh records in <main checkout>/.game-logs/cpu.csv.
#
#   scripts/cpu-report.sh [hours]     default 1; fractions work (0.25 = the last 15 min)
#
# Prints core-seconds, average cores busy and share by kind, by worktree and by both, plus the machine
# rows: host-busy (every container on the host), container (this one) and attributed (what the
# sampler assigned to a process). Environment: CPU_SAMPLER_LOG (the csv path).
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$(git -C "$SCRIPT_DIR" rev-parse --path-format=absolute --git-common-dir)")"
export CPU_SAMPLER_REPO_ROOT="$REPO_ROOT"
export CPU_SAMPLER_LOG="${CPU_SAMPLER_LOG:-$REPO_ROOT/.game-logs/cpu.csv}"
exec python3 "$SCRIPT_DIR/lib/cpu_report.py" "${1:-1}"
