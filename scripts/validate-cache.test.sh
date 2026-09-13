#!/usr/bin/env bash
# validate-cache.test.sh — exercises validate.sh's result cache (docs/ENGINEERING.md §1) against a
# throwaway git repo with a fake `pnpm` on PATH, so it runs without node_modules:
#   second run is cached; an untracked file change invalidates; --fresh re-runs; red is never
#   cached; `all` stamps its phases and itself (an `all` hit prints ALL PASSED and filters see every
#   phase's stored log); a worktree at the same content shares the stamp; a Node-major mismatch, a
#   missing stored log and a run that changes the tree are misses; VALIDATE_CACHE_DIR overrides the
#   directory; an unwritable directory degrades to no cache with one warning line; --scope narrows
#   each phase to a package or a path and stamps per scope (a scoped stamp never answers an unscoped
#   call, nor the reverse); a targeted run that selects no test file fails while a tier-wide one
#   passes; `all` prints its phases in a fixed order with a wall-times line and keeps each phase's
#   exit code and stamp; two real gates on one machine run one after the other (gate.lock) while a
#   hit never waits.
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

# --- fixture: a git repo holding validate.sh, a stub docs-index.sh, package dirs and a fake pnpm --
fixture="$sandbox/repo"
mkdir -p "$fixture/scripts" "$sandbox/bin" "$sandbox/home" \
  "$fixture/packages/shared/src" "$fixture/packages/server/src/game" "$fixture/packages/client/src/app"
cp "$repo_root/validate.sh" "$fixture/validate.sh"
printf '#!/usr/bin/env bash\nexit 0\n' > "$fixture/scripts/docs-index.sh"
touch "$fixture/packages/shared/src/index.ts" "$fixture/packages/server/src/game/world.ts" \
  "$fixture/packages/server/src/game/world.test.ts" "$fixture/packages/client/src/app/hud.spec.ts"
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
exit "\$(cat "$FAKE_PNPM_RC_FILE")"
PNPM
  chmod +x "$sandbox/bin/pnpm"
}
write_standard_fake_pnpm
chmod +x "$fixture/scripts/docs-index.sh"
echo 0 > "$FAKE_PNPM_RC_FILE"
: > "$FAKE_PNPM_TOUCH_FILE"
echo 0 > "$FAKE_PNPM_SLEEP_FILE"
: > "$FAKE_PNPM_OUTPUT_FILE"
: > "$FAKE_PNPM_FAIL_PATTERN_FILE"
git -C "$fixture" init -q
git -C "$fixture" -c user.name=test -c user.email=test@example.com add -A
git -C "$fixture" -c user.name=test -c user.email=test@example.com commit -q -m fixture

export PATH="$sandbox/bin:$PATH" HOME="$sandbox/home"
unset VALIDATE_CACHE_DIR

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
check "test prints the selection per package" $(( $(grep -q '^selected server: 2 test files, 5 tests$' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" test --scope packages/server/src/game
check "a path-scoped green is stamped for that path" $(( $(is_cached; echo $?) == 0 ))
run_validate "$fixture" test --scope packages/server/src/game/world.ts
check "a source file selects the tests named after it" $(( $(grep -q '^fake pnpm --filter @evolution/server test src/game/world\. --coverage.enabled=false$' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" test --scope packages/client/src/app
check "a client path scope passes --include without coverage" $(( $(grep -q '^fake pnpm --filter @evolution/client test --include src/app --no-coverage$' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" integration --scope packages/client/src/app
check "a client integration path scope keeps the integration spec selection" $(( $(grep -q '^fake pnpm --filter @evolution/client --if-present test:integration --include src/app/\*\*/\*\.integration\.spec\.ts$' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" lint --scope packages/server/src/game
check "a path scope lints and formats only that path" $(( $(grep -q '^fake pnpm eslint packages/server/src/game$' <<<"$out"; echo $?) == 0 && $(grep -q '^fake pnpm prettier --check packages/server/src/game$' <<<"$out"; echo $?) == 0 ))
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
check "a path-scoped run that selects no test file fails" $(( rc != 0 && $(grep -q 'selected no test files' <<<"$out"; echo $?) == 0 && $(grep -q '^selected server: 0 test files, 0 tests$' <<<"$out"; echo $?) == 0 ))
printf '%s\n' 'packages/shared test:integration:  No test files found, exiting with code 0' \
  'packages/server test:integration:  Test Files  3 passed (3)' 'packages/server test:integration:       Tests  9 passed (9)' > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" integration
check "a tier-wide run passes over a package with no files in the tier" $(( rc == 0 && $(grep -q '^selected shared: 0 test files, 0 tests$' <<<"$out"; echo $?) == 0 && $(grep -q '^selected server: 3 test files, 9 tests$' <<<"$out"; echo $?) == 0 ))
run_validate "$fixture" integration -- ecology
check "extra args that select files in any package pass" $(( rc == 0 ))
printf '%s\n' 'packages/shared test:integration:  No test files found, exiting with code 0' > "$FAKE_PNPM_OUTPUT_FILE"
run_validate "$fixture" integration -- nothing-matches
check "extra args that select no file anywhere fail" $(( rc != 0 && $(grep -q 'selected no test files' <<<"$out"; echo $?) == 0 ))
: > "$FAKE_PNPM_OUTPUT_FILE"

# --- all: fixed order, per-phase exit codes and stamps, wall times (#281) ---------------------------
echo phases > "$fixture/untracked.txt"
echo ' typecheck$' > "$FAKE_PNPM_FAIL_PATTERN_FILE"
run_validate "$fixture" all
: > "$FAKE_PNPM_FAIL_PATTERN_FILE"
phase_order="$(sed -n 's/^=== \(.*\) ===$/\1/p' <<<"$out" | tr '\n' ' ')"
check "all prints the phases in the fixed order (got: $phase_order)" $(( $(grep -q '^lint duplication typecheck test $' <<<"$phase_order"; echo $?) == 0 ))
check "a failing phase keeps its own exit code, and all ends with each phase's wall time" $(( rc != 0 && $(grep -q '^FAILED: typecheck$' <<<"$out"; echo $?) == 0 && $(grep -q '^wall times: lint [0-9]* s, duplication [0-9]* s, typecheck [0-9]* s, test [0-9]* s; all [0-9]* s$' <<<"$out"; echo $?) == 0 ))
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
started_second="$EPOCHREALTIME"
run_validate "$fixture" test
second_elapsed_ms="$(awk -v a="$started_second" -v b="$EPOCHREALTIME" 'BEGIN { printf "%d", (b - a) * 1000 }')"
wait "$first_pid" && first_rc=0 || first_rc=$?
echo 0 > "$FAKE_PNPM_SLEEP_FILE"
rm -f "$started_marker"
check "a second real gate waits for the first (second took ${second_elapsed_ms} ms, first rc $first_rc)" $(( rc == 0 && first_rc == 0 && $(grep -q '^waiting for another gate to finish' <<<"$out"; echo $?) == 0 && second_elapsed_ms >= 1500 ))
run_validate "$fixture" test
check "a cache hit never waits on the gate lock" $(( $(is_cached; echo $?) == 0 && $(grep -q 'waiting for another gate' <<<"$out"; echo $?) != 0 ))
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
flock -n "$HOME/.cache/$(basename "$fixture")-validate/gate.lock" true && lock_free=1
kill "$orphan_pid" 2>/dev/null || true
check "a child that outlives the gate does not keep the lock" $(( rc == 0 && lock_free == 1 ))
write_standard_fake_pnpm
rm -f "$fixture/untracked.txt"

if [[ $failures -gt 0 ]]; then
  echo "validate-cache.test.sh: $failures failure(s)"
  exit 1
fi
echo "validate-cache.test.sh: all cases passed"
