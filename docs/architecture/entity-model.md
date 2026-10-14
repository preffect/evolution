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
export type GiantSpecies = 'giant_amoeba' | 'giant_paramecium' | 'giant_diatom'; // GIANT_SPECIES: a giant is a wild cell with a species (ecology/giants.md §3.5)
export type GiantRole = 'hunter' | 'grazer' | 'drifter'; // GIANT_ROLE: GIANT_ROLE_BY_SPECIES (constants/giants.ts) fixes each species' role
export type WorldStanding = 'ahead' | 'with' | 'behind'; // WORLD_STANDING: standingAgainstWorld (ecology/food-and-spawn.md §3.1)

export interface OwnedTrait {
  traitId: TraitId;
  tier: TraitTier;
}
export interface CellView {
  id: EntityId;
  kind: CellKind;
  playerId: PlayerId | null; // null for a wild cell
  organismId: EntityId; // == id for every cell in build 1, wild included (reserved grouping key, game-design/controls-and-scope.md §11; wild eats wild, ecology/wild-cells.md §3.3.2)
  avatarIndex: number;
  x: number;
  y: number;
  velocityX: number; // the record's (the kernel's); a held prey's view adds its tick's drag and arm pull (#774)
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
  isStarving: boolean; // a wild cell the die-off is starving (ecology/wild-cells.md §3.3.6); the renderer fades it; always false for a player cell
  giantSpecies: GiantSpecies | null; // the giant's species (ecology/giants.md §3.5.15), null for every other cell; canEngulf reads it, so the grazer and the drifter engulf no cell
  poolCreature: PoolCreatureView | null; // the pool creature's species and body (game-design/phases.md §14.6), its seat's mirror; null for every other cell
  latchedBacteria: LatchedBacteriumView[]; // the held list (game-design/early-life.md §15.4), catch order, ≤ LATCH_MAX_HELD; empty for every cell that does not latch
}
export interface LatchedBacteriumView {
  // every field stable while held, so a holder's view changes only on a latch, a bond or a shake (early-life.md §15.11)
  moteId: EntityId; // the held mote's own id: the effects key the renderer's rod on it
  variant: BacteriumVariant;
  bearingRadians: number; // from the cell's centre at the catch; SNAPSHOT_BEARING_DECIMALS on the wire
  caughtAtTick: number; // the client derives the bond's progress from it, its render tick and the live LATCH_BOND_SECONDS
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
// packages/shared/src/types/pool.ts — the rock pool's views (game-design/phases.md §14.5), ticket #932: the layout is drawn once, from the `pool` stream, at the round's start
// a view carries only what was drawn (positions, angles, ticks); every size is read from the live balance (wire-contract.md §4 "The pool layout")
export interface PoolFilmView {
  // a bacteria film on the floor: a fixed disc of POOL_FILM_RADIUS
  x: number;
  y: number;
}
export interface PoolThreadView {
  // an algal thread: a band POOL_THREAD_WIDTH wide and POOL_THREAD_LENGTH long, centred here along angleRadians (poolThreadEnds; a segment with a bounding radius for the hash and the cull)
  x: number;
  y: number;
  angleRadians: number;
}
export interface LightPatchOrbitView {
  // on startTick the patch's centre lies orbitRadius from the pool's centre at startAngleRadians; it turns counter-clockwise once per POOL_LIGHT_PATCH_PERIOD_SECONDS (lightPatchCentreAt, simulation/pool-layout.ts)
  orbitRadius: number;
  startAngleRadians: number;
  startTick: number;
}
export interface PoolLayoutView {
  // the bank has no field: it is the band POOL_BANK_WIDTH wide inside the wall
  films: PoolFilmView[];
  threads: PoolThreadView[];
  lightPatchOrbit: LightPatchOrbitView;
}
export interface SurgeView {
  // from startedAtTick for POOL_SURGE_SECONDS every cell and mote but the anchored is pushed along the unit direction at POOL_SURGE_SPEED (§14.5.3)
  startedAtTick: number;
  directionX: number;
  directionY: number;
}
export interface CopepodLaneView {
  // the copepod has no body (§14.6.4): its head is at the start point on startedAtTick and runs along the unit direction at COPEPOD_SPEED, sweeping a lane COPEPOD_LANE_WIDTH wide
  startX: number;
  startY: number;
  directionX: number;
  directionY: number;
  startedAtTick: number;
}
export type PoolCreatureSpecies = 'didinium' | 'rotifer' | 'nematode' | 'copepod'; // POOL_CREATURE_SPECIES (§14.6.1, ticket #935); also the debug_spawn kinds and debug_get_entities filters (debug-mcp.md §8)
export type PoolCreatureCellSpecies = Exclude<PoolCreatureSpecies, 'copepod'>; // the copepod has no cell: its pass is CopepodLaneView
export type CreditlessKillerSpecies = 'rotifer' | 'copepod'; // the kills that credit no one (§14.6.4)
export interface PoolCreatureView {
  // CellView.poolCreature: a creature's cell is a wild cell with it set, as a giant is one with giantSpecies set; the wild seats' rules skip it (ticket #872)
  species: PoolCreatureCellSpecies;
  isLandmark: boolean; // the one rotifer at ERA_LANDMARK_RADIUS (§14.6.3): no pull (the shared pull skips it), never eaten
  headingRadians: number; // the way the body lies; the nematode's chain is laid along it (nematodeSegmentCentres, simulation/pool-creature-shapes.ts); SNAPSHOT_BEARING_DECIMALS on the wire
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
  bacteriaEatenByVariant: Record<BacteriumVariant, number>; // endosymbiosis counters, kept on death: bacteria taken in, swallowed or held to the bond (early-life.md §15.4.1; the wire name stays, #907)
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
  noDraftBonusGained?: number; // the mass an offer dropped for want of cards added in this window, as applied (#416)
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
`BACTERIUM_VARIANT`, `DNA_TAG`, `ZONE_ID`, `CELL_STATE`, `CELL_STAGE`, `PLAYER_LIFE_STATE`, `CELL_KIND`, `GIANT_SPECIES`, `GIANT_ROLE`, `WORLD_STANDING`, `ENTITY_KIND`, `POOL_CREATURE_SPECIES`) with the
union derived from it (`CODE-STANDARDS.md §2`); `EFFECT_KIND` (`types/effects.ts`), `TRAIT_CATEGORY` and
`TRAIT_RARITY` (`types/traits.ts`, with the trait definition shape and `CellModifiers`) follow the same rule.
The effects (`types/effects.ts`) are a discriminated union on `EFFECT_KIND`, each carrying the tick and the
world position it happened at: `cell_absorbed { cellId, playerId, predatorCellId, predatorMassGained,
predatorDnaGained, preyGiantSpecies }` (`playerId` is `PlayerId | null` like `CellView.playerId`: `null` for a wild prey, which is
reported like any other so the predator's viewer sees the dissolve, #270; `preyGiantSpecies` is the prey's
`giantSpecies`, which the client's giant popup reads, ecology/giants.md §3.5.8), `eat { cellId, eatenId, eatenKind,
massGained, dnaGained }` (the amounts measured around the gains,
#383, wire-contract.md §4 "Mass flow"), `level_up { cellId, playerId, level }`, `respawn { cellId, playerId }`; the latch's three (game-design/early-life.md §15.4, keyed by the mote's own id so the
renderer knows which rod): `bacterium_latched { cellId, moteId, variant }` at the mote's centre, `bacterium_bonded {
cellId, moteId, isCredited }` at the rim point beside the ordinary `eat` of the same mote (which carries the payout, so
the mass accounting is unchanged), and `latch_shaken { cellId, moteIds }` at the cell's centre (`moteIds` the ids they
were held under; the freed motes take fresh ids). Five happen everywhere and carry no position: `world_level_up {
level, stage }` (ecology/food-and-spawn.md §3.1), the eras' two (game-design/phases.md §14.4.1, ticket #931),
`era_warning { era }` `ERA_MOVE_WARNING_SECONDS` before a move and `era_moved { era }` on its tick, `era` being the era
the move goes into (a step that runs two moves emits two `era_moved`, in era order), and the pool's two warnings
(phases.md §14.5.2, §14.6.1, ticket #932), each carrying its view's fields: `surge_warning { startedAtTick,
directionX, directionY }` `POOL_SURGE_WARNING_SECONDS` before a surge and `copepod_warning { startX, startY,
directionX, directionY, startedAtTick }` `COPEPOD_WARNING_SECONDS` before a pass, on the tick the snapshot's `surge` or
`copepodLane` first carries it. A death to a creature with no killer cell (phases.md §14.6.4, ticket #935) emits
`eaten_by_creature { cellId, playerId, species, killerCellId }` at the victim's centre instead of `cell_absorbed`:
`species` is `rotifer` or `copepod` (`CreditlessKillerSpecies`), `killerCellId` the swallowing rotifer's cell, which a
player victim spectates, or null for the copepod; no one is credited (`killWithoutCredit`, server `session/death.ts`).

The **records** are the server's supersets in `packages/server/src/game/world/entities.ts`;
`serialize.ts` projects records onto views and nothing else reads a record outside
`packages/server/src/game/`.

```ts
// packages/server/src/game/world/entities.ts — records extend the views
export interface CellRecord extends Omit<CellView, 'latchedBacteria'> {
  latchedBacteria: LatchedBacteriumRecord[]; // the held list, each entry richer than the view's (below); hashed in the walk's trailing section (determinism/ordering-and-state-hash.md §5)
  targetX: number | null; // latest applied input's target, latched until an input with one replaces it; null until the first such input (no target: throttle 0, ecology/mass-and-movement.md §5.2)
  targetY: number | null;
  modifiers: CellModifiers; // folded at step 1 of the tick (traits/model.md §2); the simulation reads only this
  carriedOffsetX: number | null; // set at the seal (ecology/absorption.md §6.1): the prey rides at this offset from its predator's centre until payout or release
  carriedOffsetY: number | null;
  heldDisplacementX: number; // this tick's drag and arm pull on a held prey (ecology/absorption.md §6.1, #774), cleared at step 6; the serializer adds it ÷ the tick to the view's velocity, the kernel never reads it; unhashed
  heldDisplacementY: number;
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
export type BacteriumMoteRecord = FoodMoteRecord & { bacteriumVariant: BacteriumVariant }; // the only food a latch takes
export interface LatchedBacteriumRecord {
  // one held bacterium (game-design/early-life.md §15.4.1): the mote's own record kept untouched from the catch, so a bond
  // eats it through eatFoodMote and a shake puts it back into the world at its rim point under a fresh id, its mass, DNA, tag and heading kept (§15.4.2)
  mote: BacteriumMoteRecord;
  bearingRadians: number;
  caughtAtTick: number;
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
  `kind: 'wild'`, `playerId: null` and `organismId` equal to their own id (so wild engulfs wild by the ordinary
  rule), carrying the player's sprint counters (`sprintRemainingTicks`, `sprintCooldownRemainingTicks`), each owned
  by a `WildSeatRecord` in `world.wildSeats`. A giant (ecology/giants.md §3.5) is such a wild cell with its
  `giantSpecies` set, owned by a `GiantSeatRecord` in `world.giantSeats`. Both seats extend one base, what every
  seat's mind reads (ticket #826):

  ```ts
  export interface SeatMindRecord {
    seatNumber: number; // a wild seat 0..WILD_CELL_COUNT − 1; a giant WILD_CELL_COUNT + its place in GIANT_SPECIES_ORDER
    cellId: EntityId | null; // null while vacant (respawn countdown)
    grownMass: number; // permanent growth above the base size; only the player's decay (× GIANT_DECAY_MULTIPLIER for a giant) and a sprint's cost remove it (ecology/wild-cells.md §3.3.1)
    fullMass: number; // last settle's full size: min(base + grownMass, max(base, growth ceiling)); cell.mass − fullMass is the wound
    respawnInTicks: number;
    headingX: number;
    headingY: number;
    decideInTicks: number;
    huntPreyId: EntityId | null; // the four hunt fields of ticket #738 (wild/wild-hunt-give-up.ts)
    huntStartTick: number;
    givenUpPreyId: EntityId | null;
    huntRestUntilTick: number;
  }
  export interface WildSeatRecord extends SeatMindRecord {
    sizeFactor: number; // log-uniform on [WILD_CELL_SIZE_FACTOR_MIN, _MAX], drawn at each (re)spawn; base size = worldMass × sizeFactor
    isStarving: boolean; // the die-off's starver, committed until its cell dies (ecology/wild-cells.md §3.3.6); the cell's `isStarving` mirrors it
  }
  export interface GiantSeatRecord extends SeatMindRecord {
    species: GiantSpecies; // one seat per species
    bornMass: number; // the base size: uniform on the species' range, drawn at each (re)spawn; never decays, never moves with the world
  }
  export interface PoolCreatureSeatRecord {
    // a pool creature's whole memory (game-design/phases.md §14.6, ticket #935): its own seat list, WorldState.poolCreatureSeats; no mind fields yet (tickets #872, #873 add theirs)
    species: PoolCreatureCellSpecies;
    isLandmark: boolean;
    cellId: EntityId | null; // null while vacant
    respawnInTicks: number;
    headingRadians: number;
  }
  ```

  A creature's cell is a wild cell whose `poolCreature` mirrors its seat's `species`, `isLandmark` and `headingRadians`,
  written only by `mirrorPoolCreatureSeat` (`game/world/pool-creature-mirror.ts`), which also sets the cell's radius by
  `cellRadiusOf` (shared `simulation/pool-creature-shapes.ts`): the landmark's is `ERA_LANDMARK_RADIUS` and the
  nematode's its bounding radius, whatever their mass, and `setCellMass` and the step-1 fold keep them (every cell's
  radius is `cellRadiusOf`, which is `radiusForMass` for every cell that is not such a creature).

  The seat record is the whole of a seated cell's memory: the wound is not stored, it is `cell.mass − fullMass`, and
  every field above is hashed (`WILD_SEAT_HASHED_FIELDS`, `GIANT_SEAT_HASHED_FIELDS`). The giant seats live apart
  from the wild seats so the die-off's sum and `WILD_CELL_COUNT` stay the wild seats' (ecology/giants.md §3.5.10).
  The world clock is never sent: the snapshot carries `roundStartTick` and both sides compute
  `worldReference(worldElapsedSeconds(tick, roundStartTick, roundDurationSeconds), balance)` (`simulation/world-clock.ts`).
  The era is derived too (game-design/phases.md §14.2.1): `GameEra` (`types/game.ts`: `dish`, `pool`, `colonies`,
  opening in `GAME_ERA_ORDER`) is `eraAt(<the same elapsed seconds>, roundDurationSeconds, balance)`
  (`simulation/era-clock.ts`), the one function the step, the bloom and the HUD ask. What the world stores is which
  moves have run, `eraMovedInto` (below; the rule is architecture/server-simulation.md §3), and the snapshot's `era`
  copies that.

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
  roundStartTick: number; // 0 at creation, the current tick at a rematch (ecology/food-and-spawn.md §3.1); moved back, possibly below 0, by debug_set_era (game-design/phases.md §14.2.4); carried on the snapshot
  roundPhase: RoundPhase;
  roundTimeLeftMs: number;
  config: GameSessionConfig;
  balance: BalanceConfig; // defaults from shared constants; patched only by debug_set_balance
  eraMovedInto: GameEra; // the last era whose move has run: 'dish' at build (creation, rematch), kept by a reseed, left alone by a debug_set_era jump; the step runs every move after it up to eraAt (server-simulation.md §3); the snapshot's era copies it; hashed in the eras' section (ticket #931)
  gelPatches: GelPatchView[];
  poolLayout: PoolLayoutView | null; // drawn from the `pool` stream at the round's start when the pool is in play (ticket #870), null in every other round; on the snapshot from the pool's warning tick (wire-contract.md §4 "The pool layout")
  surge: SurgeView | null; // from its warning to its end (ticket #903), else null
  copepodLane: CopepodLaneView | null; // the copepod's pass from its warning to its end (ticket #873), else null
  poolCreatureSeats: PoolCreatureSeatRecord[] | null; // seat order; placed by the pool's move (ticket #872), null in every world without creatures (ticket #935)
  // the four above are hashed in the eras' section, with the eras' streams (determinism/ordering-and-state-hash.md §5, tickets #932, #935)
  cells: CellRecord[]; // insertion order
  food: FoodMoteRecord[];
  dnaFragments: DnaFragmentRecord[];
  players: PlayerRecord[]; // join order
  wildSeats: WildSeatRecord[]; // seat order (ecology/wild-cells.md §3.3)
  giantSeats: GiantSeatRecord[]; // seat order: one per species GIANT_SPECIES_IN_DISH names at creation, or a fixture or debug_spawn seats (ecology/giants.md §3.5.9)
  firstGiantSeatNumber: number; // WILD_CELL_COUNT at creation: giant seats are numbered from it, whatever a patch does later (ecology/giants.md §3.5.9)
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
