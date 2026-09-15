#!/usr/bin/env bash
# docs-index.test.sh — exercises the on-demand docs/INDEX.md (#407) against a throwaway origin and author clone, with a
# fake pnpm on PATH, never touching the checkout that runs it: scripts/worktree.sh add writes the index into a new
# worktree before anything else runs and installs the shared hooks, leaving the worktree clean (the index is
# git-ignored); written without node_modules it is marked unformatted, and the setup after an install formats it; the
# setup (scripts/lib/workspace-ready.sh) regenerates it after a doc is edited, added or deleted, or its content changes
# under an older mtime, and does nothing while it is fresh or after a touch that changes no content; a doc edited while
# a slow prettier runs is stale afterwards; concurrent writers and a reader never expose a partial index; a raw
# `git worktree add` and a merge refresh it through the hooks; a checkout that still commits the index is never
# rewritten; a foreign hook is left alone. When this checkout has node_modules, a copy of its docs indexed with the
# real prettier passes prettier --check.
#
#   scripts/docs-index.test.sh        # exit 0 when every case passes
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sandbox="$(mktemp -d)"
writer_pids=()
cleanup() {
  local pid
  for pid in "${writer_pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  rm -rf "$sandbox"
}
trap cleanup EXIT
source "$repo_root/scripts/lib/shell-test.sh"

FAKE_PRETTIER_SIGNATURE='<!-- formatted by the fake prettier -->'
UNFORMATTED_MARKER='<!-- docs-index: unformatted, prettier was not installed -->'
FAKE_PRETTIER_SLEEP_FILE="$sandbox/fake-prettier-sleep" # seconds the fake prettier takes (a slow format)
FAKE_PRETTIER_STARTED_FILE="$sandbox/fake-prettier-started" # created when the fake prettier starts
SLOW_PRETTIER_SECONDS=1
READER_POLLS_MAX=20000
real_path="$PATH"
real_home="$HOME"

mkdir -p "$sandbox/bin" "$sandbox/home"
echo 0 > "$FAKE_PRETTIER_SLEEP_FILE"
cat > "$sandbox/bin/pnpm" <<PNPM
#!/usr/bin/env bash
case "\$*" in
  'install --frozen-lockfile --prefer-offline') mkdir -p node_modules/.pnpm && cp pnpm-lock.yaml node_modules/.pnpm/lock.yaml ;;
  *'exec prettier'*)
    # Half the output, the sleep, then the rest: a write in place would expose the half to a reader.
    touch "$FAKE_PRETTIER_STARTED_FILE"
    input="\$(cat)"
    half=\$((\${#input} / 2))
    printf '%s' "\${input:0:half}"
    sleep "\$(cat "$FAKE_PRETTIER_SLEEP_FILE")"
    printf '%s\n%s\n' "\${input:half}" '$FAKE_PRETTIER_SIGNATURE'
    ;;
  *) echo "fake pnpm: unexpected \$*" >&2; exit 1 ;;
esac
PNPM
chmod +x "$sandbox/bin/pnpm"
export PATH="$sandbox/bin:$PATH" HOME="$sandbox/home"

make_origin
mkdir -p "$author/scripts/lib" "$author/docs/topic"
cp "$repo_root/scripts/docs-index.sh" "$repo_root/scripts/worktree.sh" "$author/scripts/"
cp "$repo_root/scripts/lib/workspace-ready.sh" "$author/scripts/lib/"
printf '.worktrees/\ndocs/INDEX.md\ndocs/.INDEX.md.*\n' >> "$author/.gitignore"
printf '# Alpha\n\nThe first doc.\n\n## Alpha detail\n\nMore.\n' > "$author/docs/ALPHA.md"
printf '# Beta\n\nThe topic doc.\n' > "$author/docs/topic/beta.md"
git -C "$author" add -A
git_as_test -C "$author" commit -q -m docs
git -C "$author" push -q origin main

index_of() { echo "$1/docs/INDEX.md"; } # <checkout>
indexed() { grep -qF -- "$2" "$(index_of "$1")"; } # <checkout> <text>
stale_reason() { "$1/scripts/docs-index.sh" --stale-reason; } # <checkout>
setup() { # <checkout> -> output in $setup_out
  setup_out="$(source "$1/scripts/lib/workspace-ready.sh" && workspace_ensure_ready "$1" setup: continue 2>&1)"
}
said() { grep -qF -- "$1" <<<"$setup_out"; }
clean() { [[ -z "$(git -C "$1" status --porcelain)" ]]; }
index_identity() { stat -c '%i %y' "$(index_of "$1")"; } # <checkout>: changes on every rewrite

# --- a new worktree has the index before anything runs in it ------------------------------------------
worktree_out="$(cd "$author" && scripts/worktree.sh add feat/one 2>/dev/null)"
worktree="$author/$worktree_out"
check "worktree.sh add prints the worktree path" $(( $(holds [ "$worktree_out" = .worktrees/feat/one ]) ))
check "a new worktree has docs/INDEX.md" $(( $(holds test -f "$(index_of "$worktree")") ))
check "its index lists every doc and heading" $(( $(holds indexed "$worktree" '## ALPHA.md') && $(holds indexed "$worktree" '## topic/beta.md') && $(holds indexed "$worktree" '**Alpha detail** (L5–7): More.') ))
check "without node_modules the index is marked unformatted" $(( $(holds indexed "$worktree" "$UNFORMATTED_MARKER") ))
check "the index leaves the worktree clean (git-ignored)" $(( $(holds clean "$worktree") ))
check "worktree.sh installs the shared post-checkout and post-merge hooks" $(( $(holds test -x "$author/.git/hooks/post-checkout") && $(holds test -x "$author/.git/hooks/post-merge") ))

# --- the setup formats it after the install, then refreshes it on doc changes --------------------------
setup "$worktree"
check "the setup after an install formats an unformatted index" $(( $(holds said 'written without prettier') && $(holds indexed "$worktree" "$FAKE_PRETTIER_SIGNATURE") && ! $(holds indexed "$worktree" "$UNFORMATTED_MARKER") ))

identity="$(index_identity "$worktree")"
setup "$worktree"
check "a fresh index is left alone and the setup prints nothing" $(( $(holds [ -z "$setup_out" ]) && $(holds [ "$(index_identity "$worktree")" = "$identity" ]) ))

touch "$worktree/docs/ALPHA.md" "$worktree/docs/topic"
setup "$worktree"
check "a touch that changes no doc content does not regenerate" $(( $(holds [ -z "$setup_out" ]) && $(holds [ "$(index_identity "$worktree")" = "$identity" ]) ))

cp -p "$worktree/docs/ALPHA.md" "$sandbox/alpha-before.md"
printf '\n## Alpha added\n\nNew section.\n' >> "$worktree/docs/ALPHA.md"
setup "$worktree"
check "an edited doc regenerates the index" $(( $(holds said 'the docs changed since') && $(holds indexed "$worktree" '**Alpha added**') ))

cp -p "$sandbox/alpha-before.md" "$worktree/docs/ALPHA.md"
check "a doc restored with an older mtime (cp -p) is stale" $(( $(holds [ -n "$(stale_reason "$worktree")" ]) ))
setup "$worktree"
printf '\n## Alpha backdated\n\nOld mtime.\n' >> "$worktree/docs/ALPHA.md"
touch -d '-1 day' "$worktree/docs/ALPHA.md"
check "changed content under an mtime set back (touch -d) is stale" $(( $(holds [ -n "$(stale_reason "$worktree")" ]) ))
setup "$worktree"
check "and the setup then indexes it" $(( $(holds indexed "$worktree" '**Alpha backdated**') ))

printf '# Gamma\n\nAnother topic doc.\n' > "$worktree/docs/topic/gamma.md"
setup "$worktree"
check "a doc added in a docs directory regenerates the index" $(( $(holds indexed "$worktree" '## topic/gamma.md') ))

mkdir -p "$worktree/docs/topic/tools" && echo 'not a doc' > "$worktree/docs/topic/tools/helper.txt"
setup "$worktree"
check "a change outside the indexed docs does not regenerate" $(( $(holds [ -z "$setup_out" ]) ))

rm "$worktree/docs/topic/beta.md"
setup "$worktree"
check "a deleted doc regenerates the index without it" $(( $(holds said 'regenerating the docs index') && ! $(holds indexed "$worktree" '## topic/beta.md') ))
git -C "$worktree" checkout -q -- docs && rm -r "$worktree/docs/topic/gamma.md" "$worktree/docs/topic/tools"
setup "$worktree"

# --- races: an edit during a generation, concurrent writers and a reader -------------------------------
echo "$SLOW_PRETTIER_SECONDS" > "$FAKE_PRETTIER_SLEEP_FILE"
printf '\n## Alpha before the race\n\nText.\n' >> "$worktree/docs/ALPHA.md"
rm -f "$FAKE_PRETTIER_STARTED_FILE"
"$worktree/scripts/docs-index.sh" --if-stale > "$sandbox/slow-writer.log" 2>&1 &
writer_pids+=($!)
slow_writer=$!
wait_for test -e "$FAKE_PRETTIER_STARTED_FILE" || true
printf '\n## Alpha during the race\n\nText.\n' >> "$worktree/docs/ALPHA.md"
wait "$slow_writer" || true
check "a doc edited while the generator runs leaves the index stale afterwards" $(( $(holds [ -n "$(stale_reason "$worktree")" ]) ))

old_size="$(stat -c %s "$(index_of "$worktree")")"
"$worktree/scripts/docs-index.sh" --if-stale > "$sandbox/writer-one.log" 2>&1 &
writer_one=$!
"$worktree/scripts/docs-index.sh" --if-stale > "$sandbox/writer-two.log" 2>&1 &
writer_two=$!
"$worktree/scripts/docs-index.sh" > "$sandbox/writer-forced.log" 2>&1 &
writer_forced=$!
writer_pids+=("$writer_one" "$writer_two" "$writer_forced")
: > "$sandbox/observed-sizes"
for ((poll = 0; poll < READER_POLLS_MAX; poll++)); do
  stat -c %s "$(index_of "$worktree")" >> "$sandbox/observed-sizes" 2>/dev/null || echo missing >> "$sandbox/observed-sizes"
  kill -0 "$writer_one" 2>/dev/null || kill -0 "$writer_two" 2>/dev/null || kill -0 "$writer_forced" 2>/dev/null || break
done
writers_rc=0
wait "$writer_one" "$writer_two" "$writer_forced" || writers_rc=$?
new_size="$(stat -c %s "$(index_of "$worktree")")"
unexpected="$(sort -u "$sandbox/observed-sizes" | grep -vxF -e "$old_size" -e "$new_size" || true)"
check "concurrent writers all succeed" $(( writers_rc == 0 ))
check "a reader during concurrent writes sees only the old or the final index, never a partial one (saw: $(sort -u "$sandbox/observed-sizes" | tr '\n' ' '))" $(( $(holds [ -z "$unexpected" ]) ))
check "the writers leave a fresh index with both race edits and no temp file" $(( $(holds [ -z "$(stale_reason "$worktree")" ]) && $(holds indexed "$worktree" '**Alpha during the race**') && $(holds [ -z "$(find "$worktree/docs" -maxdepth 1 -name '.INDEX.md.*')" ]) ))
echo 0 > "$FAKE_PRETTIER_SLEEP_FILE"
git -C "$worktree" checkout -q -- docs
setup "$worktree"

# --- the hooks: a raw worktree add and a merge ---------------------------------------------------------
raw_worktree="$sandbox/raw"
git -C "$author" worktree add -q -b feat/raw "$raw_worktree" origin/main 2>/dev/null
check "a raw git worktree add gets the index through post-checkout" $(( $(holds indexed "$raw_worktree" '## ALPHA.md') ))

printf '# Delta\n\nMerged doc.\n' > "$author/docs/DELTA.md"
git -C "$author" add -A
git_as_test -C "$author" commit -q -m delta
git -C "$author" push -q origin main
git -C "$raw_worktree" fetch -q origin
git_as_test -C "$raw_worktree" merge -q --no-edit origin/main 2>/dev/null
check "a merge that brings a doc refreshes the index through post-merge" $(( $(holds indexed "$raw_worktree" '## DELTA.md') && $(holds clean "$raw_worktree") ))

# --- a checkout that still commits the index is never rewritten ----------------------------------------
git -C "$raw_worktree" checkout -q -b old/committed-index
sed -i '/INDEX.md/d' "$raw_worktree/.gitignore"
echo 'committed by hand' > "$(index_of "$raw_worktree")"
git -C "$raw_worktree" add -A
git_as_test -C "$raw_worktree" commit -q -m 'an older branch commits the index'
echo 'edited' >> "$raw_worktree/docs/ALPHA.md"
git_as_test -C "$raw_worktree" commit -q -am 'a doc edit'
setup "$raw_worktree"
check "a committed index is not stale by definition and the setup leaves it" $(( $(holds [ -z "$(stale_reason "$raw_worktree")" ]) && $(holds clean "$raw_worktree") ))
git -C "$raw_worktree" checkout -q feat/raw
git -C "$raw_worktree" checkout -q old/committed-index
check "the hooks leave a committed index untouched across checkouts" $(( $(holds clean "$raw_worktree") && $(holds indexed "$raw_worktree" 'committed by hand') ))

# --- a foreign hook is left alone ----------------------------------------------------------------------
printf '#!/usr/bin/env bash\necho foreign\n' > "$author/.git/hooks/post-merge"
install_out="$("$author/scripts/docs-index.sh" --install-hooks)"
check "--install-hooks leaves a foreign hook alone and says so" $(( $(holds grep -q 'is not ours; left alone' <<<"$install_out") && $(holds grep -q foreign "$author/.git/hooks/post-merge") ))
check "--install-hooks is idempotent for its own hooks" $(( $(holds [ -z "$(grep -v 'post-merge' <<<"$install_out")" ]) ))
check "--install-hooks leaves no temp file in the hooks dir" $(( $(holds [ -z "$(find "$author/.git/hooks" -name '.post-*')" ]) ))
rm "$author/.git/hooks/post-merge"
"$author/scripts/docs-index.sh" --install-hooks >/dev/null
setup_out="$(source "$worktree/scripts/lib/workspace-ready.sh" && printf '#!/usr/bin/env bash\n' > "$author/.git/hooks/post-merge" \
  && rm -f "$(index_of "$worktree")" && workspace_ensure_ready "$worktree" setup: continue 2>&1)"
check "the setup shows the foreign-hook note instead of swallowing it" $(( $(holds said 'is not ours; left alone') ))

# --- prettier formatting holds, on a sandbox copy of this checkout's docs ------------------------------
if [[ -d "$repo_root/node_modules" ]]; then
  real="$sandbox/real"
  mkdir -p "$real/scripts"
  git init -q "$real"
  cp "$repo_root/.gitignore" "$repo_root/.prettierrc" "$repo_root/.prettierignore" "$repo_root/package.json" "$real/"
  cp "$repo_root/scripts/docs-index.sh" "$real/scripts/"
  (cd "$repo_root" && find docs -maxdepth 2 -name '*.md' ! -name INDEX.md -exec cp --parents {} "$real/" \;)
  ln -s "$repo_root/node_modules" "$real/node_modules"
  PATH="$real_path" HOME="$real_home" "$real/scripts/docs-index.sh" >/dev/null
  check "the index of this checkout's docs, formatted by the real prettier, passes prettier --check" $(( $(holds env PATH="$real_path" HOME="$real_home" bash -c "cd '$real' && pnpm --silent exec prettier --check --ignore-path .prettierignore docs/INDEX.md >/dev/null") ))
else
  echo "skip the prettier check: this checkout has no node_modules"
fi

finish_suite docs-index.test.sh
