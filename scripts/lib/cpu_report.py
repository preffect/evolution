#!/usr/bin/env python3
"""cpu_report.py — the top CPU consumers in the log scripts/lib/cpu_sampler.py writes (ticket #521), by kind,
by worktree and by both. Run through scripts/cpu-report.sh [hours]."""

import csv
import os
import sys
import time
from collections import defaultdict

from cpu_sampler import MACHINE_WORKTREE

SECONDS_PER_HOUR = 3600
REPORT_TOP_ROWS = 12
# A headless Chromium session: consecutive samples of one worktree's Chromium above BROWSER_BUSY_CORES, with gaps no
# longer than BROWSER_SESSION_GAP_SECONDS. A live game tab keeps SwiftShader near one core whatever its frame rate, so
# a long session is usually a tab left on the game after its frame was taken (ticket #521).
BROWSER_KIND = "playwright/chromium"
BROWSER_BUSY_CORES = 0.3
BROWSER_SESSION_GAP_SECONDS = 30
BROWSER_LONG_SESSION_SECONDS = 300

def read_rows(log_path, since_epoch):
    rows = []
    for path in (log_path + ".1", log_path):
        if not os.path.exists(path):
            continue
        with open(path, newline="") as log_file:
            for row in csv.DictReader(log_file):
                try:
                    if int(row["epoch"]) >= since_epoch:
                        rows.append(row)
                except (KeyError, TypeError, ValueError):
                    continue
    return rows


def print_table(title, totals, window_seconds, attributed_total, top_commands=None):
    print(f"\n{title}")
    print(f"  {'core-s':>10} {'cores':>6} {'share':>6}  name")
    ranked = sorted(totals.items(), key=lambda item: item[1], reverse=True)[:REPORT_TOP_ROWS]
    for name, core_seconds in ranked:
        share = core_seconds / attributed_total if attributed_total else 0.0
        label = " / ".join(name) if isinstance(name, tuple) else name
        suffix = f"   e.g. {top_commands[name]}" if top_commands and name in top_commands else ""
        print(f"  {core_seconds:>10.0f} {core_seconds / window_seconds:>6.2f} {share:>6.1%}  {label}{suffix}")


def browser_sessions(rows):
    """(worktree, start epoch, seconds, core-seconds) of each busy headless Chromium session in the rows."""
    samples = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))  # worktree -> epoch -> [core-s, interval]
    for row in rows:
        if row["kind"] == BROWSER_KIND:
            sample = samples[row["worktree"]][int(row["epoch"])]
            sample[0] += float(row["core_seconds"])
            sample[1] = float(row["interval_seconds"])
    sessions = []
    for worktree, by_epoch in samples.items():
        busy = [epoch for epoch, (used, interval) in sorted(by_epoch.items()) if used >= BROWSER_BUSY_CORES * interval]
        start = last = None
        core_seconds = 0.0
        for epoch in busy:
            if last is not None and epoch - last > BROWSER_SESSION_GAP_SECONDS:
                sessions.append((worktree, start, last - start, core_seconds))
                start, core_seconds = None, 0.0
            start = epoch if start is None else start
            last = epoch
            core_seconds += by_epoch[epoch][0]
        if start is not None:
            sessions.append((worktree, start, last - start, core_seconds))
    return sessions


def print_long_browser_sessions(rows):
    long_sessions = [session for session in browser_sessions(rows) if session[2] >= BROWSER_LONG_SESSION_SECONDS]
    print(f"\nHeadless Chromium busy for {BROWSER_LONG_SESSION_SECONDS // 60} min or more (a game tab left open?)")
    if not long_sessions:
        print("  none")
    for worktree, start, seconds, core_seconds in sorted(long_sessions, key=lambda session: session[1]):
        started = time.strftime("%H:%M", time.gmtime(start))
        print(f"  {started}Z  {seconds / 60:>5.1f} min  {core_seconds:>6.0f} core-s  {worktree}")


def run_report(log_path, hours):
    now = int(time.time())
    rows = read_rows(log_path, now - int(hours * SECONDS_PER_HOUR))
    if not rows:
        print(f"no samples in the last {hours} h in {log_path}")
        return 1
    first_epoch = min(int(row["epoch"]) - float(row["interval_seconds"]) for row in rows)
    window_seconds = max(1.0, max(int(row["epoch"]) for row in rows) - first_epoch)
    machine, by_kind, by_worktree, by_both = defaultdict(float), defaultdict(float), defaultdict(float), defaultdict(float)
    heaviest_command = {}
    for row in rows:
        core_seconds = float(row["core_seconds"])
        if row["worktree"] == MACHINE_WORKTREE:
            machine[row["kind"]] += core_seconds
            continue
        by_kind[row["kind"]] += core_seconds
        by_worktree[row["worktree"]] += core_seconds
        by_both[(row["worktree"], row["kind"])] += core_seconds
        if row["top_command"] and heaviest_command.get(row["kind"], ("", -1))[1] < core_seconds:
            heaviest_command[row["kind"]] = (row["top_command"], core_seconds)
    attributed = machine.get("attributed", sum(by_kind.values()))
    print(f"CPU over the last {window_seconds / SECONDS_PER_HOUR:.2f} h ({len(rows)} rows, {log_path})")
    print("  core-s = core-seconds used; cores = average cores busy over the window; share = of the attributed total")
    for name in ("host-busy", "container", "attributed"):
        if name in machine:
            print(f"  {name:<11} {machine[name]:>10.0f} core-s  {machine[name] / window_seconds:>5.2f} cores")
    print_table("By kind", by_kind, window_seconds, attributed, {k: v[0] for k, v in heaviest_command.items()})
    print_table("By worktree", by_worktree, window_seconds, attributed)
    print_table("By worktree and kind", by_both, window_seconds, attributed)
    print_long_browser_sessions(rows)
    return 0


def main(arguments):
    return run_report(os.environ["CPU_SAMPLER_LOG"], float(arguments[0]) if arguments else 1.0)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
