#!/usr/bin/env bash
# validate.sh - Unified validation runner for test, typecheck, and lint
# Usage: ./validate.sh <command> [options] [-- extra-args...]
#
# Commands:
#   test       Run unit tests (pnpm -r test)
#   integration Run integration tests only (RUN_INTEGRATION=1 pnpm -r test)
#   typecheck  Run type checking (pnpm -r typecheck)
#   lint       Run linting (eslint + prettier --check)
#   all        Run lint, typecheck and test in sequence (integration stays opt-in)
#
# Options:
#   -tN        Tail N lines of output (e.g. -t20)
#   -hN        Head N lines of output (e.g. -h50)
#   -G PATTERN Grep output for PATTERN
#
# Extra args after -- are passed to the underlying command of EVERY package (so a vitest-only
# flag breaks the client's `ng test`; pnpm `--filter` is not accepted there either).
#
# Examples:
#   ./validate.sh test                    # run all tests
#   ./validate.sh typecheck -t20          # typecheck, show last 20 lines
#   ./validate.sh lint -G 'error'         # lint, grep for pattern
#   ./validate.sh all -t30               # run all, tail 30 lines each

TAIL_N=""
HEAD_N=""
GREP_PAT=""
COMMAND=""
EXTRA_ARGS=()

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    test|integration|typecheck|lint|all)
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
  echo "Usage: ./validate.sh <test|integration|typecheck|lint|all> [-tN] [-hN] [-G pattern] [-- extra-args...]" >&2
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

build_shared() {
  # Build shared package so downstream .d.ts references are fresh
  pnpm --filter @evolution/shared build > /dev/null 2>&1 || true
}

run_one() {
  local cmd="$1"
  shift
  local output
  local rc=0

  case "$cmd" in
    test)
      if [[ $# -gt 0 ]]; then
        output="$(pnpm -r test "$@" 2>&1)" || rc=$?
      else
        output="$(pnpm -r test 2>&1)" || rc=$?
      fi
      ;;
    integration)
      # Opt-in cross-subsystem tests (docs/ENGINEERING.md §2.2); each vitest package's config
      # switches to `*.integration.test.ts` on RUN_INTEGRATION=1. The client is skipped: its
      # `ng test` ignores RUN_INTEGRATION and fails when an include glob matches no file, so
      # `*.integration.spec.ts` is wired here by the first client ticket that adds one.
      if [[ $# -gt 0 ]]; then
        output="$(RUN_INTEGRATION=1 pnpm -r --filter '!@evolution/client' test "$@" 2>&1)" || rc=$?
      else
        output="$(RUN_INTEGRATION=1 pnpm -r --filter '!@evolution/client' test 2>&1)" || rc=$?
      fi
      ;;
    typecheck)
      build_shared
      if [[ $# -gt 0 ]]; then
        output="$(pnpm -r typecheck "$@" 2>&1)" || rc=$?
      else
        output="$(pnpm -r typecheck 2>&1)" || rc=$?
      fi
      ;;
    lint)
      # Run eslint then prettier check
      local lint_out=""
      local prettier_out=""
      local lint_rc=0
      local prettier_rc=0

      lint_out="$(pnpm eslint . "$@" 2>&1)" || lint_rc=$?
      prettier_out="$(pnpm prettier --check . "$@" 2>&1)" || prettier_rc=$?

      output="${lint_out}"
      if [[ -n "$prettier_out" ]]; then
        output="${output}
${prettier_out}"
      fi

      if [[ $lint_rc -ne 0 || $prettier_rc -ne 0 ]]; then
        rc=1
      fi
      ;;
  esac

  echo "$output" | apply_filters
  return $rc
}

if [[ "$COMMAND" == "all" ]]; then
  failed=()
  for cmd in lint typecheck test; do
    echo "=== $cmd ==="
    if ! run_one "$cmd" "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"; then
      failed+=("$cmd")
    fi
    echo ""
  done
  if [[ ${#failed[@]} -gt 0 ]]; then
    echo "FAILED: ${failed[*]}"
    exit 1
  else
    echo "ALL PASSED"
  fi
else
  run_one "$COMMAND" "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
fi
