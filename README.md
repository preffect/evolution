# Evolution

> **Status: designed, not yet built.** Evolution still runs the template's placeholder **echo**
> game. The design is [`docs/GAME-DESIGN.md`](docs/GAME-DESIGN.md) with companions `ECOLOGY.md`,
> `PROGRESSION.md` and `TRAITS.md`; architecture in `docs/ARCHITECTURE.md`. Build phases are GitHub
> epics (see [`docs/WORKFLOW.md`](docs/WORKFLOW.md)); build 1 is epic #96.
> Scaffolded from the `base-multiplayer-game` template; template-level fixes go upstream there.

**The game:** you are a single-cell organism in a 2D petri dish. Eat to grow, absorb DNA from
what you eat, and choose traits as you level up. Cells wobble and wibble with soft-body membranes.
Later: engulf and absorb other cells, and grow into multi-cell organisms. Multiplayer, free-for-all
and co-op.

Multiplayer client/server game: Angular client, Fastify + WebSocket server, a 60 Hz snapshot
loop, lobby/rooms/reconnect, and a debug MCP endpoint for agents. Details in
[`CLAUDE.md`](./CLAUDE.md).

## Run it

Everything runs **inside the devcontainer**; ports come from `PORTS.env`.

```bash
./dev-container.sh          # host: build/start + attach (DEVCONTAINER_YES=1 for non-interactive)
./validate.sh all           # container: lint + typecheck + test — builds packages/shared first
./run.sh                    # container: server + client (see PORTS.env for the ports)
```

- Local: `http://localhost:<CLIENT_PORT>` — public: `https://evolution.preffect-ha.preffect-home.net`
  (Traefik route + landing card in the ha-router repo; per-host DNS record required — see
  that repo's `HA-ROUTER.md`).

## How work happens

- **[`docs/WORKFLOW.md`](docs/WORKFLOW.md)** — GitHub issues, the project board, the waiting-on-human
  rule, PR + review rules, keeping docs in sync. Scripts: `scripts/project-sync.sh`,
  `scripts/issue-status.sh`, `scripts/pr-threads.sh`, `scripts/github-setup.sh`; the agent team in
  **[`docs/TEAM.md`](docs/TEAM.md)**.
- **[`docs/ENGINEERING.md`](docs/ENGINEERING.md)**, **[`docs/ASSET-GENERATION.md`](docs/ASSET-GENERATION.md)**,
  **[`docs/AUDIO-PIPELINE.md`](docs/AUDIO-PIPELINE.md)** — the quality bar every PR is held to.
- **[`docs/INIT-GAME.md`](docs/INIT-GAME.md)** — how the game gets defined (`docs/GAME-DESIGN.md` + the first build epic).

## Layout

`packages/shared` (types, constants), `packages/server` (Fastify + WS + MCP), `packages/client`
(Angular). Game extension points are marked `// TODO(game)` / `// TODO(init)`; see `CLAUDE.md`.
