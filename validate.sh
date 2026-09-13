#!/usr/bin/env bash
# validate.sh - Unified validation runner for test, typecheck, and lint
# Usage: ./validate.sh <command> [options] [-- extra-args...]
#
# Commands:
#   test         Run unit tests with coverage thresholds (pnpm -r test)
#   integration  Run the *.integration.test.ts / *.integration.spec.ts tier plus the *.gameplay.test.ts scenarios (pnpm -r test:integration)
#   typecheck    Run type checking (pnpm -r typecheck)
#   lint         Run linting (eslint + prettier --check + disable-directive / TODO audit + docs/INDEX.md freshness)
#   duplication  Run jscpd against .jscpd.json (docs/CODE-STANDARDS.md §3)
#   all          Run lint, duplication, typecheck, test in sequence, then one line of per-phase wall times
#
# Options:
#   -tN        Tail N lines of output (e.g. -t20)
#   -hN        Head N lines of output (e.g. -h50)
#   -G PATTERN Grep output for PATTERN
#   --fresh    Ignore the result cache and re-run (a green result is still stamped)
#   --scope S  Narrow every phase to a package (shared | server | client) or to a file or directory
#              under packages/<package>/src. A package scope keeps the coverage floors; a path scope
#              runs only the tests it selects, without coverage floors, lints and scans that path, and
#              typechecks its package (tsc checks whole projects).
#   VALIDATE_NO_GATE_LOCK=1   Skip the one-gate-at-a-time lock (sandboxed tests only)
#
# Extra args after -- are passed to the underlying command (and disable the result cache).
# test and integration print a `selected <package>: N test files, M tests` line per package; a
# targeted run (a path scope, or extra args) that selects no test file fails (#289).
#
# Result cache (docs/ENGINEERING.md §1): a green run is stamped under
# $HOME/.cache/<slug>-validate/<tree>.<command>[.scope-<scope>] (override the directory with
# VALIDATE_CACHE_DIR), keyed by `git write-tree` of the whole working tree, tracked and untracked,
# plus the Node major version and the scope. A repeat call on the same tree and scope prints
# `cached green from <time> at tree <hash>` and the stored log path, applies -t/-h/-G to the stored
# log, and exits 0. Red is never cached; a scoped stamp never answers an unscoped call, nor the
# reverse. `all` stamps each phase and itself. Shared across worktrees at the same content. Real
# runs hold $HOME/.cache/<slug>-validate/gate.lock so only one gate runs per machine; hits never wait.
#
# Examples:
#   ./validate.sh test                                        # run all tests
#   ./validate.sh test --scope server                         # the server package, with its coverage floor
#   ./validate.sh test --scope packages/server/src/game/world # only the tests under that directory
#   ./validate.sh typecheck -t20                              # typecheck, show last 20 lines
#   ./validate.sh lint -G 'error'                             # lint, grep for pattern
#   ./validate.sh all -t30                                    # run all, tail 30 lines each

TAIL_N=""
HEAD_N=""
GREP_PAT=""
COMMAND=""
EXTRA_ARGS=()
FRESH=0
SCOPE_ARG=""
USAGE="Usage: ./validate.sh <test|integration|typecheck|lint|duplication|all> [-tN] [-hN] [-G pattern] [--fresh] [--scope <shared|server|client|path>] [-- extra-args...]"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    test|integration|typecheck|lint|duplication|all)
      COMMAND="$1"
      shift
      ;;
    -t[0-9]*)
      TAIL_N="${1#-t}"
      shift
      ;;
    -h[0-9]*)
      HEAD_N="${1#-h}"
      shift
      ;;
    -G)
      GREP_PAT="$2"
      shift 2
      ;;
    -G*)
      GREP_PAT="${1#-G}"
      shift
      ;;
    --fresh)
      FRESH=1
      shift
      ;;
    --scope)
      [[ $# -ge 2 ]] || { echo "$USAGE" >&2; exit 1; }
      SCOPE_ARG="$2"
      shift 2
      ;;
    --scope=*)
      SCOPE_ARG="${1#--scope=}"
      shift
      ;;
    --)
      shift
      EXTRA_ARGS=("$@")
      break
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$COMMAND" ]]; then
  echo "$USAGE" >&2
  exit 1
fi

apply_filters() {
  local input
  input="$(cat)"

  if [[ -n "$GREP_PAT" ]]; then
    input="$(echo "$input" | grep -E "$GREP_PAT" || true)"
  fi

  if [[ -n "$HEAD_N" ]]; then
    input="$(echo "$input" | head -n "$HEAD_N")"
  fi

  if [[ -n "$TAIL_N" ]]; then
    input="$(echo "$input" | tail -n "$TAIL_N")"
  fi

  echo "$input"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------------------
# Scope (--scope, see the header): resolved once, before anything runs; every phase reads these.
# ---------------------------------------------------------------------------
PACKAGES=(shared server client)
PACKAGE_NAME_PREFIX="@evolution/"
CLIENT_PACKAGE="client"
SHARED_PACKAGE="shared"
# Source files the standards apply to (docs/CODE-STANDARDS.md); tests included.
PACKAGE_SOURCES=()
for package in "${PACKAGES[@]}"; do PACKAGE_SOURCES+=("packages/$package/src"); done
TEST_FILE_PATTERN='\.(test|spec)\.ts$'
CLIENT_INTEGRATION_SPEC_SUFFIX=".integration.spec.ts"

SCOPE_NAME=""                          # what a stamp records: the package or the path; empty unscoped
SCOPE_PACKAGE=""                       # the package a scoped run is narrowed to
SCOPE_PATH=""                          # the repo-relative file or directory of a path scope
PNPM_SELECTION=(-r)                    # every package, or --filter <the scoped package>
LINT_PATHS=(.)                         # what eslint and prettier read
SOURCE_PATHS=("${PACKAGE_SOURCES[@]}") # what jscpd and the audits read

is_package() {
  local name
  for name in "${PACKAGES[@]}"; do [[ "$1" == "$name" ]] && return 0; done
  return 1
}

narrow_to_package() {
  SCOPE_NAME="$1"
  SCOPE_PACKAGE="$1"
  PNPM_SELECTION=(--filter "$PACKAGE_NAME_PREFIX$1")
  LINT_PATHS=("packages/$1")
  SOURCE_PATHS=("packages/$1/src")
}

# A package name, `packages/<package>[/src]` (the same as the name), or a path below that src.
resolve_scope() {
  [[ -n "$SCOPE_ARG" ]] || return 0
  if is_package "$SCOPE_ARG"; then
    narrow_to_package "$SCOPE_ARG"
    return 0
  fi
  local relative
  relative="$(realpath -m --relative-to="$SCRIPT_DIR" "$SCOPE_ARG")"
  if [[ "$relative" =~ ^packages/([^/]+)(/src)?$ ]] && is_package "${BASH_REMATCH[1]}"; then
    narrow_to_package "${BASH_REMATCH[1]}"
  elif [[ "$relative" =~ ^packages/([^/]+)/src/. ]] && is_package "${BASH_REMATCH[1]}"; then
    [[ -e "$SCRIPT_DIR/$relative" ]] || { echo "validate.sh: --scope $SCOPE_ARG: no such file or directory" >&2; exit 1; }
    narrow_to_package "${BASH_REMATCH[1]}"
    SCOPE_NAME="$relative"
    SCOPE_PATH="$relative"
    LINT_PATHS=("$relative")
    SOURCE_PATHS=("$relative")
  else
    echo "validate.sh: --scope $SCOPE_ARG: expected ${PACKAGES[*]} or a path under packages/<package>/src" >&2
    exit 1
  fi
}

# vitest's positional filter is a substring of the test file's path: a directory selects the tests
# under it, a test file itself, and a source file the tests named after it (foo.ts -> foo.*).
vitest_path_filter() { # <package-relative path>
  if [[ -d "$SCRIPT_DIR/$SCOPE_PATH" ]]; then
    echo "$1/"
  elif [[ "$1" =~ $TEST_FILE_PATTERN ]]; then
    echo "$1"
  else
    echo "${1%.ts}."
  fi
}

# The Angular builder's --include replaces the target's own include (a directory selects the specs
# under it, a source file its spec), so the integration target's *.integration.spec.ts selection is
# re-applied: a directory selects the integration specs under it, any other file its integration spec.
client_include() { # <test | integration> <package-relative path>
  if [[ "$1" != integration || "$2" == *"$CLIENT_INTEGRATION_SPEC_SUFFIX" ]]; then
    echo "$2"
  elif [[ -d "$SCRIPT_DIR/$SCOPE_PATH" ]]; then
    echo "$2/**/*$CLIENT_INTEGRATION_SPEC_SUFFIX"
  else
    local base="${2##*/}"
    echo "${2%/*}/${base%%.*}$CLIENT_INTEGRATION_SPEC_SUFFIX"
  fi
}

# One argument per line: what a path scope adds to the <test | integration> runner. A slice of a
# package cannot meet the package's coverage floor, so a path-scoped `test` runs without coverage.
path_scope_runner_args() { # <test | integration>
  [[ -n "$SCOPE_PATH" ]] || return 0
  local package_relative="${SCOPE_PATH#packages/"$SCOPE_PACKAGE"/}"
  if [[ "$SCOPE_PACKAGE" == "$CLIENT_PACKAGE" ]]; then
    printf '%s\n' --include "$(client_include "$1" "$package_relative")"
    [[ "$1" != test ]] || echo "--no-coverage"
  else
    vitest_path_filter "$package_relative"
    [[ "$1" != test ]] || echo "--coverage.enabled=false"
  fi
}

# ---------------------------------------------------------------------------
# Result cache (see the header). Only green runs are stamped; a stamp is
# key=value lines: exit, time, log, node, command, scope, tree.
# ---------------------------------------------------------------------------
ALL_PHASES=(lint duplication typecheck test)
CACHE_DIR=""
TREE_HASH=""
NODE_MAJOR=""
TEMP_INDEX=""   # the temporary index while cache_tree_hash runs
PHASE_OUTPUT="" # set by run_cached: the phase's raw output, or its stored log on a hit
PHASE_WAS_CACHED=0
CACHE_HIT_TIME=""
CACHE_HIT_LOG=""

cleanup_temp_files() { rm -f "${TEMP_INDEX:+$TEMP_INDEX}" "${TEMP_INDEX:+$TEMP_INDEX.lock}"; }
trap cleanup_temp_files EXIT
trap 'cleanup_temp_files; exit 130' INT TERM

# The cache name: SLUG from PORTS.env, else the main checkout's directory name (the same for
# every worktree of the repo), else this directory's name.
cache_slug() {
  local slug
  slug="$(sed -n 's/^SLUG=//p' "$SCRIPT_DIR/PORTS.env" 2>/dev/null | head -n 1)"
  if [[ -z "$slug" ]]; then
    local common_dir
    common_dir="$(git -C "$SCRIPT_DIR" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
    [[ -n "$common_dir" ]] && slug="$(basename "$(dirname "$common_dir")")"
  fi
  [[ -n "$slug" ]] || slug="$(basename "$SCRIPT_DIR")"
  echo "$slug"
}

# One hash for the exact working tree, tracked and untracked (ignored files excluded), without
# touching the real index: copy it (so unchanged files are not re-hashed), `git add -A` into the
# copy, `git write-tree`. Empty when this is not a git checkout. The add writes real loose objects
# (a blob per changed file plus the tree) into .git/objects; they are unreachable and harmless,
# and `git gc` prunes them after its default two weeks.
cache_tree_hash() {
  local real_index hash
  real_index="$(git -C "$SCRIPT_DIR" rev-parse --path-format=absolute --git-path index 2>/dev/null || true)"
  [[ -n "$real_index" ]] || return 0
  TEMP_INDEX="$(mktemp)"
  [[ -f "$real_index" ]] && cp "$real_index" "$TEMP_INDEX"
  hash="$(cd "$SCRIPT_DIR" && GIT_INDEX_FILE="$TEMP_INDEX" git add -A . 2>/dev/null \
    && GIT_INDEX_FILE="$TEMP_INDEX" git write-tree 2>/dev/null || true)"
  rm -f "$TEMP_INDEX" "$TEMP_INDEX.lock"
  TEMP_INDEX=""
  echo "$hash"
}

cache_init() {
  # Extra args change what runs, so the result is not comparable: no cache for those calls.
  [[ ${#EXTRA_ARGS[@]} -eq 0 ]] || return 0
  TREE_HASH="$(cache_tree_hash)"
  [[ -n "$TREE_HASH" ]] || return 0
  NODE_MAJOR="$(node --version 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/')"
  CACHE_DIR="${VALIDATE_CACHE_DIR:-$HOME/.cache/$(cache_slug)-validate}"
  if ! mkdir -p "$CACHE_DIR/logs" 2>/dev/null || [[ ! -w "$CACHE_DIR/logs" ]]; then
    echo "validate.sh: result cache disabled: cannot write $CACHE_DIR" >&2
    CACHE_DIR=""
  fi
}

# <cmd> unscoped; <cmd>.scope-<package or path, slashes as underscores> scoped.
cache_key() { echo "$1${SCOPE_NAME:+.scope-${SCOPE_NAME//\//_}}"; }
cache_stamp_path() { echo "$CACHE_DIR/$TREE_HASH.$(cache_key "$1")"; }
cache_log_path() { echo "$CACHE_DIR/logs/$TREE_HASH.$(cache_key "$1").log"; }
stamp_field() { sed -n "s/^$2=//p" "$1" | head -n 1; }
have_filters() { [[ -n "$GREP_PAT" || -n "$HEAD_N" || -n "$TAIL_N" ]]; }

# Returns 0, with CACHE_HIT_TIME / CACHE_HIT_LOG set, when a green stamp with its log exists for
# this tree, command, scope and Node major; returns 1 otherwise (a stamp whose log is gone is a
# miss). The scope field is compared as well as the name, so no two scopes can share a stamp.
cache_hit() {
  local cmd="$1" stamp
  [[ -n "$CACHE_DIR" && $FRESH -eq 0 ]] || return 1
  stamp="$(cache_stamp_path "$cmd")"
  [[ -f "$stamp" ]] || return 1
  [[ "$(stamp_field "$stamp" exit)" == "0" && "$(stamp_field "$stamp" node)" == "$NODE_MAJOR" ]] || return 1
  [[ "$(stamp_field "$stamp" scope)" == "$SCOPE_NAME" ]] || return 1
  CACHE_HIT_TIME="$(stamp_field "$stamp" time)"
  CACHE_HIT_LOG="$(stamp_field "$stamp" log)"
  if [[ ! -f "$CACHE_HIT_LOG" ]]; then
    echo "validate.sh: stamp $stamp has no log ($CACHE_HIT_LOG); re-running" >&2
    return 1
  fi
}

# Prints the cached-green lines and, when a filter is set, the filtered stored log.
print_cache_hit() {
  echo "cached green from $CACHE_HIT_TIME at tree $TREE_HASH"
  [[ -z "$SCOPE_NAME" ]] || echo "scope: $SCOPE_NAME"
  echo "log: $CACHE_HIT_LOG"
  if have_filters; then
    apply_filters < "$CACHE_HIT_LOG"
  fi
}

# Writes <content> to <path> atomically (per-process temp name + mv), so concurrent runs on one
# tree never expose a half-written file and never race on one temp name.
write_atomically() { # <path> <content>
  printf '%s\n' "$2" > "$1.tmp.$$" && mv "$1.tmp.$$" "$1"
}

# Stamps a green run of <cmd> whose raw output is <output>, unless the run changed the tree.
cache_store() {
  local cmd="$1" output="$2"
  [[ -n "$CACHE_DIR" ]] || return 0
  if [[ "$(cache_tree_hash)" != "$TREE_HASH" ]]; then
    echo "not cached: the run changed the working tree"
    return 0
  fi
  local stamp log stamp_body
  stamp="$(cache_stamp_path "$cmd")"
  log="$(cache_log_path "$cmd")"
  stamp_body="$(printf 'exit=0\ntime=%s\nlog=%s\nnode=%s\ncommand=%s\nscope=%s\ntree=%s' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$log" "$NODE_MAJOR" "$cmd" "$SCOPE_NAME" "$TREE_HASH")"
  if ! { write_atomically "$log" "$output" && write_atomically "$stamp" "$stamp_body"; } 2>/dev/null; then
    echo "not cached: cannot write $CACHE_DIR"
  fi
}

# One real gate at a time per machine: every non-cached run holds an exclusive lock on
# $HOME/.cache/<slug>-validate/gate.lock (falling back to ${TMPDIR:-/tmp}), independent of
# VALIDATE_CACHE_DIR so a scratch cache still queues behind the machine's gates; the fd is closed
# for the child (9>&-) so no orphaned worker can keep the lock; a cache hit never takes it.
GATE_LOCK_FD=""
gate_lock_path() { # machine-wide per repo: never under VALIDATE_CACHE_DIR, which a CI run points at scratch
  local dir="$HOME/.cache/$(cache_slug)-validate"
  if mkdir -p "$dir" 2>/dev/null && [[ -w "$dir" ]]; then echo "$dir/gate.lock"; else echo "${TMPDIR:-/tmp}/$(cache_slug)-validate-gate.lock"; fi
}
gate_lock_acquire() { # <cmd>
  [[ "${VALIDATE_NO_GATE_LOCK:-0}" == "1" ]] && return 0
  command -v flock >/dev/null 2>&1 || { echo "validate.sh: flock not found; running unlocked" >&2; return 0; }
  local path
  path="$(gate_lock_path)"
  exec 9>>"$path" || { echo "validate.sh: gate lock unavailable ($path); running unlocked" >&2; return 0; }
  GATE_LOCK_FD=9
  if ! flock -n 9; then
    echo "waiting for another gate to finish before $1 (lock $path)"
    flock 9
  fi
}
gate_lock_release() { [[ -z "$GATE_LOCK_FD" ]] || { flock -u 9; exec 9>&-; GATE_LOCK_FD=""; }; }

# Runs <cmd> through the cache: a hit prints the stamp; a green run is stamped; red never is.
# PHASE_OUTPUT and PHASE_WAS_CACHED tell `all` what goes in its own log.
run_cached() {
  local cmd="$1"
  shift
  if cache_hit "$cmd"; then
    print_cache_hit
    PHASE_OUTPUT="$(cat "$CACHE_HIT_LOG")"
    PHASE_WAS_CACHED=1
    return 0
  fi
  local rc=0
  PHASE_WAS_CACHED=0
  gate_lock_acquire "$cmd"
  PHASE_OUTPUT="$(run_one "$cmd" "$@" 9>&-)" || rc=$?
  gate_lock_release
  printf '%s\n' "$PHASE_OUTPUT" | apply_filters
  if [[ $rc -eq 0 ]]; then
    cache_store "$cmd" "$PHASE_OUTPUT"
  fi
  return $rc
}

build_shared() {
  # Build shared package so downstream .d.ts references are fresh
  pnpm --filter "$PACKAGE_NAME_PREFIX$SHARED_PACKAGE" build > /dev/null 2>&1 || true
}

# docs/ENGINEERING.md §3.3: an eslint-disable needs a justification on the directive
# (`// eslint-disable-next-line rule -- why`). Prints the count; fails on an unjustified one.
audit_disable_directives() {
  local all unjustified
  all="$(grep -rn --include='*.ts' 'eslint-disable' "${SOURCE_PATHS[@]}" 2>/dev/null || true)"
  unjustified="$(echo "$all" | grep -v '^$' | grep -v -- ' -- ' || true)"
  echo "eslint-disable directives: $(echo "$all" | grep -c 'eslint-disable' || true)"
  if [[ -n "$unjustified" ]]; then
    echo "Unjustified eslint-disable (add ' -- <reason>' to the directive):"
    echo "$unjustified"
    return 1
  fi
}

# docs/CODE-STANDARDS.md §7: a TODO carries a ticket number; TODO(game)/TODO(init) are the
# template's extension-point markers and are exempt.
audit_todo_markers() {
  local untracked
  untracked="$(grep -rn --include='*.ts' -E '\bTODO\b' "${SOURCE_PATHS[@]}" 2>/dev/null \
    | grep -v -E 'TODO\((game|init|#[0-9]+)\)' || true)"
  if [[ -n "$untracked" ]]; then
    echo "TODO without a ticket (use TODO(#N), or TODO(game)/TODO(init) for template seams):"
    echo "$untracked"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Test selection report (#289): vitest (and the Angular builder, which runs vitest) ends each
# package with `Test Files ... (N)` and `Tests ... (M)`; `pnpm -r` prefixes every line with
# `packages/<package> <script>: `, an unprefixed line belongs to the scoped package.
# ---------------------------------------------------------------------------
PNPM_LINE_PREFIX_PATTERN='^packages/([^ ]+) [^ ]+:(.*)$'
TEST_FILES_SUMMARY_PATTERN='^[[:space:]]*Test Files[[:space:]].*\(([0-9]+)\)[[:space:]]*$'
TESTS_SUMMARY_PATTERN='^[[:space:]]*Tests[[:space:]].*\(([0-9]+)\)[[:space:]]*$'
NO_TEST_FILES_MARKERS=('No test files found' 'No tests found matching')
SELECTED_LINE_PATTERN='^selected [^:]+: ([0-9]+) test files'

# One `selected <package>: N test files, M tests` line per package the runner reported on.
summarize_selection() { # <runner output>
  local line package rest marker
  local -A files=() tests=()
  while IFS= read -r line; do
    package="$SCOPE_PACKAGE"
    rest="$line"
    if [[ "$line" =~ $PNPM_LINE_PREFIX_PATTERN ]]; then
      package="${BASH_REMATCH[1]}"
      rest="${BASH_REMATCH[2]}"
    fi
    [[ -n "$package" ]] || continue
    if [[ "$rest" =~ $TEST_FILES_SUMMARY_PATTERN ]]; then
      files[$package]="${BASH_REMATCH[1]}"
    elif [[ "$rest" =~ $TESTS_SUMMARY_PATTERN ]]; then
      tests[$package]="${BASH_REMATCH[1]}"
    fi
    for marker in "${NO_TEST_FILES_MARKERS[@]}"; do
      [[ "$rest" != *"$marker"* ]] || files[$package]=0
    done
  done <<< "$1"
  for package in "${PACKAGES[@]}"; do
    [[ -z "${files[$package]+set}" ]] || echo "selected $package: ${files[$package]} test files, ${tests[$package]:-0} tests"
  done
}

total_selected_files() { # <summary lines>
  local line total=0
  while IFS= read -r line; do
    [[ ! "$line" =~ $SELECTED_LINE_PATTERN ]] || total=$((total + BASH_REMATCH[1]))
  done <<< "$1"
  echo "$total"
}

# test | integration in the scope, then the selection report; a targeted run (a path scope or
# extra args) that selected no test file fails. A tier-wide run over a package with none passes.
run_tests() { # <test | integration> <extra args...>
  local cmd="$1"
  shift
  local output summary rc=0 runner_args=()
  mapfile -t runner_args < <(path_scope_runner_args "$cmd")
  if [[ "$cmd" == test ]]; then
    output="$(pnpm "${PNPM_SELECTION[@]}" test "${runner_args[@]}" "$@" 2>&1)" || rc=$?
  else
    # Each package's test:integration script selects the *.integration.* tier (docs/TESTING.md §2).
    build_shared
    output="$(pnpm "${PNPM_SELECTION[@]}" --if-present test:integration "${runner_args[@]}" "$@" 2>&1)" || rc=$?
  fi
  summary="$(summarize_selection "$output")"
  printf '%s\n' "$output"
  [[ -z "$summary" ]] || printf '%s\n' "$summary"
  if [[ -n "$SCOPE_PATH" || $# -gt 0 ]] && [[ "$(total_selected_files "$summary")" -eq 0 ]]; then
    echo "validate.sh: this targeted $cmd run selected no test files (${SCOPE_PATH:-$*}); a run that tests nothing is not a pass"
    rc=1
  fi
  return $rc
}

# Prints <cmd>'s raw output and returns its exit code.
run_one() {
  local cmd="$1"
  shift
  local output
  local rc=0

  case "$cmd" in
    test|integration)
      run_tests "$cmd" "$@" || rc=$?
      return $rc
      ;;
    typecheck)
      [[ "$SCOPE_PACKAGE" == "$SHARED_PACKAGE" ]] || build_shared
      [[ -z "$SCOPE_PATH" ]] || echo "typecheck covers the whole $SCOPE_PACKAGE package (tsc checks a project, not a path)"
      output="$(pnpm "${PNPM_SELECTION[@]}" typecheck "$@" 2>&1)" || rc=$?
      ;;
    duplication)
      output="$(pnpm jscpd "${SOURCE_PATHS[@]}" "$@" 2>&1)" || rc=$?
      ;;
    lint)
      # Run eslint then prettier check
      local lint_out=""
      local prettier_out=""
      local lint_rc=0
      local prettier_rc=0

      # Each audit is captured on its own: a substitution only reports its last command's status.
      local directive_out=""
      local todo_out=""
      local docs_index_out=""
      local audit_rc=0

      lint_out="$(pnpm eslint "${LINT_PATHS[@]}" "$@" 2>&1)" || lint_rc=$?
      prettier_out="$(pnpm prettier --check "${LINT_PATHS[@]}" "$@" 2>&1)" || prettier_rc=$?
      directive_out="$(audit_disable_directives)" || audit_rc=1
      todo_out="$(audit_todo_markers)" || audit_rc=1
      docs_index_out="$(scripts/docs-index.sh --check 2>&1)" || audit_rc=1

      output="${lint_out}"
      local extra
      for extra in "$prettier_out" "$directive_out" "$todo_out" "$docs_index_out"; do
        if [[ -n "$extra" ]]; then
          output="${output}
${extra}"
        fi
      done

      if [[ $lint_rc -ne 0 || $prettier_rc -ne 0 || $audit_rc -ne 0 ]]; then
        rc=1
      fi
      ;;
  esac

  printf '%s\n' "$output"
  return $rc
}

# ---------------------------------------------------------------------------
# `all`: the phases in ALL_PHASES order, each through the cache with its own exit code and stamp,
# then one line of wall times. They stay sequential: run concurrently on the shared 4-core
# container they measured 290 s against 298 s back to back (#281), every phase slowed by the others.
# ---------------------------------------------------------------------------
run_all() {
  if cache_hit all; then
    print_cache_hit
    echo "ALL PASSED"
    exit 0
  fi
  local cmd started=$SECONDS phase_started failed=() wall_times=() all_log=""
  for cmd in "${ALL_PHASES[@]}"; do
    echo "=== $cmd ==="
    phase_started=$SECONDS
    run_cached "$cmd" "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}" || failed+=("$cmd")
    if [[ $PHASE_WAS_CACHED -eq 1 ]]; then
      wall_times+=("$cmd cached")
    else
      wall_times+=("$cmd $((SECONDS - phase_started)) s")
    fi
    echo ""
    all_log+="=== $cmd ===
$PHASE_OUTPUT

"
  done
  local joined
  printf -v joined '%s, ' "${wall_times[@]}"
  local wall_line="wall times: ${joined%, }; all $((SECONDS - started)) s"
  echo "$wall_line"
  if [[ ${#failed[@]} -gt 0 ]]; then
    echo "FAILED: ${failed[*]}"
    exit 1
  fi
  echo "ALL PASSED"
  cache_store all "$all_log$wall_line
ALL PASSED"
}

resolve_scope
cd "$SCRIPT_DIR" || exit 1
cache_init

if [[ "$COMMAND" == "all" ]]; then
  run_all
else
  run_cached "$COMMAND" "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
fi
