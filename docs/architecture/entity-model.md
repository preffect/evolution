# Evolution — Architecture: decisions and the entity model

§1–§2 of the split [`ARCHITECTURE.md`](../ARCHITECTURE.md), which keeps the shared context and the file list.

## 1. Decisions (the short list)

| Decision                        | Choice                                                                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulation rate / snapshot rate | `TICK_HZ` = 60 fixed step; broadcast every `SNAPSHOT_EVERY_TICKS` = 3 ticks, so the wire runs at 20 Hz (#214) while the simulation steps 60 times a second |
| Input rate                      | One `GameInput` per simulation tick, as `game-design/controls-and-scope.md §6` says; no separate input-rate constant                                       |
| Authority                       | Server owns position, mass, eating, engulf, DNA, levels, drafts, spawns, respawn, score                                                                    |
| Client-side cosmetic            | Membrane wobble, granule drift, particles, camera; never fed back                                                                                          |
| Renderer (#33, closed)          | WebGL via **Pixi v8**; benchmark numbers land in the renderer PR                                                                                           |
| Food on the wire                | Static motes (algae, detritus) as spawned/removed deltas; bacteria and fragments move, so they ride in full                                                |
| State update style              | Systems mutate the one `WorldState` in place inside `stepWorld` (section 3.1)                                                                              |
| Tunables                        | `packages/shared/src/constants/<domain>.ts` is the source; `data/balance.json` is generated from it                                                        |
| Interest management             | One snapshot for every client; viewport culling is a held lever (section 4.2)                                                                              |
| Client prediction               | Own cell predicted with the shared movement kernel, one input per tick, reconciled (section 5)                                                             |
| Randomness / time               | Seeded streams stored in the state and an injected clock only (`DETERMINISM.md`)                                                                           |
| Trust model                     | Local-only, client trusted; inputs validated by schema, nothing else checked                                                                               |

## 2. Entity model

Two layers, one direction: the **views** are the wire types in
`packages/shared/src/types/game.ts`, defined here (their one home) with each field's meaning
owned by the design doc that names it: `CellStage` and its `STAGE_ORDER` / `STAGE_GATE_TRAITS`
by [`game-design/core.md §3`](../game-design/core.md#3-the-evolution-ladder), progress and offers by
[`PROGRESSION.md`](../PROGRESSION.md), food by [`ecology/food-and-spawn.md §1`](../ecology/food-and-spawn.md#1-food-kinds),
engulf states by [`ecology/absorption.md §6.2`](../ecology/absorption.md#62-state-diagram), engulf eligibility (`canEngulf`,
the one predicate the server, HUD and renderer share) and the engulf phases (`engulfPhaseOf` over
`engulfProgress`; no phase field rides on the view) by [`ecology/absorption.md §6.1`](../ecology/absorption.md#61-rules),
the trait definition shape
(`stage`, `requires`, `unlockedBy`, `exclusionGroup`) by [`traits/model.md §1`](../traits/model.md#1-definition-shape).

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
export type CellKind = 'player' | 'wild'; // CELL_KIND: a wild cell is the world clock made flesh (ecology/wild-cells.md §3.3)
export type WorldStanding = 'ahead' | 'with' | 'behind'; // WORLD_STANDING: standingAgainstWorld (ecology/food-and-spawn.md §3.1)

export interface OwnedTrait {
  traitId: TraitId;
  tier: TraitTier;
}
export interface CellView {
  id: EntityId;
  kind: CellKind;
  playerId: PlayerId | null; // null for a wild cell
  organismId: EntityId; // == id for a player cell in build 1 (reserved grouping key, game-design/controls-and-scope.md §11); WORLD_ORGANISM_ID for every wild cell
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
  membraneRatioBonus: number; // modifiers.membraneRatioBonus mirrored at step 1 so canEngulf (ecology/absorption.md §6.1) reads views on both sides
  states: CellState[]; // 'engulfing' and 'being_engulfed' may coexist
  engulfProgress: number; // 0..1 as prey
  engulfingCellId: EntityId | null;
  engulfedByCellId: EntityId | null;
  sprintRemainingTicks: number;
  sprintCooldownRemainingTicks: number; // 0 = sprint ready; the HUD meter reads it (ui/hud.md §3.1), never estimates it
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
  level: number; // the level-up that queued it: back-to-back offers keep their own levels (PROGRESSION §4, ui/overlays.md §3.2)
  cards: OwnedTrait[]; // the tier each card would grant
  expiresAtTick: number;
}
export interface TraitChoiceInput {
  offerId: number;
  cardIndex: number; // 0..TRAIT_DRAFT_SIZE-1; a stale offerId is ignored and counted (section 3.2)
}
export interface PlayerRosterView {
  // GameSnapshot.players: what every client is sent of every player (#331, architecture/wire-contract.md §4.1)
  playerId: PlayerId;
  playerName: string;
}
export interface PlayerProgressView extends PlayerRosterView {
  // GameSnapshot.ownProgress: sent to its own player only; the records extend it and the debug tools return it
  level: number;
  dnaCumulative: number;
  dnaCatchUpGift: number;
  dnaTowardNextLevel: number;
  dnaTagPoints: Record<DnaTag, number>;
  bacteriaEatenByVariant: Record<BacteriumVariant, number>; // endosymbiosis counters, kept on death
  absorptions: number; // players absorbed: the only ones that score (game-design/session.md §5.3)
  wildAbsorptions: number; // wild cells absorbed; never scores (ecology/wild-cells.md §3.3)
  score: number;
  ownedTraits: OwnedTrait[]; // survive death; a live cell's `traits` mirrors them
  stage: CellStage; // stageOf(ownedTraits), carried so the HUD reads the ladder without a cell (ui/overlays.md §3.2)
  offer: TraitOfferView | null;
  lifeState: PlayerLifeState; // the only home of death / respawn
  spectatingCellId: EntityId | null; // the killer's cell (a wild killer has no player, game-design/session.md §5.2); null once it is gone
  respawnInTicks: number;
}
// packages/shared/src/types/mass-flow.ts (#383): why the own cell's mass moves (ui/hud.md §3.1.5, architecture/wire-contract.md §4)
export type MassRateCause = 'toxin' | 'swallowed' | 'decay' | 'vent' | 'light'; // MASS_RATE_CAUSE; declaration order is the tag tie-break
export interface MassFlowView {
  ratesPerSecond: Partial<Record<MassRateCause, number>>; // what metabolism applied this tick, post-floor and post-cap; losses negative; zeros left out
  decayTraitShare?: number; // the folded decayMultiplier − 1; left out at 0
  zone: ZoneId; // the zone the metabolism step used
  sprintSpent?: number; // the mass a sprint start took in this broadcast window, as applied
}
export interface OwnProgressView extends PlayerProgressView {
  // GameSnapshot.ownProgress; the records extend PlayerProgressView, never this: the flow is the transient world.massFlow, never hashed
  massFlow: MassFlowView | null; // null while spectating and before a new cell's first metabolism step
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
world position it happened at: `cell_absorbed { cellId, playerId, predatorCellId, predatorMassGained,
predatorDnaGained }` (`playerId` is `PlayerId | null` like `CellView.playerId`: `null` for a wild prey, which is
reported like any other so the predator's viewer sees the dissolve, #270), `eat { cellId, eatenId, eatenKind,
massGained, dnaGained }` (the amounts measured around the gains,
#383, wire-contract.md §4 "Mass flow"), `level_up { cellId, playerId, level }`, `respawn { cellId, playerId }`; `world_level_up { level, stage }`
(ecology/food-and-spawn.md §3.1) happens everywhere and is the one effect without a position.

The **records** are the server's supersets in `packages/server/src/game/world/entities.ts`;
`serialize.ts` projects records onto views and nothing else reads a record outside
`packages/server/src/game/`.

```ts
// packages/server/src/game/world/entities.ts — records extend the views
export interface CellRecord extends CellView {
  targetX: number | null; // latest applied input's target, latched until an input with one replaces it; null until the first such input (no target: throttle 0, ecology/mass-and-movement.md §5.2)
  targetY: number | null;
  modifiers: CellModifiers; // folded at step 1 of the tick (traits/model.md §2); the simulation reads only this
  carriedOffsetX: number | null; // set at the seal (ecology/absorption.md §6.1): the prey rides at this offset from its predator's centre until payout or release
  carriedOffsetY: number | null;
  spitOutRefractoryUntilTickByPreyId: Map<EntityId, number>; // ecology/absorption.md §6.1: one entry per spat-out prey (no restart on it until that tick; separation applies to the pair meanwhile); expired entries pruned at step 1
}
export interface PlayerRecord extends PlayerProgressView {
  avatarIndex: number;
  joinOrder: number; // tie-break for the leaderboard and the input drain order
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
  mass: number; // ecology/food-and-spawn.md §1 by kind
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
  from the player's owned traits and recomputed with the modifiers at step 1;
  `PlayerProgressView.stage` is the same derivation, rewritten by `refreshPlayerStage` wherever
  `ownedTraits` changes (a pick or timeout, `debug_set_player`, a scenario fixture), so it survives
  death and the state hash leaves it out as derived; the draft
  (`progression/draft.ts`) filters candidates by stage reached, `requires` owned and the
  `unlockedBy` counter (`bacteriaEatenByVariant`) exactly as [`PROGRESSION.md §3`](../PROGRESSION.md#3-draft-pool-and-weights)
  states, then reserves the rung card. Trait effects are data (`TRAIT_TIERS`) folded by
  `progression/modifiers.ts` into one `CellModifiers` record; no system ever switches on a trait id.
- **Death lives on the player.** `PlayerProgressView.lifeState`, `spectatingCellId` and
  `respawnInTicks` are the only death/respawn state; an absorbed cell is removed from
  `world.cells` the tick it is absorbed and emitted as a `cell_absorbed` effect (ecology/absorption.md §6.2).
  A spectating player has no cell record.
- **Wild cells are cells, not players** (ecology/wild-cells.md §3.3): ordinary `CellRecord`s in `world.cells` with
  `kind: 'wild'`, `playerId: null` and `organismId: WORLD_ORGANISM_ID`, owned by a `WildSeatRecord`
  (`seatNumber`, `cellId | null`, `massSpreadFactor`, `respawnInTicks`, `headingX`, `headingY`,
  `decideInTicks`, `drainedMass`) in `world.wildSeats`. The world clock is never sent: the snapshot
  carries `roundStartTick` and both sides compute `worldReference(worldElapsedSeconds(tick, roundStartTick,
roundDurationSeconds), balance)` (`simulation/world-clock.ts`).
- **Score** is computed, never stored twice: `session/leaderboard.ts` implements
  `score = (dnaCumulative − dnaCatchUpGift) + SCORE_ABSORPTION_BONUS × absorptions` with ties by
  mass then `joinOrder` (game-design/session.md §5.3) and writes `PlayerProgressView.score` and the
  `leaderboard` rows at step 10.
- **Records keyed by a closed enum** (`dnaTagPoints: Record<DnaTag, number>`,
  `bacteriaEatenByVariant: Record<BacteriumVariant, number>`) are walked in the enum's declared
  array order (`DNA_TAGS`, `BACTERIUM_VARIANTS`), never by `Object.keys`; that is what lets the
  state hash cover them (`determinism/ordering-and-state-hash.md §5`).
- Ids come from a per-world monotonic counter with a kind prefix (`c-17`, `m-2041`, `f-9`),
  never from randomness. `ENTITY_KIND = { cell: 'cell', foodMote: 'food_mote', dnaFragment: 'dna_fragment' }`
  is the debug-tool filter vocabulary; `organismId` (= own id in Build 1), the `dividing` state and
  the `shouldSplit` / `shouldEject` inputs are the reserved hooks of game-design/controls-and-scope.md §11.

```ts
// packages/server/src/game/world/world-state.ts
export interface WorldState {
  tick: number;
  seed: number; // the current round's seed (rematch increments it)
  roundStartTick: number; // 0 at creation, the current tick at a rematch (ecology/food-and-spawn.md §3.1); carried on the snapshot
  roundPhase: RoundPhase;
  roundTimeLeftMs: number;
  config: GameSessionConfig;
  balance: BalanceConfig; // defaults from shared constants; patched only by debug_set_balance
  gelPatches: GelPatchView[];
  cells: CellRecord[]; // insertion order
  food: FoodMoteRecord[];
  dnaFragments: DnaFragmentRecord[];
  players: PlayerRecord[]; // join order
  wildSeats: WildSeatRecord[]; // seat order (ecology/wild-cells.md §3.3)
  leaderboard: LeaderboardRow[];
  spawners: { food: SpawnerState; dnaFragments: SpawnerState }; // fractional accumulators (ecology/food-and-spawn.md §3)
  random: Record<ServerRandomStreamLabel, RandomState>; // the server streams' serialisable state, walked in SERVER_RANDOM_STREAM_LABELS order (determinism/random-streams.md §3, determinism/ordering-and-state-hash.md §5)
  nextEntityNumber: number;
  effects: GameEffect[]; // this tick's effects, drained by serialize (cell_absorbed, eat, level_up, …)
}
```

Every collection is an array in insertion order. Membrane vertices, wobble phase and particle
state do not exist on the server. The spatial hash is rebuilt every tick and is not part of the
state.
