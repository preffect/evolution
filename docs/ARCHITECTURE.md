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
 │  ├ interpolation (remote)    │          │ MCP /debug-mcp ─► DebugContext│
 │  └ prediction (own cell)     │          └──────────────────────────────┘
 │ Pixi scene ◄─ view registry  │          shared: types, constants, balance,
 │ HUD (Angular signals)        │                  random, movement kernel, hash
 └──────────────────────────────┘
```

## 1. Decisions (the short list)

| Decision                        | Choice                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulation rate / snapshot rate | `TICK_HZ` = 60 fixed step; broadcast every `SNAPSHOT_EVERY_TICKS` ticks: 1 today (every tick, 60 Hz), 3 (20 Hz) when #214 lands server-side |
| Input rate                      | One `GameInput` per simulation tick, as `GAME-DESIGN.md §6` says; no separate input-rate constant                                           |
| Authority                       | Server owns position, mass, eating, engulf, DNA, levels, drafts, spawns, respawn, score                                                     |
| Client-side cosmetic            | Membrane wobble, granule drift, particles, camera; never fed back                                                                           |
| Renderer (#33, closed)          | WebGL via **Pixi v8**; benchmark numbers land in the renderer PR                                                                            |
| Food on the wire                | Static motes (algae, detritus) as spawned/removed deltas; bacteria and fragments move, so they ride in full                                 |
| State update style              | Systems mutate the one `WorldState` in place inside `stepWorld` (section 3.1)                                                               |
| Tunables                        | `packages/shared/src/constants/<domain>.ts` is the source; `data/balance.json` is generated from it                                         |
| Interest management             | One snapshot for every client; viewport culling is a held lever (section 4.2)                                                               |
| Client prediction               | Own cell predicted with the shared movement kernel, one input per tick, reconciled (section 5)                                              |
| Randomness / time               | Seeded streams stored in the state and an injected clock only (`DETERMINISM.md`)                                                            |
| Trust model                     | Local-only, client trusted; inputs validated by schema, nothing else checked                                                                |

## 2. Entity model

Two layers, one direction: the **views** are the wire types in
`packages/shared/src/types/game.ts`, defined here (their one home) with each field's meaning
owned by the design doc that names it: `CellStage` and its `STAGE_ORDER` / `STAGE_GATE_TRAITS`
by [`GAME-DESIGN.md §3`](./GAME-DESIGN.md#3-the-evolution-ladder), progress and offers by
[`PROGRESSION.md`](./PROGRESSION.md), food by [`ECOLOGY.md §1`](./ECOLOGY.md#1-food-kinds),
engulf states by [`ECOLOGY.md §6.2`](./ECOLOGY.md#62-state-diagram), engulf eligibility (`canEngulf`,
the one predicate the server, HUD and renderer share) and the engulf phases (`engulfPhaseOf` over
`engulfProgress`; no phase field rides on the view) by [`ECOLOGY.md §6.1`](./ECOLOGY.md#61-rules),
the trait definition shape
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
export type CellStage = (typeof CELL_STAGE)[keyof typeof CELL_STAGE]; // STAGE_ORDER (constants/ladder.ts) fixes the order
export type TraitId = (typeof TRAIT_CATALOG)[number]['id']; // constants/traits.ts: the rows are checked as `TraitCatalogRow` (string ids) so the derivation is not circular
export type TraitTier = 1 | 2 | 3;
export type PlayerLifeState = 'alive' | 'spectating';
export type CellKind = 'player' | 'wild'; // CELL_KIND: a wild cell is the world clock made flesh (ECOLOGY §3.3)
export type WorldStanding = 'ahead' | 'with' | 'behind'; // WORLD_STANDING: standingAgainstWorld (ECOLOGY §3.1)

export interface OwnedTrait {
  traitId: TraitId;
  tier: TraitTier;
}
export interface CellView {
  id: EntityId;
  kind: CellKind;
  playerId: PlayerId | null; // null for a wild cell
  organismId: EntityId; // == id for a player cell in build 1 (reserved grouping key, GAME-DESIGN §11); WORLD_ORGANISM_ID for every wild cell
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
  membraneRatioBonus: number; // modifiers.membraneRatioBonus mirrored at step 1 so canEngulf (ECOLOGY §6.1) reads views on both sides
  states: CellState[]; // 'engulfing' and 'being_engulfed' may coexist
  engulfProgress: number; // 0..1 as prey
  engulfingCellId: EntityId | null;
  engulfedByCellId: EntityId | null;
  sprintRemainingTicks: number;
  sprintCooldownRemainingTicks: number; // 0 = sprint ready; the HUD meter reads it (UI.md §3.1), never estimates it
}
export interface MotePositionView {
  id: EntityId;
  x: number;
  y: number;
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
export interface TraitChoiceInput {
  offerId: number;
  cardIndex: number; // 0..TRAIT_DRAFT_SIZE-1; a stale offerId is ignored and counted (section 3.2)
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
  absorptions: number; // players absorbed: the only ones that score (GAME-DESIGN §5.3)
  wildAbsorptions: number; // wild cells absorbed; never scores (ECOLOGY §3.3)
  score: number;
  offer: TraitOfferView | null;
  lifeState: PlayerLifeState; // the only home of death / respawn
  spectatingCellId: EntityId | null; // the killer's cell (a wild killer has no player, GAME-DESIGN §5.2); null once it is gone
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

Every string enum above is an `as const` object (`GAME_MODE`, `ROUND_END_CONDITION`, `ROUND_PHASE`, `FOOD_KIND`,
`BACTERIUM_VARIANT`, `DNA_TAG`, `ZONE_ID`, `CELL_STATE`, `CELL_STAGE`, `PLAYER_LIFE_STATE`, `CELL_KIND`, `WORLD_STANDING`, `ENTITY_KIND`) with the
union derived from it (`CODE-STANDARDS.md §2`); `EFFECT_KIND` (`types/effects.ts`), `TRAIT_CATEGORY` and
`TRAIT_RARITY` (`types/traits.ts`, with the trait definition shape and `CellModifiers`) follow the same rule.
The effects (`types/effects.ts`) are a discriminated union on `EFFECT_KIND`, each carrying the tick and the
world position it happened at: `cell_absorbed { cellId, playerId, predatorCellId }`, `eat { cellId, eatenId,
eatenKind }`, `level_up { cellId, playerId, level }`, `respawn { cellId, playerId }`; `world_level_up { level, stage }`
(ECOLOGY §3.1) happens everywhere and is the one effect without a position.

The **records** are the server's supersets in `packages/server/src/game/world/entities.ts`;
`serialize.ts` projects records onto views and nothing else reads a record outside
`packages/server/src/game/`.

```ts
// packages/server/src/game/world/entities.ts — records extend the views
export interface CellRecord extends CellView {
  targetX: number; // latest applied input, latched until replaced
  targetY: number;
  modifiers: CellModifiers; // folded at step 1 of the tick (TRAITS §2); the simulation reads only this
  carriedOffsetX: number | null; // set at the seal (ECOLOGY §6.1): the prey rides at this offset from its predator's centre until payout or release
  carriedOffsetY: number | null;
  spitOutRefractoryUntilTickByPreyId: Map<EntityId, number>; // ECOLOGY §6.1: one entry per spat-out prey (no restart on it until that tick; separation applies to the pair meanwhile); expired entries pruned at step 1
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
- **Death lives on the player.** `PlayerProgressView.lifeState`, `spectatingCellId` and
  `respawnInTicks` are the only death/respawn state; an absorbed cell is removed from
  `world.cells` the tick it is absorbed and emitted as a `cell_absorbed` effect (ECOLOGY §6.2).
  A spectating player has no cell record.
- **Wild cells are cells, not players** (ECOLOGY §3.3): ordinary `CellRecord`s in `world.cells` with
  `kind: 'wild'`, `playerId: null` and `organismId: WORLD_ORGANISM_ID`, owned by a `WildSeatRecord`
  (`seatNumber`, `cellId | null`, `massSpreadFactor`, `respawnInTicks`, `headingX`, `headingY`,
  `decideInTicks`, `drainedMass`) in `world.wildSeats`. The world clock is never sent: the snapshot
  carries `roundStartTick` and both sides compute `worldReference(worldElapsedSeconds(tick, roundStartTick,
roundDurationSeconds), balance)` (`simulation/world-clock.ts`).
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
  the `shouldSplit` / `shouldEject` inputs are the reserved hooks of GAME-DESIGN §11.

```ts
// packages/server/src/game/world/world-state.ts
export interface WorldState {
  tick: number;
  seed: number; // the current round's seed (rematch increments it)
  roundStartTick: number; // 0 at creation, the current tick at a rematch (ECOLOGY §3.1); carried on the snapshot
  roundPhase: RoundPhase;
  roundTimeLeftMs: number;
  config: GameSessionConfig;
  balance: BalanceConfig; // defaults from shared constants; patched only by debug_set_balance
  gelPatches: GelPatchView[];
  cells: CellRecord[]; // insertion order
  food: FoodMoteRecord[];
  dnaFragments: DnaFragmentRecord[];
  players: PlayerRecord[]; // join order
  wildSeats: WildSeatRecord[]; // seat order (ECOLOGY §3.3)
  leaderboard: LeaderboardRow[];
  spawners: { food: SpawnerState; dnaFragments: SpawnerState }; // fractional accumulators (ECOLOGY §3)
  random: Record<ServerRandomStreamLabel, RandomState>; // the server streams' serialisable state, walked in SERVER_RANDOM_STREAM_LABELS order (DETERMINISM §3, §5)
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
   2 round         timer, bloom flag, world level-up, results phase (ignores 1, freezes 3–9: GAME-DESIGN §5.4), auto-rematch reseed
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
  `sequence`, `targetX/targetY` win; `shouldSprint` and `traitChoice` are OR-merged (a one-shot that
  arrives together with a newer target is never lost). Step 1 applies the pending input, records
  its `sequence` as `appliedInputSequence`, latches the target on the cell, and clears the
  one-shots. An input with a `sequence` ≤ the applied one is dropped and counted in
  `PerformanceTracker.rejectedInputs`.
- `shouldSprint` starts a sprint only when the cooldown allows (GAME-DESIGN §6); otherwise it is
  ignored and counted. `traitChoice` applies only when `offerId` is the shown offer
  (PROGRESSION §4); a stale pick is ignored and counted. `shouldSplit` / `shouldEject` pass the schema and
  are ignored by the simulation without counting: they are reserved, not invalid (GAME-DESIGN §11).
- The template's `GameRoom` calls `reduceGameState()` once per tick from the injected ticker
  (`DETERMINISM.md §2`); `reduceGameState` is `stepWorld` plus effect draining, nothing else.

### 3.3 Other structural rules

- **Fixed step.** Nothing in `game/` reads a clock; time is `world.tick` and `TICK_INTERVAL_S`.
- **Tunables** reach the systems as `context.balance` (section 9), never as module imports from
  `constants/`; formulas take numbers. That is what makes `debug_set_balance` live.
- **Spatial hash** (`world/spatial-hash.ts`): uniform grid rebuilt at step 3, cell size
  `SPATIAL_HASH_CELL_SIZE_WU`; `queryCircle` returns id-sorted results. Cell pairs (separation, engulf)
  come from `contact.ts` `cellPairs`: every pair of the few cells, id-sorted, no hash needed.
- **Engulf is server-only.** The client animates `states`, `engulfProgress` and effects. What it shares
  is the eligibility predicate `canEngulf` (`shared/simulation/engulf-eligibility.ts`, ECOLOGY §6.1: the
  engulf system, the HUD threat label (`threatsFor`) and the warning ring all call it on views, and its
  signature is mass-only) and the phase formulas of `shared/simulation/engulf-pace.ts` (`engulfPhaseOf` for the chip's
  sealed state, `engulfProgressDelta`, the held and predator speed factors, `spitOutChancePerTick`); the
  hold verdict `resolveEngulfHold` (ratio and spit-out) is called by the server alone. The engulf step is
  the only consumer of the `engulf` random stream and draws from it only for a wrapped or sealed prey
  with a positive `spitOutChancePerSecond` (DETERMINISM §3). The prey's struggle reads the movement
  kernel's `steerCommand(cell)` so the throttle arithmetic has one home. Every release emits
  `cell_released { cellId, predatorCellId, reason }` (`types/effects.ts`, reasons in ECOLOGY §6.1) beside
  `cell_absorbed`; a sealed prey is carried (`CellRecord.carriedOffsetX/Y`) after its predator has moved.
- **Perf budget** (measured by `PerformanceTracker`, gated in #103): step ≤ 4 ms p95 and serialise
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
  shouldSprint: boolean; // edge-triggered by the client, coalesced by the server (section 3.2); predicate names per CODE-STANDARDS §6
  traitChoice: TraitChoiceInput | null; // { offerId, cardIndex }
  shouldSplit?: boolean; // reserved (build 2), validated and ignored
  shouldEject?: boolean;
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
- `game_state` (start, late join, reconnect: every player receives one right after `game_started`) carries `serializeFullState()`: a `GameSnapshot`
  whose `food.spawned` is every mote, plus `balance: BalanceConfig` so the client predicts with
  the numbers the server simulates. `game_snapshot` carries `serializeRoomState()`: the delta
  since the previous broadcast. The client applies deltas idempotently (upsert `spawned`,
  delete-if-present `removedIds`, patch `moved`) and resets its food store on every
  `game_state`; WebSocket ordering makes this sufficient, so there is no base-tick check and no
  resync verb. A reconnect is a new `game_state`.
- **New server message:** `balance_updated { balance }` after `debug_set_balance`. No new client
  verbs: everything rides `player_input`.
- **`GameModule` seam additions** (#97): `serializeFullState(): { snapshot, balance }` (what `game_state`
  carries; required, the echo returns its broadcast snapshot and `DEFAULT_BALANCE`), `getDebugHandle()` (section 8).
  `RoomInitOptions.config` becomes the resolved `GameSessionConfig`; the factory receives
  `{ config, playerIds, clock }` and builds the random streams itself from `config.seed`
  (`DETERMINISM.md §3`); it never receives a `RandomSource`.

### 4.1 Bandwidth budget

Worst case, at cap with 8 players in the eukaryote era (ECOLOGY §3, §3.2, §3.3):
`FOOD_CAP_BASE + 8 × FOOD_CAP_PER_PLAYER` = 1 400 motes, of which the bacterium share
(`FOOD_KIND_WEIGHTS_BY_WORLD_STAGE`: 0.25 in the protocell era, 0.5 from the eukaryote era) is up to
700 moving every tick; 110 fragments, all drifting; 8 player cells plus `WILD_CELL_COUNT` = 24 wild
cells, ordinary `CellView`s with traits, states and engulf fields. Sizes are JSON with positions
quantised to `SNAPSHOT_POSITION_DECIMALS` = 1.

| Snapshot part (20 Hz)                                         | Count × bytes   | Per snapshot |
| ------------------------------------------------------------- | --------------- | ------------ |
| `food.moved` (bacteria `{ id, x, y }`)                        | 700 × ~30       | ~21 KB       |
| `dnaFragments` (full)                                         | 110 × ~50       | ~5.5 KB      |
| `cells` (traits, states, engulf fields, `membraneRatioBonus`) | (8 + 24) × ~300 | ~9.6 KB      |
| `players` + `leaderboard`                                     | 8 × ~350 + 80   | ~3.4 KB      |
| `food.spawned` / `removedIds`, effects, header                | ~7/s ÷ 20 Hz    | ~0.5 KB      |
| **total, uncut**                                              |                 | **≈ 40 KB**  |
| **total with lever 1** (−75 % on `moved` and `dnaFragments`)  | ~5.3 + ~1.4 + … | **≈ 20 KB**  |

Budget: **≤ 24 KB raw per snapshot, ≤ 500 KB/s raw per client** (≈ 120 KB/s after
`perMessageDeflate`, already enabled); 8 clients ≈ 4 MB/s raw server egress, fine on a LAN. The
evolving world (#161) put the uncut contract at ≈ 40 KB and ≈ 800 KB/s, about 1.7 × the budget, so
**§4.2 lever 1 is no longer held: it is required for the current contract and lands (#171) before the
wild-cell slice (#176) fills the seats**; #152's snapshot (player cells only) is inside budget meanwhile.
With it the same snapshot is ≈ 20 KB (≈ 400 KB/s), inside budget; culling wild cells outside the
viewport by the same `serializeRoomState(viewerPlayerId)` path takes the `cells` row down further
and #171 decides whether to. Sending static motes in full would add ~50 KB per snapshot, which is
why the delta is mandatory; sending bacteria as full `FoodMoteView`s instead of positions would add
~18 KB, which is why `moved` is a position list. `PerformanceTracker.snapshotBytes` is the
measurement that confirms the estimate; #103 records it.

### 4.2 Levers (in order)

1. **Viewport culling of `moved` and `dnaFragments`** (required, #171: §4.1):
   `serializeRoomState(viewerPlayerId)` with the camera extent plus `INTEREST_MARGIN_WU`,
   per-player snapshots. Cuts the two big rows by ~75 % at the widest zoom.
2. **Broadcast at 15 Hz** (`SNAPSHOT_EVERY_TICKS` = 4; held); interpolation absorbs it unchanged.

## 5. Client networking policy (`packages/client/src/app/game/net/`)

- **Interpolation.** `SnapshotBuffer` keeps the last `SNAPSHOT_BUFFER_SIZE` snapshots (derived: the delay
  plus a bracket each side, 4 at either cadence) and renders remote cells, bacteria and fragments at
  `renderTick = latestTick − INTERPOLATION_DELAY_TICKS` (`2 × SNAPSHOT_EVERY_TICKS`, two snapshot
  intervals), lerping position, velocity and radius between the bracketing
  snapshots; a missing bracket extrapolates with velocity for at most `MAX_EXTRAPOLATION_TICKS`.
- **Prediction: one input per tick.** The client's input controller (`input/input-controller.ts`, #184)
  runs its own tick counter at `TICK_HZ` and sends exactly one `GameInput` per client tick with
  `sequence` = client tick; the ticks come from the injected clock through a `FixedStepAccumulator`
  pumped once per animation frame, so game code owns no timer (`CODE-STANDARDS.md §8`). The
  prediction and reconciliation below are **#265**: today the own cell is interpolated like any
  other. On a
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
  injected `Clock`; a republished snapshot at the latest tick (a debug mutation, §8) replaces the
  frame and is not observed, since it is a new world, not a new arrival; nothing in `game/` reads
  `Date.now` (`DETERMINISM.md §1`).
- **Snapshots are applied on arrival, in order.** A `game_snapshot` is a delta (§4), so the
  transport publishes every one on `messages$` and `RenderSession` applies it to `WorldStore`
  as it arrives; the frame loop only reads (`nextFrame()`, which also releases the effects due),
  so a frame hitch or a background tab never loses a spawn, a removal or an effect. Nothing
  coalesces snapshots.

## 6. Client module plan (Pixi v8 + Angular)

```text
 Angular <app-game> host component
   └─ game-setup.ts (composition root, < 100 lines): wires net, input, render, hud, audio
 Pixi Application (one canvas, resolution = devicePixelRatio)
   stage
   ├─ dishLayer      dark-field background, wall rim, zones, gel patches (cached render texture)
   ├─ foodLayer      algae / detritus / bacteria by variant (ParticleContainer), fragments by tag
   ├─ cellLayer      CellView: one instanced quad + SDF shader per cell, organelle sprites (RENDERING.md)
   │                 (TRAITS §3.0: no nucleus until nuclear_envelope), sorted by radius ascending
   ├─ effectsLayer   eat pulse, engulf stretch, cell_absorbed dissolve, level-up burst, respawn fade
   └─ debugLayer     spatial hash / ids, toggled by the debug MCP
 HTML overlay (Angular, above the canvas, every element with a data-testid)
   components: UI.md §7 (the one home of the HUD component list, #30)
```

- **Camera** (`render/camera.ts`) implements GAME-DESIGN §7 from `constants/camera.ts`; render-only
  numbers (`PROTOCELL_GRANULE_COUNT`, palettes, layer z, wobble amplitude) live in `render/constants.ts`.
- **View registry**: entity id → view, created/destroyed on snapshot diff; views are dumb.
- **HUD** reads `WorldStore` through `GameStateService` signals (derived only; the writable UI
  signals live in `hud/hud-state.service.ts`); the renderer never touches the DOM, the HUD never
  touches Pixi. The four crossings (`previewTraitId`, `reticleVisible`, `ownCellIndicators` in;
  `cameraExtent` out) are wired in `game-setup.ts` so `render/` never imports from `hud/` (UI.md §7);
  the own cell's progress indicators are drawn by the renderer from that record (UI.md §3.1, RENDERING §10).
- **Game events** (`state/game-event-bus.ts`, `GameEventBus`, #101): the one client seam for _moments_, as
  opposed to the state the signals carry. `state/snapshot-transitions.ts` turns each snapshot into them: every
  server `GameEffect` (tagged `isOwn` / `isOwnPredator`), the own cell's `stage_changed` and `organelle_gained`,
  `danger_changed` through the shared `canEngulf`, `engulf_progress` / `engulf_ended`, `round_phase_changed` and
  `bloom_started`. The renderer raises the moments only it knows (`zone_changed` from the dish geometry,
  `trait_cue` at a trait's keyframe, TRAITS §3) and the HUD raises `trait_picked` and `ui_click`. Subscribers
  (the sound bus today; the toast and onboarding services, the effects layer) never see each other, and
  `game-setup.ts` is the only place that feeds the tracker and connects the subscribers (`AUDIO.md` §5).
- **Cosmetics** draw from the round seed's cosmetic stream and its `COSMETIC_SUB_STREAM` forks
  (`RENDERING.md §1` owns the derivation) so a paused screenshot reproduces.
- **Frame budget** (#99): 60 fps, ≤ 12 ms p95 frame time at the 8-player baseline above (8 cells, 1 400 motes,
  110 fragments) at 1080p; the per-stage budget, the 100-cell bench scene that proves headroom above that
  baseline, and how a cell is drawn are [`RENDERING.md`](./RENDERING.md) §7.

## 7. Audio hook seam (#101)

The design and the tables are [`AUDIO.md`](./AUDIO.md) (decision #140, option B). The ids are
`SOUND_EVENT` in `types/audio.ts` (the trait cues are the `audioCue` values of TRAITS §3, typed as
`SoundEventId`); the rules (priority, cooldown, loop, bus) and the layering numbers are
`constants/audio.ts`, cosmetic data like `motion.ts`; `audio/sound-events.ts` holds the lookups and
`audio/audio-manifest.ts` the manifest shape and its one validator. On the client, `SoundEventBus`
(`audio/sound-event-bus.ts`) subscribes to the `GameEventBus` of section 6 and is the one place that
knows which moment plays which cue; `AudioService` resolves each through `assets/audio/manifest.json`
and plays via Web Audio behind the `AudioBackend` seam (`audio-backend.ts`; `web-audio-backend.ts` is
the only file that knows `AudioContext`), with `CueScheduler` (cooldown, overlap by priority),
`AmbientMixer` (stem per stage, zone overlay, duck) and `AudioBuses` (`master` → `music`, `sfx`; the
persisted mute). **Silent when the manifest or an asset is missing, never throwing.** Nothing but the
sound bus plays through `AudioService`; the HUD's mute toggle is its only other caller. Time is the
injected `CLOCK` (`clock-provider.ts`) and the audio clock, never a JS timer.

## 8. Debug MCP surface (#14)

`GameModule` gains the optional `getDebugHandle(): SimulationDebugHandle`
(`game/debug/simulation-debug-handle.ts`); the room exposes it as `GameRoom.getDebugHandle()`
and the handlers in `mcp/handlers/` reach it through the one shared lookup
(`handlers/capability-tool.ts`), only translating arguments and serialising results. Every
member of the handle is an optional **capability**: a tool whose capability the module does not
implement answers `isError` "not supported by this game module" instead of stubbing behaviour
(the echo module implements only the bot pair; the Evolution module implements all). The optionality is
for the template only: the Evolution handle is declared `implements Required<SimulationDebugHandle>`
so `tsc` checks completeness (a forgotten member is a type error, never a runtime "not
supported"), and the Evolution module never wires `DebugContext.getRoomGameState`; there is one
path to the full state, and the inspector fallback below is template compatibility only. A
refused request
(unknown player, unknown kind, a balance path that is not a number leaf) is a
`DebugRequestError`, which the lookup turns into an `isError` result. This table is the one home
of the tool names (the `_room` suffix marks the tools that act on the room loop rather than the
world; they need no capability):

| Tool                                                                                        | Handle method                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `debug_get_game_state(gameId)`                                                              | `GameRoom.getFullState()`: the module's `serializeFullState()`, no handle member                                                                                                                                                                                                                   |
| `debug_get_player_progress(gameId, playerId)`                                               | `getPlayerDebugState(playerId)`: progress, the cell view, modifiers, stage, owned traits, the offer queue, the input rejections, and `engulf` (the carried offset, the spit-out refractories and the last release with its reason — the one place a release reason can be read back, ECOLOGY §6.1) |
| `debug_get_entities(gameId, kind?, bbox?)`                                                  | `listEntities(filter)`                                                                                                                                                                                                                                                                             |
| `debug_grant_dna(gameId, playerId, dna, tags?)`                                             | `grantDna(playerId, grant)` (logged)                                                                                                                                                                                                                                                               |
| `debug_spawn(gameId, kind, x, y, params)`                                                   | `spawn(request)` through the spawner                                                                                                                                                                                                                                                               |
| `debug_set_player(gameId, playerId, mass?, level?, traits?, position?)`                     | `setPlayer(playerId, patch)` (logged)                                                                                                                                                                                                                                                              |
| `debug_pause_room(gameId)` / `debug_step_room(gameId, ticks)` / `debug_resume_room(gameId)` | `pause()`, `step(ticks)`, `resume()` on the room loop                                                                                                                                                                                                                                              |
| `debug_set_seed(gameId, seed)`                                                              | `reseed(seed)`: rebuilds the streams (`DETERMINISM.md §3`)                                                                                                                                                                                                                                         |
| `debug_get_balance(gameId)` / `debug_set_balance(gameId, patch)`                            | `getBalance()` / `patchBalance(patch)` + `balance_updated`                                                                                                                                                                                                                                         |
| `debug_get_state_hash(gameId)`                                                              | `computeStateHash()`                                                                                                                                                                                                                                                                               |
| `debug_export_replay(gameId)`                                                               | `exportReplay()` (`ReplayRecorder.export()`)                                                                                                                                                                                                                                                       |
| `debug_spawn_bot(gameId, behavior, seed?, preyPlayerId?)`                                   | `spawnBot(request, seat)`: a synthetic player the module drives (`TESTING.md §8.3`)                                                                                                                                                                                                                |
| `debug_remove_bot(gameId, playerId)`                                                        | `removeBot(playerId)`; refuses a player the module did not spawn                                                                                                                                                                                                                                   |

`debug_get_game_state` returns the template's `DebugContext.getRoomGameState(gameId)` inspector when
the init step wired one, else `GameRoom.getFullState()`: the module's own `serializeFullState()`, the
same `{ snapshot, balance }` that `game_state` sends a joining client. The handle has no second
full-state member, so the Evolution module cannot implement two shapes of one fact.
`patchBalance` applies `applyBalancePatch` (`game/debug/balance-patch.ts`): number leaves only,
at paths that exist, validated as a whole before anything is written.

The room loop tools: `pause` makes the room ignore ticker fires; `step(ticks)` pauses a running
room and runs exactly `ticks` steps (each broadcast; at most `secondsToTicks(DEBUG_STEP_MAX_SECONDS)`,
converted at the tool's schema, the constant itself stays in seconds); `resume` discards the wall
time that passed while paused (`FixedStepAccumulator.discardElapsed()`), so a resumed room never
bursts to catch up. `runTick` broadcasts every `SNAPSHOT_EVERY_TICKS` ticks and `step()` always
ends with a broadcast regardless of cadence, or a `debug_step_room(1)` screenshot would show a
stale frame. `GameRoom.getTickCount()` is the room's own step counter, the `tick` these tools
report even for a module without a world tick. **Every mutating tool republishes the frame** (#236):
a tool registered with `isWorldMutation` (`debug_spawn`, `debug_grant_dna`, `debug_set_player`,
`debug_set_balance`, `debug_set_seed`, `debug_spawn_bot`, `debug_remove_bot`) calls
`GameRoom.republishSnapshot()` after its handle method succeeds, a `game_snapshot` at the current
tick without a step, so a paused room shows the patched world at once and the stage that
`debug_get_player_progress` reports is the stage the client draws. The client's `SnapshotBuffer`
takes a snapshot at its latest tick as a replacement (a republished frame), not as a stale one, and
the tick estimator is not re-observed for it (§5); a refused request republishes nothing.

**Bots (#15).** The decision stack is production code under `game/bots/` (the strategy seam,
perception, the strategies, the catalogue, identity, pilot, binding and the in-process roster);
only the wire client lives in `testing/bot-client/`. `behavior` is validated once, by the tool's
`z.enum(BOT_STRATEGY_NAMES)` schema, so the handle and the roster only ever see a `BotStrategyName`.
`spawnBot(request, seat)` builds a `BotPilot` on that strategy from `createInProcessBotRoster(binding)`
(`game/bots/in-process-bots.ts`), mints its `SpawnedBot` identity (`sim_bot_<seed>_<index>`,
`Bot <index>`, an avatar: a prefix of its own, so it can never take a wire bot's `bot_<seed>_<index>`
seat even from the same seed), then calls `seat(bot)` BEFORE adding the player to the module. The
tool passes `GameRoom.addSyntheticPlayer` as `seat`: it refuses an id already in the roster or on a
socket with `DebugRequestError` (the module then holds nothing), else enrols the bot and broadcasts
`player_joined` like a late join, with no connection; `config.maxPlayers` is deliberately not
applied to a debug spawn. `removeBot` mirrors it: the module forgets the player,
`GameRoom.removeSyntheticPlayer` (which refuses a player with a live socket) drops it from the
roster and broadcasts `player_disconnected`. The module drives its roster at the top of
`reduceGameState` (`bots.driveTick(snapshot, tick, submitInput)`, before step 1 applies pending
input), so a bot's input for tick `t` is decided from the snapshot of `t − 1` and stamped
`sequence = t`, exactly as a wire client's would be. The echo module wires the roster over the
echo binding; the Evolution module (#152/#98) wires it over the Evolution binding and never spawns a
bot any other way. Wild cells (#156) are not synthetic players and never go through the roster:
they are world entities the simulation drives with the same strategies through an entity-id
`ownCellOf`.

## 9. Constants and balance (decision, one home)

`packages/shared/src/constants/<domain>.ts` is the **source of truth** for every tunable, named
exactly as the design tables name it (`GAME-DESIGN.md §12`, `ECOLOGY.md §7`, `PROGRESSION.md §6`,
`TRAITS.md §5`). `packages/shared/src/constants/balance.ts` assembles them into one
`DEFAULT_BALANCE = { world, session, worldClock, controls, ladder, ecology, growth, wildCells, absorption, progression, traits }`
(the domain modules spread into plain records) and `BalanceConfig`, which is `typeof DEFAULT_BALANCE`
with every number leaf widened to `number` (a constant declared `= 3000` has the literal type `3000`; a
patched copy holds other numbers). The record is deep-frozen: it aliases the module constants, so a room
that patched it without cloning would rewrite every room and the constants themselves; `applyBalancePatch`
returns a fresh copy and never writes its input.
`data/balance.json` is **generated** from `DEFAULT_BALANCE` by `scripts/generate-balance.ts`,
checked in as the diffable reference the debug tools quote, and pinned by
`balance.test.ts` (file equals `DEFAULT_BALANCE`, so hand edits fail the gate). At runtime each
room starts from a copy of `DEFAULT_BALANCE`; `debug_set_balance` patches number leaves only and the
world carries the live copy. Tier numbers are read from `balance.traits.TRAIT_TIERS` only:
`TRAIT_CATALOG[n].tiers` is structure and is never read for a number (the JSON writes both because a
catalog row carries its tiers), so a patch has one path. Nothing reads `data/balance.json` at
runtime. The full rule set is `CODE-STANDARDS.md §2`.

## 10. File plan (target ≤ 250 lines per file; 300 is the lint cap)

```text
packages/shared/src/
  constants/{index,units,network,lobby,identity}.ts            (template, already split)
  constants/{world,session,world-clock,controls,ladder,camera,ecology,growth,wild-cells,absorption,progression,traits}.ts
  constants/balance.ts                                          DEFAULT_BALANCE, BalanceConfig
  constants/trait-modifiers.ts                                  DEFAULT_CELL_MODIFIERS and one tier table per trait, re-exported by traits.ts
  constants/{simulation,netcode}.ts                             engineering constants (CODE-STANDARDS §2), not tunables
  constants/audio.ts                                            SOUND_EVENT_CATALOG and the layering numbers (AUDIO.md §2, §3); cosmetic, not in balance.json
  types/{common,messages,game,traits,effects,audio}.ts          traits: TraitDefinition, CellModifiers, TRAIT_CATEGORY, TRAIT_RARITY; audio: SOUND_EVENT, AUDIO_BUS, SoundEventRule
  testing/builders.ts                                           createTestSessionConfig, createTestGameInput, createTestSnapshot, createTestCellView, createTestPlayerProgressView
  hashing/fnv1a.ts                                              one FNV-1a fold for label seeds and hash lanes
  random/{random-source,seeded-random,xoshiro128-star-star,label-hash,stream-labels}.ts
  time/{clock,fixed-step-accumulator,units}.ts
  simulation/{movement-kernel,mass-curves,level-costs,engulf-eligibility,engulf-pace,state-hasher,state-hash,vector-math}.ts   engulf-pace: phases, rates, struggle, held speed (ECOLOGY §6.1)
  simulation/{world-clock,stage-of,entry-rule,bacterium-variant-weights}.ts   worldElapsedSeconds / worldReference / standingAgainstWorld (ECOLOGY §3.1); stageOf(traitIds, balance.ladder); entryMass / entryDnaFloor (PROGRESSION §5); the stage-driven broth variant row (ECOLOGY §3.2)
                                                                level-costs: levelUpCost(level, balance.progression) and cumulativeDnaForLevel, shared with the HUD (UI.md §3.1)
                                                                engulf-eligibility: canEngulf / canContinueEngulf(predator, prey, balance.absorption) (ECOLOGY §6.1)
                                                                vector-math: distanceBetween(origin, target) over Vec2 (the bots' and the simulation's one distance)
  audio/{sound-events,audio-manifest}.ts                        catalogue lookups and layering; the manifest shape + parseAudioManifest (AUDIO.md §4)
packages/server/src/
  lobby/{game-room,ticker}.ts                                   room drives the accumulator via Ticker
  game/evolution-module.ts                                      factory + GameModule (≤ 120 lines)
  game/world/{world-state,entities,create-world,entity-ids,lookups,simulation-invariant-error,streams,spatial-hash,state-hash}.ts   state-hash: computeStateHash over the records' HASHED_FIELDS (DETERMINISM §5)
  game/simulation/{step,round,round-clock,inputs,input-coalescing,movement,contact,eating,cell-mass,metabolism,engulf,engulf-state,engulf-payout}.ts   round-clock: the tick-based round clock and worldReferenceAt; engulf: the lifecycle step (#258), engulf-state: the record on a cell and every writer of it (the aborts included, so `session/death.ts` never imports the step), engulf-payout: the #259 seam
  game/simulation/{spawner,spawn-rates,spawn-point,spawn-mote,spawn-placement,mote-motion,zones}.ts
  game/progression/{levels,ladder,draft,offers,dna,modifiers}.ts   levels applies level-ups; the cost formula is shared simulation/level-costs.ts; ladder: the shared stageOf over owned traits
  game/session/{players,membership,entry,death,respawn,leaderboard}.ts   entry: entryState (PROGRESSION §5) composing the shared entryMass / entryDnaFloor for late join and respawn
  game/serialize/{serialize,food-delta-tracker}.ts
  game/replay/{replay-format,replay-recorder,recorded-step,replay-runner,index-by-tick}.ts
  game/debug/{simulation-debug-handle,evolution-debug-handle,debug-operations,balance-patch,debug-request-error}.ts   the seam, the Evolution handle (Required<SimulationDebugHandle>) and the recorded debug mutations
  game/bots/{bot-strategy,perception,strategy-catalog,strategy-constants}.ts   the strategy seam (ScriptContext, PlayerCommand, BotStrategy), BotPerception (+ ownCellOf, CellLocation), the name → factory catalogue and its constants (#15)
  game/bots/{bot-identity,bot-pilot,bot-binding,in-process-bots}.ts          who a bot is (wire `bot_` / in-process `sim_bot_` prefixes), one bot's brain, BotWorldBinding (+ echo binding, toWireInput), the roster a module drives
  game/bots/{evolution-binding,evolution-bots}.ts                            the Evolution binding over wire snapshots and the roster the Evolution module drives
  game/bots/strategies/{idle,wander,grazer,hunter}.ts                        the build-1 strategies (TESTING.md §8.3); #156 adds flee
  mcp/handlers/<tool>.ts (one file per tool, one shared room lookup)          bots.ts: debug_spawn_bot / debug_remove_bot
  testing/builders.ts   testing/world-builders.ts   testing/bot-builders.ts   testing/socket-builders.ts  test doubles: rooms and tools; createTestWorld / createTestStepContext / createTestPlayerRecord over the records; strategy contexts, fake transport and socket; a real /ws server on an ephemeral port
  testing/gameplay/*.ts (the scenario runner, #75; re-exports the game/bots seam)   testing/gameplay/strategies/script-sequence.ts (scenario-only)
  testing/gameplay/{evolution-adapter,evolution-fixtures,evolution-views}.ts   the Evolution ScenarioAdapter (TESTING §8), the placed and world fixtures on a live world, the table selectors
  testing/bot-client/{bot-session,bot-swarm,bot-timing,bot-transport,web-socket-transport,cli,cli-arguments,errors}.ts   the headless wire client (#15): one bot's protocol, N bots, its clock + ticker, the transport seam, the `ws` transport, the CLI and its parser, BotClientError
  testing/scenarios/{ecology-spawn,ecology-cells,game-design-session,game-design-controls,progression}.gameplay.test.ts (+ shared-setups.ts)   the design tables by row (#102)
packages/client/src/app/game/
  game-setup.ts  game-host.component.ts                         the composition root and the element that mounts it
  debug/evolution-debug.ts                                      `window.__evolutionDebug` (dev only): pause / step / resume / setSeed, TESTING.md's screenshot hook
  net/{snapshot-buffer,interpolation,food-store,world-store}.ts          interpolation owns renderTick (section 5); food-store applies the mote deltas; prediction and reconciliation are still open (#265)
  input/{input-constants,keyboard-action,input-state,game-input-builder}.ts   the key tables, the Space-precedence and hotkey rules, the state and the GameInput mapping — all pure (UI.md §4)
  input/{dom-input-context,keyboard-input,pointer-input,input-world-context,input-controller,attach-input}.ts   the DOM adapters, the WorldStore adapter, the client-tick controller and the composition
  render/{pixi-app,layers,camera,view-registry,constants,palette,easing}.ts
  render/{cells,food,dish,effects,noise,textures,bench}/**             (the one home of the render/ plan: RENDERING.md §8)
  clock-provider.ts                                             the injected Clock token (DETERMINISM §2)
  state/{game-state.service,game-event-bus,snapshot-transitions}.ts   the signal facade; the moment seam of section 6 and its snapshot detector
  state/own-cell-indicators.ts                                  pure ownCellIndicatorsFor, ladderFor (UI.md §3.1.4)
  audio/audio-hooks.ts                                          AudioHooks.connect(options): the composition root's one audio call (AUDIO.md §5)
  audio/{audio.service,sound-event-bus,cue-scheduler,ambient-mixer,audio-buses,audio-asset-cache}.ts
  audio/{audio-backend,web-audio-backend,audio-tokens}.ts       the Web Audio seam, its production impl, the injection tokens (AUDIO.md §5)
  hud/*.component.ts   hud/format/*.ts   hud/{onboarding,toast,hud-state}.service.ts
  hud/{hud-constants,test-ids,trait-glyphs}.ts                  (components and file roles: UI.md §7)
  ../testing/{builders,fake-websocket,fake-audio-backend,fake-audio-context}.ts   client test doubles (TESTING.md §4)
assets/audio/manifest.json                                      event → files, mood, length, prompt hint (AUDIO.md §4); the files are gitignored
data/balance.json                                               generated (section 9): `pnpm generate:balance`
scripts/generate-balance.ts
```

Import direction: `types` ← `constants` ← `simulation` (shared); `ladder.ts` and `traits.ts`
reference each other only as types (`TraitId`, `CellStage`), and `traits.ts` imports the value
`ENDOSYMBIOSIS_BACTERIA_REQUIRED` from `ladder.ts`, so there is no runtime cycle. On the server,
`game/bots` ← `game/*` and `testing/*`, never the reverse: no production file imports `src/testing/`.

## 11. Test plan (`ENGINEERING.md §2`, `DETERMINISM.md §7`)

- **Unit:** every system and progression function with a `createTestWorld` builder; movement
  kernel; mass curves; spatial hash vs brute force on seeded populations; serialize round-trip;
  food delta tracker; draft (ladder filter, rung card, weights, timeout pick); `foldModifiers`;
  snapshot buffer / prediction / reconciliation; schemas (`message-schemas.test.ts` bounds);
  `balance.test.ts` (generated file equals `DEFAULT_BALANCE`), `constants-ledger.test.ts` (every design
  table constant exists).
- **Integration:** input → step → snapshot through a real `GameRoom` under a `ManualClock`; late
  join gets a full `game_state` then deltas; reconnect resync; replay reproduces the hash; the
  rematch reseed (`seed + ROUND_SEED_INCREMENT`) produces a fresh world.
- **Gameplay scenarios (#102)** run each design table row by id on the framework (#75);
  **perf (#103)** records step/serialise timings and `snapshotBytes` against sections 3.3 and 4.1.
