#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# wait-for.sh — block in the FOREGROUND until a background Bash task finishes (ticket #519).
#
# An agent that ends its turn while a background command runs is often never woken when the command
# ends (the "idle, waiting on a job" stall). So an agent never ends its turn on a running command: it
# calls this in the foreground (Bash timeout 600000) with the task's output file, which the harness
# printed when it started the command ("Output is being written to: <file>").
#
#   scripts/wait-for.sh <output-file> [tail-lines]
#
# Exit 0: the task finished — its last lines are printed. Exit 3: still running after
# WAIT_FOR_MAX_SECONDS (default 540, under the Bash tool's 600 s cap) — call it again.
# ---------------------------------------------------------------------------
set -uo pipefail

OUTPUT_FILE=${1:?usage: wait-for.sh <output-file> [tail-lines]}
TAIL_LINES=${2:-40}
MAX_SECONDS=${WAIT_FOR_MAX_SECONDS:-540}
POLL_SECONDS=5
EXIT_MARKER='^\[(exited with code [0-9]+|killed)\]$'
STILL_RUNNING=3

[[ -f "$OUTPUT_FILE" ]] || { echo "wait-for.sh: no such output file: $OUTPUT_FILE" >&2; exit 1; }

waited=0
until grep -Eq "$EXIT_MARKER" "$OUTPUT_FILE"; do
  if ((waited >= MAX_SECONDS)); then
    echo "wait-for.sh: still running after ${waited}s — call wait-for.sh again (do NOT end your turn)."
    tail -n 5 "$OUTPUT_FILE"
    exit $STILL_RUNNING
  fi
  sleep $POLL_SECONDS
  waited=$((waited + POLL_SECONDS))
done
tail -n "$TAIL_LINES" "$OUTPUT_FILE"
