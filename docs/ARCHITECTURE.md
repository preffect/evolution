# Evolution — Architecture

The technical contract the build tickets (#97–#103) implement. One fact, one home: rules of
engineering live in [`ENGINEERING.md`](../ENGINEERING.md), coding rules in
[`CODE-STANDARDS.md`](./CODE-STANDARDS.md), the determinism contract in
[`DETERMINISM.md`](./DETERMINISM.md), gameplay numbers in the GDD (`docs/GAME-DESIGN.md`, #22)
and `data/balance.json`. This document only decides **structure**: entities, the simulation
pipeline, the wire contract, the client module plan, the debug surface and the file plan.

```text
 browser (Angular 21 + Pixi v8)             server (Fastify + ws)
 ┌──────────────────────────────┐          ┌──────────────────────────────┐
 │ input ─► GameInput ──────────┼── ws ───►│ router ─► GameRoom           │
 │                              │          │   60 Hz stepSimulation()     │
 │ world-store ◄─ snapshots ◄───┼── ws ◄───│   20 Hz serializeRoomState() │
 │  ├ interpolation (remote)    │          │ MCP /debug-mcp ─► DebugContext│
 │  └ prediction (own cell)     │          └──────────────────────────────┘
 │ Pixi scene ◄─ view registry  │          shared: types, constants, random,
 │ HUD (Angular signals)        │                  movement kernel, state hash
 └──────────────────────────────┘
```

## 1. Decisions (the short list)

| Decision                        | Choice                                                              |
| ------------------------------- | ------------------------------------------------------------------- |
| Simulation rate / snapshot rate | 60 Hz fixed step / every 3rd tick (20 Hz) broadcast                 |
| Authority                       | Server owns position, mass, traits, engulf state, spawns, scoring   |
| Client-side cosmetic            | Membrane wobble, food bobbing, particles; never fed back            |
| Renderer (#33, closed)          | WebGL via **Pixi v8**; benchmark numbers land in the renderer PR    |
| Food on the wire                | Full list on join, then spawned/removed deltas (motes do not move)  |
| Interest management             | v1 broadcasts one snapshot to all; viewport culling is a held lever |
| Client prediction               | Own cell predicted with the shared movement kernel, reconciled      |
| Randomness / time               | Seeded streams and an injected clock only (`DETERMINISM.md`)        |
| Trust model                     | Local-only, client trusted; engulf resolved server-side             |

## 2. Entity model (`packages/shared/src/types/entities.ts`)

Entities are plain data. Behaviour lives in systems (section 3), never in entity methods.
Ids come from a per-room monotonic counter (`cell-17`), never from randomness.

```ts
export const ENTITY_KIND = { cell: 'cell', foodMote: 'foodMote', dnaFragment: 'dnaFragment' } as const;
export type EntityKind = (typeof ENTITY_KIND)[keyof typeof ENTITY_KIND];

export interface Cell {
  id: EntityId;
  ownerPlayerId: PlayerId | null; // null = NPC (reserved for Phase 3)
  position: Vec2;
  velocity: Vec2;
  mass: number; // radius is derived: radiusForMass(mass) in shared/simulation/mass-curves.ts
  traitIds: readonly TraitId[];
  engulf: EngulfState | null; // predator side of an engulf in progress
  splitCooldownTicks: number;
  mergeBackTick: Tick | null;
}
export interface EngulfState {
  preyId: EntityId;
  progress: number; // 0..1, advances per tick; prey may escape (#27)
}
export interface FoodMote {
  id: EntityId;
  kind: FoodKindId; // data/balance.json food kinds (algae, bacteria, detritus)
  position: Vec2; // motes are stationary on the server; drift is client cosmetic
  nutrientMass: number;
  dnaTagIds: readonly DnaTagId[];
}
export interface DnaFragment {
  id: EntityId;
  position: Vec2;
  dnaAmount: number;
  dnaTagIds: readonly DnaTagId[];
  expiresAtTick: Tick;
}
export interface PlayerState {
  playerId: PlayerId;
  playerName: string;
  avatarIndex: number;
  cellIds: readonly EntityId[]; // several after mitosis
  level: number;
  dnaTotal: number;
  dnaTagCounts: Readonly<Record<DnaTagId, number>>; // weights the trait draft (#24)
  traitOffer: readonly TraitId[] | null; // pending level-up choice, auto-picked on timeout
  respawnAtTick: Tick | null;
  score: ScoreBreakdown; // mass peak, dna, absorptions (#29)
}
```

Reserved, not built in Build 1: `Organism` (bonded cells, Phase 4), `Npc` (Phase 3), `Bond`;
they enter `ENTITY_KIND` only when their ticket lands.

`SimulationState` (server, `simulation/simulation-state.ts`) holds `tick`, `cells: Cell[]`,
`foodMotes: FoodMote[]`, `dnaFragments: DnaFragment[]`, `players: PlayerState[]`,
`nextEntityNumber`, `session: SessionState` and the random streams. Every collection is an
array in insertion order (`DETERMINISM.md` §4). Membrane vertices, wobble phase and
particle state do **not** exist on the server.

## 3. Server simulation

`EvolutionGameModule` implements the template's `GameModule` seam and stays thin: it queues
inputs, calls `stepSimulation`, and serialises. All decision logic is in pure systems.

```text
 stepSimulation(state, queuedInputs, context) -> { state, events }
   1 applyInputs      inputs drained per player in join order, then by sequence
   2 movement         shared movement kernel (steer toward target, mass -> speed, drag, wall)
   3 rebuildSpatialHash   derived, rebuilt every tick (≤ 2 000 entities: cheaper than upkeep)
   4 eating           cell ∩ food / dna within radius -> mass, dna, events
   5 absorption       engulf start / progress / escape / resolve (#27 state machine)
   6 growthAndDecay   mass decay, radius cap, split cooldown, merge-back
   7 progression      dna thresholds -> level-up -> trait offer -> timed default pick
   8 ecology          seeded spawner per zone with caps (#23)
   9 respawn          dead players respawn at the seeded safe spot after the timer (#29)
  10 session          round clock, leaderboard, round end
```

- **Fixed step.** `context.deltaSeconds` is always `TICK_DURATION_SECONDS`. The wall clock
  never enters a system; `GameRoom` drives the step from an injected `Clock` + `Ticker`
  through a `FixedStepAccumulator` (`DETERMINISM.md` §2).
- **Systems** are `(state, context) => void` functions that mutate only the draft they receive
  and push `GameEvent`s onto `context.events`. They import formulas from `packages/shared`
  and read tunables from `context.balance`, never from module scope.
- **Spatial hash** (`simulation/spatial-hash.ts`): uniform grid, cell size
  `SPATIAL_HASH_CELL_SIZE_UNITS` (≈ largest common radius × 2). Queries: `queryCircle`,
  `queryPairs`. Results are returned sorted by entity id so callers stay order-stable.
- **Absorption is server-only.** The client never resolves engulf, eating or death; it only
  animates the states it is told about.
- **Perf budget** (measured by `PerfTracker`, gated in #103): step ≤ 4 ms p95 and serialise
  ≤ 2 ms p95 at 8 players, 32 cells, 1 000 motes, 100 fragments; tick never skipped in
  steady state (`MAX_TICKS_PER_ADVANCE` guards catch-up after a stall).

## 4. Wire contract (`packages/shared/src/types/messages.ts`)

Validated on the server in `ws/message-schemas.ts` (Zod) before any handler sees it.
Message type strings are the `CLIENT_MESSAGE_TYPE` / `SERVER_MESSAGE_TYPE` const objects, never
bare literals (`CODE-STANDARDS.md` §2).

```ts
export interface GameInput {
  sequence: number; // monotonic per client; server echoes the last one it applied
  target: Vec2; // world-space point the cell steers toward (pointer follow)
  actions: readonly GameInputAction[]; // one-shot; applied once, deduped by sequence
}
export type GameInputAction =
  | { type: 'split' }
  | { type: 'eject' }
  | { type: 'chooseTrait'; traitId: TraitId }
  | { type: 'bond'; targetCellId: EntityId }; // reserved for Phase 4; rejected in Build 1

export interface GameSessionConfig {
  maxPlayers: number;
  mode: SessionModeId; // 'ffa' in Build 1; 'coop' reserved
  worldRadiusUnits: number;
  roundDurationSeconds: number;
  seed: number; // lobby fills it when the create request omits it; shown in the HUD/MCP
}
export type GameSessionConfigRequest = Omit<GameSessionConfig, 'seed'> & { seed?: number };

export interface GameSnapshot {
  tick: Tick;
  baseTick: Tick | null; // tick of the previous snapshot the food delta builds on; null = full
  cells: readonly CellSnapshot[];
  dnaFragments: readonly DnaFragment[];
  food: FoodDelta; // { spawned: FoodMote[]; removedIds: EntityId[] }; full list when baseTick is null
  players: readonly PlayerState[];
  leaderboard: readonly LeaderboardEntry[];
  events: readonly GameEvent[]; // eat, dnaAbsorbed, levelUp, engulfStarted, absorbed, died, respawned
  session: SessionSnapshot; // phase, secondsRemaining, roundNumber
  lastProcessedInputSequence: Readonly<Record<PlayerId, number>>;
}
export interface CellSnapshot {
  id: EntityId;
  ownerPlayerId: PlayerId | null;
  position: Vec2; // numbers quantised to SNAPSHOT_DECIMALS by the encoder
  velocity: Vec2;
  radius: number;
  mass: number;
  level: number;
  traitIds: readonly TraitId[];
  engulf: EngulfState | null;
  contactIds: readonly EntityId[]; // touching cells, for client-side membrane dents
}
```

- **`game_state`** (join, late join, reconnect) carries a **full** snapshot (`baseTick: null`,
  `food.spawned` = every mote) plus `balance: BalanceConfig` so the client renders with the
  same numbers the server simulates. **`game_snapshot`** carries deltas. WebSocket is ordered
  and reliable, so deltas need no ack; if `baseTick` does not match the client's last tick the
  client sends `request_full_state` and the server replies with `game_state`.
- **New messages:** server `balance_updated { balance }` (hot reload) and the `balance` field
  on `game_state`; client `request_full_state`. Trait offers are not a message: they live in
  `players[].traitOffer`. `player_input.payload` becomes the `GameInput` schema, sent at
  `INPUT_SEND_HZ` (30) and on every action.
- **`GameModule` seam additions:** `serializeFullState()` for `game_state`, and
  `getDebugHandle()` for the MCP tools (section 8). `RoomInitArgs.config` becomes the resolved
  `GameSessionConfig`; the factory also receives `{ random, clock, balance }`.

### 4.1 Bandwidth budget

Population targets: 8 players, ≤ 32 cells (splits), ≤ 1 000 motes, ≤ 100 fragments.

| Snapshot part (20 Hz)      | Count × bytes (JSON) | Per snapshot |
| -------------------------- | -------------------- | ------------ |
| cells                      | 32 × ~110            | ~3.5 KB      |
| players + leaderboard      | 8 × ~120 + 8 × ~40   | ~1.3 KB      |
| food delta + dna fragments | ~5 × 40 + ~10 × 60   | ~0.8 KB      |
| events + session + header  |                      | ~0.4 KB      |
| **total**                  |                      | **≈ 6 KB**   |

Budget: **≤ 6 KB raw per snapshot, ≤ 120 KB/s raw per client** (≈ 40 KB/s after
`perMessageDeflate`, already enabled); 8 clients ≈ 1 MB/s raw server egress, fine on LAN.
Without food deltas the same snapshot would be ~35 KB, which is why deltas are mandatory.
`PerfTracker.snapshotBytes` is the measurement; #103 records it. **Held lever:** if the budget
is exceeded, add viewport culling by giving `serializeRoomState(viewerPlayerId)` a bounding box
(camera extent + `INTEREST_MARGIN_UNITS`) and sending per-player snapshots.

## 5. Client networking policy (`packages/client/src/app/game/net/`)

- **Interpolation.** `SnapshotBuffer` keeps the last `SNAPSHOT_BUFFER_SIZE` (4) snapshots and
  renders remote entities at `renderTick = latestTick − INTERPOLATION_DELAY_TICKS` (2 snapshot
  intervals = 100 ms), lerping position, velocity and radius between the bracketing snapshots.
  Missing bracket (stall) → extrapolate with velocity for at most `MAX_EXTRAPOLATION_TICKS`.
- **Prediction.** The own cell runs the shared movement kernel each client frame from the last
  authoritative state, replaying inputs newer than `lastProcessedInputSequence[me]`. Mass,
  radius, traits, engulf and death are never predicted.
- **Reconciliation.** On each snapshot the predicted position is compared with the server one;
  differences under `RECONCILE_SNAP_DISTANCE_UNITS` blend out over `RECONCILE_BLEND_SECONDS`,
  larger ones snap. `WorldStore` is the single client model that HUD and renderer read.
- **Clock.** The client keeps `serverTickEstimate` from snapshot arrival times (EMA); nothing in
  the client simulation reads `Date.now` directly (`DETERMINISM.md` §2 applies to the
  cosmetic streams too, for screenshot reproducibility).

## 6. Client module plan (Pixi v8 + Angular)

```text
 Angular <app-game> host component
   └─ game-setup.ts (composition root, < 100 lines): wires net, input, render, hud, audio
 Pixi Application (one canvas, resolution = devicePixelRatio)
   stage
   ├─ dishLayer      background, zones, vignette (static, cached as render texture)
   ├─ foodLayer      FoodMoteView (ParticleContainer), DnaFragmentView
   ├─ cellLayer      CellView: MembraneMesh (ring, seeded wobble) + NucleusView + OrganelleViews
   │                 sorted by radius ascending so predators draw over prey
   ├─ effectsLayer   eat pulse, absorb dissolve, level-up burst, respawn fade
   └─ debugLayer     spatial hash / ids, toggled by the debug MCP
 HTML overlay (Angular, above the canvas)
   HudComponent, TraitPickComponent, LeaderboardComponent, RespawnComponent, MinimapComponent
```

- **Camera** (`render/camera.ts`): follows the own predicted cell, zoom = `zoomForRadius`,
  exponential smoothing, owns `worldToScreen` / `screenToWorld`. Render-only numbers live in
  `render/constants.ts`.
- **View registry**: entity id → view, created/destroyed on snapshot diff; views are dumb.
- **HUD** reads `WorldStore` through Angular signals; the renderer never touches the DOM, the
  HUD never touches Pixi; every HUD element carries a `data-testid`.
- **Cosmetics** draw from `random.fork('cosmetic:' + cellId)` so paused screenshots reproduce.
- **Frame budget** (#99): 60 fps, ≤ 12 ms p95 frame time at 100 cells + 1 000 motes at 1080p.

## 7. Audio hook seam (#101)

`packages/shared/src/audio/sound-events.ts` declares the `SOUND_EVENT` catalogue (id, priority,
cooldown). The client `SoundEventBus` maps snapshot `GameEvent`s (server-owned moments) and UI
events (local) to sound events; `AudioService` resolves each to `assets/audio/manifest.json`
and plays via Web Audio, **silent when the asset is missing, never throwing**. The renderer
and HUD emit through the bus; nothing else imports `AudioService`.

## 8. Debug MCP surface (#14)

`DebugContext` gains `getRoomDebugHandle(gameId): SimulationDebugHandle | undefined`, which the
module implements; tools in `mcp/handlers/game-specific.ts` only translate arguments and
serialise results — no game logic in handlers.

| Tool                                                 | Handle method                                         |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `debug_get_entities(gameId, kind?, bbox?)`           | `listEntities(filter)`                                |
| `debug_get_player_cell(gameId, playerId)`            | `getPlayerDebugState(playerId)`                       |
| `debug_spawn(gameId, kind, x, y, params)`            | `spawn(request)` (goes through the spawner)           |
| `debug_set_player(gameId, playerId, patch)`          | `patchPlayer(playerId, patch)`                        |
| `debug_pause` / `debug_step(ticks)` / `debug_resume` | `pause()`, `step(ticks)`, `resume()` on the room loop |
| `debug_set_seed(gameId, seed)`                       | `reseed(seed)` (restarts the random streams)          |
| `debug_get_balance()` / `debug_set_balance(patch)`   | balance loader (`CODE-STANDARDS.md` §2)               |
| `debug_get_state_hash(gameId)`                       | `computeStateHash(state)`                             |
| `debug_export_replay(gameId)`                        | `ReplayRecorder.export()`                             |

`getRoomGameState(gameId)` returns `{ tick, session, players, counts, stateHash }` — a summary,
not the entity dump (that is `debug_get_entities`).

## 9. File plan (target ≤ 250 lines per file; 300 is the lint cap)

```text
packages/shared/src/
  constants/{index,network,lobby,world,ecology,growth,progression,traits}.ts
  types/{common,messages,entities,ids,events}.ts
  data/{balance-schema,traits-schema}.ts        zod schemas + inferred types
  random/{random-source,seeded-random,stream-labels}.ts
  time/{clock,fixed-step-accumulator}.ts
  simulation/{movement-kernel,mass-curves,state-hash,vector-math}.ts
  audio/sound-events.ts
packages/server/src/
  data/{balance-loader,balance-watcher}.ts
  lobby/{game-room,ticker}.ts                    room drives the accumulator via Ticker
  game/evolution-game-module.ts, game/evolution-game-module-factory.ts
  game/simulation/{simulation-state,step-simulation,spatial-hash,step-context}.ts
  game/simulation/systems/{apply-inputs,movement,eating,absorption,growth-and-decay,
                           progression,ecology,respawn,session}.ts
  game/serialize/{snapshot-encoder,food-delta-tracker}.ts
  game/replay/{replay-recorder,replay-runner}.ts
  game/debug/simulation-debug-handle.ts
  mcp/handlers/game-specific.ts (+ one file per tool group if it passes ~200 lines)
packages/client/src/app/game/
  game-setup.ts
  net/{snapshot-buffer,prediction,reconciliation,world-store,input-sender}.ts
  input/{pointer-input,keyboard-input}.ts
  render/{pixi-app,layers,camera,view-registry,constants}.ts
  render/cells/{cell-view,membrane-mesh,nucleus-view,organelle-views}.ts
  render/food/{food-mote-view,dna-fragment-view}.ts
  render/dish/dish-background.ts   render/effects/*.ts
  state/game-state.service.ts   hud/*.component.ts   audio/{audio.service,sound-event-bus}.ts
data/{balance.json,traits.json}
```

## 10. Test plan (see `ENGINEERING.md` §2, `DETERMINISM.md` §7)

- **Unit:** every system with a `createTestState` builder; movement kernel; mass curves;
  spatial hash vs brute force on seeded populations; snapshot encoder round-trip; food delta
  tracker; snapshot buffer / prediction / reconciliation; schemas.
- **Integration:** input → step → snapshot through a real `GameRoom` under a `ManualClock`;
  late join gets a full snapshot then deltas; reconnect resync; replay reproduces the hash.
- **Gameplay scenarios (#102)** assert GDD numbers; **perf (#103)** records step/serialise
  timings and snapshot bytes against the budgets above.
