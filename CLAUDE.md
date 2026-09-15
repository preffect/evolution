# Evolution — Claude Code Guidance

> # 🟢 START HERE — is this game defined yet?
>
> **If this game has NOT been defined yet** — it was just scaffolded with `new-game.sh`,
> gameplay is still the placeholder **echo** game, and **`docs/GAME-DESIGN.md` does not exist** —
> then your **FIRST action in this session, before anything else**, is:
>
> 👉 **Read [`docs/INIT-GAME.md`](./docs/INIT-GAME.md) and follow it.**
>
> It interviews the user about the game, then produces `docs/GAME-DESIGN.md` and the game's first
> build epic + tickets on GitHub (planning lives in issues, not in files). **Do NOT start
> editing game source files yet.** When it is done it removes itself and this banner.

> **Build environment — work INSIDE the devcontainer.** Assume every command here (and in
> any helper prompt such as `docs/INIT-GAME.md`) runs inside the
> devcontainer. Open it from the host with `./dev-container.sh`. **All dependency installs
> (`pnpm install`, `./run.sh --install`) happen in the container — never install on the host.**
> System tools belong in `.devcontainer/Dockerfile`; project deps go in the workspace via pnpm.

## Commands

### Validation (always use `./validate.sh` instead of running tools directly)

```bash
./validate.sh test                    # unit tests with coverage thresholds (vitest for shared/server, ng test for client)
./validate.sh integration             # the *.integration.test.ts / *.integration.spec.ts tier plus the *.gameplay.test.ts scenarios (opt-in; not part of the plain `all`)
./validate.sh typecheck               # type check all packages
./validate.sh lint                    # eslint + prettier --check + eslint-disable / TODO audit
./validate.sh duplication             # jscpd duplicate-code gate (.jscpd.json)
./validate.sh all                     # lint, duplication, typecheck, test in sequence; stops at the first red phase
./validate.sh all --affected          # the merge gate (once, by whoever merges): only what the branch changed vs origin/main, then its integration tier; refuses a branch behind origin/main (merge it first)
./validate.sh test --scope server     # build loop: one package (shared|server|client), coverage floor kept
./validate.sh test --scope packages/server/src/game/world   # build loop: only that path's tests, no coverage floor

# Output filters (work with any command):
./validate.sh test -t20               # show last 20 lines
./validate.sh typecheck -h50          # show first 50 lines
./validate.sh lint -G 'error'         # grep output for pattern
./validate.sh integration --scope server -- ecology   # extra args reach one package's runner (a vitest file filter; never cached)
./validate.sh integration --scope client -- app.integration   # the client: a spec path filter, passed as --include; options as --option=value
./validate.sh all --fresh             # ignore the content-addressed result cache (docs/engineering/validation-gate.md §1)
```

A fresh worktree needs no setup: before a real run `./validate.sh` runs `pnpm install --frozen-lockfile`
when `node_modules` does not match `pnpm-lock.yaml`, and builds `@evolution/shared` when its `dist` is
missing or older than its sources (`scripts/lib/workspace-ready.sh`); `./run.sh` and the deploy do the same,
`./run.sh` before it stops the running stack. The setup holds a per-checkout lock (never the machine-wide
gate lock), waiting at most `WORKSPACE_SETUP_LOCK_TIMEOUT_SECONDS` (300) before failing. For `test` and
`integration`, `-- extra args` need a one-package `--scope`; give file filters before options, since a word
after an option written with a space is its value. A filtered (`-- <file filter>`, `-t`, `--testNamePattern`,
`--filter`) or path-scoped `test` has no coverage floor. A scoped `lint` also prettier-checks the docs (`*.md` outside
`packages/`) the branch changed against `origin/main`. A real run takes a machine-wide slot of its phase's class
(`scripts/lib/gate-lock.sh`): heavy for `test`, `integration` and `typecheck` (one per 4 cores), light for `lint` and
`duplication` (one per 2 cores), so a lint never queues behind a test run; a wait prints who holds the slots (pid,
worktree, command).

### Running the dev servers

```bash
./run.sh                # start server (4400) + Angular client (4402)
./run.sh --server-only  # start only the game server
./run.sh --client-only  # start only the Angular dev server
./run.sh --stop         # stop all running processes
./run.sh --status       # check what's running
./run.sh --logs         # tail the server, client and deploy logs
./run.sh --install      # run pnpm install before starting
./run.sh --no-deploy-watch   # start without the deploy watcher (below)
scripts/deploy-main.sh  # redeploy the MAIN checkout (/workspace, the human's game) from origin/main once, even when run from a worktree
```

`./run.sh` also starts `scripts/deploy-main.sh --watch` for its own checkout: it polls `origin/main`
every 60 s and redeploys on every merge — fast-forward, the workspace setup (`pnpm install` when
`node_modules` does not match the lockfile, the shared build when stale), then `./run.sh --clear-prebundle --wait-ready` in the mode and ports the stack was started
with (the Angular prebundle is deleted between stop and start, since a stale one breaks new shared
exports; the deploy counts only once the server and client listen again). A one-shot
`scripts/deploy-main.sh` restarts the same way and starts the watcher if none is running. Hard-refresh
the browser afterwards. Only a checkout on `main` tracking `origin/main`, without tracked changes, that
can fast-forward is deployed (a watcher anywhere else stops); every step goes to
`.game-logs/deploy.log`; `./run.sh --stop` stops the watcher.

### Headless bots (`docs/testing/bots-and-design-tables.md` §8.3)

```bash
pnpm --filter @evolution/server bot-client --game <id> --bots 4 --strategy grazer --seed 42   # over the wire
# in-process: debug_spawn_bot / debug_remove_bot on the debug MCP
```

### Dev container

```bash
./dev-container.sh          # start or attach to container
./dev-container.sh rebuild  # force rebuild (DEVCONTAINER_YES=1 to confirm non-interactively)
./dev-container.sh stop     # stop the container
./dev-container.sh status   # show container status
```

## Project workflow (GitHub issues, board, reviews)

**Planning lives in GitHub issues** — epics, tickets, roadmaps, task lists. Files under `docs/`
hold what is decided (design, architecture, standards, process), never what is planned; a
document with a to-do list in it is a ticket that was filed in the wrong place.

**[`docs/WORKFLOW.md`](docs/WORKFLOW.md)** is the single source of truth: tickets + labels on GitHub Issues,
stage on the linked Project board, epics as sub-issues, **assignee = waiting on the human**
(`pending` label + `Blocked`), PR required with **reviewers run on every PR and every review
thread resolved before merge**, labels updated as tickets complete. Everything is done via the
API — the human never clicks in GitHub's UI. Helpers: `scripts/project-sync.sh` (run at session
start), `scripts/issue-status.sh <Status> <N...>`, `scripts/pr-threads.sh` (batched review threads), `.github/PULL_REQUEST_TEMPLATE.md` (review checklist).
**Human dial: 2 (Consulted)** from milestone M2 First playable onward (M0/M1 ran at 1) — taste,
direction and scope questions are posed to the human as decision tickets with options and mockups;
see `docs/TEAM.md`.
**[`docs/TEAM.md`](docs/TEAM.md)** defines the agent roles (`.claude/agents/`, spawned with the Agent tool in
session, or headlessly with `scripts/agent.sh`) and the scripted review loop (`scripts/land-pr.sh`).

## Toolchain inside the devcontainer

Node 24, pnpm 10, Claude Code, `gh` (authenticated via the mounted host `~/.config/gh`), git
(pushes over HTTPS with `gh` as credential helper — no SSH key inside; identity from the host's
gh account unless the container already has one), python3, jq, ripgrep, ImageMagick, ffmpeg, and
Playwright Chromium for the `playwright` MCP (`.mcp.json`), rsvg-convert + DejaVu fonts for SVG
rendering; the template checkout is mounted at `/base-multiplayer-game` so template-first fixes and
`scripts/sync-from-template.sh` work inside too. A host conversation continues inside with
`scripts/resume-in-container.sh`. Improvements to the container or the
process belong upstream in `base-multiplayer-game` so the next game inherits them.

## Standards & guidelines

These docs are the enforceable quality bar for any work in this repo. Do not read them front to back: look up
the file you need and read only the spec files your ticket or brief cites (its **Spec files:** line). The large
design and standards docs are split into topic files under `docs/<domain>/` (`ecology`, `architecture`, `rendering`,
`ui`, `traits`, `game-design`, `visual-style`, `testing`, `engineering`, `determinism`); each old `docs/<NAME>.md` lists its files, and `docs/INDEX.md` lists every heading of
every file with its line range (git-ignored, generated on demand by `scripts/docs-index.sh`: `scripts/worktree.sh add`,
the workspace setup and the shared git hooks refresh it when a doc is newer).

- **[`docs/ENGINEERING.md`](docs/ENGINEERING.md)** — coding, architecture, and testing rules. The single
  gate is **`./validate.sh all`** (lint + duplication + typecheck + test): builders and reviewers run scoped
  checks (`--scope`), and whoever merges runs `./validate.sh all --affected` once, right before the merge; never run the underlying tools directly; never commit red. All new logic needs unit tests;
  cross-subsystem wiring needs `*.integration.test.ts`. See its **Definition of Done** checklist.
- **[`docs/TESTING.md`](docs/TESTING.md)** — the testing bar: unit / integration / gameplay / UI
  tiers, naming and placement, `src/testing/` builders, the coverage floors `./validate.sh test`
  enforces, the flaky-test policy.
- **[`docs/CODE-STANDARDS.md`](docs/CODE-STANDARDS.md)** — the lint-enforced coding rules:
  no magic values (and where every constant/enum/config value lives), no duplicated logic, SOLID,
  size limits, full descriptive names, error handling, test placement.
- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — entity model, simulation pipeline, wire
  contract, client module plan, debug MCP surface, file plan. **[`docs/DETERMINISM.md`](docs/DETERMINISM.md)**
  — seeded random streams, injected clock, fixed step, stable ordering, state hash, replay.
- **[`docs/ASSET-GENERATION.md`](docs/ASSET-GENERATION.md)** — visual asset quality bar. All visual assets
  are code-drawn (zero bitmaps); every player/monster/item is layered, shaded, palette-disciplined,
  animated, and silhouette-legible. "It renders" is not done — meet the per-asset checklist.
- **[`docs/AUDIO-PIPELINE.md`](docs/AUDIO-PIPELINE.md)** — the opt-in music + voice + SFX pipeline.
  **Google/Gemini is the default** for both music (Lyria) and voice (Chirp). `./ai-pipeline.sh check`
  is offline; `sync` spends money and never runs unsolicited.
- **[`docs/AUDIO.md`](docs/AUDIO.md)** — the sound design (decision #140, option B "living broth"): the
  event catalogue with priorities and cooldowns, the layering per ladder stage, the asset manifest and
  the client audio seam.

> **The gate:** scoped checks green after each change, and `./validate.sh all --affected` green on the
> final head, run once by whoever merges (`docs/engineering/validation-gate.md` §1); the Definition of Done in
> `docs/engineering/conventions-and-done.md` §6 must hold, and any new visual/audio asset must meet its doc's criteria.

## Architecture

Built from the base-multiplayer-game template: client/server, native WebSocket multiplayer, MCP game-state visibility. The generic multiplayer/lobby/room/connection/MCP plumbing is provided and working; game logic lives in the extension points below (`// TODO(game)` / `// TODO(init)` until the init step fills them).

### Monorepo Structure

pnpm monorepo with three packages:

- **`packages/shared`** — Shared types, constants, and logic (message envelope, branded ids, the game contract: `types/game.ts` views, `types/messages.ts` seams, `constants/<domain>.ts` tunables assembled into `DEFAULT_BALANCE`, `simulation/` pure formulas). Pure TypeScript, no framework dependencies. Used by both server and client.
- **`packages/server`** — Fastify + WebSocket game server. Handles multiplayer coordination (lobby, rooms, the 60Hz broadcast loop) and exposes a debug MCP endpoint at `/debug-mcp`. The single game seam is `src/game/game-module.ts` (`defaultGameModuleFactory` ships a trust-client echo). No persistence by default.
- **`packages/client`** — Angular 21 application. Zoneless by default. Proxies `/api`, `/ws`, and `/debug-mcp` to the server via `proxy.conf.json`. The client game seam is `src/app/game/game-setup.ts`.

### Game extension points (left as TODOs)

- **Shared:** done (#97): `packages/shared/src/types/messages.ts` — `GameInput`, `GameSnapshot`, `GameSessionConfig`; `data/balance.json` is generated (`pnpm generate:balance`) and pinned by `balance.test.ts`.
- **Server:** done (#152): `packages/server/src/game/evolution-module.ts` is the `GameModule` on the simulation under `src/game/{world,simulation,progression,session,serialize,replay,debug}` (docs/architecture/server-simulation.md §3, docs/architecture/constants-files-tests.md §10); `src/index.ts` wires `evolutionModuleFactory`. The echo module in `game-module.ts` stays as the template placeholder the framework's proving scenarios run on. Engulf and the wild cells are the next #98 slices.
- **Client:** `packages/client/src/app/game/game-setup.ts` — the game loop + renderer.
- **Init:** see `docs/INIT-GAME.md` to interview the user and produce `docs/GAME-DESIGN.md` + the first build epic.

### Trust model

LOCAL-ONLY play. Client-side trust where convenient — we do NOT care about security or cheating; prefer simplicity over anti-cheat.

### Ports

This game's ports are **pre-selected on the host** by `new-game.sh` (verified free against
both the host and the live `ha-router` config) and recorded in **`PORTS.env`** at the repo
root — read that file for the authoritative `SERVER_PORT` / `CLIENT_PORT`. Do **not** pick or
change ports inside the container; they are already baked into the integration files.

- **`SERVER_PORT`** (template default **4400**) — Game server (Fastify: REST API + WebSocket + debug MCP)
- **`CLIENT_PORT`** (template default **4402**) — Angular dev server (proxies to server)

### Tech Stack

- Node 24 LTS, pnpm 10
- Angular 21 (zoneless, standalone components, vitest)
- Fastify 5 + @fastify/websocket
- TypeScript strict mode
- ESLint (angular-eslint + typescript-eslint) + Prettier
- Vitest for testing

### Style Guide

- ESLint with angular-eslint for Angular-specific rules
- Prettier: 2-space indent, single quotes, trailing commas, semicolons, 120 char width
- TypeScript strict: noUnusedLocals, noUnusedParameters, noUncheckedIndexedAccess, verbatimModuleSyntax
- See **`docs/ENGINEERING.md`** for the full enforceable TS/lint/testing/architecture standards.

### MCP Servers

- **evolution-debug** — HTTP MCP endpoint on the game server (`http://localhost:4400/debug-mcp`). Generic
  tools: game state (`debug_get_game_state`, `debug_list_games`, `debug_get_room`), player connections
  (`debug_get_connections`), performance (`debug_get_performance`, `debug_get_room_performance`).
  Game-specific tools (`docs/architecture/debug-mcp.md` §8 is the contract; the Evolution module implements every
  capability, the echo only the bot pair, and a missing one answers "not supported by this game module"): inspect `debug_get_entities(gameId, kind?, bbox?)`,
  `debug_get_player_progress(gameId, playerId)`, `debug_get_state_hash(gameId)`, `debug_get_balance(gameId)`,
  `debug_export_replay(gameId)`; manipulate `debug_spawn(gameId, kind, x, y, params)`,
  `debug_grant_dna(gameId, playerId, dna, tags?)`, `debug_set_player(gameId, playerId, mass?, level?, traits?, position?)`,
  `debug_set_seed(gameId, seed)`, `debug_set_balance(gameId, patch)`; freeze the loop for deterministic screenshots
  with `debug_pause_room(gameId)`, `debug_step_room(gameId, ticks)`, `debug_resume_room(gameId)` (these work with
  every module); populate a room with `debug_spawn_bot(gameId, behavior, seed?, preyPlayerId?)` /
  `debug_remove_bot(gameId, playerId)` (`idle` | `wander` | `grazer` | `hunter`, `docs/testing/bots-and-design-tables.md` §8.3)
- **angular** — Angular's built-in MCP server for component introspection and development assistance
- **playwright** — headless Chromium (`@playwright/mcp`, installed in the image) for QA / graphics roles to drive and screenshot the running game; screenshots land in `.qa/screenshots/`
