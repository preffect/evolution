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
 │ world-store ◄─ snapshots ◄───┼── ws ◄───│   20 Hz serializeRoomState() │
 │  ├ interpolation (remote)    │          │ MCP /debug-mcp ─► DebugContext│
 │  └ prediction (own cell)     │          └──────────────────────────────┘
 │ Pixi scene ◄─ view registry  │          shared: types, constants, balance,
 │ HUD (Angular signals)        │                  random, movement kernel, hash
 └──────────────────────────────┘
```

## 1. Decisions (the short list)

| Decision                        | Choice                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Simulation rate / snapshot rate | `TICK_HZ` = 60 fixed step; broadcast every `SNAPSHOT_EVERY_TICKS` = 3 ticks (20 Hz)                         |
| Input rate                      | One `GameInput` per simulation tick, as `GAME-DESIGN.md §6` says; no separate input-rate constant           |
| Authority                       | Server owns position, mass, eating, engulf, DNA, levels, drafts, spawns, respawn, score                     |
| Client-side cosmetic            | Membrane wobble, granule drift, particles, camera; never fed back                                           |
| Renderer (#33, closed)          | WebGL via **Pixi v8**; benchmark numbers land in the renderer PR                                            |
| Food on the wire                | Static motes (algae, detritus) as spawned/removed deltas; bacteria and fragments move, so they ride in full |
| State update style              | Systems mutate the one `WorldState` in place inside `stepWorld` (section 3.1)                               |
| Tunables                        | `packages/shared/src/constants/<domain>.ts` is the source; `data/balance.json` is generated from it         |
| Interest management             | One snapshot for every client; viewport culling is a held lever (section 4.2)                               |
| Client prediction               | Own cell predicted with the shared movement kernel, one input per tick, reconciled (section 5)              |
| Randomness / time               | Seeded streams stored in the state and an injected clock only (`DETERMINISM.md`)                            |
| Trust model                     | Local-only, client trusted; inputs validated by schema, nothing else checked                                |

## 2. Entity model

Two layers, one direction: the **views** are the wire types in
`packages/shared/src/types/game.ts`, defined here (their one home) with each field's meaning
owned by the design doc that names it: `CellStage` and its `STAGE_ORDER` / `STAGE_GATE_TRAITS`
by [`GAME-DESIGN.md §3`](./GAME-DESIGN.md#3-the-evolution-ladder), progress and offers by
[`PROGRESSION.md`](./PROGRESSION.md), food by [`ECOLOGY.md §1`](./ECOLOGY.md#1-food-kinds),
engulf states by [`ECOLOGY.md §6.2`](./ECOLOGY.md#62-state-diagram), the trait definition shape
(`stage`, `requires`, `unlockedBy`, `exclusionGroup`) by [`TRAITS.md §1`](./TRAITS.md#1-definition-shape).

```ts
// packages/shared/src/types/game.ts — the views (imported by messages.ts)
export type GameMode = 'free_for_all' | 'colony'; // 'colony' reserved for build 2
export type RoundEndCondition = 'timer'; // dominant-organism / DNA-target reserved
export type RoundPhase = 'playing' | 'results';
export type FoodKind = 'algae' | 'bacterium' | 'detritus';
export type BacteriumVariant = 'plain' | 'aerobic' | 'photosynthetic'; // the endosymbiosis hook
export type DnaTag = 'motile' | 'photic' | 'predatory' | 'armored' | 'toxic' | 'sensory' | 'metabolic';
export type ZoneId = 'sunlit_shallows' | 'warm_vent' | 'viscous_gel' | 'open_broth';
export type CellState = 'free' | 'being_engulfed' | 'engulfing' | 'dividing'; // no death state: see below
export type CellStage = (typeof STAGE_ORDER)[number]; // constants/ladder.ts
export type TraitId = (typeof TRAIT_CATALOG)[number]['id']; // constants/traits.ts
export type TraitTier = 1 | 2 | 3;
export type PlayerLifeState = 'alive' | 'spectating';

export interface OwnedTrait {
  traitId: TraitId;
  tier: TraitTier;
}
export interface CellView {
  id: EntityId;
  playerId: PlayerId;
  organismId: EntityId; // == id in build 1 (reserved grouping key, GAME-DESIGN §11)
  avatarIndex: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  mass: number;
  radius: number;
  level: number;
  stage: CellStage; // derived from traits (stageOf), carried for the renderer and HUD
  traits: OwnedTrait[];
  states: CellState[]; // 'engulfing' and 'being_engulfed' may coexist
  engulfProgress: number; // 0..1 as prey
  engulfingCellId: EntityId | null;
  engulfedByCellId: EntityId | null;
  sprintRemainingTicks: number;
}
export interface FoodMoteView {
  id: EntityId;
  kind: FoodKind;
  bacteriumVariant: BacteriumVariant | null; // set when kind === 'bacterium'
  x: number;
  y: number;
}
export interface DnaFragmentView {
  id: EntityId;
  x: number;
  y: number;
  tag: DnaTag;
}
export interface GelPatchView {
  x: number;
  y: number;
  radius: number;
}
export interface TraitOfferView {
  offerId: number;
  cards: OwnedTrait[]; // the tier each card would grant
  expiresAtTick: number;
}
export interface PlayerProgressView {
  playerId: PlayerId;
  playerName: string;
  level: number;
  dnaCumulative: number;
  dnaCatchUpGift: number;
  dnaTowardNextLevel: number;
  dnaTagPoints: Record<DnaTag, number>;
  bacteriaEatenByVariant: Record<BacteriumVariant, number>; // endosymbiosis counters, kept on death
  absorptions: number;
  score: number;
  offer: TraitOfferView | null;
  lifeState: PlayerLifeState; // the only home of death / respawn
  spectatingPlayerId: PlayerId | null;
  respawnInTicks: number;
}
export interface LeaderboardRow {
  rank: number;
  playerId: PlayerId;
  score: number;
  mass: number;
  level: number;
  absorptions: number;
}
```

The **records** are the server's supersets in `packages/server/src/game/world/entities.ts`;
`serialize.ts` projects records onto views and nothing else reads a record outside
`packages/server/src/game/`.

```ts
// packages/server/src/game/world/entities.ts — records extend the views
export interface CellRecord extends CellView {
  targetX: number; // latest applied input, latched until replaced
  targetY: number;
  sprintCooldownRemainingTicks: number;
  modifiers: CellModifiers; // folded at step 1 of the tick (TRAITS §2); the simulation reads only this
}
export interface PlayerRecord extends PlayerProgressView {
  avatarIndex: number;
  joinOrder: number; // tie-break for the leaderboard and the input drain order
  ownedTraits: OwnedTrait[]; // survive death; the cell's `traits` mirrors them
  offerQueue: TraitOffer[]; // FIFO; offerQueue[0] is the shown offer (PROGRESSION §4)
  appliedInputSequence: number; // echoed in the snapshot for prediction (section 5)
  pendingInput: GameInput | null; // coalesced by submitInput (section 3.2)
}
export interface TraitOffer extends TraitOfferView {
  shownAtTick: number | null; // null while queued behind another offer
  cardWeights: number[]; // for the timeout pick (highest weight, lowest catalog index)
  // `cards` and `cardWeights` are empty while queued: PROGRESSION §4 builds them when the offer is shown
}
export interface FoodMoteRecord extends FoodMoteView {
  mass: number; // ECOLOGY §1 by kind
  dna: number;
  tag: DnaTag | null; // by variant for bacteria, null otherwise
  headingRadians: number; // bacteria only: random walk, redrawn from the `moteMotion` stream
  expiresAtTick: number | null; // detritus only
}
export interface DnaFragmentRecord extends DnaFragmentView {
  driftX: number; // unit vector × DNA_FRAGMENT_DRIFT_SPEED, drawn at spawn
  driftY: number;
}
```

- **Cell stage and traits.** `CellView.stage` is derived by `progression/ladder.ts` `stageOf`
  from the player's owned traits and recomputed with the modifiers at step 1; the draft
  (`progression/draft.ts`) filters candidates by stage reached, `requires` owned and the
  `unlockedBy` counter (`bacteriaEatenByVariant`) exactly as [`PROGRESSION.md §3`](./PROGRESSION.md#3-draft-pool-and-weights)
  states, then reserves the rung card. Trait effects are data (`TRAIT_TIERS`) folded by
  `progression/modifiers.ts` into one `CellModifiers` record; no system ever switches on a trait id.
- **Death lives on the player.** `PlayerProgressView.lifeState`, `spectatingPlayerId` and
  `respawnInTicks` are the only death/respawn state; an absorbed cell is removed from
  `world.cells` the tick it is absorbed and emitted as a `cell_absorbed` effect (ECOLOGY §6.2).
  A spectating player has no cell record.
- **Score** is computed, never stored twice: `session/leaderboard.ts` implements
  `score = (dnaCumulative − dnaCatchUpGift) + SCORE_ABSORPTION_BONUS × absorptions` with ties by
  mass then `joinOrder` (GAME-DESIGN §5.3) and writes `PlayerProgressView.score` and the
  `leaderboard` rows at step 10.
- **Records keyed by a closed enum** (`dnaTagPoints: Record<DnaTag, number>`,
  `bacteriaEatenByVariant: Record<BacteriumVariant, number>`) are walked in the enum's declared
  array order (`DNA_TAGS`, `BACTERIUM_VARIANTS`), never by `Object.keys`; that is what lets the
  state hash cover them (`DETERMINISM.md §5`).
- Ids come from a per-world monotonic counter with a kind prefix (`c-17`, `m-2041`, `f-9`),
  never from randomness. `ENTITY_KIND = { cell: 'cell', foodMote: 'food_mote', dnaFragment: 'dna_fragment' }`
  is the debug-tool filter vocabulary; `organismId` (= own id in Build 1), the `dividing` state and
  the `split` / `eject` inputs are the reserved hooks of GAME-DESIGN §11.

```ts
// packages/server/src/game/world/world-state.ts
export interface WorldState {
  tick: number;
  seed: number; // the current round's seed (rematch increments it)
  roundPhase: RoundPhase;
  roundTimeLeftMs: number;
  config: GameSessionConfig;
  balance: BalanceConfig; // defaults from shared constants; patched only by debug_set_balance
  gelPatches: GelPatchView[];
  cells: CellRecord[]; // insertion order
  food: FoodMoteRecord[];
  dnaFragments: DnaFragmentRecord[];
  players: PlayerRecord[]; // join order
  leaderboard: LeaderboardRow[];
  spawners: { food: SpawnerState; dnaFragments: SpawnerState }; // fractional accumulators (ECOLOGY §3)
  random: Record<RandomStreamLabel, RandomState>; // the streams' serialisable state (DETERMINISM §3)
  nextEntityNumber: number;
  effects: GameEffect[]; // this tick's effects, drained by serialize (cell_absorbed, eat, level_up, …)
}
```

Every collection is an array in insertion order. Membrane vertices, wobble phase and particle
state do not exist on the server. The spatial hash is rebuilt every tick and is not part of the
state.

## 3. Server simulation (`packages/server/src/game/`)

`evolution-module.ts` implements the template's `GameModule` seam and stays thin (wiring only):
it coalesces inputs, calls `stepWorld`, and serialises. All decision logic is in the subsystems
of the file plan (section 10), in this fixed step order (the scenario tables are computed
against it):

```text
 stepWorld(world, context): void          context = { balance, streams, effects }
   1 inputs        apply the coalesced input per player (join order); fold modifiers + stage
   2 round         timer, bloom flag, results phase (freezes 3–9), auto-rematch reseed
   3 movement      shared kernel: throttle, steer blend, gel factor, wall clamp; then separation
   4 eating        motes and fragments within the radius, variant counters, cap overflow → DNA
   5 metabolism    decay, toxin and spike drains, photosynthesis (one formula, ECOLOGY §4.1)
   6 engulf        canStart / canContinue, progress, release, payout, chains; absorbed cells removed
   7 progression   level-ups, offer queue, timeouts, rung card
   8 spawners      food and fragment accumulators, bacteria random walk, fragment drift, detritus expiry
   9 respawn       spectate timers, safe placement from the spawnPlacement stream
  10 leaderboard   score and ranking
```

### 3.1 In-place systems, pure step

Systems are `(world: WorldState, context: StepContext) => void` and **mutate the world they
receive**; `stepWorld` returns nothing and the module keeps one `WorldState` for the room's
lifetime. Why in place: the pair-wise systems (separation, engulf chains) update two records at
once, the hash and the spatial hash walk one owned structure, and rebuilding arrays of ~1 500
entities sixty times a second buys nothing at this scale. What "pure" means here (the word
the design uses for `progression/ladder.ts`, GAME-DESIGN §3): a system reads nothing but its
arguments, calls no IO, no clock, no
`Math.random`, and two worlds that hash equal before a step hash equal after it. Tests therefore
assert **values and hashes**, never object identity; `ENGINEERING.md §2.3`'s
`expect(result).not.toBe(prevState)` applies to reducers that return new state (lobby and room
descriptors, the client `WorldStore`), not to the simulation. Formulas in `packages/shared`
(`movement-kernel.ts`, `mass-curves.ts`) stay side-effect free and take numbers, so the client
prediction reuses them unchanged.

### 3.2 Input handling

- `submitInput(playerId, input)` **coalesces** into `PlayerRecord.pendingInput`: the newest
  `sequence`, `targetX/targetY` win; `sprint` and `traitChoice` are OR-merged (a one-shot that
  arrives together with a newer target is never lost). Step 1 applies the pending input, records
  its `sequence` as `appliedInputSequence`, latches the target on the cell, and clears the
  one-shots. An input with a `sequence` ≤ the applied one is dropped and counted in
  `PerfTracker.rejectedInputs`.
- `sprint` starts a sprint only when the cooldown allows (GAME-DESIGN §6); otherwise it is
  ignored and counted. `traitChoice` applies only when `offerId` is the shown offer
  (PROGRESSION §4); a stale pick is ignored and counted. `split` / `eject` pass the schema and
  are ignored by the simulation without counting: they are reserved, not invalid (GAME-DESIGN §11).
- The template's `GameRoom` calls `reduceGameState()` once per tick from the injected ticker
  (`DETERMINISM.md §2`); `reduceGameState` is `stepWorld` plus effect draining, nothing else.

### 3.3 Other structural rules

- **Fixed step.** Nothing in `game/` reads a clock; time is `world.tick` and `TICK_INTERVAL_S`.
- **Tunables** reach the systems as `context.balance` (section 9), never as module imports from
  `constants/`; formulas take numbers. That is what makes `debug_set_balance` live.
- **Spatial hash** (`world/spatial-hash.ts`): uniform grid rebuilt at step 3, cell size
  `SPATIAL_HASH_CELL_SIZE_WU`; `queryCircle` and `queryPairs` return id-sorted results.
- **Engulf is server-only.** The client animates `states`, `engulfProgress` and effects.
- **Perf budget** (measured by `PerfTracker`, gated in #103): step ≤ 4 ms p95 and serialise
  ≤ 2 ms p95 at 8 players, 1 400 motes, 110 fragments; `MAX_TICKS_PER_ADVANCE` bounds catch-up.

## 4. Wire contract (`packages/shared/src/types/messages.ts`)

The three seams replace the template's `unknown` / `{ maxPlayers }` hooks; this section is their
one home, and the design docs own the meaning of every field. Validated on the server in `ws/message-schemas.ts` (Zod) before any handler sees
them; message verbs are the `CLIENT_MESSAGE_TYPE` / `SERVER_MESSAGE_TYPE` objects.

```ts
export interface GameInput {
  sequence: number; // monotonic per client, one per client tick
  targetX: number; // pointer target in world units
  targetY: number;
  sprint: boolean; // edge-triggered by the client, coalesced by the server (section 3.2)
  traitChoice: TraitChoiceInput | null; // { offerId, cardIndex }
  split?: boolean; // reserved (build 2), validated and ignored
  eject?: boolean;
}
export interface GameSessionConfig {
  maxPlayers: number; // MIN_PLAYERS_PER_GAME .. MAX_PLAYERS_PER_GAME
  seed: number; // 0 .. SEED_MAX; generated by the creating client, never by the server
  mode: GameMode; // 'free_for_all'; 'colony' rejected by the schema until build 2
  roundDurationSeconds: number; // ROUND_DURATION_MIN_SECONDS .. ROUND_DURATION_MAX_SECONDS
  endCondition: RoundEndCondition; // 'timer'
}
export interface GameSnapshot {
  tick: number;
  seed: number; // current round seed (G2 asserts 43 after the first rematch)
  roundPhase: RoundPhase;
  roundTimeLeftMs: number;
  gelPatches: GelPatchView[];
  cells: CellView[];
  dnaFragments: DnaFragmentView[]; // full every snapshot: they drift
  food: FoodDelta; // wire refinement of the design's FoodMoteView[] (section 4.1)
  players: Record<string, PlayerProgressView>; // built from the join-ordered array
  leaderboard: LeaderboardRow[];
  appliedInputSequenceByPlayer: Record<string, number>; // prediction (section 5)
  effects: GameEffect[]; // this broadcast window's cell_absorbed, eat, level_up, respawn, …
}
export interface FoodDelta {
  spawned: FoodMoteView[]; // every mote when the snapshot is a game_state
  removedIds: EntityId[];
  moved: MotePositionView[]; // { id, x, y } for every bacterium, every snapshot (random walk)
}
```

- The dish radius is the constant `DISH_RADIUS` (GAME-DESIGN §8), not a session field.
- `game_state` (join, late join, reconnect) carries `serializeFullState()`: a `GameSnapshot`
  whose `food.spawned` is every mote, plus `balance: BalanceConfig` so the client predicts with
  the numbers the server simulates. `game_snapshot` carries `serializeRoomState()`: the delta
  since the previous broadcast. The client applies deltas idempotently (upsert `spawned`,
  delete-if-present `removedIds`, patch `moved`) and resets its food store on every
  `game_state`; WebSocket ordering makes this sufficient, so there is no base-tick check and no
  resync verb. A reconnect is a new `game_state`.
- **New server message:** `balance_updated { balance }` after `debug_set_balance`. No new client
  verbs: everything rides `player_input`.
- **`GameModule` seam additions** (#97): `serializeFullState()`, `getDebugHandle()` (section 8).
  `RoomInitArgs.config` becomes the resolved `GameSessionConfig`; the factory receives
  `{ config, playerIds, clock }` and builds the random streams itself from `config.seed`
  (`DETERMINISM.md §3`); it never receives a `RandomSource`.

### 4.1 Bandwidth budget

Populations at 8 players from ECOLOGY §3: `FOOD_CAP_BASE + 8 × FOOD_CAP_PER_PLAYER` = 1 400
motes, of which the bacterium share (`FOOD_KIND_WEIGHTS` 0.25) ≈ 350 move every tick; 110
fragments, all drifting; 8 cells. Sizes are JSON with positions quantised to
`SNAPSHOT_POSITION_DECIMALS` = 1.

| Snapshot part (20 Hz)                          | Count × bytes | Per snapshot |
| ---------------------------------------------- | ------------- | ------------ |
| `food.moved` (bacteria `{ id, x, y }`)         | 350 × ~30     | ~10.5 KB     |
| `dnaFragments` (full)                          | 110 × ~50     | ~5.5 KB      |
| `cells` (traits, states, engulf fields)        | 8 × ~300      | ~2.4 KB      |
| `players` + `leaderboard`                      | 8 × ~350 + 80 | ~3.4 KB      |
| `food.spawned` / `removedIds`, effects, header | ~7/s ÷ 20 Hz  | ~0.5 KB      |
| **total**                                      |               | **≈ 22 KB**  |

Budget: **≤ 24 KB raw per snapshot, ≤ 500 KB/s raw per client** (≈ 120 KB/s after
`perMessageDeflate`, already enabled); 8 clients ≈ 4 MB/s raw server egress, fine on a LAN.
Sending static motes in full would add ~50 KB per snapshot, which is why the delta is mandatory;
sending bacteria as full `FoodMoteView`s instead of positions would add ~18 KB, which is why
`moved` is a position list. `PerfTracker.snapshotBytes` is the measurement; #103 records it.

### 4.2 Held levers (in order)

1. **Viewport culling of `moved` and `dnaFragments`:** `serializeRoomState(viewerPlayerId)`
   with the camera extent plus `INTEREST_MARGIN_WU`, per-player snapshots. Cuts the two big rows
   by ~75 % at the widest zoom.
2. **Broadcast at 15 Hz** (`SNAPSHOT_EVERY_TICKS` = 4); interpolation absorbs it unchanged.

## 5. Client networking policy (`packages/client/src/app/game/net/`)

- **Interpolation.** `SnapshotBuffer` keeps the last `SNAPSHOT_BUFFER_SIZE` = 4 snapshots and
  renders remote cells, bacteria and fragments at `renderTick = latestTick − INTERPOLATION_DELAY_TICKS`
  (6 ticks = two snapshot intervals), lerping position, velocity and radius between the bracketing
  snapshots; a missing bracket extrapolates with velocity for at most `MAX_EXTRAPOLATION_TICKS`.
- **Prediction: one input per tick.** The client's input controller runs its own tick counter at
  `TICK_HZ` and sends exactly one `GameInput` per client tick with `sequence` = client tick. On a
  snapshot at tick `T` carrying `appliedInputSequenceByPlayer[me] = S`, the own cell's
  authoritative pose is "tick `T` after input `S`". The client then re-runs the shared movement
  kernel for its unacknowledged inputs `S + 1 … latest`, assuming input `S + i` was applied at
  tick `T + i` (the server applies the newest pending input each tick; with one input per tick
  the two counters advance together). When jitter makes the server coalesce two inputs into one
  tick the assumption is off by one tick for one snapshot, and reconciliation absorbs it. Mass,
  radius, stage, traits, engulf state and death are never predicted.
- **Reconciliation.** Differences under `RECONCILE_SNAP_DISTANCE_WU` blend out over
  `RECONCILE_BLEND_SECONDS`; larger ones snap. `WorldStore` is the single client model; the
  Angular `GameStateService` is its signal facade for the HUD, not a second model.
- **Clock.** `serverTickEstimate` comes from snapshot arrival times (EMA) through the client's
  injected `Clock`; nothing in `game/` reads `Date.now` (`DETERMINISM.md §1`).

## 6. Client module plan (Pixi v8 + Angular)

```text
 Angular <app-game> host component
   └─ game-setup.ts (composition root, < 100 lines): wires net, input, render, hud, audio
 Pixi Application (one canvas, resolution = devicePixelRatio)
   stage
   ├─ dishLayer      dark-field background, wall rim, zones, gel patches (cached render texture)
   ├─ foodLayer      algae / detritus / bacteria by variant (ParticleContainer), fragments by tag
   ├─ cellLayer      CellView: membrane ring mesh (seeded wobble) + stage/organelle sub-views
   │                 (TRAITS §3.0: no nucleus until nuclear_envelope), sorted by radius ascending
   ├─ effectsLayer   eat pulse, engulf stretch, cell_absorbed dissolve, level-up burst, respawn fade
   └─ debugLayer     spatial hash / ids, toggled by the debug MCP
 HTML overlay (Angular, above the canvas, every element with a data-testid; docs/UI.md, #30)
   hud-mass-level, dna-progress-ring, trait-strip, leaderboard-panel, trait-offer-overlay,
   respawn-overlay, results-overlay
```

- **Camera** (`render/camera.ts`) implements GAME-DESIGN §7 from `constants/camera.ts`; render-only
  numbers (`PROTOCELL_GRANULE_COUNT`, palettes, layer z, wobble amplitude) live in `render/constants.ts`.
- **View registry**: entity id → view, created/destroyed on snapshot diff; views are dumb.
- **HUD** reads `WorldStore` through signals; the renderer never touches the DOM, the HUD never
  touches Pixi.
- **Cosmetics** draw from `fork(RANDOM_STREAM.cosmetic + ':' + cellId)` of the round seed so a
  paused screenshot reproduces.
- **Frame budget** (#99): 60 fps, ≤ 12 ms p95 frame time at 8 cells + 1 400 motes at 1080p.

## 7. Audio hook seam (#101)

`packages/shared/src/audio/sound-events.ts` declares the `SOUND_EVENT` catalogue (id, priority,
cooldown); the ids are the `audioCue` values of TRAITS §3. The client `SoundEventBus` maps
snapshot effects (server-owned moments) and UI events (local) to sound events; `AudioService`
resolves each through `assets/audio/manifest.json` and plays via Web Audio, **silent when the
asset is missing, never throwing**. Nothing but the bus imports `AudioService`.

## 8. Debug MCP surface (#14)

`DebugContext` gains `getRoomDebugHandle(gameId): SimulationDebugHandle | undefined`, which the
module implements; handlers in `mcp/handlers/` only translate arguments and serialise results.
This table is the one home of the tool names (the `_room` suffix marks the tools that act on
the room loop rather than the world):

| Tool                                                                | Handle method                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `debug_get_game_state(gameId)`                                      | `serializeFullState()` + counts per food kind, variant and zone    |
| `debug_get_player_progress(gameId, playerId)`                       | `getPlayerDebugState(playerId)`: progress, modifiers, stage, offer |
| `debug_get_entities(gameId, kind?, bbox?)`                          | `listEntities(filter)`                                             |
| `debug_grant_dna(gameId, playerId, dna, tags?)`                     | `grantDna(playerId, grant)` (logged)                               |
| `debug_spawn(gameId, kind, x, y, params)`                           | `spawn(request)` through the spawner                               |
| `debug_pause_room` / `debug_step_room(ticks)` / `debug_resume_room` | `pause()`, `step(ticks)`, `resume()` on the room loop              |
| `debug_set_seed(gameId, seed)`                                      | `reseed(seed)`: rebuilds the streams (`DETERMINISM.md §3`)         |
| `debug_get_balance(gameId)` / `debug_set_balance(gameId, patch)`    | `world.balance` read / patch + `balance_updated`                   |
| `debug_get_state_hash(gameId)`                                      | `computeStateHash(world)`                                          |
| `debug_export_replay(gameId)`                                       | `ReplayRecorder.export()`                                          |

`getRoomGameState(gameId)` (the template's summary) returns `{ tick, seed, roundPhase,
roundTimeLeftMs, players, counts, stateHash }`, not the entity dump.

## 9. Constants and balance (decision, one home)

`packages/shared/src/constants/<domain>.ts` is the **source of truth** for every tunable, named
exactly as the design tables name it (`GAME-DESIGN.md §12`, `ECOLOGY.md §7`, `PROGRESSION.md §6`,
`TRAITS.md §5`). `packages/shared/src/constants/balance.ts` assembles them into one
`DEFAULT_BALANCE = { world, session, controls, ladder, ecology, growth, absorption, progression, traits }`
(the domain modules as namespaces) and `BalanceConfig = typeof DEFAULT_BALANCE`.
`data/balance.json` is **generated** from `DEFAULT_BALANCE` by `scripts/generate-balance.ts`,
checked in as the diffable reference the debug tools quote, and pinned by
`balance.test.ts` (file equals `DEFAULT_BALANCE`, so hand edits fail the gate). At runtime each
room starts from `DEFAULT_BALANCE`; `debug_set_balance` patches number leaves only and the
world carries the live copy. Nothing reads `data/balance.json` at runtime. The full rule set is
`CODE-STANDARDS.md §2`.

## 10. File plan (target ≤ 250 lines per file; 300 is the lint cap)

```text
packages/shared/src/
  constants/{index,units,network,lobby,identity}.ts            (template, already split)
  constants/{world,session,controls,ladder,camera,ecology,growth,absorption,progression,traits}.ts
  constants/balance.ts                                          DEFAULT_BALANCE, BalanceConfig
  types/{common,messages,game,effects}.ts
  random/{random-source,seeded-random,stream-labels}.ts
  time/{clock,fixed-step-accumulator,units}.ts
  simulation/{movement-kernel,mass-curves,state-hash,vector-math}.ts
  audio/sound-events.ts
packages/server/src/
  lobby/{game-room,ticker}.ts                                   room drives the accumulator via Ticker
  game/evolution-module.ts                                      factory + GameModule (≤ 120 lines)
  game/world/{world-state,entities,spatial-hash}.ts
  game/simulation/{step,movement,contact,eating,metabolism,engulf,spawner,zones,spawn-placement,round}.ts
  game/progression/{levels,ladder,draft,modifiers,late-join}.ts
  game/session/{leaderboard,respawn}.ts
  game/serialize/{serialize,food-delta-tracker}.ts
  game/replay/{replay-recorder,replay-runner}.ts
  game/debug/simulation-debug-handle.ts
  mcp/handlers/<tool>.ts (one file per tool, one shared room lookup)
  testing/{builders,scenarios/*}.ts                             (#75)
packages/client/src/app/game/
  game-setup.ts
  net/{snapshot-buffer,prediction,reconciliation,world-store,input-sender}.ts
  input/{input-controller,pointer-input,keyboard-input}.ts
  render/{pixi-app,layers,camera,view-registry,constants,interpolation}.ts
  render/{dish-layer,food-layer,cell-layer,effects-layer}.ts   render/cells/*.ts
  state/game-state.service.ts   hud/*.component.ts   audio/{audio.service,sound-event-bus}.ts
data/balance.json                                               generated (section 9)
scripts/generate-balance.ts
```

Import direction: `types` ← `constants` ← `simulation` (shared); `ladder.ts` and `traits.ts`
reference each other only as types (`TraitId`, `CellStage`), and `traits.ts` imports the value
`ENDOSYMBIOSIS_BACTERIA_REQUIRED` from `ladder.ts`, so there is no runtime cycle.

## 11. Test plan (`ENGINEERING.md §2`, `DETERMINISM.md §7`)

- **Unit:** every system and progression function with a `createTestWorld` builder; movement
  kernel; mass curves; spatial hash vs brute force on seeded populations; serialize round-trip;
  food delta tracker; draft (ladder filter, rung card, weights, timeout pick); `foldModifiers`;
  snapshot buffer / prediction / reconciliation; schemas (`message-schemas.test.ts` bounds);
  `balance.test.ts` (generated file equals `DEFAULT_BALANCE`; every design table constant exists).
- **Integration:** input → step → snapshot through a real `GameRoom` under a `ManualClock`; late
  join gets a full `game_state` then deltas; reconnect resync; replay reproduces the hash; the
  rematch reseed (`seed + ROUND_SEED_INCREMENT`) produces a fresh world.
- **Gameplay scenarios (#102)** run each design table row by id on the framework (#75);
  **perf (#103)** records step/serialise timings and `snapshotBytes` against sections 3.3 and 4.1.
