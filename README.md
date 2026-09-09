# Evolution

A reusable **multiplayer game template**: a working client/server multiplayer skeleton
(native WebSocket transport, lobby, rooms, a 60 Hz broadcast loop, reconnection/identity,
and MCP game-state visibility) whose actual **game definition is deferred**.

Everything except the game logic ships working today against a placeholder trust-client
"echo" game. The game-specific seams are clearly marked `// TODO(game)` / `// TODO(init)`
extension points, ready to be filled in.

## Create a game from this template

This repo is a working multiplayer skeleton (the placeholder "echo" game). Turning it into your own
game is two phases — **instantiate**, then **define & build** — in the steps below. Commands marked
_(host)_ run on your machine; everything else runs **inside the devcontainer**.

> **Driving this with an AI?** Point it at this section plus `init-game-prompt.md` — steps 5–6 are AI-led.

**1. Copy the template** _(host)_

```bash
cp -r evolution my-game && cd my-game
```

**2. Instantiate** — rename the template to your project _(host, once, before the container)_

```bash
./presetup.sh            # name = folder; or: ./presetup.sh my-game --title "My Game"
```

Rewrites package scope `@evolution` → `@my-game`, slug, display title, and the MCP server
name. Container/image/volume names auto-derive from the folder. Run it **before** the container so the
first install resolves the final scope.

**3. Start the devcontainer** _(host)_ — builds the image, installs deps, normalizes formatting

```bash
./dev-container.sh       # drops you into a shell at /workspace
```

**4. Verify the skeleton is green** (inside the container)

```bash
./validate.sh all        # lint + typecheck + test — all pass on a fresh copy
./run.sh                 # server 4400 + client 4402
```

Open two tabs at `http://localhost:4402` → Connect → Create → Join → Start; the snapshot JSON updates
as each tab sends input. Confirms transport, lobby, rooms, broadcast, and MCP all work.

**5. Define your game (AI-led)** — interview only, no code yet

```bash
claude "Read init-game-prompt.md and help me initialize my game"
```

Produces `init-game.md`: a concrete, build-ready plan (exact files, edits, and the game definition).

**6. Build your game** — execute `init-game.md`, filling the three extension points:

- **shared** — `packages/shared/src/types/messages.ts`: `GameInput` / `GameSnapshot` / `GameSessionConfig`
- **server** — `packages/server/src/game/game-module.ts`: game logic; wire the factory into `index.ts`; expose state via `DebugContext.getRoomGameState`
- **client** — `packages/client/src/app/game/game-setup.ts`: input loop + renderer

Re-run `./validate.sh all` and `./run.sh` as you iterate.

**7. (Optional) Publish via ha-router** — follow `ha-router/HA-ROUTER.md` (re-verify free ports first).

## What's included (working today)

- **Transport** — native WebSocket, `?clientId=` identity, multi-tab takeover, auto-reconnect.
- **Lobby + rooms** — create/join/start/delete games, late-join, disconnect grace, room teardown.
- **Broadcast loop** — per-room 60 Hz tick; server broadcasts `game_snapshot` to all clients.
- **MCP visibility** — a `/debug-mcp` endpoint (`evolution-debug`) exposing connections, performance,
  rooms, and game state to Claude Code.
- **Generic message envelope** — client sends `player_input { payload }`; server broadcasts
  `game_snapshot { snapshot }`. `GameInput` / `GameSnapshot` are the only types a game must define.
- **Dev tooling** — DinD devcontainer, `run.sh`, `validate.sh`, ESLint + Prettier, Vitest.

## Standards

This template ships three enforceable standards docs — read them before (and while) building:

- **[`ENGINEERING.md`](./ENGINEERING.md)** — coding, architecture, and testing rules. The single
  gate is `./validate.sh all`; includes a Definition of Done checklist.
- **[`ASSET-GENERATION.md`](./ASSET-GENERATION.md)** — the code-drawn visual asset quality bar
  (layered, shaded, animated, legible) with a per-asset checklist.
- **[`AUDIO-PIPELINE.md`](./AUDIO-PIPELINE.md)** — the opt-in music + voice + SFX pipeline with
  Google/Gemini as the default for both music and voice.

## Tech stack

- Node 24 LTS, pnpm 10
- TypeScript (strict)
- Fastify 5 + `@fastify/websocket` (server)
- Angular 21 (zoneless, standalone components) (client)
- `@modelcontextprotocol/sdk` for the debug MCP endpoint
- ESLint (angular-eslint + typescript-eslint) + Prettier, Vitest

## Monorepo layout

```
packages/shared   — message envelope, branded ids, game-defined type hooks (GameInput / GameSnapshot)
packages/server   — Fastify + WS server: lobby, rooms, 60Hz loop, /debug-mcp; game seam = src/game/game-module.ts
packages/client   — Angular client: WS service, identity, room browser; game seam = src/app/game/game-setup.ts
```

## Ports

- **4400** — game server (Fastify: REST API `/api` + WebSocket `/ws` + debug MCP `/debug-mcp`, single instance)
- **4402** — Angular dev server (proxies `/api`, `/ws`, `/debug-mcp` to the server)

## How to run

> **Run everything inside the devcontainer.** Open it from the host with `./dev-container.sh`,
> then run the commands below **inside** the container. All installs happen in the container —
> never `pnpm install` on the host. System tools belong in `.devcontainer/Dockerfile`.

```bash
pnpm install            # install workspace dependencies (inside the devcontainer)

./run.sh                # start server (4400) + Angular client (4402)
./run.sh --server-only  # start only the game server
./run.sh --client-only  # start only the Angular dev server
./run.sh --stop         # stop all running processes
./run.sh --status       # check what's running
./run.sh --logs         # tail server and client logs
```

Then open two browser tabs at the client to exercise the lobby → create → join → start →
`player_input` ↔ `game_snapshot` flow against the placeholder echo game.

### Validation

```bash
./validate.sh all       # lint + typecheck + test across all packages
./validate.sh test      # tests only
./validate.sh typecheck # type check only
./validate.sh lint      # eslint + prettier --check
```

### Dev container

```bash
./dev-container.sh          # start or attach to the DinD devcontainer
./dev-container.sh rebuild  # force rebuild
./dev-container.sh stop     # stop the container
```

## MCP visibility (`/debug-mcp`)

The server exposes an HTTP MCP endpoint (`evolution-debug`) at `http://localhost:4400/debug-mcp`
(configured in `.mcp.json`). Claude Code can inspect live state via tools such as:

- `debug_get_connections` — active WebSocket connections
- `debug_get_performance` / `debug_get_room_performance` — tick timing / broadcast telemetry
- `debug_list_games` / `debug_get_room` — lobby and room membership
- `debug_get_game_state` — the full game-state blob (wired up by your game via
  `DebugContext.getRoomGameState(gameId)`)

## ha-router integration

This template targets the local `ha-router` Traefik reverse proxy. Ready-to-copy integration
artifacts live under `ha-router/` (`route.template.yml` and `landing-card.html`);
see **`ha-router/HA-ROUTER.md`** for how to wire the game into ha-router (route config, host slug,
landing-page card). Final slug, ports, and icon hue are chosen during the init step.

## Trust model

**LOCAL-ONLY play.** Client-side trust where convenient — we do not care about security or
cheating. Prefer simplicity over anti-cheat.
