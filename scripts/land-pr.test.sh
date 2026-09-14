#!/usr/bin/env bash
# land-pr.test.sh — exercises scripts/land-pr.sh's merge gate (#344) against a local bare "origin", with gh,
# scripts/agent.sh and scripts/pr-threads.sh stubbed (every reviewer approves, no thread open) and a PR
# worktree carrying an old validate.sh that passes anything: a PR behind origin/main is refused by land-pr.sh
# itself, naming how far behind (plural and singular) and the merge, without running the PR's validate.sh,
# arming the merge or merging main into the worktree; once the author merges origin/main and pushes, the
# gate runs on that head and the merge is armed.
#
#   scripts/land-pr.test.sh        # exit 0 when every case passes
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sandbox="$(mktemp -d)"
source "$repo_root/scripts/lib/shell-test.sh"
trap 'rm -rf "$sandbox"' EXIT

PR_NUMBER=7
PR_BRANCH="feat/$PR_NUMBER-old-gate"
REVIEWER="code-qa"

# --- fixture: origin + author, the land-pr checkout (stubbed neighbours), the PR worktree ---------
make_origin
calls="$sandbox/calls"
: > "$calls"
# The PR's validate.sh as it was before the refusal: green whatever the base.
printf '#!/usr/bin/env bash\necho "old validate.sh $*" >> "%s"\necho "ALL PASSED"\n' "$calls" > "$author/validate.sh"
chmod +x "$author/validate.sh"
git -C "$author" add -A
git_as_test -C "$author" commit -q -m 'old validate.sh'
git -C "$author" push -q origin main
git -C "$author" checkout -q -b "$PR_BRANCH"
echo feature > "$author/feature.txt"
git -C "$author" add -A
git_as_test -C "$author" commit -q -m feature
git -C "$author" push -q -u origin "$PR_BRANCH"
git -C "$author" checkout -q main

root="$sandbox/root"
mkdir -p "$root/scripts/lib" "$root/.worktrees/feat" "$sandbox/bin"
cp "$repo_root/scripts/land-pr.sh" "$root/scripts/land-pr.sh"
cp "$repo_root/scripts/lib/behind-base.sh" "$root/scripts/lib/behind-base.sh"
printf '#!/usr/bin/env bash\necho "agent $*" >> "%s"\n' "$calls" > "$root/scripts/agent.sh"
printf '#!/usr/bin/env bash\necho %s\n' "'{\"verdicts\":{\"$REVIEWER\":\"APPROVE\"},\"unresolved\":0}'" > "$root/scripts/pr-threads.sh"
cat > "$sandbox/bin/gh" <<GH
#!/usr/bin/env bash
case "\$1 \$2" in
  'repo view') echo owner/game ;;
  'pr view') echo "$PR_BRANCH" ;;
  'pr merge') echo "gh pr merge \$*" >> "$calls" ;;
esac
GH
chmod +x "$root/scripts/agent.sh" "$root/scripts/pr-threads.sh" "$sandbox/bin/gh"
worktree="$root/.worktrees/$PR_BRANCH"
git clone -q -b "$PR_BRANCH" "$origin" "$worktree"
export PATH="$sandbox/bin:$PATH"

run_land() { # -> output in $out, exit code in $rc
  rc=0
  out="$("$root/scripts/land-pr.sh" "$PR_NUMBER" --reviewers "$REVIEWER" 2>&1)" || rc=$?
}
called() { grep -q -- "$1" "$calls"; }

# --- cases ------------------------------------------------------------------------------------------
merge_to_main game.txt v2
merge_to_main game.txt v3
pr_head="$(git -C "$worktree" rev-parse HEAD)"
run_land
check "a PR 2 commits behind origin/main is refused by land-pr.sh, naming the merge" $(( rc != 0 && $(holds grep -q "== PR #$PR_NUMBER: this branch is 2 commits behind origin/main" <<<"$out") && $(holds grep -q 'git merge origin/main' <<<"$out") ))
check "the refusal runs neither the PR's old validate.sh nor the merge" $(( $(holds called 'old validate.sh') == 0 && $(holds called 'gh pr merge') == 0 ))
check "land-pr.sh does not merge main into the PR worktree itself" $(( $(holds test "$(git -C "$worktree" rev-parse HEAD)" == "$pr_head") ))

git -C "$author" checkout -q "$PR_BRANCH"
git_as_test -C "$author" merge -q --no-edit main
git -C "$author" push -q origin "$PR_BRANCH"
git -C "$author" checkout -q main
merge_to_main game.txt v4
run_land
check "one commit behind reads in the singular" $(( rc != 0 && $(holds grep -q 'this branch is 1 commit behind origin/main' <<<"$out") ))

git -C "$author" checkout -q "$PR_BRANCH"
git_as_test -C "$author" merge -q --no-edit main
git -C "$author" push -q origin "$PR_BRANCH"
git -C "$author" checkout -q main
run_land
check "once origin/main is merged in and pushed, the gate runs on that head and the merge is armed" $(( rc == 0 && $(holds called 'old validate.sh all --affected') && $(holds called "gh pr merge pr merge $PR_NUMBER --squash --auto --delete-branch") && $(holds test "$(git -C "$worktree" rev-parse HEAD)" == "$(git -C "$author" rev-parse "$PR_BRANCH")") ))

finish_suite land-pr.test.sh
