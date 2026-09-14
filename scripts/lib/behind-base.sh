#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# behind-base.sh — whether a checkout's HEAD is behind a base ref (origin/main), and the one refusal line for it.
# Sourced by validate.sh (`all --affected`) and scripts/land-pr.sh (its merge gate). land-pr.sh refuses from the
# main checkout's own copy because a PR branched earlier carries a validate.sh without the refusal (#344).
#
#   commits_behind <checkout> <base ref>     prints how many commits <base ref> has that HEAD lacks (0 when unknown)
#   behind_base_message <count> <base ref>   prints the refusal: how far behind, and the merge that fixes it
# ---------------------------------------------------------------------------

commits_behind() { # <checkout> <base ref>
  local count
  count="$(git -C "$1" rev-list --count "HEAD..$2" 2>/dev/null)" || count=0
  echo "${count:-0}"
}

behind_base_message() { # <count> <base ref>
  local noun="commits"
  [[ "$1" -ne 1 ]] || noun="commit"
  echo "this branch is $1 $noun behind $2, so a green gate would not check the tree that merges; run \`git merge $2\` on the branch (never a rebase on a reviewed branch), push, then re-run"
}
