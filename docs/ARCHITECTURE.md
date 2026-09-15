# Evolution — Architecture

The technical contract the Build 1 tickets (#97–#103) implement. It is the structural companion
of the design: every rule, number and scenario is owned by [`GAME-DESIGN.md`](./GAME-DESIGN.md)
and its companions ([`ECOLOGY.md`](./ECOLOGY.md), [`PROGRESSION.md`](./PROGRESSION.md),
[`TRAITS.md`](./TRAITS.md)); the build plan is the Build 1 epic (#96). This document decides
only **structure**: where state lives, the simulation pipeline, the wire contract, the client
module plan, the debug surface and the file plan. Engineering rules:
[`ENGINEERING.md`](./ENGINEERING.md); coding rules: [`CODE-STANDARDS.md`](./CODE-STANDARDS.md);
seeds, clock, ordering and hashing: [`DETERMINISM.md`](./DETERMINISM.md).

```text
 browser (Angular 21 + Pixi v8)             server (Fastify + ws)
 ┌──────────────────────────────┐          ┌──────────────────────────────┐
 │ input ─► GameInput (60 Hz) ──┼── ws ───►│ router ─► GameRoom           │
 │                              │          │   60 Hz stepWorld()          │
 │ world-store ◄─ snapshots ◄───┼── ws ◄───│   serializeRoomState() delta │
 │  (20 Hz, every 3rd tick)     │          │   every SNAPSHOT_EVERY_TICKS │
 │  ├ interpolation (remote)    │          │ MCP /debug-mcp ─► DebugContext│
 │  └ prediction (own cell)     │          └──────────────────────────────┘
 │ Pixi scene ◄─ view registry  │          shared: types, constants, balance,
 │ HUD (Angular signals)        │                  random, movement kernel, hash
 └──────────────────────────────┘
```

## Files

This document is split into topic files (#306). Read only the file a ticket or brief cites.

| File                                                                               | Sections | Topic                                         |
| ---------------------------------------------------------------------------------- | -------- | --------------------------------------------- |
| [`architecture/entity-model.md`](./architecture/entity-model.md)                   | §1–§2    | Decisions and the entity model                |
| [`architecture/server-simulation.md`](./architecture/server-simulation.md)         | §3       | Server simulation                             |
| [`architecture/wire-contract.md`](./architecture/wire-contract.md)                 | §4       | Wire contract                                 |
| [`architecture/client.md`](./architecture/client.md)                               | §5–§7    | Client networking, module plan and audio seam |
| [`architecture/debug-mcp.md`](./architecture/debug-mcp.md)                         | §8       | Debug MCP surface                             |
| [`architecture/constants-files-tests.md`](./architecture/constants-files-tests.md) | §9–§11   | Constants, file plan and test plan            |
| [`architecture/encyclopedia.md`](./architecture/encyclopedia.md)                   | §12      | Encyclopedia content model and preview seam   |
