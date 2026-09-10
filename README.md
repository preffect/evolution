# Evolution

> **Status: designed, not yet built.** Evolution still runs the template's placeholder **echo**
> game. The design is in [`docs/GAME-DESIGN.md`](./docs/GAME-DESIGN.md) (index of `GDD.md`,
> `ECOLOGY.md`, `PROGRESSION.md`, `TRAITS.md`) and the build plan in [`init-game.md`](./init-game.md);
> groundwork and build phases are GitHub epics (see [`WORKFLOW.md`](./WORKFLOW.md)).
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
  (Traefik route + landing card in the ha-router repo; per-host DNS record required —
  `ha-router/HA-ROUTER.md`).

## How work happens

- **[`WORKFLOW.md`](./WORKFLOW.md)** — GitHub issues, the project board, the waiting-on-human
  rule, PR + review rules, keeping docs in sync. Scripts: `scripts/project-sync.sh`,
  `scripts/issue-status.sh`, `scripts/github-setup.sh`.
- **[`ENGINEERING.md`](./ENGINEERING.md)**, **[`ASSET-GENERATION.md`](./ASSET-GENERATION.md)**,
  **[`AUDIO-PIPELINE.md`](./AUDIO-PIPELINE.md)** — the quality bar every PR is held to.
- **[`init-game-prompt.md`](./init-game-prompt.md)** → `init-game.md` — how the game gets defined.

## Layout

`packages/shared` (types, constants), `packages/server` (Fastify + WS + MCP), `packages/client`
(Angular). Game extension points are marked `// TODO(game)` / `// TODO(init)`; see `CLAUDE.md`.
