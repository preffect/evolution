# Engineering Standards: the validation gate

§1 of the split [`ENGINEERING.md`](../ENGINEERING.md), which keeps the shared context and the file list.

## 1. The Validation Gate (`./validate.sh`)

1. **Always use `./validate.sh`. Never run the underlying tools directly.** Do not reach for
   `pnpm -r test`, `pnpm test`, `pnpm typecheck`, `npx tsc`, `pnpm eslint`, `pnpm prettier`,
   or `pnpm --filter ... exec vitest` as a shortcut. The wrapper:
   - makes the checkout runnable before every real run (never a cache hit; `scripts/lib/workspace-ready.sh`,
     #329, which `./run.sh` also runs before it stops the running stack, and the deploy before its
     restart): under a per-checkout setup lock, never the machine-wide gate lock, waiting at most
     `WORKSPACE_SETUP_LOCK_TIMEOUT_SECONDS` (300) and failing loudly after, `pnpm install --frozen-lockfile` when
     `node_modules/.pnpm/lock.yaml` is missing or differs from `pnpm-lock.yaml`, and the
     `@evolution/shared` build when `dist/index.d.ts` is missing or a shared source or config is newer
     than its tsbuildinfo, one line each, so a fresh worktree needs no manual step and downstream
     `.d.ts` references are fresh — running `tsc` directly gives stale/false results;
   - runs **eslint AND prettier `--check` as a pair** — running only eslint silently misses
     formatting failures — then audits the source for `eslint-disable` directives without a
     `-- reason` and for `TODO`s without a ticket (`docs/CODE-STANDARDS.md` §7), printing the
     directive count;
   - runs **`jscpd`** (`duplication`) against `.jscpd.json`: ≥ 5 duplicated lines / 50 tokens
     anywhere in `packages/*/src` outside tests and `testing/` fails (`docs/CODE-STANDARDS.md`
     §3); import blocks are ignored; the offending file pairs are printed with line ranges;
   - runs the unit tier **with coverage thresholds** (`docs/testing/tiers-and-builders.md` §5), so a drop below a
     package's floor fails `test`; an unscoped `test` then runs the tooling's shell suites
     (`scripts/*.test.sh`: the result cache, `run.sh`, the deploy watcher), which a scoped run skips;
   - **narrows with `--scope`** (#281): `--scope shared|server|client` runs every phase on one
     package (its tests keep the package's coverage floor unless `-- extra-args` filter them: a
     filtered or path-scoped `test` has no coverage floor; typecheck builds shared first when stale);
     `--scope <file or directory under packages/<package>/src>` runs only the tests that path
     selects (a directory: the tests under it; a source file: the tests named after it) **without**
     coverage floors, lints, formats and scans that path, and typechecks its package. Either scope's
     `lint` also prettier-checks the docs (`*.md` outside `packages/`) the branch changed against
     `origin/main` and names them (#329), so a scoped lint is never green over unformatted docs. No `--scope`
     is the whole repo, exactly as before; an empty `--scope` is refused. `test` and `integration`
     print `selected <package>: N test files, M tests run[, K skipped]`, and a targeted run (a path
     scope or `-- extra-args`) that runs no test — nothing selected, or every selected test skipped
     — **fails** (#289); a tier-wide run over a package with no file in that tier still passes, and
     a runner that crashes keeps its own error;
   - runs `all` as lint → duplication → typecheck → test and **stops at the first failing phase**
     (`FAILED: <phase>`; the later phases never run, #304); each phase has its own exit code and
     stamp, and a run ends with a `wall times:` line (run concurrently the phases measured no faster
     on the shared container, #281);
   - **`all --affected`** (#304, the merge gate) checks only what the branch changed against
     `origin/main` (committed, uncommitted and untracked): the changed packages plus their dependents
     (a `packages/shared` change selects all three); lint alone for a docs-only change (`*.md`,
     `docs/`, `qa/`: prettier on the changed docs plus the docs index); the shell suites for a
     `scripts/` or root `*.sh` change; the plain `all` for any other root file. It prints
     `affected <what>: <why>` for each selection, skips the phases with nothing to check, and is
     stamped per affected set (`scope=affected-<set>`; a root-file change is `affected-everything`, so a
     plain `all` stamp never answers it). After the unit tests it runs the **integration tier**
     (`*.integration.test.ts`, `*.integration.spec.ts`, `*.gameplay.test.ts`; #344) of each selected
     package that has one, fail-fast and stamped like the other phases, and prints
     `affected integration: <package> (N files) …`; a docs-only or scripts-only branch skips it. It
     checks the tree that will merge: it first fetches `origin main` (best effort: a failed fetch says so
     and compares against the local copy), then **refuses a branch behind `origin/main`**
     (`run git merge origin/main first`) before reading any stamp, so a green stamp from an old base
     cannot pass. It never merges, rebases or stashes on its own;
   - **caches green results by content** (#224, template #75): a green run is stamped under
     `$HOME/.cache/<slug>-validate/<tree>.<command>[.scope-<scope>]` (the scope with `/` as `_`;
     fields: `exit`, ISO `time`, `log` path, `node` major, `command`, `scope`, `tree`; the raw log
     under `logs/`), keyed by `git write-tree` of the
     whole working tree — tracked and untracked, via a temporary index — plus the Node major
     version. **"Same tree" includes untracked files**: a worktree at the author's commit misses
     the author's stamp when either side has any untracked, non-ignored file. A repeat call on the
     same tree prints `cached green from <time> at tree <hash>` and the stored log path and exits
     0 in well under a second; the filters apply to the stored log. Red is never cached, `all`
     stamps each phase and itself, `--fresh` bypasses the stamp, and `-- extra-args` calls are
     never cached. The scope is part of the stamp: a scoped green never answers an unscoped call,
     nor the reverse. The stamp names the tree the merge gate ran on. Nothing
     prunes the stamps: `rm -rf ~/.cache/<slug>-validate` clears them, and so does a container
     rebuild (`~/.cache` is not a mount). A CI run, where a game adds one, passes `--fresh` (or
     sets `VALIDATE_CACHE_DIR` to a scratch directory) so it never trusts a stamp. **One real gate
     at a time per machine** (#234): every non-cached run holds `$HOME/.cache/<slug>-validate/gate.lock`
     (independent of `VALIDATE_CACHE_DIR`, so a scratch cache still queues), so a second agent's gate
     prints `waiting for another gate to finish …` and queues instead of both starving the box; a
     cache hit never waits; the lock fd is closed for the child so no orphaned worker keeps it.
     `VALIDATE_NO_GATE_LOCK=1` disables it for a sandboxed test; without `flock` it runs unlocked;
   - is pre-authorized in `.claude/settings.json`, so it never trips a permission prompt.
2. **Who runs which gate** (#281, #304). A full gate costs minutes (§2.2), so it runs once per PR,
   at merge. This applies to direct work AND delegated work (teams, agents).
   - **Builders:** scoped checks only — `./validate.sh test --scope <scope>` with a package or a
     path, and `lint` / `typecheck` in the same scope — on what they touched. Fix every failure
     before moving on. No gate when a PR is ready, and no re-gate after review fixes. When no scope
     fits, add one to `validate.sh` (item 3).
   - **Reviewers:** scoped checks on what they review. A reviewer never needs a stamp and never
     runs `all`.
   - **Whoever merges:** runs `./validate.sh all --affected` once on the final head, right before
     the merge, and merges only on its `ALL PASSED`; the integration tier is part of it. When it
     refuses a branch behind `origin/main`, merge `origin/main` into the branch (never rebase a
     reviewed PR), push, and run the gate on that head.
   - **Long gates:** a real `all` or `integration` runs in the background (the agent's
     `run_in_background`), with `set -o pipefail` before any pipe; the verdict is the command's own
     exit code, never a `tail` of its output.
3. **If `./validate.sh` does not support what you need** (a flag, a scope, an output mode),
   **STOP and extend the script (or prompt the user to)** — never route around it with a raw
   tool invocation.
4. Use the output filters instead of dumping full logs: `-tN` (tail), `-hN` (head),
   `-G PATTERN` (grep), `-- extra-args` (passthrough). Example: `./validate.sh test -G 'fail'`.
   For `test` and `integration` the extra args reach one package's runner, so they need a one-package
   `--scope` (vitest and the Angular builder read different arguments). For the client (#329) an
   extra arg that is not an option is a file filter as vitest reads one, a substring of the spec's
   repo- or package-relative path, passed as one `--include` per matching spec of the tier (under a
   file path scope, only the spec that file selects); options pass through, and a word right after an
   option written without `=` is its value (`--reporter verbose`), never a filter, so give filters first.
   A filtered `test` (a non-option extra arg, `-t`, `--testNamePattern` or `--filter`) runs without
   the coverage floor, in every package.
   `--fresh` re-runs regardless of the result cache.

```text
./validate.sh test         # unit tier with coverage thresholds
./validate.sh integration  # *.integration.test.ts / *.integration.spec.ts tier + *.gameplay.test.ts (opt-in; all --affected runs it)
./validate.sh typecheck    # type check all packages (builds shared first when stale)
./validate.sh lint         # eslint + prettier --check + disable-directive / TODO audit + docs/INDEX.md freshness
./validate.sh duplication  # jscpd (.jscpd.json)
./validate.sh all          # lint -> duplication -> typecheck -> test, stopping at the first red phase; prints wall times and ALL PASSED / FAILED: <phase>
./validate.sh all --affected  # the merge gate: only what the branch changed against origin/main, then its integration tier; refuses a branch behind origin/main
./validate.sh all --fresh  # same, ignoring the result cache (a green run is still stamped)
./validate.sh test --scope server                          # one package, with its coverage floor
./validate.sh test --scope packages/server/src/game/world  # only the tests under a path, no coverage floor
```
