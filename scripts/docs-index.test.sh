#!/usr/bin/env bash
# docs-index.test.sh — exercises the on-demand docs/INDEX.md (#407) against a throwaway origin and author clone, with a
# fake pnpm on PATH: scripts/worktree.sh add writes the index into a new worktree before anything else runs and
# installs the shared hooks, leaving the worktree clean (the index is git-ignored); written without node_modules it
# is marked unformatted, and the setup after an install formats it; the setup (scripts/lib/workspace-ready.sh)
# regenerates it after a doc is edited, added or deleted and does nothing while it is fresh; a raw `git worktree add`
# and a merge refresh it through the hooks; a checkout that still commits the index is never rewritten; a foreign
# hook is left alone. Against this checkout, when prettier is installed, the generated index passes prettier --check.
#
#   scripts/docs-index.test.sh        # exit 0 when every case passes
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sandbox="$(mktemp -d)"
trap 'rm -rf "$sandbox"' EXIT
source "$repo_root/scripts/lib/shell-test.sh"

FAKE_PRETTIER_SIGNATURE='<!-- formatted by the fake prettier -->'
UNFORMATTED_MARKER='<!-- docs-index: unformatted, prettier was not installed -->'

mkdir -p "$sandbox/bin" "$sandbox/home"
cat > "$sandbox/bin/pnpm" <<PNPM
#!/usr/bin/env bash
case "\$*" in
  'install --frozen-lockfile --prefer-offline') mkdir -p node_modules/.pnpm && cp pnpm-lock.yaml node_modules/.pnpm/lock.yaml ;;
  *'exec prettier'*) cat; echo '$FAKE_PRETTIER_SIGNATURE' ;;
  *) echo "fake pnpm: unexpected \$*" >&2; exit 1 ;;
esac
PNPM
chmod +x "$sandbox/bin/pnpm"
export PATH="$sandbox/bin:$PATH" HOME="$sandbox/home"

make_origin
mkdir -p "$author/scripts/lib" "$author/docs/topic"
cp "$repo_root/scripts/docs-index.sh" "$repo_root/scripts/worktree.sh" "$author/scripts/"
cp "$repo_root/scripts/lib/workspace-ready.sh" "$author/scripts/lib/"
printf '.worktrees/\ndocs/INDEX.md\n' >> "$author/.gitignore"
printf '# Alpha\n\nThe first doc.\n\n## Alpha detail\n\nMore.\n' > "$author/docs/ALPHA.md"
printf '# Beta\n\nThe topic doc.\n' > "$author/docs/topic/beta.md"
git -C "$author" add -A
git_as_test -C "$author" commit -q -m docs
git -C "$author" push -q origin main

index_of() { echo "$1/docs/INDEX.md"; } # <checkout>
indexed() { grep -qF -- "$2" "$(index_of "$1")"; } # <checkout> <text>
setup() { # <checkout> -> output in $setup_out
  setup_out="$(source "$1/scripts/lib/workspace-ready.sh" && workspace_ensure_ready "$1" setup: continue 2>&1)"
}
said() { grep -qF -- "$1" <<<"$setup_out"; }
clean() { [[ -z "$(git -C "$1" status --porcelain)" ]]; }

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

index_mtime="$(stat -c %Y.%y "$(index_of "$worktree")")"
setup "$worktree"
check "a fresh index is left alone and the setup prints nothing" $(( $(holds [ -z "$setup_out" ]) && $(holds [ "$(stat -c %Y.%y "$(index_of "$worktree")")" = "$index_mtime" ]) ))

printf '\n## Alpha added\n\nNew section.\n' >> "$worktree/docs/ALPHA.md"
setup "$worktree"
check "an edited doc regenerates the index" $(( $(holds said 'docs/ALPHA.md changed since') && $(holds indexed "$worktree" '**Alpha added**') ))

printf '# Gamma\n\nAnother topic doc.\n' > "$worktree/docs/topic/gamma.md"
setup "$worktree"
check "a doc added in a docs directory regenerates the index" $(( $(holds indexed "$worktree" '## topic/gamma.md') ))

rm "$worktree/docs/topic/beta.md"
setup "$worktree"
check "a deleted doc regenerates the index without it" $(( $(holds said 'regenerating the docs index') && ! $(holds indexed "$worktree" '## topic/beta.md') ))
git -C "$worktree" checkout -q -- docs && rm "$worktree/docs/topic/gamma.md"

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
sed -i '/docs\/INDEX.md/d' "$raw_worktree/.gitignore"
echo 'committed by hand' > "$(index_of "$raw_worktree")"
git -C "$raw_worktree" add -A
git_as_test -C "$raw_worktree" commit -q -m 'an older branch commits the index'
touch "$raw_worktree/docs/ALPHA.md"
setup "$raw_worktree"
check "a committed index is not stale by definition and the setup leaves it" $(( $(holds [ -z "$("$raw_worktree/scripts/docs-index.sh" --stale-reason)" ]) && $(holds clean "$raw_worktree") ))
git -C "$raw_worktree" checkout -q feat/raw
git -C "$raw_worktree" checkout -q old/committed-index
check "the hooks leave a committed index untouched across checkouts" $(( $(holds clean "$raw_worktree") && $(holds indexed "$raw_worktree" 'committed by hand') ))

# --- a foreign hook is left alone ----------------------------------------------------------------------
printf '#!/usr/bin/env bash\necho foreign\n' > "$author/.git/hooks/post-merge"
install_out="$("$author/scripts/docs-index.sh" --install-hooks)"
check "--install-hooks leaves a foreign hook alone and says so" $(( $(holds grep -q 'is not ours; left alone' <<<"$install_out") && $(holds grep -q foreign "$author/.git/hooks/post-merge") ))
check "--install-hooks is idempotent for its own hooks" $(( $(holds [ -z "$(grep -v 'post-merge' <<<"$install_out")" ]) ))

# --- prettier formatting holds on this checkout's real docs --------------------------------------------
if [[ -d "$repo_root/node_modules" ]] && git -C "$repo_root" check-ignore -q docs/INDEX.md; then
  PATH="${PATH#"$sandbox/bin:"}" "$repo_root/scripts/docs-index.sh" --if-stale >/dev/null
  check "the generated index of this checkout passes prettier --check" $(( $(holds bash -c "cd '$repo_root' && PATH='${PATH#"$sandbox/bin:"}' pnpm --silent exec prettier --check --ignore-path .prettierignore docs/INDEX.md >/dev/null") ))
else
  echo "skip the prettier check: this checkout has no node_modules"
fi

finish_suite docs-index.test.sh
