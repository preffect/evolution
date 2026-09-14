#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# workspace-ready.sh — make a checkout runnable before validate.sh, run.sh or a deploy runs anything in it
# (#329). Sourced. A fresh worktree has no node_modules and no packages/shared/dist, and a merge can change
# the lockfile or the shared sources; either way the client's tests fail with TS2307 on @evolution/shared,
# the server cannot start, and the gate cannot find prettier.
#
#   workspace_ensure_ready <root> <log prefix> <continue | fail>
#     installs (pnpm install --frozen-lockfile) when node_modules/.pnpm/lock.yaml, pnpm's copy of the
#     lockfile it installed, is missing or differs from pnpm-lock.yaml; then builds @evolution/shared
#     when its types entry is missing or a source or config file is newer than its tsbuildinfo, which a
#     build stamps with its start time (a source saved during the build is rebuilt next time).
#     One line per step taken, none when the checkout is ready. A failed install fails; a failed build
#     prints its output and fails with `fail` (a deploy) or returns 0 with `continue` (validate.sh and
#     run.sh, whose phases and server report the errors themselves).
#     With work to do it holds this checkout's setup lock (<git dir>/workspace-setup.lock, so two setups
#     never install into one node_modules), waiting at most WORKSPACE_SETUP_LOCK_TIMEOUT_SECONDS (300)
#     and failing loudly after; never the machine-wide gate lock, which another worktree's gate holds.
#   workspace_ready_needed <root>
#     whether workspace_ensure_ready has anything to do
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
WORKSPACE_SETUP_LOCK_NAME=workspace-setup.lock
WORKSPACE_DEFAULT_SETUP_LOCK_TIMEOUT_SECONDS=300
WORKSPACE_BUILD_FAILURE_CONTINUES=continue
WORKSPACE_SETUP_LOCK_HELD=0 # the lock is fd 7 while held

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

# The checkout's own git dir (a worktree has its own), else the root: one lock per node_modules.
workspace_setup_lock_path() { # <root>
  local git_dir
  if git_dir="$(git -C "$1" rev-parse --absolute-git-dir 2>/dev/null)"; then
    echo "$git_dir/$WORKSPACE_SETUP_LOCK_NAME"
  else
    echo "$1/.$WORKSPACE_SETUP_LOCK_NAME"
  fi
}

workspace_setup_lock_acquire() { # <root> <log prefix>
  local path timeout="${WORKSPACE_SETUP_LOCK_TIMEOUT_SECONDS:-$WORKSPACE_DEFAULT_SETUP_LOCK_TIMEOUT_SECONDS}"
  command -v flock >/dev/null 2>&1 || { echo "$2 flock not found; setting up unlocked"; return 0; }
  path="$(workspace_setup_lock_path "$1")"
  exec 7>>"$path" || { echo "$2 setup lock unavailable ($path); setting up unlocked"; return 0; }
  WORKSPACE_SETUP_LOCK_HELD=1
  flock -n 7 && return 0
  echo "$2 waiting for another setup of this checkout (lock $path, at most ${timeout}s)"
  flock -w "$timeout" 7 && return 0
  workspace_setup_lock_release
  echo "$2 timed out after ${timeout}s waiting for another setup of this checkout (lock $path)"
  return 1
}

workspace_setup_lock_release() {
  [[ $WORKSPACE_SETUP_LOCK_HELD -eq 1 ]] || return 0
  flock -u 7 2>/dev/null || true
  exec 7>&-
  WORKSPACE_SETUP_LOCK_HELD=0
}

workspace_ensure_ready() { # <root> <log prefix> <continue | fail>
  workspace_ready_needed "$1" || return 0
  workspace_setup_lock_acquire "$1" "$2" || return 1
  local rc=0
  # fd 7 is closed for the steps, so nothing they leave running can keep the lock.
  workspace_prepare "$@" 7>&- || rc=$?
  workspace_setup_lock_release
  return "$rc"
}

# The install and the build, each re-checked under the lock (another setup may have done them).
workspace_prepare() { # <root> <log prefix> <continue | fail>
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
    # tsc leaves the record untouched when no content changed (a file merely rewritten, a package.json
    # edit), so stamp it, with the start time: a source saved while tsc ran stays newer than the record.
    touch -c -d "@$started" "$shared/$WORKSPACE_SHARED_BUILD_INFO"
    return 0
  fi
  printf '%s\n' "$output"
  if [[ "$3" == "$WORKSPACE_BUILD_FAILURE_CONTINUES" ]]; then
    echo "$prefix the $WORKSPACE_SHARED_PACKAGE build failed; continuing, so what runs next reports its errors"
    return 0
  fi
  echo "$prefix the $WORKSPACE_SHARED_PACKAGE build failed"
  return 1
}
