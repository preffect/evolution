#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# project-sync.sh — reconcile GitHub issues with the Evolution project board.
#
# Replaces the Project UI "workflows" (auto-add, auto-close) so nobody has to click
# anything in the browser. Safe to run any time; idempotent. Team lead runs it at the
# start of every session and after closing issues.
#
#   1. Every open or closed issue in the repo is on the project.
#   2. Closed issues  -> Status "Done".
#   3. Open issues with label "pending" -> Status "Blocked" (waiting on a human).
#   4. Open issues that were "Blocked" but no longer carry "pending" -> "Backlog".
#   5. Prints a summary table.
#
# Usage:  ./scripts/project-sync.sh [--dry-run]
# Needs:  gh (auth with repo + project scopes), jq
# ---------------------------------------------------------------------------

REPO="preffect/evolution"
PROJECT_OWNER="preffect"
PROJECT_NUMBER="1"
PENDING_LABEL="pending"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

project_json="$(gh project view "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json)"
PROJECT_ID="$(jq -r '.id' <<<"$project_json")"

fields_json="$(gh project field-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json)"
STATUS_FIELD_ID="$(jq -r '.fields[] | select(.name=="Status") | .id' <<<"$fields_json")"
option_id() { jq -r --arg n "$1" '.fields[] | select(.name=="Status") | .options[] | select(.name==$n) | .id' <<<"$fields_json"; }
OPT_DONE="$(option_id Done)"
OPT_BLOCKED="$(option_id Blocked)"
OPT_BACKLOG="$(option_id Backlog)"

items_json="$(gh project item-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json --limit 500)"
issues_json="$(gh issue list -R "$REPO" --state all --limit 500 --json number,url,state,labels)"

set_status() { # item-id option-id
  $DRY_RUN && return 0
  gh project item-edit --project-id "$PROJECT_ID" --id "$1" --field-id "$STATUS_FIELD_ID" --single-select-option-id "$2" >/dev/null
}

added=0 done=0 blocked=0 unblocked=0
while IFS=$'\t' read -r number url state has_pending; do
  item_id="$(jq -r --argjson n "$number" '.items[] | select(.content.number==$n) | .id' <<<"$items_json")"
  current="$(jq -r --argjson n "$number" '.items[] | select(.content.number==$n) | .status // ""' <<<"$items_json")"
  if [[ -z "$item_id" ]]; then
    if ! $DRY_RUN; then
      item_id="$(gh project item-add "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --url "$url" --format json | jq -r '.id')"
    fi
    added=$((added + 1)); current=""
  fi
  if [[ "$state" == "CLOSED" && "$current" != "Done" ]]; then
    set_status "$item_id" "$OPT_DONE"; done=$((done + 1))
  elif [[ "$state" == "OPEN" && "$has_pending" == "true" && "$current" != "Blocked" ]]; then
    set_status "$item_id" "$OPT_BLOCKED"; blocked=$((blocked + 1))
  elif [[ "$state" == "OPEN" && "$has_pending" == "false" && "$current" == "Blocked" ]]; then
    set_status "$item_id" "$OPT_BACKLOG"; unblocked=$((unblocked + 1))
  fi
done < <(jq -r --arg p "$PENDING_LABEL" '.[] | [.number, .url, .state, (any(.labels[]; .name==$p))] | @tsv' <<<"$issues_json")

$DRY_RUN && echo "(dry run — nothing changed)"
printf '%-32s %s\n' "added to project:" "$added" "closed -> Done:" "$done" \
  "pending -> Blocked:" "$blocked" "un-pended -> Backlog:" "$unblocked"
