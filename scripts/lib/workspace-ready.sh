#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# workspace-ready.sh — make a checkout runnable before validate.sh or run.sh runs anything in it (#329).
# Sourced. A fresh worktree has no node_modules and no packages/shared/dist, and a merge can change the
# lockfile or the shared sources; either way the client's tests fail with TS2307 on @evolution/shared,
# the server cannot start, and the gate cannot find prettier.
#
#   workspace_ensure_ready <root> <log prefix>
#     installs (pnpm install --frozen-lockfile) when node_modules/.pnpm/lock.yaml, pnpm's copy of the
#     lockfile it installed, is missing or differs from pnpm-lock.yaml; then builds @evolution/shared
#     when its types entry is missing or a source or config file is newer than its tsbuildinfo, which a
#     build stamps with its start time (a source saved during the build is rebuilt next time).
#     One line per step taken, none when the checkout is ready. Fails only when the install fails;
#     a failed build prints its output and returns 0, so the phases report the errors themselves.
#   workspace_ready_needed <root>
#     whether workspace_ensure_ready has anything to do (run.sh takes the gate lock only then)
# ---------------------------------------------------------------------------

WORKSPACE_LOCKFILE=pnpm-lock.yaml
WORKSPACE_INSTALLED_LOCKFILE=node_modules/.pnpm/lock.yaml
WORKSPACE_INSTALL_COMMAND=(pnpm install --frozen-lockfile --prefer-offline)
WORKSPACE_SHARED_DIR=packages/shared
WORKSPACE_SHARED_PACKAGE=@evolution/shared
WORKSPACE_SHARED_TYPES=dist/index.d.ts # package.json "types": what TS2307 cannot find
# The incremental build's record (tsc -p tsconfig.build.json). tsc re-emits nothing while it is
# present, even when dist is gone, so a build without the types entry deletes it first.
WORKSPACE_SHARED_BUILD_INFO=tsconfig.build.tsbuildinfo
WORKSPACE_ROOT_TSCONFIG=tsconfig.base.json

workspace_install_needed() { # <root>
  [[ -f "$1/$WORKSPACE_LOCKFILE" ]] || return 1
  ! cmp -s "$1/$WORKSPACE_LOCKFILE" "$1/$WORKSPACE_INSTALLED_LOCKFILE"
}

# Why the shared package needs a build, or nothing when it is fresh (or the checkout has none).
workspace_shared_stale_reason() { # <root>
  local shared="$1/$WORKSPACE_SHARED_DIR" inputs=() path newer
  [[ -d "$shared/src" ]] || return 0
  if [[ ! -f "$shared/$WORKSPACE_SHARED_TYPES" ]]; then
    echo "no $WORKSPACE_SHARED_DIR/$WORKSPACE_SHARED_TYPES"
    return 0
  fi
  if [[ ! -f "$shared/$WORKSPACE_SHARED_BUILD_INFO" ]]; then
    echo "no $WORKSPACE_SHARED_DIR/$WORKSPACE_SHARED_BUILD_INFO"
    return 0
  fi
  # A directory is newer too when a file in it was added, renamed or deleted.
  for path in "$shared/src" "$shared"/package.json "$shared"/tsconfig*.json "$1/$WORKSPACE_ROOT_TSCONFIG"; do
    [[ ! -e "$path" ]] || inputs+=("$path")
  done
  newer="$(find "${inputs[@]}" -newer "$shared/$WORKSPACE_SHARED_BUILD_INFO" -print -quit)"
  [[ -z "$newer" ]] || echo "${newer#"$1"/} changed since the last build"
}

workspace_ready_needed() { # <root>
  workspace_install_needed "$1" || [[ -n "$(workspace_shared_stale_reason "$1")" ]]
}

workspace_ensure_ready() { # <root> <log prefix>
  local root="$1" prefix="$2" shared="$1/$WORKSPACE_SHARED_DIR" reason output started
  if workspace_install_needed "$root"; then
    echo "$prefix installing dependencies (node_modules does not match $WORKSPACE_LOCKFILE): ${WORKSPACE_INSTALL_COMMAND[*]}"
    if ! output="$(cd "$root" && "${WORKSPACE_INSTALL_COMMAND[@]}" 2>&1)"; then
      printf '%s\n' "$output"
      echo "$prefix the dependency install failed"
      return 1
    fi
  fi
  reason="$(workspace_shared_stale_reason "$root")"
  [[ -n "$reason" ]] || return 0
  echo "$prefix building $WORKSPACE_SHARED_PACKAGE ($reason)"
  [[ -f "$shared/$WORKSPACE_SHARED_TYPES" ]] || rm -f "$shared/$WORKSPACE_SHARED_BUILD_INFO"
  started="$(date +%s.%N)"
  if output="$(cd "$root" && pnpm --filter "$WORKSPACE_SHARED_PACKAGE" build 2>&1)"; then
    # tsc leaves the record untouched when no content changed (a file merely rewritten), so stamp it,
    # with the start time: a source saved while tsc ran stays newer than the record.
    touch -c -d "@$started" "$shared/$WORKSPACE_SHARED_BUILD_INFO"
    return 0
  fi
  printf '%s\n' "$output"
  echo "$prefix the $WORKSPACE_SHARED_PACKAGE build failed; continuing, so what runs next reports its errors"
}
