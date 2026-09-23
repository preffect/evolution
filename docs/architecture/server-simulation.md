# Evolution — Architecture: server simulation

§3 of the split [`ARCHITECTURE.md`](../ARCHITECTURE.md), which keeps the shared context and the file list.

## 3. Server simulation (`packages/server/src/game/`)

`evolution-module.ts` implements the template's `GameModule` seam and stays thin (wiring only):
it coalesces inputs, calls `stepWorld`, and serialises. All decision logic is in the subsystems
of the file plan (section 10), in this fixed step order (the scenario tables are computed
against it):

```text
 stepWorld(world, context): void          context = { balance, streams, effects }
   1 inputs        apply the coalesced input per player (join order); fold modifiers + stage; then the wild settle and the due wild seats' decisions (§3.4)
                   (`wild/wild-settle.ts`: every seated wild cell's growth, recovery, level, traits and stage; `wild/wild-strategy.ts`: target + sprint)
   2 round         timer, bloom flag, world level-up, results phase (ignores 1, freezes 3–9: game-design/session.md §5.4), auto-rematch reseed
   3 movement      shared kernel: throttle, steer blend, gel factor, wall clamp; then separation
   4 eating        motes and fragments within the radius, variant counters, cap overflow → DNA; a wild cell eats algae and detritus only
   5 metabolism    decay, toxin and spike drains, photosynthesis (one formula, ecology/mass-and-movement.md §4.1); a wild cell,
                   free or engulfing, takes every drain and gain but no base decay (the settle takes decay from its growth)
   6 engulf        canStart / canContinue, progress, release, payout, chains; absorbed cells removed
   7 progression   level-ups, offer queue, timeouts, rung card
   8 spawners      food and fragment accumulators, bacteria random walk, fragment drift, detritus expiry
   9 respawn       spectate timers, safe placement from the spawnPlacement stream; then the wild seats (`wild/wild-respawn.ts`:
                   a vacated seat counts `WILD_CELL_RESPAWN_SECONDS` down and is placed again with a fresh size factor, no growth)
  10 leaderboard   score and ranking
```

### 3.1 In-place systems, pure step

Systems are `(world: WorldState, context: StepContext) => void` and **mutate the world they
receive**; `stepWorld` returns nothing and the module keeps one `WorldState` for the room's
lifetime. Why in place: the pair-wise systems (separation, engulf chains) update two records at
once, the hash and the spatial hash walk one owned structure, and rebuilding arrays of ~1 500
entities sixty times a second buys nothing at this scale. What "pure" means here (the word
the design uses for `progression/ladder.ts`, game-design/core.md §3): a system reads nothing but its
arguments, calls no IO, no clock, no
`Math.random`, and two worlds that hash equal before a step hash equal after it. Tests therefore
assert **values and hashes**, never object identity; `engineering/testing-and-typescript.md §2.3`'s
`expect(result).not.toBe(prevState)` applies to reducers that return new state (lobby and room
descriptors, the client `WorldStore`), not to the simulation. Formulas in `packages/shared`
(`movement-kernel.ts`, `mass-curves.ts`) stay side-effect free and take numbers, so the client
prediction reuses them unchanged.

### 3.2 Input handling

- `submitInput(playerId, input)` **coalesces** into `PlayerRecord.pendingInput`: the newest
  `sequence` and the newest non-null `targetX/targetY` win; `shouldSprint` and `traitChoice` are OR-merged (a one-shot that
  arrives together with a newer target is never lost). Step 1 applies the pending input, records
  its `sequence` as `appliedInputSequence`, latches the target on the cell when the input carries one, and clears the
  one-shots. An input with a `sequence` ≤ the applied one is dropped and counted in
  `PerformanceTracker.rejectedInputs`.
- `shouldSprint` starts a sprint only when the cooldown allows (game-design/controls-and-scope.md §6); otherwise it is
  ignored and counted. `traitChoice` applies only when `offerId` is the shown offer
  (PROGRESSION §4); a stale pick is ignored and counted. `shouldSplit` / `shouldEject` pass the schema and
  are ignored by the simulation without counting: they are reserved, not invalid (game-design/controls-and-scope.md §11).
- The template's `GameRoom` calls `reduceGameState()` once per tick from the injected ticker
  (`determinism/contract-and-clock.md §2`); `reduceGameState` is `stepWorld` plus effect draining, nothing else.

### 3.3 Other structural rules

- **Fixed step.** Nothing in `game/` reads a clock; time is `world.tick` and `TICK_INTERVAL_S`.
- **Tunables** reach the systems as `context.balance` (section 9), never as module imports from
  `constants/`; formulas take numbers. That is what makes `debug_set_balance` live.
- **Spatial hash** (`world/spatial-hash.ts`): uniform grid rebuilt at step 3, cell size
  `SPATIAL_HASH_CELL_SIZE_WU`; `queryCircle` returns id-sorted results. Cell pairs (separation, engulf)
  come from `contact.ts` `cellPairs`: every pair of the few cells, id-sorted, no hash needed.
- **Engulf is server-only.** The client animates `states`, `engulfProgress` and effects. What it shares
  is the eligibility predicate `canEngulf` (`shared/simulation/engulf-eligibility.ts`, ecology/absorption.md §6.1: the
  engulf system, the HUD threat label (`threatsFor`) and the warning ring all call it on views, and its
  signature is mass-only) and the phase formulas of `shared/simulation/engulf-pace.ts` (`engulfPhaseOf` for the chip's
  sealed state, `engulfProgressDelta`, the held and predator speed factors, `spitOutChancePerTick`); the
  hold verdict `resolveEngulfHold` (ratio and spit-out) is called by the server alone. The engulf step is
  the only consumer of the `engulf` random stream and draws from it only for a wrapped or sealed prey
  with a positive `spitOutChancePerSecond` (determinism/random-streams.md §3). The prey's struggle reads the movement
  kernel's `steerCommand(cell)` so the throttle arithmetic has one home. Every release emits
  `cell_released { cellId, predatorCellId, reason }` (`types/effects.ts`, reasons in ecology/absorption.md §6.1) beside
  `cell_absorbed`; a sealed prey is carried (`CellRecord.carriedOffsetX/Y`) after its predator has moved.
- **Perf budget** (measured by `PerformanceTracker`, gated in #103): step ≤ 4 ms p95 and serialise
  ≤ 2 ms p95 at 8 players, 1 400 motes, 110 fragments; `MAX_TICKS_PER_ADVANCE` bounds catch-up.

### 3.4 Wild cells in the step (ecology/wild-cells.md §3.3, #517)

A wild cell is a `CellRecord` driven by a seat (architecture/entity-model.md §2); what differs from a player cell
is confined to `game/wild/` and to three branches on `cell.kind` in steps 4 and 5.

- **The settle** (`wild/wild-settle.ts`) replaces the per-tick pin. The pure core is
  `settleWildMass({ mass, fullMass, grownMass, decayPerSecond, baseMass, worldMass }, balance) → { mass, grownMass,
fullMass }` (ecology W11) plus `wildSizeFactor(u, balance)`. Its caller supplies `decayPerSecond` from
  `simulation/metabolism.ts` (`decayPerSecond(metabolismInputOf(cell, world, balance), balance)`), so the settle never
  carries a second decay formula, and supplies `baseMass` and `worldMass` from `worldReferenceAt`. Level, traits
  and stage are set as the pin set them (`wild-build.ts`, unchanged).
- **A loss never lifts a wild cell.** Step 5 and a sprint start floor a wild cell at `min(CELL_STARTING_MASS,
its mass before the change)`, never at `CELL_STARTING_MASS`: a cell born below 20 would otherwise be raised to
  20 by a drain or a sprint, and the settle would book the rise as permanent growth. The floor has one home,
  `massFloorOf(cell, massBefore, balance)` in `simulation/cell-mass.ts` beside `loseMassToFloor`, which
  `loseMassToFloor` and `tryStartSprint` both call (a player cell's floor stays `CELL_STARTING_MASS`); a sub-20
  wild cell's sprint therefore costs nothing, as a player's does at the floor. The settle's own floor,
  `min(CELL_STARTING_MASS, baseMass)`, is inside `settleWildMass`.
- **Order inside step 1:** players' inputs, then the settle for every seated cell in seat order, then the due
  seats' decisions. A sprint a decision starts is paid on that tick through `tryStartSprint`, the player's own
  function, and the next settle reads the cost as a loss to recover.
- **Perception is filtered by sight, linearly.** `createWildPerception` is built per decision around the
  deciding cell: `cellsOf` and `motesOf` return only entities whose centre lies within
  `wildSightRange(radius, balance) = WILD_CELL_SIGHT_VIEW_MULTIPLE × viewHalfHeightFor(radius)` (the shared
  `camera/camera-follow.ts` function), `motesOf` only algae and detritus. The hunt rule gets the same view
  minus player cells while `worldStage` is below `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE`; the flee rule sees every
  cell in sight. Cost: seats decide staggered on distinct ticks (24 seats, a 30-tick interval), so a tick runs
  at most one decision, one pass over the cells and motes (≤ ~1 550 at the §3.3 budget's 1 400 motes): no
  spatial-hash query is needed and nothing is O(n²). A balance patch that shortens the interval below the seat
  count only multiplies that by the seats per tick.
- **Camera coupling.** Sight reads the camera's zoom curve (`constants/camera.ts`), which is not a balance
  domain: a change to the zoom curve is a simulation change and moves the W6, W13 and G13 numbers and the state
  hash. The knob a balance patch turns is `WILD_CELL_SIGHT_VIEW_MULTIPLE`.
- **Payout.** A wild predator keeps its meal: the engulf payout calls `gainMass(cell, undefined, …)` (clamped to
  `CELL_MAX_MASS`, no DNA) and reports the measured mass gain; the settle turns it into growth.
- **Determinism.** The `wildCells` stream is the only randomness (size factors, headings, turn rolls); sight,
  settle and sprint choices are arithmetic on hashed state. `WILD_SEAT_HASHED_FIELDS` becomes `seatNumber`,
  `cellId`, `sizeFactor`, `grownMass`, `fullMass`, `respawnInTicks`, `headingX`, `headingY`, `decideInTicks`;
  every pinned state hash and golden replay moves with the build and is re-pinned there.
