#!/usr/bin/env bash
# docs-index.sh — generate docs/INDEX.md: every heading of every docs/*.md and docs/*/*.md with its line range and first
# sentence, so a brief can cite "ecology/constants.md §7 (L5–103)" and an agent reads only that range (docs/TEAM.md).
#
#   scripts/docs-index.sh                  # rewrite docs/INDEX.md
#   scripts/docs-index.sh --if-stale       # rewrite it only when --stale-reason names a reason, printing that reason
#   scripts/docs-index.sh --stale-reason   # why the index needs a rewrite: missing, the docs changed, unformatted
#   scripts/docs-index.sh --install-hooks  # the shared post-checkout / post-merge hooks that run --if-stale
#
# The index is git-ignored and never committed (#407): a committed index conflicted on nearly every back-to-back
# merge. It is generated on demand instead: by scripts/lib/workspace-ready.sh (validate.sh, run.sh, the deploy), by
# scripts/worktree.sh add, and by the git hooks, which live in the common git dir so one install covers every
# worktree. --if-stale and --stale-reason do nothing in a checkout whose .gitignore does not ignore the index (an
# older branch that still commits it), and the hooks run nothing in a checkout without this script.
#
# The index stores a fingerprint of the docs it indexes (their names and contents), taken before they are read: it is
# stale when it is missing, when the docs no longer match that fingerprint (a doc edited during a generation included,
# whatever its mtime), or when it was written unformatted and prettier is installed now. Writers hold this checkout's
# lock (<git dir>/docs-index.lock) and re-check under it, and the index is replaced by a rename, so a reader never sees
# a partial file. A section's range runs from its heading to the line before the next heading of the same or a higher
# level. Headings inside fenced code blocks (``` or ~~~, at any indent) are ignored. Output is passed through
# prettier; without node_modules the generator writes it unformatted, marked, and the next --if-stale formats it.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
docs_dir="$repo_root/docs"
index_relative_path=docs/INDEX.md
index_file="$repo_root/$index_relative_path"
SUMMARY_MAX_CHARS=140
INDEX_FILE_MODE=644
TEMP_FILE_PREFIX=.INDEX.md # git-ignored; never a *.md, so never indexed
LOCK_NAME=docs-index.lock
LOCK_TIMEOUT_SECONDS="${DOCS_INDEX_LOCK_TIMEOUT_SECONDS:-120}"
LOCK_FD=8
FINGERPRINT_PREFIX='<!-- docs-index fingerprint: '
FINGERPRINT_SUFFIX=' -->'
NO_DOCS_FINGERPRINT=none
UNFORMATTED_MARKER='<!-- docs-index: unformatted, prettier was not installed -->'
HOOK_MARKER='# docs-index hook (scripts/docs-index.sh --install-hooks)'
HOOK_NAMES=(post-checkout post-merge)
TEMP_FILE="" # removed on exit when a write stops half way
trap 'rm -f "$TEMP_FILE"' EXIT

index_one_document() {
  local path="$1"
  awk -v max="$SUMMARY_MAX_CHARS" '
    function flush(i) {
      if (count == 0) return
      for (i = 1; i <= count; i++) {
        end = NR
        for (j = i + 1; j <= count; j++) if (level[j] <= level[i]) { end = line[j] - 1; break }
        printf "%s- **%s** (L%d–%d)%s\n", indent[i], title[i], line[i], end, (summary[i] == "" ? "" : ": " summary[i])
      }
    }
    /^[[:space:]]*(```|~~~)/ { fenced = !fenced; next }
    fenced { next }
    /^#{1,6} / {
      count++
      match($0, /^#+/)
      level[count] = RLENGTH
      indent[count] = (level[count] <= 2 ? "" : "  ")
      title[count] = link_text(substr($0, RLENGTH + 2))
      line[count] = NR
      summary[count] = ""
      want = count
      buffer = ""
      next
    }
    want && $0 ~ /^[[:space:]]*$/ { if (buffer != "") finish(); else next }
    want && $0 !~ /^[|>]/ && $0 !~ /^<!--/ && $0 !~ /^[[:space:]]*([-*]|[0-9]+\.) / {
      s = $0
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", s)
      buffer = (buffer == "" ? s : buffer " " s)
      if (match(buffer, /[.!?]( |$)/)) finish()
      next
    }
    want && buffer != "" { finish() }
    function finish() {
      s = buffer
      gsub(/\*\*/, "", s)
      s = link_text(s)
      if (match(s, /[.!?]( |$)/)) s = substr(s, 1, RSTART)
      if (length(s) > max) s = substr(s, 1, max - 1) "…"
      summary[want] = s
      want = 0
      buffer = ""
    }
    # The index keeps the text of a link, not its target: the target is relative to the source file, not to INDEX.md.
    function link_text(s, link) {
      while (match(s, /\[[^]]*\]\([^)]*\)/)) {
        link = substr(s, RSTART, RLENGTH)
        s = substr(s, 1, RSTART - 1) substr(link, 2, index(link, "](") - 2) substr(s, RSTART + RLENGTH)
      }
      return s
    }
    END { flush() }
  ' "$path"
}

# The docs the index covers, relative to docs/, in index order: the one list the generator and the fingerprint read.
indexed_docs() {
  local path name
  for path in "$docs_dir"/*.md "$docs_dir"/*/*.md; do
    name="${path#"$docs_dir"/}"
    [[ -f "$path" && "$name" != "INDEX.md" ]] && printf '%s\n' "$name"
  done
  return 0
}

docs_fingerprint() {
  local docs=()
  mapfile -t docs < <(indexed_docs)
  if [[ ${#docs[@]} -eq 0 ]]; then
    echo "$NO_DOCS_FINGERPRINT"
    return 0
  fi
  (cd "$docs_dir" && sha1sum -- "${docs[@]}") | sha1sum | cut -d' ' -f1
}

generate() { # <fingerprint>
  echo "# docs/ index"
  echo
  echo "Generated by \`scripts/docs-index.sh\` — do not edit by hand; git-ignored, regenerated on demand. Cite sections as"
  echo "\`FILE.md §heading (Lstart–end)\` and read only that line range (\`sed -n 'start,endp' docs/FILE.md\`)."
  echo
  echo "$FINGERPRINT_PREFIX$1$FINGERPRINT_SUFFIX"
  echo
  local name
  while IFS= read -r name; do
    echo "## $name ($(wc -l < "$docs_dir/$name") lines)"
    echo
    index_one_document "$docs_dir/$name"
    echo
  done < <(indexed_docs)
}

have_prettier() { (cd "$repo_root" && command -v pnpm >/dev/null && [[ -d node_modules ]]); }

# Prettier skips a path .gitignore names, and the index is git-ignored: read .prettierignore alone.
format() {
  if have_prettier; then
    (cd "$repo_root" && pnpm --silent exec prettier --ignore-path .prettierignore --stdin-filepath "$index_relative_path")
  else
    cat
    printf '\n%s\n' "$UNFORMATTED_MARKER"
  fi
}

# The fingerprint is taken before the docs are read, so a doc edited during the generation leaves the stored one
# behind and the next check regenerates. The rename makes the new index appear whole.
write_index() {
  local fingerprint
  fingerprint="$(docs_fingerprint)"
  TEMP_FILE="$(mktemp "$docs_dir/$TEMP_FILE_PREFIX.XXXXXX")"
  generate "$fingerprint" | format > "$TEMP_FILE"
  chmod "$INDEX_FILE_MODE" "$TEMP_FILE"
  mv -f "$TEMP_FILE" "$index_file"
  TEMP_FILE=""
  echo "wrote $index_file ($(grep -c '^ *- ' "$index_file") sections)"
}

# Runs <command...> holding this checkout's lock, so writers take turns; without flock or a git dir it runs unlocked.
with_lock() { # <command...>
  local git_dir
  if ! command -v flock >/dev/null 2>&1 || ! git_dir="$(git -C "$repo_root" rev-parse --absolute-git-dir 2>/dev/null)"; then
    "$@"
    return
  fi
  eval "exec $LOCK_FD>>\"\$git_dir/\$LOCK_NAME\""
  if ! flock -w "$LOCK_TIMEOUT_SECONDS" "$LOCK_FD"; then
    echo "docs-index: timed out after ${LOCK_TIMEOUT_SECONDS}s waiting for another generation (lock $git_dir/$LOCK_NAME)" >&2
    return 1
  fi
  "$@"
}

is_index_ignored() { git -C "$repo_root" check-ignore -q "$index_relative_path" 2>/dev/null; }

stored_fingerprint() {
  local line
  line="$(grep -m1 -F -- "$FINGERPRINT_PREFIX" "$index_file" || true)"
  line="${line#"$FINGERPRINT_PREFIX"}"
  echo "${line%"$FINGERPRINT_SUFFIX"}"
}

stale_reason() {
  is_index_ignored || return 0
  if [[ ! -f "$index_file" ]]; then
    echo "$index_relative_path is missing"
  elif [[ "$(stored_fingerprint)" != "$(docs_fingerprint)" ]]; then
    echo "the docs changed since $index_relative_path was generated"
  elif have_prettier && grep -qF -- "$UNFORMATTED_MARKER" "$index_file"; then
    echo "$index_relative_path was written without prettier, which is installed now"
  fi
}

# Re-checked under the lock: a writer that waited on another finds the index fresh and writes nothing.
write_index_if_stale() {
  local reason
  reason="$(stale_reason)"
  [[ -n "$reason" ]] || return 0
  echo "docs index: $reason"
  write_index
}

hook_body() {
  cat <<HOOK
#!/usr/bin/env bash
$HOOK_MARKER
# Refreshes the git-ignored docs/INDEX.md of the checkout git just updated; never fails the git command.
root="\$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
[[ -x "\$root/scripts/docs-index.sh" ]] && git -C "\$root" check-ignore -q $index_relative_path 2>/dev/null || exit 0
"\$root/scripts/docs-index.sh" --if-stale >/dev/null 2>&1 || true
HOOK
}

# Writes each hook that is missing or already ours, by a rename, so a checkout running one never reads it half written;
# a foreign hook of the same name is left alone, with a note.
install_hooks() {
  local hooks_dir name hook
  hooks_dir="$(cd "$repo_root" && git rev-parse --path-format=absolute --git-path hooks)"
  mkdir -p "$hooks_dir"
  for name in "${HOOK_NAMES[@]}"; do
    hook="$hooks_dir/$name"
    if [[ -e "$hook" ]] && ! grep -qF -- "$HOOK_MARKER" "$hook"; then
      echo "docs-index: $hook exists and is not ours; left alone"
      continue
    fi
    [[ -e "$hook" ]] && [[ "$(cat "$hook")" == "$(hook_body)" ]] && continue
    TEMP_FILE="$(mktemp "$hooks_dir/.$name.XXXXXX")"
    hook_body > "$TEMP_FILE"
    chmod +x "$TEMP_FILE"
    mv -f "$TEMP_FILE" "$hook"
    TEMP_FILE=""
    echo "docs-index: installed $hook"
  done
}

case "${1:-}" in
  "") with_lock write_index ;;
  --stale-reason) stale_reason ;;
  --if-stale) [[ -z "$(stale_reason)" ]] || with_lock write_index_if_stale ;;
  --install-hooks) install_hooks ;;
  *) sed -n '5,8p' "${BASH_SOURCE[0]}"; exit 1 ;;
esac
