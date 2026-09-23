# Workflow — GitHub issues, project board, reviews

The single source of truth for **how work is tracked and merged** in a game built from this
template. `CLAUDE.md`, `docs/INIT-GAME.md`, the seeded GitHub issues, and every agent role
prompt point here instead of restating these rules. Everything below is done through the
GitHub API (`gh`, GraphQL) by scripts or agents — **the human never has to click in GitHub's UI.**

## 1. Where things live

| What                                | Where                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| Tickets, labels, milestones         | The game's GitHub repo, **Issues** tab                                                       |
| Stage of each ticket (the board)    | The GitHub **Project** linked to the repo (shows under the repo's **Projects** tab)          |
| Epic → ticket hierarchy             | Native **sub-issues** (epics show a progress bar; closing a child updates the parent)        |
| "Waiting on me" list for the human  | `https://github.com/issues/assigned` — anything **assigned to the human** is waiting on them |
| Project identifiers used by scripts | `.github/project.env` (written by `scripts/github-setup.sh`)                                 |

GitHub stores Projects under the user/org, not inside the repo; the project is _linked_ to the
repo so it appears in the repo's Projects tab and only holds this repo's issues.

Repo-level "saved issue views" are **not API-editable** — do not use them; the Project views
cover the same need.

### 1.1 Referring to a number: say which, and lead with the ticket

GitHub issues and pull requests **share one number sequence**, so a bare `#452` is ambiguous.
The board shows **tickets only**, so a bare PR number is something the human cannot look up.

- **Never write a bare `#N`.** Write **`ticket #447`** or **`PR #452`**, every time — in chat,
  in ticket bodies, in PR descriptions, in agent briefs and in commit messages.
- **Lead with the ticket** where one exists: `ticket #447 (PR #452)`, not the reverse. The ticket
  is the unit of work the human tracks; the PR is an implementation detail of it.
- Status summaries, tables and "what landed" lists name **tickets**. Mention a PR only where it
  adds something the ticket does not — a review to read, a head sha, a merge.
- Landed work reads `ticket #415 (via PR #441)`, so it is findable on the board.

A reference the reader cannot resolve is not a reference.

## 2. Labels (category), Status (stage), assignee (ball in court)

- **Labels say what and who.** `area:*` (devcontainer, tooling-mcp, team, quality, testing,
  design, architecture, gameplay, graphics, networking, ui, audio, qa, docs), `role:*` (the
  agent role that owns it), `priority:p0|p1|p2`, `epic`, `roadmap`, `needs-decision`, `pending`.
- **Project Status says where it is.** `Backlog → Ready → In progress → In review → Done`,
  plus `Blocked`. Status is the _only_ stage field — no `status:*` labels.
- **Assignee means "waiting on a human".** Agents are not GitHub users, so the assignee field
  is reserved: assign the human when, and only when, a ticket needs their decision, credential,
  or approval.

**Waiting-on-human rule.** When an agent needs the human it (1) adds `pending`, (2) assigns
the human, (3) sets Status `Blocked`, (4) states the exact question in a comment. `@mention` the
human only when the question blocks active work. When the human answers, the agent removes the
label, unassigns, records the decision in a comment, and moves Status back.

**Label hygiene.** Update labels as you go: remove `pending` / `needs-decision` the moment a
decision is applied; close the ticket when it is done; never leave a closed ticket carrying
`pending`. The sync script (below) keeps Status consistent, not labels.

## 3. Milestones and epics

- Planning/groundwork phase only: **`M0 Setup`** (devcontainer, tooling/MCP, team, quality
  gates, testing foundations) and **`M1 Design`** (design docs, architecture, build plan).
  Later build phases live in a single `roadmap` issue until the human approves them; they then
  become their own epics. **Epics scope one phase of groundwork, never the whole game.**
- Epics carry the `epic` label and own their tickets as sub-issues. Every ticket body starts
  with `**Epic:** #N` and carries a `**Spec files:**` line naming the `docs/<domain>/<topic>.md` files (with §)
  the work needs; agents read only those (`.claude/roles/_common.md`).
- **One subsystem per ticket.** A ticket names one subsystem, and its PR is readable in one
  sitting: about 40 files at most, tests included. A title that lists several subsystems
  ("world, ecology, movement, growth, …") is an epic, not a ticket: give it the `epic` label and
  split it into sub-issues before anyone starts. The lead checks size before spawning and splits
  first; a build agent that finds its ticket bigger than this stops and reports instead of
  building. Why: #152 (175 files) cost three review rounds, two agents lost at the usage limit
  and several usage windows; five 40-file tickets would have landed one at a time.

## 4. Keeping the board in sync (no UI workflows)

The Project's UI-only automations (auto-add, auto-close) are replaced by
`scripts/project-sync.sh`, which is idempotent and safe to run any time:

1. every issue is on the project (new ones get `Backlog` / `Blocked` / `Done` as they are added);
2. closed → `Done`; open + `pending` → `Blocked`; `Blocked` without `pending` → `Backlog`;
3. items in `Ready` / `In progress` / `In review` are never touched.

The team lead runs it at the start of every session and after closing issues. Agents move a
ticket between stages with `gh project item-edit` (ids in `.github/project.env`).

## 5. Branch and PR rules

**Every piece of work starts as a ticket — no exceptions, including template and tooling work.**
Create the issue first (or pick one up), work on a branch named after it, and put `Closes #N` in
the PR body. Work on a different repository gets its own Project and its own tickets there
(`scripts/github-setup.sh --no-seed` for repos that are not games); never track one repo's work
in another repo's board.

Applied as a **ruleset** on the default branch by `scripts/github-setup.sh`:

- a pull request is required — no direct pushes, no force pushes, no branch deletion;
- **the `pr-links-issue` status check must pass** — `.github/workflows/pr-links-issue.yml` fails
  any PR whose body has no `Closes #N` / `Fixes #N` / `Resolves #N`, so a PR without a ticket
  cannot be merged (this is the hard enforcement of the rule above);
- **every review thread must be resolved before merge**;
- stale approvals are dismissed on new commits;
- the `validate` (CI) and `code-review` (reviewer agent) checks are added **only once those
  checks exist** — requiring a check that never reports blocks every merge.

All agents act as the human's GitHub account (mounted `~/.config/gh`; git pushes over HTTPS
with `gh` as the credential helper, set up by `.devcontainer/post-create.sh`), so GitHub cannot
enforce "reviewer ≠ author". Reviews are therefore procedural (below) plus the `code-review`
status.

### 5.1 Lanes — how much process a change gets

Decided 2026-09-22 after a two-line logging change took 35 minutes of agent, brief, review and gate:
**the process scales with the risk of the change, not with the ceremony available.** The lead picks the
lane when it picks up the ticket and names it in the PR body (`Lane: 1`). When in doubt between two
lanes, take the lighter one and let the timed gate (below) catch what slips.

| Lane          | What                                                                                                                                 | Who                                                                                                                             | Checks before merge                                                                                                       | Target    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------- |
| **1 trivial** | docs, copy, constants, dev tooling, logging, a fix under ~50 lines in one package with no new behaviour                              | the lead itself — no agent, no reviewer, no design review                                                                       | `./validate.sh <phase> --scope <path>` on what changed (lint for docs), then merge                                        | 5–10 min  |
| **2 normal**  | a feature slice or fix inside one package (`client`, `server`) that does not touch the lane-3 areas                                  | one builder with a brief under ~150 words, one reviewer by area (§6), **one** round; blockers fixed, minors filed as follow-ups | builder's scoped tests + reviewer's scoped check; no per-PR gate, no mutation table, at most one evidence frame if visual | 30–60 min |
| **3 risky**   | anything in `packages/shared/`, the simulation step, the wire contract, renderer or session lifecycle, `validate.sh`, deploy scripts | the full §6 process: design review, parallel round one, light round two                                                         | `./validate.sh all --affected` on the final head, by whoever merges                                                       | as needed |

**The gate moves from the PR to `main`.** Lanes 1 and 2 merge on scoped checks. `./validate.sh all` runs
against `origin/main` on a timer (`scripts/main-gate.sh`, hourly while anything merged) rather than once per
PR; a red run names the merge that broke it and that merge is **reverted, not fixed forward**, with a lane-2
ticket for the redo. Lane 3 keeps the per-PR gate because a revert there is not cheap.

Every lane still starts as a ticket (§5; the `pr-links-issue` check requires it — a lane-1 ticket is one
`gh issue create` line) and still says `ticket #N` / `PR #N` (§1.1). What lanes 1–2 drop is the parts that cost
hours and found little on small changes: long briefs, mutation tables, multi-viewport evidence, second review
rounds, and a 20-minute gate queued behind another gate.

**Agent hygiene.** Agents never wait with `until …; do sleep …; done` loops — they end their turn and are
woken by the harness; a poll loop outlives its agent and burns a core for days. The lead sweeps at session
start for processes whose cwd is a deleted worktree and for poll loops older than an hour.

## 6. Review process (lanes 2 and 3)

Lane 2 runs steps 2 and 4 only, with one reviewer and one round. Lane 3 runs everything.

1. **Design review** (architect) before code: approach, file plan, interfaces, where constants
   and config live, test plan.
2. **Code review** against the checklist in `.github/PULL_REQUEST_TEMPLATE.md`. Findings are
   **line-anchored PR review comments**; reviewers request changes rather than fixing silently.
3. **Domain review** where the change is playable or visible (with screenshots for visuals).
   Which roles review which PR is the table in `docs/TEAM.md`.
4. The author fixes, **replies on every thread** saying what changed, and the reviewer resolves
   after verifying. The author never resolves their own threads.
5. Merge only after `./validate.sh all --affected` passes on the final head, run once by whoever
   merges right before the merge, with all threads resolved and all checks green. Builders and
   reviewers run scoped checks only: no gate when a PR is ready, no re-gate after review fixes, and
   no stamp for a reviewer (`docs/engineering/validation-gate.md` §1).
   The author never merges their own PR when a reviewer role exists.
6. **After merge** the human's running game redeploys itself within a minute (the deploy watcher
   `./run.sh` starts in `/workspace`); the lead checks `.game-logs/deploy.log` and tells the human to hard-refresh.
   A stack running without a watcher (started before #291, or with `--no-deploy-watch`) is brought
   up to date with one `scripts/deploy-main.sh`, which restarts it with the watcher.

**Review rounds** (#224, template #76). Round one runs **in parallel**: every reviewer named on the PR is spawned
at once (within the account's agent cap; if the cap is two and a builder is running, the reviewers
still start together as soon as a slot frees), each posts one verdict review, and the author gets
**one consolidated fix round** covering all reviewers' threads. **Later rounds are light**: a
round-two reviewer re-reads only the diff since its previous verdict (`git diff <r1-head>..<head>`)
and the replies on its own threads — it does not re-review the whole PR and does not re-read the
docs — resolves or re-opens its threads on that basis, and its verdict comment says
`round 2 (diff-only)`. **Reviewers run scoped checks, never the gate**: a reviewer runs
`./validate.sh <phase> --scope <package or path>` on what it reviews and never needs a stamp
(`docs/engineering/validation-gate.md` §1). The **lead
resolves purely mechanical round-two threads** (a rename, a moved constant, deleted dead code,
verified by diff) itself instead of a further reviewer pass.

**Docs stay in sync.** Any PR that changes behaviour, scripts, tooling, or process updates the
docs that describe it in the same PR — `README.md`, `CLAUDE.md`, `docs/WORKFLOW.md`, `docs/ENGINEERING.md`,
`ha-router/HA-ROUTER.md` (template only), `.devcontainer/*` comments — and keeps them consistent with each other
(one fact, one home; the others link to it). A reviewer rejects a PR whose docs drift. Fixes that
belong to the template are upstreamed to `base-multiplayer-game` so the next game inherits them.

The reviewer table and the scripted review loop that runs these steps with the agent team
(`scripts/land-pr.sh`) are in `docs/TEAM.md`.

Branch names: `feat/<issue>-<slug>` / `fix/<issue>-<slug>`; PR body contains `Closes #N`.
Graphics PRs attach before/after screenshots; gameplay PRs list the balance values touched.

## 7. Scripts

| Script                           | Runs on   | Purpose                                                                                                                                                                                       |
| -------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/github-setup.sh`        | host      | Create/push the repo, labels, milestones, Project + views, ruleset, seed groundwork epics.                                                                                                    |
| `scripts/project-sync.sh`        | host/cont | Reconcile issues ↔ board (section 4).                                                                                                                                                         |
| `scripts/issue-status.sh`        | host/cont | `issue-status.sh <Status> <N> [N...]` — move tickets to a Status in two API calls.                                                                                                            |
| `scripts/pr-threads.sh`          | host/cont | `pr-threads.sh list\|unresolved\|state <PR>`; `reply <PR> actions.json` — read, summarise, and answer/resolve review threads in one request each.                                             |
| `scripts/agent.sh`               | host/cont | `agent.sh <role> [--ticket N] [--branch B] "<task>"` — run one team role headlessly inside the devcontainer (`docs/TEAM.md`).                                                                 |
| `scripts/worktree.sh`            | host/cont | `worktree.sh add\|remove <branch>` — one git worktree per branch under `.worktrees/` for parallel agents (`docs/TEAM.md`).                                                                    |
| `scripts/land-pr.sh`             | host/cont | `land-pr.sh <PR> [--reviewers "roles"]` — reviewer roles review, engineer fixes, re-review, then auto-merge (`docs/TEAM.md`).                                                                 |
| `scripts/resume-in-container.sh` | host/cont | Copy a Claude Code transcript under the other side's project key so `claude --resume <id>` continues the same conversation inside the devcontainer (or back on the host).                     |
| `scripts/sync-from-template.sh`  | host/cont | Pull template-owned files (scripts, devcontainer, process docs) from `base-multiplayer-game` into this game, re-applying its identity; land the diff via a PR.                                |
| `scripts/main-gate.sh`           | cont      | `main-gate.sh [--watch]` — the timed gate on `main` (section 5.1): `./validate.sh all` on `origin/main` in its own worktree when it moved; red logs the commits since the last green.         |
| `scripts/wait-for.sh`            | cont      | `wait-for.sh <output-file>` — block in the foreground until a background Bash task ends (exit 3: still running, call again); agents never go idle on their own running command (ticket #519). |
| `scripts/hooks/teammate-idle.py` | cont      | `TeammateIdle` hook: refuses an agent's idle while a background command it started is running or finished unread; logs to `.game-logs/teammate-idle.log` (ticket #519).                       |
| `scripts/deploy-main.sh`         | cont      | Redeploy the running stack from `origin/main` (once, or `--watch` as `./run.sh` starts it); refuses dirty checkouts, logs to `.game-logs/deploy.log`.                                         |
| `scripts/cpu-sampler.sh`         | cont      | `cpu-sampler.sh start\|stop\|status` — record every 10 s which worktree and kind (tests, typecheck, lint, ng serve, Chromium, claude…) uses the cores, to `.game-logs/cpu.csv` (ticket #521). |
| `scripts/cpu-report.sh`          | cont      | `cpu-report.sh [hours]` — the top CPU consumers over the last hours from `cpu.csv`: core-seconds, average cores and share by kind, by worktree and by both (ticket #521).                     |

`gh` needs the `repo` and `project` scopes (`gh auth refresh -h github.com -s project,read:project`).
