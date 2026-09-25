#!/usr/bin/env bash
# validate-cache.test.sh — exercises validate.sh's result cache (docs/engineering/validation-gate.md §1) against a
# throwaway git repo with a fake `pnpm` on PATH, so it runs without node_modules:
#   second run is cached; an untracked file change invalidates; a plain lint passes eslint's and prettier's
#   caches, `all` prettier's alone, --fresh neither, and a plain lint's stamp never answers `all` (#559);
#   `all --affected` answers test and typecheck from every affected package's own stamp on the tree, never
#   lint, duplication or the shell suites (#563); --fresh re-runs; red is never
#   cached; `all` stamps its phases and itself (an `all` hit prints ALL PASSED and filters see every
#   phase's stored log); a worktree at the same content shares the stamp; a Node-major mismatch, a
#   missing stored log and a run that changes the tree are misses; VALIDATE_CACHE_DIR overrides the
#   directory; an unwritable directory degrades to no cache with one warning line; --scope narrows
#   each phase to a package or a path and stamps per scope (a scoped stamp never answers an unscoped
#   call, nor the reverse) and an empty scope is refused; a targeted run that runs no test (none
#   selected, or all skipped) fails while a tier-wide one passes, and a runner crash keeps its own
#   error; `all` prints its phases in a fixed order with a wall-times line and keeps each phase's
#   exit code and stamp; two real gates on one machine run one after the other (gate.lock) while a
#   hit never waits; `all` stops at the first failing phase (a red lint never runs test); and
#   `all --affected`, against a fixture origin/main, selects client alone for a client change, all
#   three packages for a shared change, lint alone for docs, the shell suites for scripts and the
#   plain `all` for a root file, and stamps per affected set. Readiness (#329): a real run installs
#   when node_modules does not match the lockfile and builds shared when its dist is missing (deleting
#   the build record) or older than its sources, one line each; a ready checkout and a cache hit do
#   neither; a failed install stops the run, a failed build does not. Client filters (#329): a
#   non-option extra arg becomes one --include per matching spec of the tier (under a path scope, in
#   place of its include), options pass through, no match fails, and extra args on a selection that
#   mixes the client with other packages are refused. A scoped lint also prettier-checks the docs the
#   branch changed, and only those (#329). A filtered test run (a non-option extra arg or a test-name
#   filter) drops the coverage floor in every package while an option that narrows nothing keeps it;
#   a client filter matches repo-relative paths and stays on a file scope's spec; a shared source saved
#   during the build is rebuilt by the next run; a setup waiting on the checkout's setup lock past its
#   timeout fails loudly; a word after an option written with a space is its value, never a filter.
#   format (#641): eslint --fix then prettier --write over lint's paths for the scope (a scoped one also the
#   changed docs), the files it changed within those paths listed, never cached; unfixable eslint problems
#   leave it green, a tool that fails to run fails it, and extra args are refused.
#   The merge gate's integration tier (#344): `all --affected` runs integration last, only in the selected
#   packages that have integration or gameplay tests (a shared change runs its dependents', docs and
#   scripts skip it); a red integration fails the gate and is never stamped; a red unit phase never
#   reaches it; a plain `all` stamp never answers the affected gate on a root-file branch; a branch behind
#   origin/main is refused before any stamp is read, leaving the branch, tree and stash untouched; the
#   gate fetches origin main first and falls back to the local copy when the fetch fails.
#   Unhandled runner errors (#475): a run whose every test passed is still red when the runner counted an
#   error outside its tests, even if the runner exits 0, and is never stamped; an RPC timeout among them is
#   named as the runner's watchdog rather than as the branch; a clean summary is left alone.
#
#   scripts/validate-cache.test.sh        # exit 0 when every case passes
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sandbox="$(mktemp -d)"
trap 'rm -rf "$sandbox"' EXIT

CACHED_HIT_SECONDS_MAX=2
FAKE_PNPM_RC_FILE="$sandbox/fake-pnpm-rc"
FAKE_PNPM_TOUCH_FILE="$sandbox/fake-pnpm-touch" # when non-empty: a path the fake pnpm creates (a run that changes the tree)
FAKE_PNPM_SLEEP_FILE="$sandbox/fake-pnpm-sleep" # seconds the fake pnpm sleeps (a slow gate)
FAKE_PNPM_OUTPUT_FILE="$sandbox/fake-pnpm-output" # what the fake pnpm prints after its command line (a runner summary)
FAKE_PNPM_FAIL_PATTERN_FILE="$sandbox/fake-pnpm-fail-pattern" # when non-empty: a command line matching it exits 1
FAKE_BUILD_SAW_FILE="$sandbox/fake-build-saw" # the fake shared build writes whether the build record was kept or deleted
FAKE_BUILD_EDIT_FILE="$sandbox/fake-build-edit" # when non-empty: the fake shared build saves a shared source mid-build

# --- fixture: a git repo holding validate.sh, package dirs and a fake pnpm -------------------------
fixture="$sandbox/repo"
mkdir -p "$fixture/scripts/lib" "$sandbox/bin" "$sandbox/home" \
  "$fixture/packages/shared/src" "$fixture/packages/shared/dist" "$fixture/node_modules/.pnpm" \
  "$fixture/packages/server/src/game" "$fixture/packages/client/src/app"
cp "$repo_root/validate.sh" "$fixture/validate.sh"
cp "$repo_root/scripts/lib/workspace-ready.sh" "$repo_root/scripts/lib/gate-lock.sh" "$repo_root/scripts/lib/behind-base.sh" "$fixture/scripts/lib/"
touch "$fixture/packages/shared/src/index.ts" "$fixture/packages/server/src/game/world.ts" \
  "$fixture/packages/server/src/game/world.test.ts" "$fixture/packages/client/src/app/hud.spec.ts" \
  "$fixture/packages/client/src/app/app.integration.spec.ts" "$fixture/packages/client/src/app/hud.ts" \
  "$fixture/packages/client/src/app/hud-layout.spec.ts" "$fixture/packages/server/src/game/round.gameplay.test.ts"
# A ready checkout (#329): node_modules installed from the lockfile, shared built after its sources.
printf 'node_modules/\ndist/\n*.tsbuildinfo\n' > "$fixture/.gitignore"
echo 'lockfileVersion: fixture' > "$fixture/pnpm-lock.yaml"
cp "$fixture/pnpm-lock.yaml" "$fixture/node_modules/.pnpm/lock.yaml"
touch -d '-1 hour' "$fixture/packages/shared/src/index.ts" "$fixture/packages/shared/src"
touch "$fixture/packages/shared/dist/index.d.ts" "$fixture/packages/shared/tsconfig.build.tsbuildinfo"
FIXTURE_SUITE_MARKER="fixture shell suite ran"
printf '#!/usr/bin/env bash\necho "%s"\n' "$FIXTURE_SUITE_MARKER" > "$fixture/scripts/fixture-suite.test.sh"
chmod +x "$fixture/scripts/fixture-suite.test.sh"
write_standard_fake_pnpm() {
  cat > "$sandbox/bin/pnpm" <<PNPM
#!/usr/bin/env bash
echo "fake pnpm \$*"
cat "$FAKE_PNPM_OUTPUT_FILE"
touch_path="\$(cat "$FAKE_PNPM_TOUCH_FILE")"
[[ -z "\$touch_path" ]] || echo generated > "\$touch_path"
sleep "\$(cat "$FAKE_PNPM_SLEEP_FILE")"
fail_pattern="\$(cat "$FAKE_PNPM_FAIL_PATTERN_FILE")"
[[ -z "\$fail_pattern" ]] || ! grep -qE -- "\$fail_pattern" <<<"\$*" || exit 1
case "\$*" in
  'install --frozen-lockfile --prefer-offline') mkdir -p node_modules/.pnpm && cp pnpm-lock.yaml node_modules/.pnpm/lock.yaml ;;
  '--filter @evolution/shared build')
    if [[ -e packages/shared/tsconfig.build.tsbuildinfo ]]; then echo kept; else echo deleted; fi > "$FAKE_BUILD_SAW_FILE"
    [[ ! -s "$FAKE_BUILD_EDIT_FILE" ]] || { sleep 0.1; touch packages/shared/src/index.ts; sleep 0.1; }
    mkdir -p packages/shared/dist && touch packages/shared/dist/index.d.ts packages/shared/tsconfig.build.tsbuildinfo
    ;;
esac
exit "\$(cat "$FAKE_PNPM_RC_FILE")"
PNPM
  chmod +x "$sandbox/bin/pnpm"
}
write_standard_fake_pnpm
echo 0 > "$FAKE_PNPM_RC_FILE"
: > "$FAKE_PNPM_TOUCH_FILE"
echo 0 > "$FAKE_PNPM_SLEEP_FILE"
: > "$FAKE_PNPM_OUTPUT_FILE"
: > "$FAKE_PNPM_FAIL_PATTERN_FILE"
: > "$FAKE_BUILD_EDIT_FILE"
git -C "$fixture" init -q
git -C "$fixture" -c user.name=test -c user.email=test@example.com add -A
git -C "$fixture" -c user.name=test -c user.email=test@example.com commit -q -m fixture

export PATH="$sandbox/bin:$PATH" HOME="$sandbox/home"
# The gate slots live in the sandbox, never the machine's own lock dir (#380).
export VALIDATE_GATE_LOCK_DIR="$sandbox/gate-locks" VALIDATE_HEAVY_SLOTS=1 VALIDATE_LIGHT_SLOTS=2
unset VALIDATE_CACHE_DIR VALIDATE_NO_GATE_LOCK

# --- helpers ------------------------------------------------------------------------------------
failures=0
check() { # <description> <arithmetic-truth: 1 passes, 0 fails>
  if [[ "$2" -ne 0 ]]; then echo "ok   $1"; else echo "FAIL $1"; failures=$((failures + 1)); fi
}
run_validate() { # <dir> <args...>  -> stdout in $out, exit code in $rc
  rc=0
  out="$(cd "$1" && shift && ./validate.sh "$@" 2>&1)" || rc=$?
}
is_cached() { grep -q '^cached green from .* at tree [0-9a-f]\{40\}$' <<<"$out"; }
ran_pnpm() { grep -q '^fake pnpm' <<<"$out"; }
ran() { grep -q -- "$1" <<<"$out"; } # <pattern>: whether the last run's output matches

# The lint caches validate.sh passes (#559): eslint's on a plain lint only, prettier's on every run but --fresh.
ESLINT_CACHED='--cache --cache-strategy content --cache-location node_modules/.cache/eslint/'
PRETTIER_CACHED='--cache --cache-strategy content --cache-location node_modules/.cache/prettier/.prettier-cache'

# --- cases --------------------------------------------------------------------------------------
run_validate "$fixture" test
check "first run executes and is green" $(( rc == 0 && $(ran_pnpm; echo $?) == 0 ))

start=$SECONDS
run_validate "$fixture" test
elapsed=$((SECONDS - start))
check "second run on the same tree is a cache hit" $(( rc == 0 && $(is_cached; echo $?) == 0 && $(ran_pnpm; echo $?) != 0 ))
check "cache hit returns in under ${CACHED_HIT_SECONDS_MAX}s (took ${elapsed}s)" $(( elapsed < CACHED_HIT_SECONDS_MAX ))
check "cache hit prints the stored log path" $(( $(grep -q '^log: .*\.test\.log$' <<<"$out"; echo $?) == 0 ))

run_validate "$fixture" test -G 'fake pnpm'
check "filters apply to the stored log on a hit" $(( $(is_cached; echo $?) == 0 && $(ran_pnpm; echo $?) == 0 ))

echo scratch > "$fixture/untracked.txt"
run_validate "$fixture" test
check "an untracked file change invalidates the stamp" $(( rc == 0 && $(is_cached; echo $?) != 0 && $(ran_pnpm; echo $?) == 0 ))

run_validate "$fixture" test
check "the changed tree is stamped in turn" $(( $(is_cached; echo $?) == 0 ))

run_validate "$fixture" test --fresh
check "--fresh bypasses the stamp and re-runs" $(( rc == 0 && $(is_cached; echo $?) != 0 && $(ran_pnpm; echo $?) == 0 ))

echo 1 > "$FAKE_PNPM_RC_FILE"
echo red > "$fixture/untracked.txt"
run_validate "$fixture" test
check "a red run exits non-zero" $(( rc != 0 ))
echo 0 > "$FAKE_PNPM_RC_FILE"
run_validate "$fixture" test
check "red is never cached: the next call on the same tree runs again" $(( rc == 0 && $(is_cached; echo $?) != 0 && $(ran_pnpm; echo $?) == 0 ))

run_validate "$fixture" typecheck -- --filter shared
check "extra args after -- bypass the cache" $(( rc == 0 && $(ran_pnpm; echo $?) == 0 ))
run_validate "$fixture" typecheck -- --filter shared
check "extra args are never stamped" $(( $(is_cached; echo $?) != 0 ))

echo all > "$fixture/untracked.txt"
run_validate "$fixture" all
check "all runs every phase green" $(( rc == 0 && $(grep -q '^ALL PASSED$' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" lint
check "all stamps each phase individually" $(( $(is_cached; echo $?) == 0 ))
run_validate "$fixture" all
check "all stamps itself" $(( rc == 0 && $(is_cached; echo $?) == 0 && $(ran_pnpm; echo $?) != 0 ))
check "an all hit still prints ALL PASSED" $(( $(grep -q '^ALL PASSED$' <<<"$out"; echo $?) == 0 ))

echo phase-hit > "$fixture/untracked.txt"
run_validate "$fixture" lint
run_validate "$fixture" all
run_validate "$fixture" all -G 'fake pnpm eslint'
check "filters on an all hit see a phase that was itself a hit" $(( $(is_cached; echo $?) == 0 && $(grep -q '^fake pnpm eslint' <<<"$out"; echo $?) == 0 ))

echo 1 > "$FAKE_PNPM_RC_FILE"
echo all-red > "$fixture/untracked.txt"
run_validate "$fixture" all
check "a red all reports the failed phases" $(( rc != 0 && $(grep -q '^FAILED: ' <<<"$out"; echo $?) == 0 ))
echo 0 > "$FAKE_PNPM_RC_FILE"
run_validate "$fixture" all
check "a red all is not stamped" $(( rc == 0 && $(ran_pnpm; echo $?) == 0 ))

rm "$fixture/untracked.txt"
git -C "$fixture" -c user.name=test -c user.email=test@example.com commit -q --allow-empty -m same-tree
worktree="$sandbox/worktree"
git -C "$fixture" worktree add -q "$worktree" -b other HEAD
run_validate "$fixture" test
run_validate "$worktree" test
check "a worktree at the same content shares the stamp" $(( rc == 0 && $(is_cached; echo $?) == 0 ))

slug_dir="$HOME/.cache/$(basename "$fixture")-validate"
stamp_count="$(find "$slug_dir" -maxdepth 1 -name '*.test' 2>/dev/null | wc -l)"
check "stamps live under \$HOME/.cache/<slug>-validate (found $stamp_count in $slug_dir)" $(( stamp_count > 0 ))

run_validate "$fixture" test
current_tree="$(sed -n 's/^cached green from .* at tree //p' <<<"$out")"
stamp="$slug_dir/$current_tree.test"
sed -i 's/^node=.*/node=0/' "$stamp"
run_validate "$fixture" test
check "a Node-major mismatch in the stamp is a miss" $(( rc == 0 && $(is_cached; echo $?) != 0 && $(ran_pnpm; echo $?) == 0 ))
run_validate "$fixture" test
check "the re-run restamps for the current Node major" $(( $(is_cached; echo $?) == 0 ))

rm -f "$slug_dir"/logs/*.test.log
run_validate "$fixture" test
check "a stamp whose stored log is missing is a miss with a note" $(( rc == 0 && $(is_cached; echo $?) != 0 && $(ran_pnpm; echo $?) == 0 && $(grep -q 'has no log' <<<"$out"; echo $?) == 0 ))

echo "$fixture/generated-by-the-run.txt" > "$FAKE_PNPM_TOUCH_FILE"
echo changed-by-run > "$fixture/untracked.txt"
run_validate "$fixture" test
check "a run that changes the tree is not stamped" $(( rc == 0 && $(grep -q '^not cached: the run changed the working tree$' <<<"$out"; echo $?) == 0 ))
: > "$FAKE_PNPM_TOUCH_FILE"
run_validate "$fixture" test
check "the changed tree runs again rather than hitting" $(( $(is_cached; echo $?) != 0 && $(ran_pnpm; echo $?) == 0 ))
rm -f "$fixture/generated-by-the-run.txt"

override_dir="$sandbox/override-cache"
out="$(cd "$fixture" && VALIDATE_CACHE_DIR="$override_dir" ./validate.sh typecheck 2>&1)"
override_count="$(find "$override_dir" -maxdepth 1 -name '*.typecheck' 2>/dev/null | wc -l)"
check "VALIDATE_CACHE_DIR overrides the cache directory (found $override_count)" $(( override_count == 1 ))

readonly_dir="$sandbox/readonly"
mkdir -p "$readonly_dir" && chmod 500 "$readonly_dir"
rc=0
out="$(cd "$fixture" && VALIDATE_CACHE_DIR="$readonly_dir/cache" ./validate.sh typecheck 2>&1)" || rc=$?
warning_count="$(grep -c 'result cache disabled' <<<"$out" || true)"
error_count="$(grep -c -i 'permission denied\|no such file' <<<"$out" || true)"
check "an unwritable cache dir degrades to no cache with one warning line ($warning_count warning, $error_count errors)" $(( rc == 0 && $(ran_pnpm; echo $?) == 0 && warning_count == 1 && error_count == 0 ))
chmod 700 "$readonly_dir"

# --- scope (#281): package and path scopes, and their stamps --------------------------------------
echo scope-case > "$fixture/untracked.txt"
run_validate "$fixture" test --scope server
check "a package scope runs that package's tests, coverage floors intact" $(( rc == 0 && $(grep -q '^fake pnpm --filter @evolution/server test$' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" test --scope server
check "a scoped green is stamped for its scope" $(( rc == 0 && $(is_cached; echo $?) == 0 && $(grep -q '^scope: server$' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" test
check "a scoped stamp never answers an unscoped call" $(( rc == 0 && $(is_cached; echo $?) != 0 && $(ran_pnpm; echo $?) == 0 ))
run_validate "$fixture" test --scope client
check "nor a call in another scope" $(( $(is_cached; echo $?) != 0 && $(ran_pnpm; echo $?) == 0 ))

echo scope-reverse > "$fixture/untracked.txt"
run_validate "$fixture" test
run_validate "$fixture" test --scope server
check "an unscoped stamp never answers a scoped call" $(( rc == 0 && $(is_cached; echo $?) != 0 && $(ran_pnpm; echo $?) == 0 ))
run_validate "$fixture" test
scope_tree="$(sed -n 's/^cached green from .* at tree //p' <<<"$out")"
cp "$slug_dir/$scope_tree.test" "$slug_dir/$scope_tree.test.scope-server"
run_validate "$fixture" test --scope server
check "a stamp whose scope field disagrees with its name is a miss" $(( $(is_cached; echo $?) != 0 && $(ran_pnpm; echo $?) == 0 ))

run_validate "$fixture" test --scope packages/server --fresh
check "packages/<package> is the package scope" $(( $(grep -q '^fake pnpm --filter @evolution/server test$' <<<"$out"; echo $?) == 0 ))

printf ' Test Files  2 passed (2)\n      Tests  5 passed (5)\n' > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" test --scope packages/server/src/game
check "a directory scope filters the package's tests and drops coverage" $(( rc == 0 && $(grep -q '^fake pnpm --filter @evolution/server test src/game/ --coverage.enabled=false$' <<<"$out"; echo $?) == 0 ))
check "test prints the selection per package" $(( $(grep -q '^selected server: 2 test files, 5 tests run$' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" test --scope packages/server/src/game
check "a path-scoped green is stamped for that path" $(( $(is_cached; echo $?) == 0 ))
run_validate "$fixture" test --scope packages/server/src/game/world.ts
check "a source file selects the tests named after it" $(( $(grep -q '^fake pnpm --filter @evolution/server test src/game/world\. --coverage.enabled=false$' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" test --scope packages/client/src/app
check "a client path scope passes --include without coverage" $(( $(grep -q '^fake pnpm --filter @evolution/client test --include src/app --no-coverage$' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" integration --scope packages/client/src/app
check "a client integration path scope keeps the integration spec selection" $(( $(grep -q '^fake pnpm --filter @evolution/client --if-present test:integration --include src/app/\*\*/\*\.integration\.spec\.ts$' <<<"$out"; echo $?) == 0 ))
printf ' Test Files  1 passed (1)\n      Tests  2 passed (2)\n' > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" integration --scope client -- app.integration
check "a client filter becomes one --include per matching integration spec (#329)" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/client --if-present test:integration --include src/app/app\.integration\.spec\.ts$'; echo $?) == 0 ))
run_validate "$fixture" integration --scope client -- app --filter=^App
check "a client filter selects only its tier's specs, and an option passes through" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/client --if-present test:integration --include src/app/app\.integration\.spec\.ts --filter=^App$'; echo $?) == 0 ))
run_validate "$fixture" test --scope packages/client/src/app -- hud
check "a client filter under a directory scope replaces the directory include and drops coverage" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/client test --include src/app/hud-layout\.spec\.ts --include src/app/hud\.spec\.ts --no-coverage$'; echo $?) == 0 ))
run_validate "$fixture" test --scope packages/client/src/app/hud.ts -- hud
check "a client filter under a file scope stays on the spec that file selects" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/client test --include src/app/hud\.spec\.ts --no-coverage$'; echo $?) == 0 ))
run_validate "$fixture" test --scope packages/client/src/app/hud.ts -- layout
check "a client filter that misses the file scope's spec fails" $(( rc != 0 && $(ran 'no client test spec under packages/client/src/app/hud.ts has a path containing: layout'; echo $?) == 0 && $(ran_pnpm; echo $?) != 0 ))
run_validate "$fixture" test --scope client -- packages/client/src/app/hud.spec.ts
check "a client filter matches a repo-relative path, and a filtered package-scope test drops the floor" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/client test --include src/app/hud\.spec\.ts --no-coverage$'; echo $?) == 0 ))
run_validate "$fixture" test --scope server -- world
check "a filtered server test has no coverage floor" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/server test world --coverage\.enabled=false$'; echo $?) == 0 ))
run_validate "$fixture" test --scope shared -- -t name
check "a shared test narrowed by a test-name filter has no coverage floor either" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/shared test -t name --coverage\.enabled=false$'; echo $?) == 0 ))
run_validate "$fixture" test --scope server -- --reporter=verbose
check "an option that narrows nothing keeps the coverage floor" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/server test --reporter=verbose$'; echo $?) == 0 ))
run_validate "$fixture" test --scope server -- --reporter verbose
check "so does one written with a space: its value is not a filter" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/server test --reporter verbose$'; echo $?) == 0 ))
run_validate "$fixture" integration --scope client -- --filter ^App app
check "a client option's spaced value passes through with it, and the filter after it still selects" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/client --if-present test:integration --include src/app/app\.integration\.spec\.ts --filter ^App$'; echo $?) == 0 ))
run_validate "$fixture" integration --scope server -- world
check "a filtered integration run takes no coverage switch" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/server --if-present test:integration world$'; echo $?) == 0 ))
run_validate "$fixture" integration --scope client -- nothing-matches
check "a client filter that matches no spec fails without running the runner" $(( rc != 0 && $(ran 'no client integration spec under packages/client/src has a path containing: nothing-matches'; echo $?) == 0 && $(ran 'test:integration'; echo $?) != 0 ))
: > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" lint --scope packages/server/src/game
check "a path scope lints and formats only that path" $(( $(grep -q "^fake pnpm eslint $ESLINT_CACHED packages/server/src/game$" <<<"$out"; echo $?) == 0 && $(grep -q "^fake pnpm prettier --check $PRETTIER_CACHED packages/server/src/game$" <<<"$out"; echo $?) == 0 ))
check "a plain lint passes both lint caches" $(( $(grep -q "^fake pnpm eslint $ESLINT_CACHED " <<<"$out"; echo $?) == 0 && $(grep -q "^fake pnpm prettier --check $PRETTIER_CACHED " <<<"$out"; echo $?) == 0 ))
: > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" lint --scope packages/server/src/game --fresh
check "--fresh passes neither lint cache" $(( $(grep -q '^fake pnpm eslint packages/server/src/game$' <<<"$out"; echo $?) == 0 && $(grep -q '^fake pnpm prettier --check packages/server/src/game$' <<<"$out"; echo $?) == 0 ))
# #559 review: a plain lint's stamp (eslint ran with its cache) is keyed apart, so `all` never reads it.
echo lint-key > "$fixture/untracked-lint-key.txt"
run_validate "$fixture" lint
run_validate "$fixture" lint
check "a plain lint's repeat hits its own stamp" $(( rc == 0 && $(is_cached; echo $?) == 0 ))
run_validate "$fixture" all
check "an unscoped all never reads a plain lint's stamp: it runs eslint itself, without the cache" $(( rc == 0 && $(ran '^fake pnpm eslint \.$'; echo $?) == 0 ))
run_validate "$fixture" lint --fresh
run_validate "$fixture" all --fresh
rm -f "$fixture/untracked-lint-key.txt"
# format (#641): lint's fixers over lint's paths, the files they changed listed, never cached.
ESLINT_FIX_ARGUMENTS='--fix --cache --cache-strategy content --cache-location node_modules/.cache/eslint/ --output-file /dev/null'
PRETTIER_WRITE_ARGUMENTS="--write --log-level warn $PRETTIER_CACHED"
run_validate "$fixture" format --scope server
check "a scoped format runs eslint --fix, then prettier --write, over lint's paths for that scope" $(( rc == 0 && $(ran "^fake pnpm eslint $ESLINT_FIX_ARGUMENTS packages/server$"; echo $?) == 0 && $(ran "^fake pnpm prettier $PRETTIER_WRITE_ARGUMENTS packages/server$"; echo $?) == 0 && $(grep -n '^fake pnpm' <<<"$out" | grep -v install | head -n 1 | grep -q eslint; echo $?) == 0 ))
check "a format that changed nothing says so" $(( $(ran '^format changed no files$'; echo $?) == 0 ))
run_validate "$fixture" format --scope server
check "a format is never cached: the repeat on the same tree runs the tools again" $(( rc == 0 && $(is_cached; echo $?) != 0 && $(ran "^fake pnpm eslint --fix"; echo $?) == 0 && $(compgen -G "$sandbox/home/.cache/*-validate/*.format*" >/dev/null; echo $?) != 0 ))
echo "$fixture/packages/server/src/game/world.ts" > "$FAKE_PNPM_TOUCH_FILE"
run_validate "$fixture" format --scope server
: > "$FAKE_PNPM_TOUCH_FILE"
git -C "$fixture" checkout -q -- packages/server/src/game/world.ts
check "a format lists the files it changed and exits 0" $(( rc == 0 && $(ran '^format changed 1 files:$'; echo $?) == 0 && $(ran '^packages/server/src/game/world\.ts$'; echo $?) == 0 ))
echo "$fixture/packages/client/src/app/hud.ts" > "$FAKE_PNPM_TOUCH_FILE"
run_validate "$fixture" format --scope server
: > "$FAKE_PNPM_TOUCH_FILE"
git -C "$fixture" checkout -q -- packages/client/src/app/hud.ts
check "a write outside format's paths during the run is not listed as its change" $(( rc == 0 && $(ran '^format changed no files$'; echo $?) == 0 && $(ran 'hud\.ts'; echo $?) != 0 ))
run_validate "$fixture" format --fresh
check "an unscoped format --fresh covers the repo without either lint cache" $(( rc == 0 && $(ran '^fake pnpm eslint --fix --output-file /dev/null \.$'; echo $?) == 0 && $(ran '^fake pnpm prettier --write --log-level warn \.$'; echo $?) == 0 ))
echo '^eslint' > "$FAKE_PNPM_FAIL_PATTERN_FILE"
run_validate "$fixture" format --scope server
: > "$FAKE_PNPM_FAIL_PATTERN_FILE"
check "problems eslint cannot fix leave a format green, pointing at lint" $(( rc == 0 && $(ran '^eslint --fix left problems it cannot fix'; echo $?) == 0 && $(ran '^fake pnpm prettier --write'; echo $?) == 0 ))
echo '^prettier' > "$FAKE_PNPM_FAIL_PATTERN_FILE"
run_validate "$fixture" format --scope server
: > "$FAKE_PNPM_FAIL_PATTERN_FILE"
check "a prettier that fails (a syntax error) fails the format" $(( rc != 0 && $(ran '^FAILED: format (eslint exit 0, prettier exit 1)$'; echo $?) == 0 ))
cat > "$sandbox/bin/pnpm" <<'PNPM'
#!/usr/bin/env bash
echo "fake pnpm $*"
[[ "$1" != eslint ]] || exit 2
PNPM
run_validate "$fixture" format --scope server
write_standard_fake_pnpm
check "an eslint that fails to run (exit 2) fails the format" $(( rc != 0 && $(ran '^FAILED: format (eslint exit 2, prettier exit 0)$'; echo $?) == 0 ))
run_validate "$fixture" format --scope server -- --debug
check "a format with extra args is refused before any tool runs" $(( rc != 0 && $(ran 'format takes no extra args'; echo $?) == 0 && $(ran_pnpm; echo $?) != 0 ))
run_validate "$fixture" duplication --scope client
check "a package scope scans only that package's source" $(( $(grep -q '^fake pnpm jscpd packages/client/src$' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" typecheck --scope packages/server/src/game
check "a path scope typechecks its package" $(( $(grep -q '^fake pnpm --filter @evolution/server typecheck$' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" test --scope elsewhere
check "a scope that is neither a package nor a package path is refused" $(( rc != 0 && $(grep -q 'expected shared server client' <<<"$out"; echo $?) == 0 && $(ran_pnpm; echo $?) != 0 ))
run_validate "$fixture" test --scope packages/server/src/missing.ts
check "a path scope that does not exist is refused" $(( rc != 0 && $(grep -q 'no such file or directory' <<<"$out"; echo $?) == 0 ))

# --- selection (#289): a targeted run that tests nothing is not a pass ----------------------------
printf ' No test files found, exiting with code 0\n' > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" integration --scope packages/server/src/game/world.test.ts
check "a path-scoped run that selects no test file fails" $(( rc != 0 && $(grep -q 'ran no tests' <<<"$out"; echo $?) == 0 && $(grep -q '^selected server: 0 test files, 0 tests run$' <<<"$out"; echo $?) == 0 ))
printf ' Test Files  1 skipped (1)\n      Tests  1 skipped (1)\n' > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" test --scope packages/server/src/game/world.test.ts -- -t no-such-test
check "a targeted run whose every selected test is skipped fails, and skipped never counts as run" $(( rc != 0 && $(grep -q 'ran no tests' <<<"$out"; echo $?) == 0 && $(grep -q '^selected server: 1 test files, 0 tests run, 1 skipped$' <<<"$out"; echo $?) == 0 ))
printf ' Test Files  1 passed (1)\n      Tests  2 passed | 3 skipped (5)\n' > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" test --scope packages/server/src/game/world.test.ts -- -t some-tests
check "a targeted run that ran some of its tests passes and names the skipped ones" $(( rc == 0 && $(grep -q '^selected server: 1 test files, 2 tests run, 3 skipped$' <<<"$out"; echo $?) == 0 ))
printf 'CACError: Unknown option -G\n' > "$FAKE_PNPM_OUTPUT_FILE"
echo 1 > "$FAKE_PNPM_RC_FILE"
run_validate "$fixture" integration --scope server -- -G ecology
echo 0 > "$FAKE_PNPM_RC_FILE"
check "a runner that crashes keeps its own error and is not blamed on the selection" $(( rc != 0 && $(grep -q 'CACError' <<<"$out"; echo $?) == 0 && $(grep -q 'ran no tests' <<<"$out"; echo $?) != 0 ))
: > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" typecheck --scope ""
check "an empty --scope is refused, not a repo-wide run" $(( rc != 0 && $(ran_pnpm; echo $?) != 0 && $(grep -q 'not an empty value' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" typecheck --scope=
check "so is an empty --scope=" $(( rc != 0 && $(ran_pnpm; echo $?) != 0 ))
printf '%s\n' 'packages/shared test:integration:  No test files found, exiting with code 0' \
  'packages/server test:integration:  Test Files  3 passed (3)' 'packages/server test:integration:       Tests  9 passed (9)' > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" integration
check "a tier-wide run passes over a package with no files in the tier" $(( rc == 0 && $(grep -q '^selected shared: 0 test files, 0 tests run$' <<<"$out"; echo $?) == 0 && $(grep -q '^selected server: 3 test files, 9 tests run$' <<<"$out"; echo $?) == 0 ))
: > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" integration -- ecology
check "extra args on a selection that mixes the client with vitest packages are refused, naming --scope" $(( rc != 0 && $(ran 'add --scope shared|server|client'; echo $?) == 0 && $(ran_pnpm; echo $?) != 0 ))

# --- unhandled runner errors (#475): every test passed and the run is still red --------------------
echo unhandled-errors > "$fixture/untracked.txt" # a tree of its own: no earlier scoped stamp answers these
printf '%s\n' ' Test Files  246 passed (246)' '      Tests  2449 passed (2449)' \
  'Error: [vitest-worker]: Timeout calling "onTaskUpdate"' '     Errors  1 error' > "$FAKE_PNPM_OUTPUT_FILE"
echo 1 > "$FAKE_PNPM_RC_FILE"
run_validate "$fixture" test --scope client
check "a run whose every test passed still fails on an unhandled error, and says so" $(( rc != 0 && $(ran '^selected client: 246 test files, 2449 tests run$'; echo $?) == 0 && $(ran 'reported 1 unhandled error outside its tests'; echo $?) == 0 && $(ran 'this run is RED'; echo $?) == 0 ))
check "an RPC timeout is named as the runner's watchdog, at the watchdog it was given, not as this branch" $(( $(ran '1 of them is a "Timeout calling" error: the runner.s 180s worker RPC watchdog'; echo $?) == 0 && $(ran 'infrastructure, not this branch'; echo $?) == 0 ))
printf '%s\n' ' Test Files  246 passed (246)' '      Tests  2449 passed (2449)' 'Error: [vitest-worker]: Timeout calling "onTaskUpdate"' \
  '  Timeout calling "onTaskUpdate" (repeated in a cause)' '     Errors  1 error' > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" test --scope client
check "one timeout printed on two lines is counted as one error, not two" $(( rc != 0 && $(ran '1 of them is a "Timeout calling" error'; echo $?) == 0 && $(ran '2 of them'; echo $?) != 0 ))
printf '%s\n' ' Test Files  246 passed (246)' '      Tests  2449 passed (2449)' \
  'Error: [vitest-worker]: Timeout calling "onTaskUpdate"' 'Error: [vitest-worker]: Timeout calling "onTaskUpdate"' \
  '     Errors  2 errors' > "$FAKE_PNPM_OUTPUT_FILE"
export VITEST_WORKER_RPC_TIMEOUT_MS=90000
run_validate "$fixture" test --scope client
unset VITEST_WORKER_RPC_TIMEOUT_MS
check "two timeouts read as plural, at an inherited watchdog" $(( rc != 0 && $(ran '2 of them are "Timeout calling" errors: the runner.s 90s worker RPC watchdog'; echo $?) == 0 ))
export VITEST_WORKER_RPC_TIMEOUT_MS=1
run_validate "$fixture" test --scope client
unset VITEST_WORKER_RPC_TIMEOUT_MS
check "a sub-second watchdog reads in milliseconds, not as 0s" $(( rc != 0 && $(ran 'the runner.s 1ms worker RPC watchdog'; echo $?) == 0 ))
for refused in 1e6 1.5 0x10 ' 90000' 0 2147483648 99999999999999999999; do # the patch keeps vitest's 60 s for these
  export VITEST_WORKER_RPC_TIMEOUT_MS="$refused"
  run_validate "$fixture" test --scope client
  check "a watchdog of '$refused', which the patch refuses, is reported as vitest's 60s" $(( rc != 0 && $(ran 'the runner.s 60s worker RPC watchdog'; echo $?) == 0 ))
done
export VITEST_WORKER_RPC_TIMEOUT_MS=2147483647
run_validate "$fixture" test --scope client
check "the largest delay setTimeout honours is reported as given" $(( rc != 0 && $(ran 'the runner.s 2147483647ms worker RPC watchdog'; echo $?) == 0 ))
export VITEST_WORKER_RPC_TIMEOUT_MS=0090000
run_validate "$fixture" test --scope client
unset VITEST_WORKER_RPC_TIMEOUT_MS
check "leading zeros read as decimal, as the patch reads them" $(( rc != 0 && $(ran 'the runner.s 90s worker RPC watchdog'; echo $?) == 0 ))
printf '%s\n' ' Test Files  246 passed (246)' '      Tests  2449 passed (2449)' \
  'Error: [vitest-worker]: Timeout calling "onTaskUpdate"' '     Errors  1 error' > "$FAKE_PNPM_OUTPUT_FILE"
echo 0 > "$FAKE_PNPM_RC_FILE"
run_validate "$fixture" test --scope client
check "an unhandled error fails the phase even when the runner itself exits 0" $(( rc != 0 ))
run_validate "$fixture" test --scope client
check "a run with an unhandled error is never stamped green" $(( rc != 0 && $(is_cached; echo $?) != 0 ))
printf '%s\n' 'packages/server test:  Test Files  3 passed (3)' 'packages/server test:       Tests  9 passed (9)' \
  'packages/server test:      Errors  2 errors' > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" test --scope server
check "a pnpm-prefixed error count counts, and an unhandled error that is no timeout is not called one" $(( rc != 0 && $(ran 'reported 2 unhandled errors outside its tests'; echo $?) == 0 && $(ran 'worker RPC watchdog'; echo $?) != 0 ))
# --- worker cap (#475): the runner never gets every core, the main process needs one ---------------
echo worker-cap > "$fixture/untracked.txt"
cat > "$sandbox/bin/pnpm" <<'PNPM'
#!/usr/bin/env bash
echo "fake pnpm $*"
echo "workers: VITEST_MAX_FORKS=${VITEST_MAX_FORKS:-unset} VITEST_MAX_THREADS=${VITEST_MAX_THREADS:-unset}"
echo "watchdog: VITEST_WORKER_RPC_TIMEOUT_MS=${VITEST_WORKER_RPC_TIMEOUT_MS:-unset}"
echo ' Test Files  1 passed (1)'
echo '      Tests  2 passed (2)'
PNPM
chmod +x "$sandbox/bin/pnpm"
expected_workers=$(( $(nproc) - 2 ))
[[ $expected_workers -ge 1 ]] || expected_workers=1
run_validate "$fixture" test --scope server
check "the test phase caps the runner's workers two below the core count" $(( rc == 0 && $(ran "workers: VITEST_MAX_FORKS=$expected_workers VITEST_MAX_THREADS=$expected_workers"; echo $?) == 0 ))
echo worker-cap-inherited > "$fixture/untracked.txt"
export VITEST_MAX_FORKS=7
run_validate "$fixture" test --scope server
unset VITEST_MAX_FORKS
check "an inherited worker cap wins, for a one-off experiment" $(( $(ran 'VITEST_MAX_FORKS=7'; echo $?) == 0 ))
echo worker-rpc-watchdog > "$fixture/untracked.txt"
run_validate "$fixture" integration --scope server
check "the runner's worker RPC watchdog is raised to three minutes (#437)" $(( rc == 0 && $(ran '^watchdog: VITEST_WORKER_RPC_TIMEOUT_MS=180000$'; echo $?) == 0 ))
echo worker-rpc-watchdog-inherited > "$fixture/untracked.txt"
export VITEST_WORKER_RPC_TIMEOUT_MS=90000
run_validate "$fixture" integration --scope server
unset VITEST_WORKER_RPC_TIMEOUT_MS
check "an inherited worker RPC watchdog wins" $(( $(ran '^watchdog: VITEST_WORKER_RPC_TIMEOUT_MS=90000$'; echo $?) == 0 ))
write_standard_fake_pnpm

echo unhandled-errors-clean > "$fixture/untracked.txt"
printf ' Test Files  1 passed (1)\n      Tests  2 passed (2)\n' > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" test --scope server
check "a runner summary without an Errors line is left alone" $(( rc == 0 && $(ran_pnpm; echo $?) == 0 && $(ran 'unhandled'; echo $?) != 0 ))
: > "$FAKE_PNPM_OUTPUT_FILE"

# --- all: fixed order, per-phase exit codes and stamps, wall times (#281) ---------------------------
echo phases > "$fixture/untracked.txt"
echo ' typecheck$' > "$FAKE_PNPM_FAIL_PATTERN_FILE"
run_validate "$fixture" all
: > "$FAKE_PNPM_FAIL_PATTERN_FILE"
phase_order="$(sed -n 's/^=== \(.*\) ===$/\1/p' <<<"$out" | tr '\n' ' ')"
check "all prints the phases in the fixed order and stops at the failing one (got: $phase_order)" $(( $(grep -q '^lint duplication typecheck $' <<<"$phase_order"; echo $?) == 0 ))
check "a failing phase keeps its own exit code, and all ends with the wall time of each phase that ran" $(( rc != 0 && $(grep -q '^FAILED: typecheck$' <<<"$out"; echo $?) == 0 && $(grep -q '^wall times: lint [0-9]* s, duplication [0-9]* s, typecheck [0-9]* s; all [0-9]* s$' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" lint
check "the green phases of a red all are still stamped" $(( $(is_cached; echo $?) == 0 ))
run_validate "$fixture" typecheck
check "the red phase is not" $(( $(is_cached; echo $?) != 0 && rc == 0 ))

echo lock-case > "$fixture/untracked.txt"
echo 2 > "$FAKE_PNPM_SLEEP_FILE"
first_log="$sandbox/first-gate.log"
started_marker="$sandbox/first-gate-started"
echo "$started_marker" > "$FAKE_PNPM_TOUCH_FILE" # the fake pnpm creates it the moment the first gate is inside the lock
(cd "$fixture" && ./validate.sh test > "$first_log" 2>&1) &
first_pid=$!
until [[ -e "$started_marker" ]]; do sleep 0.05; done
: > "$FAKE_PNPM_TOUCH_FILE"
lint_log="$sandbox/lint-beside-gate.log"
(cd "$fixture" && ./validate.sh lint --fresh > "$lint_log" 2>&1) &
lint_pid=$!
started_second="$EPOCHREALTIME"
run_validate "$fixture" test --fresh
second_elapsed_ms="$(awk -v a="$started_second" -v b="$EPOCHREALTIME" 'BEGIN { printf "%d", (b - a) * 1000 }')"
wait "$first_pid" && first_rc=0 || first_rc=$?
wait "$lint_pid" && lint_rc=0 || lint_rc=$?
check "a lint never waits on a test holding the only heavy slot (#380; lint rc $lint_rc)" $(( lint_rc == 0 && $(grep -q 'waiting for a' "$lint_log"; echo $?) != 0 ))
echo 0 > "$FAKE_PNPM_SLEEP_FILE"
rm -f "$started_marker"
check "a second real test waits for the heavy slot (second took ${second_elapsed_ms} ms, first rc $first_rc)" $(( rc == 0 && first_rc == 0 && $(ran '^waiting for a heavy gate slot before test (1 slot,'; echo $?) == 0 && second_elapsed_ms >= 1500 ))
check "the waiting line names the holder: its pid, worktree and command" $(( $(ran "held by: pid [0-9]* in $fixture: ./validate.sh test, since "; echo $?) == 0 ))
run_validate "$fixture" test
check "a cache hit never waits on the gate slots" $(( $(is_cached; echo $?) == 0 && $(ran 'waiting for a'; echo $?) != 0 ))
echo orphan-case > "$fixture/untracked.txt"
orphan_pid_file="$sandbox/orphan-pid"
cat > "$sandbox/bin/pnpm" <<PNPM
#!/usr/bin/env bash
echo "fake pnpm \$*"
(sleep 30 & echo \$! > "$orphan_pid_file")
exit 0
PNPM
run_validate "$fixture" test
orphan_pid="$(cat "$orphan_pid_file")"
lock_free=0
flock -n "$VALIDATE_GATE_LOCK_DIR/gate.lock" true && lock_free=1
kill "$orphan_pid" 2>/dev/null || true
check "a child that outlives the gate does not keep the lock" $(( rc == 0 && lock_free == 1 ))
write_standard_fake_pnpm
rm -f "$fixture/untracked.txt"

# --- fail fast (#304) -----------------------------------------------------------------------------
echo fail-fast > "$fixture/untracked.txt"
echo '^eslint' > "$FAKE_PNPM_FAIL_PATTERN_FILE"
run_validate "$fixture" all
: > "$FAKE_PNPM_FAIL_PATTERN_FILE"
check "all stops at a red lint: FAILED: lint, and no later phase runs" $(( rc != 0 && $(grep -q '^FAILED: lint$' <<<"$out"; echo $?) == 0 && $(grep -q '^=== \(duplication\|typecheck\|test\) ===$' <<<"$out"; echo $?) != 0 && $(grep -q '^fake pnpm .*test' <<<"$out"; echo $?) != 0 ))
rm -f "$fixture/untracked.txt"

# --- readiness (#329): install and shared build before a real run, never on a hit -----------------
readiness_line='installing dependencies\|building @evolution/shared'
echo readiness > "$fixture/untracked.txt"
run_validate "$fixture" test
check "a ready checkout installs nothing and builds nothing" $(( rc == 0 && $(ran "$readiness_line"; echo $?) != 0 ))
rm -rf "$fixture/node_modules"
run_validate "$fixture" test
check "a cache hit never installs, even without node_modules" $(( $(is_cached; echo $?) == 0 && $(ran "$readiness_line"; echo $?) != 0 ))
run_validate "$fixture" test --fresh
check "a real run without node_modules installs from the lockfile first, in one line" $(( rc == 0 && $(grep -c '^validate.sh: installing dependencies (node_modules does not match pnpm-lock.yaml): pnpm install --frozen-lockfile --prefer-offline$' <<<"$out") == 1 && $(test -f "$fixture/node_modules/.pnpm/lock.yaml"; echo $?) == 0 ))
echo 'lockfileVersion: changed' > "$fixture/pnpm-lock.yaml"
run_validate "$fixture" test
check "a lockfile that no longer matches node_modules installs again" $(( rc == 0 && $(ran '^validate.sh: installing dependencies'; echo $?) == 0 ))
git -C "$fixture" checkout -q -- pnpm-lock.yaml
cp "$fixture/pnpm-lock.yaml" "$fixture/node_modules/.pnpm/lock.yaml"

rm -rf "$fixture/packages/shared/dist"
run_validate "$fixture" test --fresh
check "a missing shared dist is built first, its build record deleted so tsc re-emits" $(( rc == 0 && $(ran '^validate.sh: building @evolution/shared (no packages/shared/dist/index.d.ts)$'; echo $?) == 0 && $(grep -qx deleted "$FAKE_BUILD_SAW_FILE"; echo $?) == 0 ))
run_validate "$fixture" test --fresh
check "once built the checkout is ready: the next real run builds nothing" $(( rc == 0 && $(ran "$readiness_line"; echo $?) != 0 ))
touch -d '+1 minute' "$fixture/packages/shared/src/index.ts"
run_validate "$fixture" test --fresh
touch -d '-1 hour' "$fixture/packages/shared/src/index.ts"
check "a shared source newer than the last build rebuilds, keeping the build record" $(( rc == 0 && $(ran '^validate.sh: building @evolution/shared (packages/shared/src/index.ts changed since the last build)$'; echo $?) == 0 && $(grep -qx kept "$FAKE_BUILD_SAW_FILE"; echo $?) == 0 ))
echo 1 > "$FAKE_BUILD_EDIT_FILE"
rm -rf "$fixture/packages/shared/dist"
run_validate "$fixture" test --fresh
: > "$FAKE_BUILD_EDIT_FILE"
run_validate "$fixture" test --fresh
touch -d '-1 hour' "$fixture/packages/shared/src/index.ts"
check "a shared source saved during the build is rebuilt by the next run (the record has the start time)" $(( rc == 0 && $(ran '^validate.sh: building @evolution/shared (packages/shared/src/index.ts changed since the last build)$'; echo $?) == 0 ))

rm -rf "$fixture/node_modules"
setup_lock="$fixture/.git/workspace-setup.lock"
(exec 8>>"$setup_lock"; flock 8; exec sleep 60) &
setup_holder=$!
until ! flock -n "$setup_lock" true; do sleep 0.05; done
export WORKSPACE_SETUP_LOCK_TIMEOUT_SECONDS=1
run_validate "$fixture" test --fresh
unset WORKSPACE_SETUP_LOCK_TIMEOUT_SECONDS
kill "$setup_holder"
wait "$setup_holder" 2>/dev/null || true
check "a setup waiting past its timeout on the checkout's setup lock fails loudly, before any phase" $(( rc != 0 && $(ran '^validate.sh: timed out after 1s waiting for another setup of this checkout'; echo $?) == 0 && $(ran '^fake pnpm -r test$'; echo $?) != 0 ))
echo '^install' > "$FAKE_PNPM_FAIL_PATTERN_FILE"
run_validate "$fixture" test --fresh
: > "$FAKE_PNPM_FAIL_PATTERN_FILE"
check "a failed install fails the run before any phase runs" $(( rc != 0 && $(ran '^validate.sh: the dependency install failed$'; echo $?) == 0 && $(ran '^fake pnpm -r test$'; echo $?) != 0 ))
rm -rf "$fixture/packages/shared/dist"
echo 'shared build$' > "$FAKE_PNPM_FAIL_PATTERN_FILE"
run_validate "$fixture" test --fresh
: > "$FAKE_PNPM_FAIL_PATTERN_FILE"
check "a failed shared build is reported and the phase still runs" $(( rc == 0 && $(ran 'the @evolution/shared build failed; continuing'; echo $?) == 0 && $(ran '^fake pnpm -r test$'; echo $?) == 0 ))
run_validate "$fixture" test --fresh # rebuilds, so the cases below start from a ready checkout
rm -f "$fixture/untracked.txt"

# --- all --affected (#304): branches off a fixture origin/main ------------------------------------
affected_base="$(git -C "$fixture" rev-parse HEAD)"
git -C "$fixture" update-ref refs/remotes/origin/main "$affected_base"
affected_branch() { # <branch> <path>: a branch off origin/main whose one commit changes <path>
  git -C "$fixture" checkout -q -B "$1" "$affected_base"
  mkdir -p "$(dirname "$fixture/$2")"
  echo "$1" >> "$fixture/$2"
  git -C "$fixture" add -A
  git -C "$fixture" -c user.name=test -c user.email=test@example.com commit -q -m "$1"
}

affected_branch affected-client packages/client/src/app/hud.spec.ts
run_validate "$fixture" all --affected
check "a client-only branch selects client, and says why" $(( rc == 0 && $(ran '^affected client: changed (1 files, e.g. packages/client/src/app/hud.spec.ts)$'; echo $?) == 0 ))
check "a client-only branch typechecks, lints (eslint without its cache, since all is the merge gate) and tests client alone" $(( $(ran '^fake pnpm --filter @evolution/client typecheck$'; echo $?) == 0 && $(ran '^fake pnpm --filter @evolution/client test$'; echo $?) == 0 && $(ran '^fake pnpm eslint packages/client$'; echo $?) == 0 && $(ran '^fake pnpm eslint --cache'; echo $?) != 0 && $(ran '@evolution/server\|-r test\|-r typecheck\|^affected server\|^affected shared'; echo $?) != 0 ))
check "a client-only branch runs client's integration tier after its unit tests (#344)" $(( $(ran '^fake pnpm --filter @evolution/client --if-present test:integration$'; echo $?) == 0 && $(ran '^affected integration: client (1 files) with integration or gameplay tests$'; echo $?) == 0 ))
run_validate "$fixture" lint --scope client
check "a scoped lint on a branch that changed no doc prettier-checks its scope alone" $(( rc == 0 && $(ran "^fake pnpm prettier --check $PRETTIER_CACHED packages/client$"; echo $?) == 0 && $(ran '^lint also prettier-checks'; echo $?) != 0 ))
run_validate "$fixture" all --affected
check "all --affected is stamped per affected set" $(( rc == 0 && $(is_cached; echo $?) == 0 && $(ran '^scope: affected-client$'; echo $?) == 0 ))
run_validate "$fixture" all
check "an affected stamp never answers the plain all" $(( $(is_cached; echo $?) != 0 && $(ran '^fake pnpm -r test$'; echo $?) == 0 ))

affected_branch affected-shared packages/shared/src/index.ts
run_validate "$fixture" all --affected
check "a shared change selects all three packages, the dependents with their reason" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/shared --filter @evolution/server --filter @evolution/client test$'; echo $?) == 0 && $(ran '^affected server: depends on shared$'; echo $?) == 0 && $(ran '^affected client: depends on shared$'; echo $?) == 0 ))
check "a shared change runs the integration tier of every selected package that has one: server and client" $(( $(ran '^fake pnpm --filter @evolution/server --filter @evolution/client --if-present test:integration$'; echo $?) == 0 ))

# #563: the gate answers test and typecheck from package stamps on the same tree, never lint or duplication.
affected_branch affected-reuse packages/server/src/reuse.ts
run_validate "$fixture" test --scope server
run_validate "$fixture" typecheck --scope server
: > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" all --affected
check "an affected gate answers test and typecheck from the package's green stamps on the same tree (#563)" $(( rc == 0 && $(grep -c '^cached green from the package stamps of server at tree [0-9a-f]\{40\}$' <<<"$out") == 2 && $(ran '^fake pnpm --filter @evolution/server test$\|^fake pnpm --filter @evolution/server typecheck$'; echo $?) != 0 ))
check "that gate still lints and scans for duplication itself" $(( $(ran '^fake pnpm eslint packages/server$'; echo $?) == 0 && $(ran '^fake pnpm jscpd'; echo $?) == 0 ))
affected_branch affected-reuse-partial packages/shared/src/partial.ts
run_validate "$fixture" test --scope shared
run_validate "$fixture" test --scope server
run_validate "$fixture" all --affected
check "a package without its own stamp (client) makes the gate run the whole test phase" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/shared --filter @evolution/server --filter @evolution/client test$'; echo $?) == 0 ))
affected_branch affected-reuse-scripts packages/server/src/with-tool.ts
echo tool >> "$fixture/scripts/tool.sh"
git -C "$fixture" add -A && git -C "$fixture" -c user.name=test -c user.email=test@example.com commit -q -m tool
run_validate "$fixture" test --scope server
run_validate "$fixture" all --affected
check "a gate that also runs the shell suites runs its test phase, which no package stamp covers" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/server test$'; echo $?) == 0 && $(ran "$FIXTURE_SUITE_MARKER"; echo $?) == 0 ))

# The reuse's guards, each on its own tree: --fresh, a path-scoped stamp, a Node-major mismatch, the -r gate.
affected_branch affected-reuse-fresh packages/server/src/fresh.ts
run_validate "$fixture" test --scope server
run_validate "$fixture" typecheck --scope server
run_validate "$fixture" all --affected --fresh
check "--fresh never answers the gate from package stamps" $(( rc == 0 && $(ran '^cached green from the package stamps'; echo $?) != 0 && $(ran '^fake pnpm --filter @evolution/server typecheck$'; echo $?) == 0 ))
affected_branch affected-reuse-path packages/server/src/path.ts
printf ' Test Files  1 passed (1)\n      Tests  2 passed (2)\n' > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" test --scope packages/server/src/game
run_validate "$fixture" typecheck --scope packages/server/src/game
run_validate "$fixture" test --scope packages/server/src/game
path_stamped=$(( $(is_cached; echo $?) == 0 ))
: > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" all --affected
check "a path-scoped stamp (no coverage floor) never answers the gate" $(( path_stamped && rc == 0 && $(ran '^cached green from the package stamps'; echo $?) != 0 && $(ran '^fake pnpm --filter @evolution/server test$'; echo $?) == 0 && $(ran '^fake pnpm --filter @evolution/server typecheck$'; echo $?) == 0 ))
affected_branch affected-reuse-node packages/server/src/node.ts
run_validate "$fixture" test --scope server
run_validate "$fixture" typecheck --scope server
run_validate "$fixture" typecheck --scope server
reuse_tree="$(sed -n 's/^cached green from .* at tree //p' <<<"$out")"
sed -i 's/^node=.*/node=0/' "$slug_dir/$reuse_tree.typecheck.scope-server"
run_validate "$fixture" all --affected
check "a package stamp from another Node major never answers the gate" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/server typecheck$'; echo $?) == 0 && $(grep -c '^cached green from the package stamps of server' <<<"$out") == 1 ))
affected_branch affected-reuse-everything packages/extra/src/unregistered.ts
echo root >> "$fixture/eslint.config.js"
git -C "$fixture" add -A && git -C "$fixture" -c user.name=test -c user.email=test@example.com commit -q -m root
for package in shared server client; do run_validate "$fixture" typecheck --scope "$package"; done
run_validate "$fixture" all --affected
check "the everything gate (-r, which also reaches unregistered packages) never composes package stamps" $(( rc == 0 && $(ran '^cached green from the package stamps'; echo $?) != 0 && $(ran '^fake pnpm -r typecheck$'; echo $?) == 0 ))

affected_branch affected-docs docs/NOTE.md
run_validate "$fixture" all --affected
check "a docs-only branch runs lint alone: prettier on the doc, no eslint, the other phases skipped" $(( rc == 0 && $(ran "^fake pnpm prettier --check $PRETTIER_CACHED docs/NOTE.md$"; echo $?) == 0 && $(ran '^fake pnpm eslint\|typecheck$\|test$\|test:integration'; echo $?) != 0 && $(grep -c '^skipped: no package' <<<"$out") == 4 ))
run_validate "$fixture" lint --scope client
check "a scoped lint also prettier-checks the docs the branch changed, and says so (#329)" $(( rc == 0 && $(ran "^fake pnpm prettier --check $PRETTIER_CACHED packages/client docs/NOTE.md$"; echo $?) == 0 && $(ran '^lint also prettier-checks the 1 docs changed on the branch: docs/NOTE.md$'; echo $?) == 0 ))
run_validate "$fixture" format --scope client
check "a scoped format also prettier-writes the docs the branch changed, and says so (#641)" $(( rc == 0 && $(ran "^fake pnpm prettier $PRETTIER_WRITE_ARGUMENTS packages/client docs/NOTE.md$"; echo $?) == 0 && $(ran '^format also prettier-writes the 1 docs changed on the branch: docs/NOTE.md$'; echo $?) == 0 ))

affected_branch affected-scripts scripts/tool.sh
run_validate "$fixture" all --affected
check "a scripts change runs the shell suites and no package phase" $(( rc == 0 && $(ran "$FIXTURE_SUITE_MARKER"; echo $?) == 0 && $(ran '^fake pnpm .*test$\|typecheck$\|test:integration'; echo $?) != 0 && $(ran '^affected scripts:'; echo $?) == 0 ))

affected_branch affected-root eslint.config.js
run_validate "$fixture" all
run_validate "$fixture" all --affected
check "a root file outside packages, docs and scripts runs the plain all" $(( rc == 0 && $(ran '^affected everything: eslint.config.js is outside'; echo $?) == 0 && $(ran '^fake pnpm -r test$'; echo $?) == 0 ))
check "a plain all stamp never answers the affected gate on a root-file branch, which adds integration" $(( rc == 0 && $(is_cached; echo $?) != 0 && $(ran '^fake pnpm --filter @evolution/server --filter @evolution/client --if-present test:integration$'; echo $?) == 0 && $(ran '^ALL PASSED$'; echo $?) == 0 ))

# --- the merge gate's integration tier and base (#344) ---------------------------------------------
affected_branch affected-server packages/server/src/game/world.ts
echo 'test:integration' > "$FAKE_PNPM_FAIL_PATTERN_FILE"
run_validate "$fixture" all --affected
: > "$FAKE_PNPM_FAIL_PATTERN_FILE"
check "a failing integration test fails the gate: FAILED: integration, after the unit tests ran" $(( rc != 0 && $(ran '^FAILED: integration$'; echo $?) == 0 && $(ran '^fake pnpm --filter @evolution/server test$'; echo $?) == 0 ))
run_validate "$fixture" all --affected
phase_order="$(sed -n 's/^=== \(.*\) ===$/\1/p' <<<"$out" | tr '\n' ' ')"
check "a red integration phase is never stamped: the next gate on the same tree runs it again" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/server --if-present test:integration$'; echo $?) == 0 && $(ran '^ALL PASSED$'; echo $?) == 0 ))
check "a server-affected gate runs integration last, for the package with gameplay tests (got: $phase_order)" $(( $(grep -q '^lint duplication typecheck test integration $' <<<"$phase_order"; echo $?) == 0 && $(ran '^affected integration: server (1 files) with integration or gameplay tests$'; echo $?) == 0 && $(ran '^wall times: lint cached, duplication cached, typecheck cached, test cached, integration [0-9]* s; all [0-9]* s$'; echo $?) == 0 ))

affected_branch affected-server-red packages/server/src/game/world.ts
echo '@evolution/server test$' > "$FAKE_PNPM_FAIL_PATTERN_FILE"
run_validate "$fixture" all --affected
: > "$FAKE_PNPM_FAIL_PATTERN_FILE"
check "a red unit phase stops the gate before integration" $(( rc != 0 && $(ran '^FAILED: test$'; echo $?) == 0 && $(ran '^=== integration ===$\|test:integration'; echo $?) != 0 ))

affected_branch affected-behind packages/server/src/game/world.ts
run_validate "$fixture" all --affected
git -C "$fixture" checkout -q -B main-moved "$affected_base"
mkdir -p "$fixture/docs"
echo moved > "$fixture/docs/MOVED.md"
git -C "$fixture" add -A
git -C "$fixture" -c user.name=test -c user.email=test@example.com commit -q -m main-moved
git -C "$fixture" update-ref refs/remotes/origin/main HEAD
git -C "$fixture" checkout -q affected-behind
behind_head="$(git -C "$fixture" rev-parse HEAD)"
behind_status="$(git -C "$fixture" status --porcelain)"
run_validate "$fixture" all --affected
check "a branch behind origin/main is refused, naming the merge, even with a green stamp on its tree" $(( rc != 0 && $(ran 'is 1 commit behind origin/main'; echo $?) == 0 && $(ran 'git merge origin/main'; echo $?) == 0 && $(ran_pnpm; echo $?) != 0 && $(is_cached; echo $?) != 0 && $(ran '^ALL PASSED$'; echo $?) != 0 ))
check "the refusal leaves the branch, the tree and the stash as they were" $(( $(test "$(git -C "$fixture" rev-parse HEAD)" == "$behind_head"; echo $?) == 0 && $(test "$(git -C "$fixture" status --porcelain)" == "$behind_status"; echo $?) == 0 &&$(git -C "$fixture" stash list | wc -l) == 0 ))
git -C "$fixture" -c user.name=test -c user.email=test@example.com merge -q --no-edit origin/main
run_validate "$fixture" all --affected
check "once origin/main is merged in, the gate runs, integration included" $(( rc == 0 && $(ran '^fake pnpm --filter @evolution/server --if-present test:integration$'; echo $?) == 0 && $(ran '^ALL PASSED$'; echo $?) == 0 ))

remote_repo="$sandbox/origin.git"
git init -q --bare "$remote_repo"
git -C "$fixture" checkout -q -B main-fetched origin/main
mkdir -p "$fixture/docs"
echo fetched > "$fixture/docs/FETCHED.md"
git -C "$fixture" add -A
git -C "$fixture" -c user.name=test -c user.email=test@example.com commit -q -m main-fetched
fetched_head="$(git -C "$fixture" rev-parse HEAD)"
git -C "$fixture" push -q "$remote_repo" HEAD:refs/heads/main
git -C "$fixture" checkout -q affected-behind
git -C "$fixture" remote add origin "$remote_repo"
run_validate "$fixture" all --affected
check "the gate fetches origin main first, so an out-of-date local origin/main never hides a behind branch" $(( rc != 0 && $(ran 'behind origin/main'; echo $?) == 0 && $(test "$(git -C "$fixture" rev-parse origin/main)" == "$fetched_head"; echo $?) == 0 ))
git -C "$fixture" -c user.name=test -c user.email=test@example.com merge -q --no-edit origin/main
git -C "$fixture" remote set-url origin "$sandbox/no-such-origin.git"
run_validate "$fixture" all --affected
check "a fetch that fails says so and compares against the local copy" $(( rc == 0 && $(ran '^validate.sh: could not fetch origin/main; comparing against the local copy$'; echo $?) == 0 && $(ran '^ALL PASSED$'; echo $?) == 0 ))
git -C "$fixture" remote remove origin

run_validate "$fixture" test --affected
check "--affected is refused outside all" $(( rc != 0 && $(ran 'works with `all` only'; echo $?) == 0 && $(ran_pnpm; echo $?) != 0 ))
run_validate "$fixture" all --affected --scope server
check "--affected is refused with --scope" $(( rc != 0 && $(ran_pnpm; echo $?) != 0 ))

if [[ $failures -gt 0 ]]; then
  echo "validate-cache.test.sh: $failures failure(s)"
  exit 1
fi
echo "validate-cache.test.sh: all cases passed"
