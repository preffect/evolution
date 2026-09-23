#!/usr/bin/env python3
"""cpu_sampler.py — who uses the dev box's cores (ticket #521). Driven by scripts/cpu-sampler.sh and
scripts/cpu-report.sh; see those for usage.

Reads /proc every INTERVAL seconds in one long-lived process (no fork per sample) and appends
one CSV row per (worktree, kind) that used CPU in the interval:

    epoch,iso_time,interval_seconds,worktree,kind,core_seconds,processes,top_command

core_seconds is user + system time over the interval (1.0 = one core busy for one second). A process's
own time is counted while it lives; the time of a child that started and exited between two samples
reaches its parent's cutime/cstime when reaped, and is attributed to the parent's worktree and kind.
Three machine-wide rows per sample check the attribution: `(machine),host-busy` (/proc/stat, every
container on the host), `(machine),container` (this container's cgroup) and `(machine),attributed`
(the sum of the per-process rows). container − attributed is what the sampler missed; host-busy −
container is load from outside this container.

scripts/lib/cpu_report.py reads the log.
"""

import csv
import os
import re
import time
from collections import defaultdict

PROC_ROOT = os.environ.get("CPU_SAMPLER_PROC", "/proc")
CGROUP_CPU_STAT = os.environ.get("CPU_SAMPLER_CGROUP_CPU_STAT", "/sys/fs/cgroup/cpu.stat")
CLOCK_TICKS_PER_SECOND = os.sysconf("SC_CLK_TCK")
MICROSECONDS_PER_SECOND = 1_000_000
ROTATE_BYTES = 64 * 1024 * 1024
TOP_COMMAND_CHARACTERS = 80
ANCESTOR_DEPTH_MAX = 12
MIN_REPORTED_CORE_SECONDS = 0.005

CSV_HEADER = ["epoch", "iso_time", "interval_seconds", "worktree", "kind", "core_seconds", "processes", "top_command"]
MACHINE_WORKTREE = "(machine)"
OUTSIDE_REPO = "(outside repo)"
MAIN_CHECKOUT = "(main checkout)"
UNREADABLE = "(unreadable)"

TYPECHECK_PATTERN = re.compile(r"(^|[/ ])(tsc|ngc|vue-tsc)( |$)| typecheck( |$)")
KIND_OTHER = "other"
KIND_CLAUDE = "claude"
# stat fields after the ")" that closes comm: index 0 is field 3 (state) of proc(5).
STAT_PPID, STAT_UTIME, STAT_STIME, STAT_CUTIME, STAT_CSTIME, STAT_STARTTIME = 1, 11, 12, 13, 14, 19
# /proc/stat cpu line: user nice system idle iowait irq softirq steal
PROC_STAT_IDLE_COLUMNS = (3, 4)
PROC_STAT_COUNTED_COLUMNS = 8


def classify_test_run(command, cwd, ancestor_commands):
    """The kind of a vitest / Angular test process, from its package and whether it runs the opt-in tier."""
    tier = "integration" if any("integration" in each for each in [command, *ancestor_commands]) else "tests"
    if "/packages/client" in cwd or "@evolution/client" in " ".join(ancestor_commands):
        return f"client {tier}"
    return f"server/shared {tier}"


def classify_own(command):
    """A kind from the process's own command line, or None when it names nothing known."""
    program = os.path.basename(command.split(" ", 1)[0])
    rules = [
        (program == "claude", KIND_CLAUDE),
        ("ng serve" in command, "ng serve"),
        ("tsx" in command and "src/index.ts" in command, "game server"),
        (any(each in command for each in ("chrom", "playwright", "headless_shell")), "playwright/chromium"),
        ("jscpd" in command, "jscpd"),
        ("eslint" in command or "prettier" in command, "lint/prettier"),
        (TYPECHECK_PATTERN.search(command) is not None, "typecheck"),
        (".test.sh" in command, "shell suites"),
        ("validate.sh" in command, "validate.sh (orchestration)"),
        ("main-gate.sh" in command, "main gate (orchestration)"),
        ("cpu_sampler" in command, "cpu sampler"),
    ]
    for matched, kind in rules:
        if matched:
            return kind
    return None


def is_test_runner(command):
    return "vitest" in command or "ng test" in command or "tinypool" in command or " test:integration" in command


class ProcessTable:
    """One /proc scan: pid -> ppid, own ticks, reaped-children ticks and (pid, starttime), the key a reused pid changes."""

    def __init__(self):
        self.entries = {}
        for name in os.listdir(PROC_ROOT):
            if name.isdigit():
                self._read(int(name))

    def _read(self, pid):
        base = f"{PROC_ROOT}/{pid}"
        try:
            with open(f"{base}/stat", "rb") as stat_file:
                raw = stat_file.read().decode("utf-8", "replace")
        except OSError:
            return
        fields = raw[raw.rfind(")") + 2 :].split()
        own = int(fields[STAT_UTIME]) + int(fields[STAT_STIME])
        children = int(fields[STAT_CUTIME]) + int(fields[STAT_CSTIME])
        key = (pid, fields[STAT_STARTTIME])
        self.entries[pid] = {"ppid": int(fields[STAT_PPID]), "own": own, "children": children, "key": key}

    def command(self, pid, cache):
        entry = self.entries[pid]
        if entry["key"] not in cache:
            try:
                with open(f"{PROC_ROOT}/{pid}/cmdline", "rb") as cmdline_file:
                    text = cmdline_file.read().replace(b"\0", b" ").decode("utf-8", "replace").strip()
            except OSError:
                text = ""
            cache[entry["key"]] = text
        return cache[entry["key"]]

    def cwd(self, pid):
        try:
            return os.readlink(f"{PROC_ROOT}/{pid}/cwd")
        except OSError:
            return ""


class Attributor:
    """Maps a process to (worktree, kind); caches worktree roots by directory."""

    def __init__(self, repo_root):
        self.repo_root = repo_root.rstrip("/")
        self.worktrees_dir = f"{self.repo_root}/.worktrees/"
        self.command_cache = {}  # (pid, starttime) -> command line
        self.worktree_cache = {}

    def worktree(self, cwd):
        if not cwd:
            return UNREADABLE
        if cwd not in self.worktree_cache:
            self.worktree_cache[cwd] = self._worktree_of(cwd)
        return self.worktree_cache[cwd]

    def _worktree_of(self, cwd):
        if cwd.startswith(self.worktrees_dir):
            directory = cwd
            while directory.startswith(self.worktrees_dir):
                if os.path.exists(f"{directory}/.git"):
                    return directory[len(self.worktrees_dir) :]
                directory = os.path.dirname(directory)
            return cwd[len(self.worktrees_dir) :]
        if cwd == self.repo_root or cwd.startswith(self.repo_root + "/"):
            return MAIN_CHECKOUT
        return OUTSIDE_REPO

    def attribute(self, table, pid):
        command = table.command(pid, self.command_cache)
        cwd = table.cwd(pid)
        ancestors = []
        ancestor = table.entries[pid]["ppid"]
        while ancestor in table.entries and len(ancestors) < ANCESTOR_DEPTH_MAX:
            ancestors.append(ancestor)
            ancestor = table.entries[ancestor]["ppid"]
        ancestor_commands = [table.command(each, self.command_cache) for each in ancestors]
        return self.worktree(cwd), self._kind(command, cwd, ancestor_commands), command

    def _kind(self, command, cwd, ancestor_commands):
        for index, candidate in enumerate([command, *ancestor_commands]):
            if is_test_runner(candidate):
                return classify_test_run(command, cwd, ancestor_commands)
            kind = classify_own(candidate)
            if kind == KIND_CLAUDE and index > 0:
                return KIND_OTHER  # a tool command claude ran, not claude itself
            if kind is not None:
                return kind
        return KIND_OTHER


def read_host_busy_ticks():
    with open(f"{PROC_ROOT}/stat") as stat_file:
        columns = [int(each) for each in stat_file.readline().split()[1 : 1 + PROC_STAT_COUNTED_COLUMNS]]
    return sum(columns) - sum(columns[each] for each in PROC_STAT_IDLE_COLUMNS)


def read_container_microseconds():
    try:
        with open(CGROUP_CPU_STAT) as stat_file:
            for line in stat_file:
                name, value = line.split()
                if name == "usage_usec":
                    return int(value)
    except OSError:
        pass
    return None


def interval_usage(previous, current):
    """Ticks each live pid used since the previous scan, including children reaped in between."""
    usage = {}
    vanished_by_parent = defaultdict(int)
    for pid, entry in previous.items():
        if pid not in current or current[pid]["key"] != entry["key"]:
            vanished_by_parent[entry["ppid"]] += entry["own"] + entry["children"]
    for pid, entry in current.items():
        before = previous.get(pid)
        if before is None or before["key"] != entry["key"]:
            own, reaped = entry["own"], entry["children"]
        else:
            own = entry["own"] - before["own"]
            reaped = entry["children"] - before["children"] - vanished_by_parent.get(pid, 0)
        usage[pid] = own + max(reaped, 0)
    return usage


def sample_rows(attributor, previous_table, table, interval_seconds):
    usage = interval_usage(previous_table.entries, table.entries)
    groups = defaultdict(lambda: {"ticks": 0, "processes": 0, "top_ticks": -1, "top": ""})
    for pid, ticks in usage.items():
        if ticks <= 0:
            continue
        worktree, kind, command = attributor.attribute(table, pid)
        group = groups[(worktree, kind)]
        group["ticks"] += ticks
        group["processes"] += 1
        if ticks > group["top_ticks"]:
            group["top_ticks"], group["top"] = ticks, command[:TOP_COMMAND_CHARACTERS]
    rows = []
    for (worktree, kind), group in sorted(groups.items()):
        core_seconds = group["ticks"] / CLOCK_TICKS_PER_SECOND
        if core_seconds >= MIN_REPORTED_CORE_SECONDS:
            rows.append([worktree, kind, core_seconds, group["processes"], group["top"]])
    attributed = sum(ticks for ticks in usage.values() if ticks > 0) / CLOCK_TICKS_PER_SECOND
    rows.append([MACHINE_WORKTREE, "attributed", attributed, len(usage), ""])
    return rows


def open_log(path):
    if os.path.exists(path) and os.path.getsize(path) > ROTATE_BYTES:
        os.replace(path, path + ".1")
    is_new = not os.path.exists(path) or os.path.getsize(path) == 0
    log_file = open(path, "a", newline="")
    if is_new:
        csv.writer(log_file).writerow(CSV_HEADER)
        log_file.flush()
    return log_file


def run_sampler(repo_root, log_path, interval_seconds, sample_count):
    attributor = Attributor(repo_root)
    previous_table = ProcessTable()
    previous_host, previous_container = read_host_busy_ticks(), read_container_microseconds()
    previous_time = time.monotonic()
    taken = 0
    while sample_count <= 0 or taken < sample_count:
        time.sleep(max(0.0, previous_time + interval_seconds - time.monotonic()))
        table, now = ProcessTable(), time.monotonic()
        host, container = read_host_busy_ticks(), read_container_microseconds()
        elapsed = now - previous_time
        rows = sample_rows(attributor, previous_table, table, elapsed)
        rows.append([MACHINE_WORKTREE, "host-busy", (host - previous_host) / CLOCK_TICKS_PER_SECOND, 0, ""])
        if container is not None and previous_container is not None:
            container_seconds = (container - previous_container) / MICROSECONDS_PER_SECOND
            rows.append([MACHINE_WORKTREE, "container", container_seconds, 0, ""])
        epoch = int(time.time())
        iso_time = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(epoch))
        with open_log(log_path) as log_file:
            writer = csv.writer(log_file)
            for worktree, kind, core_seconds, processes, top in rows:
                writer.writerow([epoch, iso_time, f"{elapsed:.2f}", worktree, kind, f"{core_seconds:.3f}", processes, top])
        previous_table, previous_host, previous_container, previous_time = table, host, container, now
        attributor.command_cache = {key: value for key, value in attributor.command_cache.items() if key[0] in table.entries}
        taken += 1


def main():
    run_sampler(
        os.environ["CPU_SAMPLER_REPO_ROOT"],
        os.environ["CPU_SAMPLER_LOG"],
        float(os.environ.get("CPU_SAMPLER_INTERVAL_SECONDS", "10")),
        int(os.environ.get("CPU_SAMPLER_SAMPLES", "0")),
    )


if __name__ == "__main__":
    main()
