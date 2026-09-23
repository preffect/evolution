#!/usr/bin/env bash
# validate.sh - Unified validation runner for test, typecheck, and lint
# Usage: ./validate.sh <command> [options] [-- extra-args...]
#
# Commands:
#   test         Run unit tests with coverage thresholds (pnpm -r test)
#   integration  Run the *.integration.test.ts / *.integration.spec.ts tier plus the *.gameplay.test.ts scenarios (pnpm -r test:integration)
#   typecheck    Run type checking (pnpm -r typecheck)
#   lint         Run linting (eslint + prettier --check + disable-directive / TODO audit); caches per file (#559)
#   duplication  Run jscpd against .jscpd.json (docs/CODE-STANDARDS.md §3)
#   all          Run lint, duplication, typecheck, test in sequence, stopping at the first failing phase
#                (FAILED: <phase>), then one line of per-phase wall times; `all --affected` adds integration last
#
# Options:
#   -tN        Tail N lines of output (e.g. -t20)
#   -hN        Head N lines of output (e.g. -h50)
#   -G PATTERN Grep output for PATTERN
#   --fresh    Ignore the result cache and the lint caches, and re-run (a green result is still stamped)
#   --scope S  Narrow every phase to a package (shared | server | client) or to a file or directory
#              under packages/<package>/src. A package scope keeps the coverage floors unless extra args filter it; a path scope
#              runs only the tests it selects, without coverage floors, lints and scans that path, and
#              typechecks its package (tsc checks whole projects). An empty scope is refused. A scoped
#              lint also prettier-checks the docs (*.md outside packages/) changed against origin/main.
#   --affected With `all` only, never with --scope: the merge gate. Checks what the branch changed
#              against origin/main (committed, uncommitted, untracked): the changed packages and their
#              dependents (a shared change selects every package); lint alone for docs (*.md, docs/,
#              qa/); the shell suites for scripts/ and root *.sh; the plain `all` for any other root
#              file. After the unit tests it runs the integration tier (integration and gameplay tests)
#              of each selected package that has any (#344). Fetches origin main first (best effort) and
#              refuses a branch behind origin/main: merge it first. Prints each selection and why, and
#              is stamped per affected set.
#   VALIDATE_NO_GATE_LOCK=1   Skip the machine-wide gate slots (sandboxed tests only)
#   VALIDATE_HEAVY_SLOTS=N    Heavy runs (test, integration, typecheck) at once; default from cores and memory
#   VALIDATE_LIGHT_SLOTS=N    Light runs (lint, duplication) at once; default one per 2 cores, capped by memory
#   VALIDATE_GATE_LOCK_DIR=D  Where the slot lock files live (default $HOME/.cache/<slug>-validate)
#   VITEST_MAX_FORKS=N        Test workers per runner; default cores - 2, leaving the runner's own main
#   VITEST_MAX_THREADS=N      process a core (#475). An inherited value wins, for a one-off experiment.
#
# Extra args after -- are passed to the underlying command (and disable the result cache). For test and
# integration they reach one package's runner, so a selection that mixes the client (the Angular builder)
# with vitest packages refuses them: add --scope. For the client, an extra arg that is not an option is a
# file filter as vitest reads one (a substring of the spec's repo- or package-relative path), passed as
# one --include per matching spec of the tier (under a file scope, only the spec that file selects);
# options pass through (#329). A word right after an option written without `=` is that option's value,
# never a filter (--reporter verbose), so give file filters before options. A filtered `test` (a filter, -t,
# --testNamePattern or --filter) is a slice of its package, so like a path scope it has no coverage floor.
#
# Before a real run (never a cache hit) the checkout is made runnable (scripts/lib/workspace-ready.sh,
# #329): pnpm install --frozen-lockfile when node_modules does not match pnpm-lock.yaml, and the
# @evolution/shared build when its dist is missing or older than its sources, one line each.
# test and integration print a `selected <package>: N test files, M tests run[, K skipped]` line per
# package; a targeted run (a path scope, or extra args) that runs no test fails (#289).
#
# Result cache (docs/engineering/validation-gate.md §1): a green run is stamped under
# $HOME/.cache/<slug>-validate/<tree>.<command>[.scope-<scope>] (override the directory with
# VALIDATE_CACHE_DIR), keyed by `git write-tree` of the whole working tree, tracked and untracked,
# plus the Node major version and the scope. A repeat call on the same tree and scope prints
# `cached green from <time> at tree <hash>` and the stored log path, applies -t/-h/-G to the stored
# log, and exits 0. Red is never cached; a scoped stamp never answers an unscoped call, nor the
# reverse. `all` stamps each phase and itself. Shared across worktrees at the same content. A real
# phase holds one machine-wide slot of its class (scripts/lib/gate-lock.sh, #380): heavy for test,
# integration and typecheck, light for lint and duplication, none for a lint without eslint; a wait
# names the holders (pid, worktree, command). Hits never wait.
#
# Examples:
#   ./validate.sh test                                        # run all tests
#   ./validate.sh test --scope server                         # the server package, with its coverage floor
#   ./validate.sh test --scope packages/server/src/game/world # only the tests under that directory
#   ./validate.sh typecheck -t20                              # typecheck, show last 20 lines
#   ./validate.sh lint -G 'error'                             # lint, grep for pattern
#   ./validate.sh all -t30                                    # run all, tail 30 lines each
#   ./validate.sh all --affected                              # the merge gate: only what the branch changed

TAIL_N=""
HEAD_N=""
GREP_PAT=""
COMMAND=""
EXTRA_ARGS=()
FRESH=0
SCOPE_ARG=""
SCOPE_GIVEN=0
AFFECTED=0
USAGE="Usage: ./validate.sh <test|integration|typecheck|lint|duplication|all> [-tN] [-hN] [-G pattern] [--fresh] [--scope <shared|server|client|path> | --affected] [-- extra-args...]"
INVOCATION="./validate.sh $*" # what a gate slot's holder file names

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
      SCOPE_GIVEN=1
      shift 2
      ;;
    --scope=*)
      SCOPE_ARG="${1#--scope=}"
      SCOPE_GIVEN=1
      shift
      ;;
    --affected)
      AFFECTED=1
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

if [[ $AFFECTED -eq 1 && ( "$COMMAND" != all || $SCOPE_GIVEN -eq 1 ) ]]; then
  echo "validate.sh: --affected works with \`all\` only, and never with --scope" >&2
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
source "$SCRIPT_DIR/scripts/lib/workspace-ready.sh"
source "$SCRIPT_DIR/scripts/lib/gate-lock.sh"
source "$SCRIPT_DIR/scripts/lib/behind-base.sh"

# ---------------------------------------------------------------------------
# Scope (--scope, see the header): resolved once, before anything runs; every phase reads these.
# ---------------------------------------------------------------------------
PACKAGES=(shared server client)
PACKAGE_NAME_PREFIX="@evolution/"
CLIENT_PACKAGE="client"
# Source files the standards apply to (docs/CODE-STANDARDS.md); tests included.
PACKAGE_SOURCES=()
for package in "${PACKAGES[@]}"; do PACKAGE_SOURCES+=("packages/$package/src"); done
TEST_FILE_PATTERN='\.(test|spec)\.ts$'
CLIENT_SPEC_SUFFIX=".spec.ts"
CLIENT_INTEGRATION_SPEC_SUFFIX=".integration.spec.ts"
CLIENT_NO_COVERAGE_ARGUMENT="--no-coverage"
VITEST_NO_COVERAGE_ARGUMENT="--coverage.enabled=false"
# Lint result caches (#559), per worktree under node_modules/.cache, keyed by file content. prettier's
# is exact (a file's result depends on the file and the config alone), so every run but --fresh uses it.
# eslint's is not: its type-aware rules (no-floating-promises) read other files, which its cache does not
# key on, so only a plain `lint` uses it and `all` (the merge gate, the timed main gate) never does.
ESLINT_CACHE_ARGUMENTS=(--cache --cache-strategy content --cache-location node_modules/.cache/eslint/)
PRETTIER_CACHE_ARGUMENTS=(--cache --cache-strategy content --cache-location node_modules/.cache/prettier/.prettier-cache)
ESLINT_CACHED_LINT_KEY=lint-eslint-cached # the stamp name of a lint that used eslint's cache
# The options that narrow a test run to some tests (vitest's test-name filter, the Angular builder's).
NARROWING_OPTION_PATTERN='^(-t|--testNamePattern|--filter)(=.*)?$'

SCOPE_NAME=""                          # what a stamp records: the package or the path; empty unscoped
SCOPE_PACKAGE=""                       # the package a scoped run is narrowed to
SCOPE_PATH=""                          # the repo-relative file or directory of a path scope
PNPM_SELECTION=(-r)                    # every package, or --filter <each selected package>; empty: none
ESLINT_PATHS=(.)                       # what eslint reads; empty: eslint does not run
LINT_PATHS=(.)                         # what prettier reads; empty: prettier does not run
SOURCE_PATHS=("${PACKAGE_SOURCES[@]}") # what jscpd and the audits read; empty: the audits do not run
SHELL_SUITES_SELECTED=1                # whether `test` runs the tooling's shell suites (scripts/*.test.sh)

is_package() {
  local name
  for name in "${PACKAGES[@]}"; do [[ "$1" == "$name" ]] && return 0; done
  return 1
}

narrow_to_package() {
  SCOPE_NAME="$1"
  SCOPE_PACKAGE="$1"
  PNPM_SELECTION=(--filter "$PACKAGE_NAME_PREFIX$1")
  ESLINT_PATHS=("packages/$1")
  LINT_PATHS=("packages/$1")
  SOURCE_PATHS=("packages/$1/src")
  SHELL_SUITES_SELECTED=0
}

# A package name, `packages/<package>[/src]` (the same as the name), or a path below that src.
resolve_scope() {
  [[ $SCOPE_GIVEN -eq 1 ]] || return 0
  if [[ -z "$SCOPE_ARG" ]]; then
    # An unset variable (`--scope "$TOUCHED"`) must not silently become a repo-wide run.
    echo "validate.sh: --scope needs a package or a path, not an empty value" >&2
    echo "$USAGE" >&2
    exit 1
  fi
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
    ESLINT_PATHS=("$relative")
    LINT_PATHS=("$relative")
    SOURCE_PATHS=("$relative")
  else
    echo "validate.sh: --scope $SCOPE_ARG: expected ${PACKAGES[*]} or a path under packages/<package>/src" >&2
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Affected (--affected, #304): what the branch changed against origin/main decides what `all` checks.
# Resolved once, after the scope; it narrows the same globals a scope does and names the stamp.
# ---------------------------------------------------------------------------
AFFECTED_REMOTE="origin"
AFFECTED_BASE_BRANCH="main"
AFFECTED_BASE_REF="$AFFECTED_REMOTE/$AFFECTED_BASE_BRANCH"
AFFECTED_FETCH_TIMEOUT_SECONDS=60
AFFECTED_SCOPE_PREFIX="affected-"
AFFECTED_EVERYTHING_TOKEN="everything"
# The opt-in tier's file names: vitest.tiers.ts OPT_IN_TEST_GLOBS and the client's test-integration target.
OPT_IN_TEST_SUFFIXES=(.integration.test.ts .integration.spec.ts .gameplay.test.ts)
declare -A PACKAGE_DEPENDENTS=([shared]="server client") # the workspace dependencies in package.json
PACKAGE_PATH_PATTERN='^packages/([^/]+)/'
DOCS_PATH_PATTERN='(\.md$|^docs/|^qa/)'
SHELL_PATH_PATTERN='(^scripts/|^[^/]+\.sh$)'
PRETTIER_DOC_PATTERN='\.md$'
AFFECTED_PACKAGES=()      # the selected packages, in PACKAGES order
INTEGRATION_PACKAGES=()   # the selected packages that have integration or gameplay tests
AFFECTED_DOC_FILES=()     # changed docs that still exist, for prettier
AFFECTED_EVERYTHING_BY="" # the first changed path outside packages, docs and scripts
IS_DOCS_AFFECTED=0
IS_SCRIPTS_AFFECTED=0
AFFECTED_REPORT="" # the `affected ...` lines, printed before the phases and kept in the `all` log
declare -A CHANGED_PACKAGE_COUNT=() CHANGED_PACKAGE_EXAMPLE=()

# Every path the branch changed against its merge base with origin/main — committed, uncommitted
# and untracked, the same tree the stamp hashes. Fails when the merge base cannot be found.
affected_changed_paths() {
  local base
  base="$(git -C "$SCRIPT_DIR" merge-base HEAD "$AFFECTED_BASE_REF" 2>/dev/null)" || return 1
  { git -C "$SCRIPT_DIR" diff --name-only "$base" && git -C "$SCRIPT_DIR" ls-files --others --exclude-standard; } \
    | sort -u
}

# A changed doc outside the packages that prettier formats and that still exists.
is_prettier_doc() { # <repo-relative path>
  [[ ! "$1" =~ $PACKAGE_PATH_PATTERN && "$1" =~ $DOCS_PATH_PATTERN && "$1" =~ $PRETTIER_DOC_PATTERN && -e "$SCRIPT_DIR/$1" ]]
}

# A scoped lint also prettier-checks the docs the branch changed (#329): a package or path scope reads
# no docs/, so an author's scoped lint was green over unformatted docs that only the merge gate caught.
# Without a merge base with origin/main there is nothing to compare, and the scope stays as it is.
add_changed_docs_to_scoped_lint() {
  [[ $SCOPE_GIVEN -eq 1 ]] || return 0
  local paths path docs=()
  paths="$(affected_changed_paths)" || return 0
  while IFS= read -r path; do
    [[ -z "$path" ]] || ! is_prettier_doc "$path" || docs+=("$path")
  done <<< "$paths"
  [[ ${#docs[@]} -gt 0 ]] || return 0
  LINT_PATHS+=("${docs[@]}")
  [[ ! "$COMMAND" =~ ^(lint|all)$ ]] || echo "lint also prettier-checks the ${#docs[@]} docs changed on the branch: ${docs[*]}"
}

# Sorts each changed path into a package, the docs, the scripts, or "everything" (a root file).
classify_affected_path() { # <repo-relative path>
  local path="$1" package
  if [[ "$path" =~ $PACKAGE_PATH_PATTERN ]] && is_package "${BASH_REMATCH[1]}"; then
    package="${BASH_REMATCH[1]}"
    CHANGED_PACKAGE_COUNT[$package]=$((${CHANGED_PACKAGE_COUNT[$package]:-0} + 1))
    CHANGED_PACKAGE_EXAMPLE[$package]="${CHANGED_PACKAGE_EXAMPLE[$package]:-$path}"
  elif [[ "$path" =~ $DOCS_PATH_PATTERN ]]; then
    IS_DOCS_AFFECTED=1
    ! is_prettier_doc "$path" || AFFECTED_DOC_FILES+=("$path")
  elif [[ "$path" =~ $SHELL_PATH_PATTERN ]]; then
    IS_SCRIPTS_AFFECTED=1
  else
    AFFECTED_EVERYTHING_BY="${AFFECTED_EVERYTHING_BY:-$path}"
  fi
}

report_affected() { AFFECTED_REPORT+="affected $1"$'\n'; }

# The changed packages and their dependents, in PACKAGES order, each reported with its reason.
select_affected_packages() {
  local package dependent
  local -A reason=()
  for package in "${!CHANGED_PACKAGE_COUNT[@]}"; do
    reason[$package]="changed (${CHANGED_PACKAGE_COUNT[$package]} files, e.g. ${CHANGED_PACKAGE_EXAMPLE[$package]})"
  done
  for package in "${!CHANGED_PACKAGE_COUNT[@]}"; do
    for dependent in ${PACKAGE_DEPENDENTS[$package]:-}; do
      reason[$dependent]="${reason[$dependent]:-depends on $package}"
    done
  done
  for package in "${PACKAGES[@]}"; do
    [[ -n "${reason[$package]:-}" ]] || continue
    AFFECTED_PACKAGES+=("$package")
    report_affected "$package: ${reason[$package]}"
  done
}

# Narrows the phase globals to the affected set and names its stamp scope.
apply_affected_selection() {
  local package tokens=() joined
  PNPM_SELECTION=()
  ESLINT_PATHS=()
  LINT_PATHS=()
  SOURCE_PATHS=()
  for package in "${AFFECTED_PACKAGES[@]}"; do
    tokens+=("$package")
    PNPM_SELECTION+=(--filter "$PACKAGE_NAME_PREFIX$package")
    ESLINT_PATHS+=("packages/$package")
    LINT_PATHS+=("packages/$package")
    SOURCE_PATHS+=("packages/$package/src")
  done
  [[ ${#AFFECTED_PACKAGES[@]} -ne 1 ]] || SCOPE_PACKAGE="${AFFECTED_PACKAGES[0]}"
  LINT_PATHS+=("${AFFECTED_DOC_FILES[@]}")
  [[ $IS_DOCS_AFFECTED -eq 0 ]] || { tokens+=(docs); report_affected "docs: lint only (prettier on ${#AFFECTED_DOC_FILES[@]} changed docs)"; }
  SHELL_SUITES_SELECTED=$IS_SCRIPTS_AFFECTED
  [[ $IS_SCRIPTS_AFFECTED -eq 0 ]] || { tokens+=(scripts); report_affected "scripts: the shell suites (scripts/*.test.sh)"; }
  [[ ${#tokens[@]} -gt 0 ]] || { tokens+=(nothing); report_affected "nothing: no change against $AFFECTED_BASE_REF; lint only"; }
  printf -v joined '%s+' "${tokens[@]}"
  SCOPE_NAME="$AFFECTED_SCOPE_PREFIX${joined%+}"
}

opt_in_test_count() { # <package>: its integration and gameplay test files
  local names=() suffix
  for suffix in "${OPT_IN_TEST_SUFFIXES[@]}"; do names+=(-o -name "*$suffix"); done
  find "$SCRIPT_DIR/packages/$1/src" -type f \( "${names[@]:1}" \) 2>/dev/null | wc -l
}

# The integration phase runs only where there is something to run: a docs or scripts branch, or a
# package without the tier, skips it.
select_integration_packages() {
  local package count found=() joined
  for package in "${AFFECTED_PACKAGES[@]}"; do
    count="$(opt_in_test_count "$package")"
    [[ "$count" -gt 0 ]] || continue
    INTEGRATION_PACKAGES+=("$package")
    found+=("$package ($count files)")
  done
  [[ ${#found[@]} -gt 0 ]] || return 0
  printf -v joined '%s, ' "${found[@]}"
  report_affected "integration: ${joined%, } with integration or gameplay tests"
}

# The integration phase's selection: the integration packages alone, not every affected one.
narrow_to_integration_packages() {
  local package
  PNPM_SELECTION=()
  for package in "${INTEGRATION_PACKAGES[@]}"; do PNPM_SELECTION+=(--filter "$PACKAGE_NAME_PREFIX$package"); done
  SCOPE_PACKAGE=""
  [[ ${#INTEGRATION_PACKAGES[@]} -ne 1 ]] || SCOPE_PACKAGE="${INTEGRATION_PACKAGES[0]}"
}

# Best effort: the merge gate compares against origin/main as it is now, not as of the last fetch. A
# checkout without the remote, or a fetch that fails, compares against the local copy.
refresh_affected_base() {
  git -C "$SCRIPT_DIR" remote get-url "$AFFECTED_REMOTE" >/dev/null 2>&1 || return 0
  GIT_TERMINAL_PROMPT=0 timeout "$AFFECTED_FETCH_TIMEOUT_SECONDS" \
    git -C "$SCRIPT_DIR" fetch --quiet "$AFFECTED_REMOTE" "$AFFECTED_BASE_BRANCH" 2>/dev/null \
    || echo "validate.sh: could not fetch $AFFECTED_BASE_REF; comparing against the local copy" >&2
}

# A branch behind origin/main was green on an old base, and main may have broken it since (#344: #343's
# scenarios failed only once main was merged in). The gate refuses it before any stamp is read, so an old
# green stamp on the same tree cannot pass it either. It changes nothing: merging is the author's step.
refuse_branch_behind_base() {
  local behind
  behind="$(commits_behind "$SCRIPT_DIR" "$AFFECTED_BASE_REF")"
  [[ "$behind" -gt 0 ]] || return 0
  echo "validate.sh: --affected: $(behind_base_message "$behind" "$AFFECTED_BASE_REF")" >&2
  exit 1
}

resolve_affected() {
  [[ $AFFECTED -eq 1 ]] || return 0
  local paths path
  refresh_affected_base
  if ! paths="$(affected_changed_paths)"; then
    echo "validate.sh: --affected cannot find the merge base with $AFFECTED_BASE_REF (git fetch origin first)" >&2
    exit 1
  fi
  refuse_branch_behind_base
  while IFS= read -r path; do
    [[ -z "$path" ]] || classify_affected_path "$path"
  done <<< "$paths"
  if [[ -n "$AFFECTED_EVERYTHING_BY" ]]; then
    # A root file (config, lockfile, validate.sh's neighbours) can change any phase: the plain `all`,
    # stamped apart from it, since the affected gate adds the integration phase.
    AFFECTED_PACKAGES=("${PACKAGES[@]}")
    SCOPE_NAME="$AFFECTED_SCOPE_PREFIX$AFFECTED_EVERYTHING_TOKEN"
    report_affected "everything: $AFFECTED_EVERYTHING_BY is outside packages/, the docs and scripts/"
  else
    select_affected_packages
    apply_affected_selection
  fi
  select_integration_packages
  printf '%s' "$AFFECTED_REPORT"
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
  else
    vitest_path_filter "$package_relative"
  fi
  [[ "$1" != test ]] || coverage_off_argument
}

coverage_off_argument() { # the scoped package's runner switch that drops the coverage floor
  if [[ "$SCOPE_PACKAGE" == "$CLIENT_PACKAGE" ]]; then echo "$CLIENT_NO_COVERAGE_ARGUMENT"; else echo "$VITEST_NO_COVERAGE_ARGUMENT"; fi
}

# Splits extra args into EXTRA_FILTERS and EXTRA_OPTIONS. A word right after an option written without
# `=` is that option's value (--reporter verbose, -t name) and stays with it, never a filter.
EXTRA_FILTERS=()
EXTRA_OPTIONS=()
split_extra_args() { # <extra args...>
  local argument follows_option=0
  EXTRA_FILTERS=()
  EXTRA_OPTIONS=()
  for argument in "$@"; do
    if [[ "$argument" == -* ]]; then
      EXTRA_OPTIONS+=("$argument")
      follows_option=1
      [[ "$argument" != *=* ]] || follows_option=0
    elif [[ $follows_option -eq 1 ]]; then
      EXTRA_OPTIONS+=("$argument")
      follows_option=0
    else
      EXTRA_FILTERS+=("$argument")
    fi
  done
}

# Whether the split extra args narrow the run: a file filter or a test-name filter. An option such as
# --reporter verbose narrows nothing.
extra_args_narrow() {
  local option
  [[ ${#EXTRA_FILTERS[@]} -eq 0 ]] || return 0
  for option in "${EXTRA_OPTIONS[@]}"; do
    [[ ! "$option" =~ $NARROWING_OPTION_PATTERN ]] || return 0
  done
  return 1
}

# `-- extra args` reach one runner, and vitest (shared, server) and the Angular builder (client) read
# different arguments: test and integration refuse them on a selection holding the client and more.
refuse_mixed_runner_args() {
  [[ ${#EXTRA_ARGS[@]} -gt 0 && "$COMMAND" =~ ^(test|integration|all)$ ]] || return 0
  [[ "$SCOPE_PACKAGE" != "$CLIENT_PACKAGE" ]] || return 0
  local selection=" ${PNPM_SELECTION[*]} " package_choices
  [[ "$selection" == *" -r "* || "$selection" == *" $PACKAGE_NAME_PREFIX$CLIENT_PACKAGE "* ]] || return 0
  printf -v package_choices '%s|' "${PACKAGES[@]}"
  echo "validate.sh: -- ${EXTRA_ARGS[*]}: extra args for test and integration reach one package's runner; add --scope ${package_choices%|} (the client runs the Angular builder, the others vitest)" >&2
  exit 1
}

# RUNNER_ARGS: what the <test | integration> runner gets for the scope and the extra args. The Angular
# builder rejects a positional file filter (#329), so for the client each extra arg that is not an
# option becomes one --include per matching spec (client_filter_includes), replacing the path scope's
# own --include; options pass through. Fails when a filter matches no spec.
RUNNER_ARGS=()
resolve_runner_args() { # <test | integration> <extra args...>
  local cmd="$1" client_filtered=0
  shift
  RUNNER_ARGS=()
  split_extra_args "$@"
  if [[ "$SCOPE_PACKAGE" == "$CLIENT_PACKAGE" && ${#EXTRA_FILTERS[@]} -gt 0 ]]; then
    client_filter_includes "$cmd" "${EXTRA_FILTERS[@]}" || return 1
    RUNNER_ARGS+=("${EXTRA_OPTIONS[@]}")
    client_filtered=1
  else
    mapfile -t RUNNER_ARGS < <(path_scope_runner_args "$cmd")
    RUNNER_ARGS+=("$@")
  fi
  # A filtered run is a slice of its package and cannot meet the package's floor; a path scope's own
  # arguments already drop it, unless client filters replaced them.
  if [[ "$cmd" == test ]] && extra_args_narrow && [[ -z "$SCOPE_PATH" || $client_filtered -eq 1 ]]; then
    RUNNER_ARGS+=("$(coverage_off_argument)")
  fi
}

# Appends `--include <spec>` to RUNNER_ARGS for each candidate spec of the tier (integration:
# *.integration.spec.ts, test: the other *.spec.ts) whose repo- or package-relative path contains one
# of the filters.
client_filter_includes() { # <test | integration> <filter...>
  local cmd="$1" spec package_relative filter wants_integration=0 is_integration matched=0
  shift
  [[ "$cmd" != integration ]] || wants_integration=1
  while IFS= read -r spec; do
    is_integration=0
    [[ "$spec" != *"$CLIENT_INTEGRATION_SPEC_SUFFIX" ]] || is_integration=1
    [[ $is_integration -eq $wants_integration ]] || continue
    package_relative="${spec#packages/"$CLIENT_PACKAGE"/}"
    for filter in "$@"; do
      if [[ "$package_relative" == *"$filter"* || "$spec" == *"$filter"* ]]; then
        RUNNER_ARGS+=(--include "$package_relative")
        matched=1
        break
      fi
    done
  done < <(client_candidate_specs "$cmd")
  [[ $matched -eq 0 ]] || return 0
  echo "validate.sh: no client $cmd spec under ${SCOPE_PATH:-packages/$CLIENT_PACKAGE/src} has a path containing: $*"
  return 1
}

# Repo-relative spec paths, one per line: the one spec a file path scope selects (when it exists),
# else every spec under the directory path scope or the client's src.
client_candidate_specs() { # <test | integration>
  local package_dir="packages/$CLIENT_PACKAGE" spec
  if [[ -n "$SCOPE_PATH" && ! -d "$SCRIPT_DIR/$SCOPE_PATH" ]]; then
    spec="$package_dir/$(client_file_scope_spec "$1" "${SCOPE_PATH#"$package_dir"/}")"
    [[ ! -f "$SCRIPT_DIR/$spec" ]] || echo "$spec"
    return 0
  fi
  (cd "$SCRIPT_DIR" && find "${SCOPE_PATH:-$package_dir/src}" -name "*$CLIENT_SPEC_SUFFIX" | sort)
}

# The spec a file scope selects: its integration spec for the integration tier; for test, the file
# itself when it is a spec, else the spec named after it.
client_file_scope_spec() { # <test | integration> <package-relative file>
  if [[ "$1" == integration ]]; then
    client_include "$1" "$2"
  elif [[ "$2" == *"$CLIENT_SPEC_SUFFIX" ]]; then
    echo "$2"
  else
    echo "${2%.ts}$CLIENT_SPEC_SUFFIX"
  fi
}

# ---------------------------------------------------------------------------
# Result cache (see the header). Only green runs are stamped; a stamp is
# key=value lines: exit, time, log, node, command, scope, tree.
# ---------------------------------------------------------------------------
ALL_PHASES=(lint duplication typecheck test)
AFFECTED_PHASES=("${ALL_PHASES[@]}" integration) # the merge gate adds the integration tier (#344)
CACHE_DIR=""
TREE_HASH=""
NODE_MAJOR=""
TEMP_INDEX=""   # the temporary index while cache_tree_hash runs
PHASE_OUTPUT="" # set by run_cached: the phase's raw output, or its stored log on a hit
PHASE_WAS_CACHED=0
CACHE_HIT_TIME=""
CACHE_HIT_LOG=""

cleanup_temp_files() { rm -f "${TEMP_INDEX:+$TEMP_INDEX}" "${TEMP_INDEX:+$TEMP_INDEX.lock}"; }
# A killed run releases its gate slot too, so its holder file never reads as stale beside the next holder.
trap 'cleanup_temp_files; gate_lock_release' EXIT
trap 'cleanup_temp_files; gate_lock_release; exit 130' INT TERM

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
  CACHE_DIR="${VALIDATE_CACHE_DIR:-$HOME/.cache/$(repo_slug "$SCRIPT_DIR")-validate}"
  if ! mkdir -p "$CACHE_DIR/logs" 2>/dev/null || [[ ! -w "$CACHE_DIR/logs" ]]; then
    echo "validate.sh: result cache disabled: cannot write $CACHE_DIR" >&2
    CACHE_DIR=""
  fi
}

# <cmd> unscoped; <cmd>.scope-<package or path, slashes as underscores> scoped.
# A plain lint runs eslint with its cache (#559), which can miss what the type-aware rules would find in an
# unchanged file; its stamp is keyed apart (lint-eslint-cached), so `all` never reads it as a lint stamp.
uses_eslint_cache() { [[ $FRESH -eq 0 && "$COMMAND" == lint ]]; }
cache_command_key() { # <cmd>
  if [[ "$1" == lint ]] && uses_eslint_cache; then echo "$ESLINT_CACHED_LINT_KEY"; else echo "$1"; fi
}
scope_suffix() { echo "${SCOPE_NAME:+.scope-${SCOPE_NAME//\//_}}"; }
cache_key() { echo "$(cache_command_key "$1")$(scope_suffix)"; }
cache_stamp_path() { echo "$CACHE_DIR/$TREE_HASH.$(cache_key "$1")"; }
cache_log_path() { echo "$CACHE_DIR/logs/$TREE_HASH.$(cache_key "$1").log"; }
stamp_field() { sed -n "s/^$2=//p" "$1" | head -n 1; }
have_filters() { [[ -n "$GREP_PAT" || -n "$HEAD_N" || -n "$TAIL_N" ]]; }

# Returns 0, with CACHE_HIT_TIME / CACHE_HIT_LOG set, when a green stamp with its log exists for
# this tree, command, scope and Node major; returns 1 otherwise (a stamp whose log is gone is a
# miss). The scope field is compared as well as the name, so no two scopes can share a stamp.
cache_hit() {
  local cmd="$1" key
  [[ -n "$CACHE_DIR" && $FRESH -eq 0 ]] || return 1
  for key in $(cache_lookup_keys "$cmd"); do
    cache_hit_stamp "$CACHE_DIR/$TREE_HASH.$key" && return 0
  done
  return 1
}

# A plain lint also takes a stamp of a lint that ran eslint without its cache (`all`, `lint --fresh`):
# that check was the stricter one. Never the reverse.
cache_lookup_keys() { # <cmd>
  cache_key "$1"
  [[ "$1" != lint ]] || ! uses_eslint_cache || echo "lint$(scope_suffix)"
}

cache_hit_stamp() { # <stamp path>
  local stamp="$1"
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

# Machine-wide gate slots (scripts/lib/gate-lock.sh, #380): every non-cached phase holds one slot of its
# class under $HOME/.cache/<slug>-validate, independent of VALIDATE_CACHE_DIR so a scratch cache still
# queues behind the machine's gates; the fd is closed for the child (9>&-) so no orphaned worker can
# keep the slot; a cache hit never takes one. The workspace setup runs before it, under a per-checkout lock.
# The multi-core runners are heavy; eslint, prettier and jscpd use one core each, so a docs lint never
# queues behind a test run; prettier and the audits alone take no slot.
gate_class() { # <cmd>
  case "$1" in
    lint) if [[ ${#ESLINT_PATHS[@]} -gt 0 ]]; then echo "$GATE_CLASS_LIGHT"; else echo "$GATE_CLASS_NONE"; fi ;;
    duplication) echo "$GATE_CLASS_LIGHT" ;;
    *) echo "$GATE_CLASS_HEAVY" ;;
  esac
}

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
  # The setup takes this checkout's own lock, not the machine's gate: another worktree's gate never waits it.
  workspace_ensure_ready "$SCRIPT_DIR" "validate.sh:" continue || return 1
  gate_lock_acquire "$SCRIPT_DIR" "$(gate_class "$cmd")" "$cmd" "$INVOCATION"
  PHASE_OUTPUT="$(run_one "$cmd" "$@" 9>&-)" || rc=$?
  gate_lock_release
  printf '%s\n' "$PHASE_OUTPUT" | apply_filters
  if [[ $rc -eq 0 ]]; then
    cache_store "$cmd" "$PHASE_OUTPUT"
  fi
  return $rc
}

# docs/engineering/testing-and-typescript.md §3.3: an eslint-disable needs a justification on the directive
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
TESTS_SUMMARY_PATTERN='^[[:space:]]*Tests[[:space:]].*\([0-9]+\)[[:space:]]*$'
NO_TEST_FILES_MARKERS=('No test files found' 'No tests found matching')
RUN_OUTCOMES=(passed failed)    # a test that ran
NOT_RUN_OUTCOMES=(skipped todo) # a test that was selected and never ran
SELECTED_LINE_PATTERN='^selected [^:]+: [0-9]+ test files, ([0-9]+) tests run'

# Unhandled runner errors (#475): an error thrown outside any test is counted on its own `Errors N`
# line and exits the runner non-zero, while the per-test counts still read `Tests 2449 passed (2449)`.
# Left to those counts the output of such a run is indistinguishable from a green one, so it is named.
UNHANDLED_ERRORS_SUMMARY_PATTERN='^[[:space:]]*Errors[[:space:]]+([0-9]+)[[:space:]]+errors?[[:space:]]*$'
# The commonest one by far, and the only one no diff can fix: vitest's worker RPC watchdog
# (`[vitest-worker]: Timeout calling "onTaskUpdate"`). It is birpc's DEFAULT_TIMEOUT, hard-coded in
# vitest 3.2.7 with no option or environment variable behind it, and it fires when neither side of the
# worker channel makes progress for that long — starvation, not a slow test, which `testTimeout` fails first.
RUNNER_RPC_TIMEOUT_MARKER='Timeout calling'
RUNNER_RPC_TIMEOUT_SECONDS=60

# Worker cap (#475). Vitest's forks pool defaults to `availableParallelism() - 1` workers, and forgets
# its own main process, which alone serves the vite transforms, the coverage collection and the
# reporters for every one of them: on the 4-core box that is four CPU-hungry processes for four cores
# before any other agent's load, and `pnpm -r test` runs each selected package's runner at the same
# time, multiplying it. Two cores are reserved — one for the runner's main process, which is the part
# that has to answer a worker within RUNNER_RPC_TIMEOUT_SECONDS, and one for everything else on the
# box. No package sets `pool`, so they all use forks; the threads variable is set alongside it so a
# package that switches pool later does not silently lose the cap. An inherited value wins, for a
# one-off experiment.
RUNNER_WORKER_CORES_RESERVED=2
RUNNER_WORKER_MINIMUM=1
runner_worker_limit() {
  local cores
  cores="$(nproc 2>/dev/null || echo "$((RUNNER_WORKER_CORES_RESERVED + RUNNER_WORKER_MINIMUM))")"
  local limit=$((cores - RUNNER_WORKER_CORES_RESERVED))
  [[ $limit -ge $RUNNER_WORKER_MINIMUM ]] || limit=$RUNNER_WORKER_MINIMUM
  echo "$limit"
}

# The sum of the `N <outcome>` counts on a vitest summary line, for the outcomes named.
outcome_count() { # <summary line> <outcome...>
  local line="$1" outcome total=0
  shift
  for outcome in "$@"; do
    [[ ! "$line" =~ ([0-9]+)\ $outcome ]] || total=$((total + BASH_REMATCH[1]))
  done
  echo "$total"
}

# One `selected <package>: N test files, M tests run[, K skipped]` line per package the runner
# reported on. A skipped or todo test was selected but never ran, so it never counts as run.
summarize_selection() { # <runner output>
  local line package rest marker skipped_note
  local -A files=() tests_run=() tests_not_run=()
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
      tests_run[$package]="$(outcome_count "$rest" "${RUN_OUTCOMES[@]}")"
      tests_not_run[$package]="$(outcome_count "$rest" "${NOT_RUN_OUTCOMES[@]}")"
    fi
    for marker in "${NO_TEST_FILES_MARKERS[@]}"; do
      [[ "$rest" != *"$marker"* ]] || files[$package]=0
    done
  done <<< "$1"
  for package in "${PACKAGES[@]}"; do
    [[ -n "${files[$package]+set}" ]] || continue
    skipped_note=""
    [[ "${tests_not_run[$package]:-0}" -eq 0 ]] || skipped_note=", ${tests_not_run[$package]} skipped"
    echo "selected $package: ${files[$package]} test files, ${tests_run[$package]:-0} tests run$skipped_note"
  done
}

total_tests_run() { # <summary lines>
  local line total=0
  while IFS= read -r line; do
    [[ ! "$line" =~ $SELECTED_LINE_PATTERN ]] || total=$((total + BASH_REMATCH[1]))
  done <<< "$1"
  echo "$total"
}

# What the runner reported outside its tests (#475), as the lines to print; empty when it reported
# none. Every package's `Errors N` line counts, and an RPC timeout among them is named as the
# infrastructure failure it is, so nobody reads the passed counts above it as a green run.
unhandled_error_report() { # <runner output>
  local line rest errors=0 timeouts=0 noun=errors
  while IFS= read -r line; do
    rest="$line"
    [[ ! "$line" =~ $PNPM_LINE_PREFIX_PATTERN ]] || rest="${BASH_REMATCH[2]}"
    if [[ "$rest" =~ $UNHANDLED_ERRORS_SUMMARY_PATTERN ]]; then
      errors=$((errors + BASH_REMATCH[1]))
    elif [[ "$rest" == *"$RUNNER_RPC_TIMEOUT_MARKER"* ]]; then
      timeouts=$((timeouts + 1))
    fi
  done <<< "$1"
  [[ $errors -gt 0 ]] || return 0
  [[ $errors -ne 1 ]] || noun=error
  echo "validate.sh: the runner reported $errors unhandled $noun outside its tests, and exited non-zero:"
  echo "validate.sh: this run is RED, whatever the passed counts above it say. An unhandled error fails the run."
  [[ $timeouts -gt 0 ]] || return 0
  echo "validate.sh: $timeouts of them is a \"$RUNNER_RPC_TIMEOUT_MARKER\" error: the runner's ${RUNNER_RPC_TIMEOUT_SECONDS}s worker RPC watchdog."
  echo "validate.sh: that is infrastructure, not this branch — the runner made no progress for ${RUNNER_RPC_TIMEOUT_SECONDS}s, which no diff causes and none fixes."
  echo "validate.sh: re-run it, on a quieter box (docs/engineering/validation-gate.md §1)."
}

# test | integration: the selected packages' runner, then the shell suites when they are selected
# (`test` with no extra args). `all --affected` over scripts alone selects no package.
run_tests() { # <test | integration> <extra args...>
  local cmd="$1"
  shift
  local rc=0
  if [[ ${#PNPM_SELECTION[@]} -gt 0 ]]; then
    run_package_tests "$cmd" "$@" || rc=$?
  fi
  if [[ "$cmd" == test && $SHELL_SUITES_SELECTED -eq 1 && $# -eq 0 ]]; then
    run_script_suites || rc=1
  fi
  return $rc
}

# The package runner in the scope, then the selection report; a targeted run (a path scope or
# extra args) that ran no test fails. A tier-wide run over a package with none passes.
run_package_tests() { # <test | integration> <extra args...>
  local cmd="$1"
  shift
  local output summary unhandled rc=0
  resolve_runner_args "$cmd" "$@" || return 1
  local workers
  workers="$(runner_worker_limit)"
  export VITEST_MAX_FORKS="${VITEST_MAX_FORKS:-$workers}" VITEST_MAX_THREADS="${VITEST_MAX_THREADS:-$workers}"
  if [[ "$cmd" == test ]]; then
    output="$(pnpm "${PNPM_SELECTION[@]}" test "${RUNNER_ARGS[@]}" 2>&1)" || rc=$?
  else
    # Each package's test:integration script selects the *.integration.* tier (docs/testing/tiers-and-builders.md §2).
    output="$(pnpm "${PNPM_SELECTION[@]}" --if-present test:integration "${RUNNER_ARGS[@]}" 2>&1)" || rc=$?
  fi
  summary="$(summarize_selection "$output")"
  printf '%s\n' "$output"
  [[ -z "$summary" ]] || printf '%s\n' "$summary"
  if [[ -n "$SCOPE_PATH" || $# -gt 0 ]] && [[ "$(total_tests_run "$summary")" -eq 0 ]]; then
    # A runner that failed without reporting an empty selection (a crash, an unknown option)
    # keeps its own error as the reason.
    if [[ $rc -eq 0 || "$summary" == *": 0 test files"* ]]; then
      echo "validate.sh: this targeted $cmd run ran no tests (${SCOPE_PATH:-$*}): nothing was selected, or every selected test was skipped; a run that tests nothing is not a pass"
    fi
    rc=1
  fi
  # Last, so it is the final word of the phase and a `-tN` filter still shows it.
  unhandled="$(unhandled_error_report "$output")"
  if [[ -n "$unhandled" ]]; then
    printf '%s\n' "$unhandled"
    rc=1
  fi
  return $rc
}

# The tooling's own shell suites (scripts/*.test.sh: this script's cache, run.sh, the deploy watcher)
# run with an unscoped test phase and with `all --affected` over scripts; they test no package, so a
# scoped or targeted run skips them.
run_script_suites() {
  local suite rc=0
  for suite in "$SCRIPT_DIR"/scripts/*.test.sh; do
    [[ -e "$suite" ]] || continue
    echo "=== ${suite#"$SCRIPT_DIR"/} ==="
    "$suite" 2>&1 || rc=1
  done
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
      local audit_rc=0

      # An empty path list (`all --affected` over docs or scripts alone) skips that tool: eslint with
      # no path lints the whole repo, and grep with no path reads stdin.
      local eslint_cache=() prettier_cache=()
      [[ $FRESH -ne 0 ]] || prettier_cache=("${PRETTIER_CACHE_ARGUMENTS[@]}")
      ! uses_eslint_cache || eslint_cache=("${ESLINT_CACHE_ARGUMENTS[@]}")
      if [[ ${#ESLINT_PATHS[@]} -gt 0 ]]; then
        lint_out="$(pnpm eslint "${eslint_cache[@]}" "${ESLINT_PATHS[@]}" "$@" 2>&1)" || lint_rc=$?
      fi
      if [[ ${#LINT_PATHS[@]} -gt 0 ]]; then
        prettier_out="$(pnpm prettier --check "${prettier_cache[@]}" "${LINT_PATHS[@]}" "$@" 2>&1)" || prettier_rc=$?
      fi
      if [[ ${#SOURCE_PATHS[@]} -gt 0 ]]; then
        directive_out="$(audit_disable_directives)" || audit_rc=1
        todo_out="$(audit_todo_markers)" || audit_rc=1
      fi

      output="${lint_out}"
      local extra
      for extra in "$prettier_out" "$directive_out" "$todo_out"; do
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
# stopping at the first failing phase (#304: a red lint never pays for the test phase), then one
# line of wall times. They stay sequential: run concurrently on the shared 4-core container they
# measured 290 s against 298 s back to back (#281), every phase slowed by the others.
# ---------------------------------------------------------------------------

# Why `all --affected` skips <cmd>, or nothing when the phase runs.
phase_skip_reason() { # <cmd>
  [[ $AFFECTED -eq 1 ]] || return 0
  case "$1" in
    duplication|typecheck)
      [[ ${#AFFECTED_PACKAGES[@]} -gt 0 ]] || echo "no package affected"
      ;;
    test)
      [[ ${#AFFECTED_PACKAGES[@]} -gt 0 || $SHELL_SUITES_SELECTED -eq 1 ]] || echo "no package and no script affected"
      ;;
    integration)
      if [[ ${#AFFECTED_PACKAGES[@]} -eq 0 ]]; then
        echo "no package affected"
      elif [[ ${#INTEGRATION_PACKAGES[@]} -eq 0 ]]; then
        echo "no affected package has integration or gameplay tests"
      fi
      ;;
  esac
}

wall_times_line() { # <started seconds> <phase times...>
  local started="$1" joined
  shift
  printf -v joined '%s, ' "$@"
  echo "wall times: ${joined%, }; all $((SECONDS - started)) s"
}

run_all() {
  if cache_hit all; then
    print_cache_hit
    echo "ALL PASSED"
    exit 0
  fi
  local cmd started=$SECONDS phase_started phase_rc skip_reason wall_times=() all_log="$AFFECTED_REPORT"
  local phases=("${ALL_PHASES[@]}")
  [[ $AFFECTED -eq 0 ]] || phases=("${AFFECTED_PHASES[@]}")
  for cmd in "${phases[@]}"; do
    echo "=== $cmd ==="
    skip_reason="$(phase_skip_reason "$cmd")"
    phase_started=$SECONDS
    phase_rc=0
    # The last phase, so narrowing the selection for it leaves the earlier phases as they were.
    [[ "$cmd" != integration || -n "$skip_reason" ]] || narrow_to_integration_packages
    if [[ -n "$skip_reason" ]]; then
      PHASE_OUTPUT="skipped: $skip_reason"
      echo "$PHASE_OUTPUT"
      wall_times+=("$cmd skipped")
    else
      run_cached "$cmd" "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}" || phase_rc=$?
      if [[ $PHASE_WAS_CACHED -eq 1 ]]; then
        wall_times+=("$cmd cached")
      else
        wall_times+=("$cmd $((SECONDS - phase_started)) s")
      fi
    fi
    echo ""
    if [[ $phase_rc -ne 0 ]]; then
      wall_times_line "$started" "${wall_times[@]}"
      echo "stopped at the first failing phase; the phases after $cmd did not run"
      echo "FAILED: $cmd"
      exit 1
    fi
    all_log+="=== $cmd ===
$PHASE_OUTPUT

"
  done
  local wall_line
  wall_line="$(wall_times_line "$started" "${wall_times[@]}")"
  echo "$wall_line"
  echo "ALL PASSED"
  cache_store all "$all_log$wall_line
ALL PASSED"
}

resolve_scope
resolve_affected
add_changed_docs_to_scoped_lint
refuse_mixed_runner_args
cd "$SCRIPT_DIR" || exit 1
cache_init

if [[ "$COMMAND" == "all" ]]; then
  run_all
else
  run_cached "$COMMAND" "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
fi
