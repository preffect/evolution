# Engineering Standards: the validation gate

§1 of the split [`ENGINEERING.md`](../ENGINEERING.md), which keeps the shared context and the file list.

## 1. The Validation Gate (`./validate.sh`)

1. **Always use `./validate.sh`. Never run the underlying tools directly.** Do not reach for
   `pnpm -r test`, `pnpm test`, `pnpm typecheck`, `npx tsc`, `pnpm eslint`, `pnpm prettier`,
   or `pnpm --filter ... exec vitest` as a shortcut, and never `prettier --write` or `eslint --fix` to
   fix what lint reports: `./validate.sh format` does that. The wrapper:
   - makes the checkout runnable before every real run (never a cache hit; `scripts/lib/workspace-ready.sh`,
     #329, which `./run.sh` also runs before it stops the running stack, and the deploy before its
     restart): under a per-checkout setup lock, never the machine-wide gate lock, waiting at most
     `WORKSPACE_SETUP_LOCK_TIMEOUT_SECONDS` (300) and failing loudly after, `pnpm install --frozen-lockfile` when
     `node_modules/.pnpm/lock.yaml` is missing or differs from `pnpm-lock.yaml`, and the
     `@evolution/shared` build when `dist/index.d.ts` is missing or a shared source or config is newer
     than its tsbuildinfo, one line each, so a fresh worktree needs no manual step and downstream
     `.d.ts` references are fresh — running `tsc` directly gives stale/false results; between the two it
     regenerates the git-ignored `docs/INDEX.md` (`scripts/docs-index.sh`, #407) when it is missing, the docs
     no longer match the fingerprint it stores, or it was written before prettier was installed, and installs the shared hooks that
     refresh it after a checkout or merge; the index is never committed, so lint does not check it;
   - runs **eslint AND prettier `--check` as a pair** — running only eslint silently misses
     formatting failures — then audits the source for `eslint-disable` directives without a
     `-- reason` and for `TODO`s without a ticket (`docs/CODE-STANDARDS.md` §7), printing the
     directive count;
   - fixes what lint's tools can fix with **`format`** (#641): `eslint --fix`, then `prettier --write`,
     over the paths `lint` reads for the same `--scope` (a scoped format also writes the docs the branch
     changed against `origin/main`), with the lint caches unless `--fresh`; it prints the files it changed
     (the working tree's hash before and after) and exits 0 unless a tool fails to run (a prettier syntax
     error, an eslint crash). Problems eslint cannot fix leave it green and point at `lint`, so run `lint`
     after it. It takes no extra args and is **never cached**: it changes the tree, and it proves nothing
     about lint;
   - runs **`jscpd`** (`duplication`) against `.jscpd.json`: ≥ 5 duplicated lines / 50 tokens
     anywhere in `packages/*/src` outside tests and `testing/` fails (`docs/CODE-STANDARDS.md`
     §3); import blocks are ignored; the offending file pairs are printed with line ranges;
   - runs the unit tier **with coverage thresholds** (`docs/testing/tiers-and-builders.md` §5), so a drop below a
     package's floor fails `test`; an unscoped `test` then runs the tooling's shell suites
     (`scripts/*.test.sh`: the result cache, `run.sh`, the deploy watcher), which a scoped run skips;
   - **caps the test workers below the core count** (#475): vitest's forks pool defaults to
     `availableParallelism() - 1` workers and does not count its own main process, which alone serves
     the vite transforms, the coverage collection and the reporters for all of them — on the 4-core box
     four CPU-hungry processes for four cores before any other agent's load, multiplied again because
     `pnpm -r test` runs each selected package's runner at the same time. `test` and `integration` set
     `VITEST_MAX_FORKS` / `VITEST_MAX_THREADS` to **cores − 2**, reserving one core for the runner's
     main process (the part that has to answer a worker inside the RPC watchdog below) and one for the
     rest of the box. An inherited value wins, for a one-off experiment;
   - **names an unhandled runner error for what it is** (#475): an error thrown outside any test is
     counted on the runner's own `Errors N` line, and exits it non-zero while the per-test counts still
     read `Tests 2449 passed (2449)` — output indistinguishable from a green run, which only the exit
     code contradicts. `test` and `integration` fail on that count, in their last lines, whatever the
     runner's own exit code was, and such a run is never stamped green. The commonest one is vitest's
     **worker RPC watchdog** (`[vitest-worker]: Timeout calling "onTaskUpdate"`): a timer in each test
     worker that fails the run when the runner has not acknowledged an update the worker sent. Unpatched
     it is birpc's `DEFAULT_TIMEOUT`, **60 s** hard-coded in vitest 3.2.7 with no option behind it (`teardownTimeout` is the pool's
     shutdown budget, not this; the only seam is a custom pool that copies vitest's own), and a
     starved runner outran it with every test green (#437). `patches/vitest@3.2.7.patch` (pnpm's
     `patchedDependencies`) makes it read `VITEST_WORKER_RPC_TIMEOUT_MS` (whole milliseconds, 1 to
     2147483647, `setTimeout`'s largest delay; anything else keeps the 60 s), which `test` and `integration`
     set to **180 s**, three times vitest's own, and an inherited value wins. The same timer also bounds the
     worker's module fetches during collection, which no `testTimeout` or `hookTimeout` covers, so a genuine
     hang there (a stuck vite plugin, a deadlocked runner) now takes up to 180 s to report instead of 60 s,
     still well inside an agent's 600 s command limit. A test that fails or hangs still fails on its own
     assertion or `testTimeout` (5 s in the unit tier); an opt-in scenario (`OPT_IN_TEST_TIMEOUT_MS`, 300 s)
     that blocks its worker for longer than the watchdog can trip it on its own, and that one is the
     branch's. So a unit run where every test passed and the watchdog still fired is infrastructure, a
     runner that made no progress for three minutes, not the branch: re-run it on a quieter box rather than
     looking for the cause in the diff. A vitest upgrade fails `pnpm install` on the unused patch until it
     is ported to the new version's `dist` (`pnpm patch vitest@<version>`) or dropped;
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
     `affected integration: <package> (N files) …`; a docs-only or scripts-only branch skips it. With
     more than one integration package (a shared change selects shared, server and client) pnpm runs their
     runners side by side, and a gameplay scenario may use up to its 300 s timeout
     (`OPT_IN_TEST_TIMEOUT_MS` in `vitest.tiers.ts`): a timeout in this phase on a busy box is re-run with
     `./validate.sh integration --scope <package> -- <file>` before anyone calls it flaky. It
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
     nor the reverse, with one exception (#563): `all --affected` answers its `test` and `typecheck`
     phases from green package stamps (`test --scope client`, …) when every affected package has one on
     the same tree, so the merge gate does not repeat what the builder or reviewer ran on that exact code.
     It prints `cached green from the package stamps of <packages> at tree <hash>` and stamps the phase.
     Lint is never reused, because a plain lint uses eslint's cache (#559). Duplication is never reused,
     because jscpd across packages finds what one package cannot. A test phase that also runs the shell
     suites always runs. The stamps kept on this box showed 17 typecheck and 7 test phases repeated on
     an identical tree (a client test run costs about 340 core-s). The stamp names the tree the merge gate
     ran on. Nothing
     prunes the stamps: `rm -rf ~/.cache/<slug>-validate` clears them, and so does a container
     rebuild (`~/.cache` is not a mount). A CI run, where a game adds one, passes `--fresh` (or
     sets `VALIDATE_CACHE_DIR` to a scratch directory) so it never trusts a stamp. **Lint caches per
     file** (#559): a stamp miss still skips unchanged files. prettier runs with `--cache` on every run
     but `--fresh`, and eslint with `--cache` on a plain `lint` only. Both caches live under the worktree's
     `node_modules/.cache` and are keyed by file content. eslint's type-aware rules (`no-floating-promises`)
     read other files, which its cache does not track, so `all` (the merge gate and the timed main gate)
     never uses the eslint cache. A lint that used it stamps as `lint-eslint-cached`, which `all` never
     reads. A plain lint still takes the stricter `lint` stamp of `all` or `lint --fresh`. A repeat client lint with one file changed measured
     57.6 core-s without the caches and 17.2 with them warm. **Machine-wide
     gate slots by phase class** (#234, #380; `scripts/lib/gate-lock.sh`): every non-cached phase holds
     one slot of its class under `$HOME/.cache/<slug>-validate` (independent of `VALIDATE_CACHE_DIR`, so a
     scratch cache still queues; `VALIDATE_GATE_LOCK_DIR` moves it for a sandboxed test), so parallel
     agents queue instead of starving the box, and a cheap phase never queues behind a heavy one.
     **Heavy** (`test`, `integration`, `typecheck`: vitest and the Angular builder run cores − 2 workers)
     gets one slot per 2 cores, capped at one per 4 GB of memory, so two on the 4-core box (#561);
     **light** (`lint`, `duplication`, `format`: eslint, prettier and jscpd use one core each, eslint over the
     client peaks near 1 GB) gets one slot per 2 cores, since it runs beside a heavy run that already
     fills every core, capped at one per GB; a lint that runs no eslint (`all --affected` over docs alone)
     takes **no** slot. `VALIDATE_HEAVY_SLOTS` / `VALIDATE_LIGHT_SLOTS` override the counts (a value that
     is not a number is warned about and ignored). `all --affected` takes each phase's slot in turn like
     any other run. Waiters are served first come first served; one still waiting after a second prints
     `waiting for a <class> gate slot before <phase> (N slots, lock dir …), held by: pid P in <worktree>:`
     `<command>, since HH:MM:SS` (a holder whose pid is gone is named stale), then
     `got a <class> gate slot after N s`. A killed run releases its slot and holder file. Heavy slot 0 is
     the old `gate.lock`, so a branch still carrying the single-lock `validate.sh` excludes a new heavy
     run. **Known transitional limit:** a class with more than one slot has its queue head poll the
     slots every 0.5 s, while an old `validate.sh` waits on `gate.lock` in the kernel, so a steady stream
     of old-branch runs could starve such a head. Since #561 this box has two heavy slots, so the limit
     applies here too. It ends once every branch carries this script. A cache hit never waits; the slot fd is
     closed for the child so no orphaned worker keeps it.
     `VALIDATE_NO_GATE_LOCK=1` disables the slots for a sandboxed test; without `flock` it runs unlocked;
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
     reviewed PR), push, and run the gate on that head. `scripts/land-pr.sh` refuses a behind PR itself
     before running the PR's gate (`scripts/lib/behind-base.sh`), because a PR branched earlier carries
     a `validate.sh` without the refusal or the integration phase; it never merges main in for the author.
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
./validate.sh typecheck    # type check all packages, the client's vitest specs and Playwright e2e/ included (builds shared first when stale)
./validate.sh lint         # eslint + prettier --check + disable-directive / TODO audit
./validate.sh duplication  # jscpd (.jscpd.json)
./validate.sh format --scope server  # eslint --fix + prettier --write on what lint --scope server reads; lists the changed files
./validate.sh all          # lint -> duplication -> typecheck -> test, stopping at the first red phase; prints wall times and ALL PASSED / FAILED: <phase>
./validate.sh all --affected  # the merge gate: only what the branch changed against origin/main, then its integration tier; refuses a branch behind origin/main
./validate.sh all --fresh  # same, ignoring the result cache (a green run is still stamped)
./validate.sh test --scope server                          # one package, with its coverage floor
./validate.sh test --scope packages/server/src/game/world  # only the tests under a path, no coverage floor
```
