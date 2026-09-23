#!/usr/bin/env python3
"""cpu_attribution.py — which worktree and which kind of work a process is (ticket #521), for
scripts/lib/cpu_sampler.py. The worktree comes from the process's cwd; the kind from its own command
line, then its ancestors' (a vitest worker is its package's tests, an esbuild under ng serve is ng serve,
a command claude ran is "other": only claude itself is "claude")."""

import os
import re

ANCESTOR_DEPTH_MAX = 12
OUTSIDE_REPO = "(outside repo)"
MAIN_CHECKOUT = "(main checkout)"
UNREADABLE = "(unreadable)"
TYPECHECK_PATTERN = re.compile(r"(^|[/ ])(tsc|ngc|vue-tsc)( |$)| typecheck( |$)")
KIND_OTHER = "other"
KIND_CLAUDE = "claude"


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
