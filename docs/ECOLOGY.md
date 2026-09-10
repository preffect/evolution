# Evolution — Ecology, Growth and Absorption

Tickets: #23 (food ecology), #26 (size, mass, speed, mitosis), #27 (absorption). Epic #2.
World geometry, the evolution ladder, session rules and controls: [`GAME-DESIGN.md`](./GAME-DESIGN.md).
DNA and levels: [`PROGRESSION.md`](./PROGRESSION.md). Trait modifiers named below: [`TRAITS.md`](./TRAITS.md).

Units: world units (wu), mass units (mass), seconds (s), ticks at `SIMULATION_TICK_HZ` = 60.
All randomness comes from the seeded `spawner` stream (#73) except gel placement (`zones`) and safe
spawn placement (`spawnPlacement`, [`GAME-DESIGN.md §5.2`](./GAME-DESIGN.md#52-spawn-death-and-respawn));
nothing here uses wall time.

## 1. Food kinds

| Kind          | Constant prefix | Mass | DNA | Tag points           | Motion                                 | Radius (wu) | Lifetime                    |
| ------------- | --------------- | ---- | --- | -------------------- | -------------------------------------- | ----------- | --------------------------- |
| Algae mote    | `ALGAE_`        | 1    | 0   | `photic` × 1         | static                                 | 6           | none                        |
| Bacterium     | `BACTERIUM_`    | 3    | 1   | one tag by variant   | random walk, `BACTERIUM_DRIFT_SPEED`   | 8           | none                        |
| Detritus mote | `DETRITUS_`     | 2    | 0   | none                 | static                                 | 7           | `DETRITUS_LIFETIME_SECONDS` |
| DNA fragment  | `DNA_FRAGMENT_` | 0    | 5   | one tag by zone (§2) | slow drift, `DNA_FRAGMENT_DRIFT_SPEED` | 9           | none                        |
| NPC microbe   | reserved        | —    | —   | —                    | —                                      | —           | build 2                     |

- **Eating rule.** A mote is eaten the tick its centre lies within the cell's radius. Any cell can eat
  any mote; no minimum size. Mass is added instantly (the renderer animates the gulp); DNA and tag
  points go to the progression counters ([`PROGRESSION.md`](./PROGRESSION.md#1-dna-and-tags)).
- **Detritus** is never spawned by the spawner: it drops when a cell dies or dissolves
  (`DETRITUS_MASS_FRACTION` of the cell's mass, split into motes of `DETRITUS_MOTE_MASS`, scattered
  uniformly within 2 × the dead cell's radius).
- **DNA fragments** are the only mass-free food. Their tag is drawn at spawn from the zone's tag
  table (§2) so where you feed shapes your drafts.
- **Bacterium variants (the endosymbiosis hook).** Every bacterium carries a `BacteriumVariant`;
  the cluster's variant is drawn once per cluster from `BACTERIUM_VARIANT_WEIGHTS_BY_ZONE` (§3). Mass,
  DNA, radius and motion are the same for all three; the tag and the ladder credit differ:

| Variant          | Tag point (`BACTERIUM_TAG_BY_VARIANT`) | Ladder credit on eating                                      | Look (renderer)         |
| ---------------- | -------------------------------------- | ------------------------------------------------------------ | ----------------------- |
| `plain`          | `motile` × 1                           | none                                                         | pale rod                |
| `aerobic`        | `metabolic` × 1                        | `bacteriaEatenByVariant.aerobic += 1` → `mitochondrion`      | orange-red rod, hot rim |
| `photosynthetic` | `photic` × 1                           | `bacteriaEatenByVariant.photosynthetic += 1` → `chloroplast` | green rod, dark bands   |

The counters live on the player (`PlayerProgressView.bacteriaEatenByVariant`), survive death, and
gate the endosymbiont traits at `ENDOSYMBIOSIS_BACTERIA_REQUIRED`
([`GAME-DESIGN.md §3`](./GAME-DESIGN.md#3-the-evolution-ladder)). Absorbing a player cell that owns
`mitochondrion` or `chloroplast` sets the matching counter to at least the requirement (you ate the
whole organelle).

## 2. Zones

Geometry is fixed by the dish radius; the three gel patches are placed from the `zones` random
stream at world creation and are part of the snapshot so clients draw them.

| Zone id           | Geometry                                                                                                            | Effect on cells                        | Fragment tag table                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------- |
| `sunlit_shallows` | Annulus `DISH_RADIUS − SHALLOWS_WIDTH` .. `DISH_RADIUS`                                                             | Light: the Chloroplast works here.     | `photic` 0.5, `sensory` 0.5                   |
| `warm_vent`       | Disc of radius `VENT_RADIUS` at the origin                                                                          | Mass decay × `VENT_DECAY_MULTIPLIER`.  | `predatory` 0.4, `toxic` 0.3, `metabolic` 0.3 |
| `viscous_gel`     | `GEL_PATCH_COUNT` discs of radius `GEL_PATCH_RADIUS`, centres uniform in the broth, ≥ `GEL_PATCH_MIN_SPACING` apart | Speed × `gelSpeedFactor(mass)` (§5.2). | uses the broth table                          |
| `open_broth`      | Everything else                                                                                                     | none                                   | `motile` 0.5, `armored` 0.5                   |

A point belongs to the first zone in the order above that contains it (gel patches never overlap the
vent or the shallows because of `GEL_PATCH_MIN_SPACING` and the placement bounds).

## 3. Spawn model

Two independent spawners, each a fractional accumulator: every tick `accumulator += ratePerSecond ×
TICK_INTERVAL_S`; while `accumulator ≥ 1` and the population is below the cap, spawn one and subtract 1.

| Spawner       | Cap                                                               | Rate per second                                                                             | Initial fill                               |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Food motes    | `FOOD_CAP_BASE` + `FOOD_CAP_PER_PLAYER` × players                 | `FOOD_SPAWN_PER_SECOND_BASE` + `FOOD_SPAWN_PER_SECOND_PER_PLAYER` × players                 | `FOOD_INITIAL_FILL_FRACTION` × cap         |
| DNA fragments | `DNA_FRAGMENT_CAP_BASE` + `DNA_FRAGMENT_CAP_PER_PLAYER` × players | `DNA_FRAGMENT_SPAWN_PER_SECOND_BASE` + `DNA_FRAGMENT_SPAWN_PER_SECOND_PER_PLAYER` × players | `DNA_FRAGMENT_INITIAL_FILL_FRACTION` × cap |

- "players" = cells currently in the dish (connected or in disconnect grace). Caps and rates are
  re-evaluated every tick, so joins and leaves take effect immediately; nothing is despawned when the
  cap drops.
- **Initial fill runs after player placement** inside `createWorld`, with the same in-cell rejection
  as a live spawn, and never skips: a rejected point is redrawn until accepted. So at tick 0 no mote
  lies inside any cell and the counts are exactly `fillFraction × cap`.
- **Kind then zone then point.** A live food spawn first draws a kind (`FOOD_KIND_WEIGHTS`: algae
  0.75, bacterium 0.25), then a zone from that kind's zone weights, then a uniform point inside that
  zone, rejecting points within `FOOD_EDGE_MARGIN` of the wall or inside any cell (retry up to
  `SPAWN_POINT_MAX_ATTEMPTS`, then skip this spawn).
- **Bacteria spawn as clusters** of `BACTERIUM_CLUSTER_SIZE` within `BACTERIUM_CLUSTER_RADIUS` of
  the drawn point, all of one variant drawn from `BACTERIUM_VARIANT_WEIGHTS_BY_ZONE` for the zone.
  The cluster is truncated to the room left under the cap (never exceeds it) and consumes one
  accumulator unit per member actually spawned (the accumulator may go negative and recovers), so
  over a window the spawner overshoots its accumulated budget by fewer than `BACTERIUM_CLUSTER_SIZE`.
- **Zone weights per kind:** algae shallows 0.70 / broth 0.25 / vent 0.05; bacterium vent 0.60 /
  broth 0.30 / shallows 0.10; DNA fragment vent 0.40 / broth 0.40 / shallows 0.20.
- **Variant weights per zone** (`BACTERIUM_VARIANT_WEIGHTS_BY_ZONE`): vent plain 0.3 / aerobic 0.7 /
  photosynthetic 0; shallows plain 0.3 / aerobic 0 / photosynthetic 0.7; broth and gel plain 0.6 /
  aerobic 0.2 / photosynthetic 0.2. A vent trip is the mitochondrion, a shallows trip the chloroplast.
- **Bloom.** From `ROUND_BLOOM_START_FRACTION` of the round, food rate × `FOOD_BLOOM_SPAWN_MULTIPLIER`
  and fragment rate × `DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER`; caps unchanged.
- **Expected time to level 2, solo (design estimate).** Level 2 needs 20 DNA
  ([`PROGRESSION.md`](./PROGRESSION.md#2-level-thresholds)). A grazing player sees on average one
  fragment per viewport and reaches one every 8–10 s (5 DNA), plus a bacterium every ~10 s (1 DNA):
  about 45 s. Acceptance bound: 90 s (scenario P1).

## 4. Mass decay

```
decayPerSecond = max(0, mass − CELL_STARTING_MASS) × MASS_DECAY_RATE_PER_SECOND × zoneDecayMultiplier
```

Applied every tick in the metabolism step (§4.1). Mass never drops below `CELL_STARTING_MASS` by
decay or drains. `zoneDecayMultiplier` is `VENT_DECAY_MULTIPLIER` in the vent, 1 elsewhere; the trait
`decayMultiplier` ([`TRAITS.md §2`](./TRAITS.md#2-modifier-model)) multiplies on top. At mass 1020 in
the broth this is 2.0 mass/s: idling halves your surplus in about 6 minutes, so a giant must keep eating.

### 4.1 The metabolism step (one formula)

Every metabolism term reads the mass at the start of the step, so a test can reproduce a tick exactly:

```
drainFraction = toxinDrainFractionPerSecond (of every cell whose toxin reaches this one)
              + spikeDrainFractionPerSecond (of the prey this cell is engulfing, while progress > 0)
mass' = max(CELL_STARTING_MASS, mass − decayPerSecond × TICK_INTERVAL_S − mass × drainFraction × TICK_INTERVAL_S)
        + photosynthesisMassPerSecond × TICK_INTERVAL_S           (only inside sunlit_shallows)
```

Drained mass is lost to the dish. The step runs after eating and before the engulf update
([`init-game.md §3`](../init-game.md#3-server-edits), fixed step order), which is why a predator that
starts an engulf on tick _t_ first pays the spike drain on tick _t_ + 1.

## 5. Size, mass and speed

### 5.1 Curves

```
radius(mass)   = CELL_RADIUS_SCALE × sqrt(mass)                       (area ∝ mass)
maxSpeed(mass) = clamp(CELL_BASE_SPEED × (CELL_STARTING_MASS / mass) ^ CELL_SPEED_MASS_EXPONENT,
                       CELL_MIN_SPEED, CELL_BASE_SPEED)
```

| Mass | Radius (wu) | Max speed (wu/s) | Note                                         |
| ---- | ----------- | ---------------- | -------------------------------------------- |
| 20   | 17.9        | 220.0            | starting cell                                |
| 80   | 35.8        | 155.6            | a minute of grazing                          |
| 320  | 71.6        | 110.0            | half speed at 16× mass                       |
| 1000 | 126.5       | 82.7             | apex of a typical round                      |
| 2000 | 178.9       | 69.6             |                                              |
| 5000 | 282.8       | 55.3             | `CELL_MAX_MASS`; ≈ 19 % of the dish diameter |

Reviewed for feel: a starting cell crosses its own diameter in 0.16 s, a 1000-mass cell in 3 s.
Escape is always possible on paper (prey is faster); the predator's tools are ambush and zones.

### 5.2 Movement step (server, per tick)

```
direction = normalise(target − centre)
throttle  = clamp((|target − centre| / radius − STEER_DEAD_ZONE_RADII)
                  / (STEER_FULL_THROTTLE_RADII − STEER_DEAD_ZONE_RADII), 0, 1)
speedCap  = maxSpeed(mass) × sprintFactor × zoneSpeedFactor × traitSpeedFactor × engulfSpeedFactor
desired   = direction × throttle × speedCap
velocity += (desired − velocity) × steerBlendPerTick               (derived in code: TICK_INTERVAL_S / (CELL_ACCELERATION_SECONDS × accelerationSecondsMultiplier))
centre   += velocity × TICK_INTERVAL_S
clamp centre to DISH_RADIUS − radius; zero the outward radial velocity on contact
```

The blend is the only drag: with no input `desired` is zero and the cell coasts to a stop within
about a second. `gelSpeedFactor(mass) = max(clamp(1 − mass / GEL_MASS_SCALE, GEL_MIN_SPEED_FACTOR,
GEL_MAX_SPEED_FACTOR), gelSpeedFactorFloor)`: the gel barely slows a starting cell and cuts a 600-mass
cell to 40 %, which is why small cells shelter there; the amoeba's `gelSpeedFactorFloor` is the only
way through ([`TRAITS.md §3.12`](./TRAITS.md)). Trait and engulf factors: [`TRAITS.md`](./TRAITS.md), §6.

### 5.3 Cell-to-cell contact

Two cells that overlap and where neither can engulf the other (§6.1) are pushed apart along the
centre line by `CELL_SEPARATION_FRACTION_PER_TICK` of the overlap each tick, split by inverse mass
(the lighter cell moves more). Cells never bounce; the renderer draws the contact dent.

### 5.4 Growth, cap and mitosis (reserved)

- Mass gained from food is applied in full (`digestionFactor` = 1 + trait bonuses).
- At `CELL_MAX_MASS` any further mass is converted to DNA at `MASS_OVERFLOW_DNA_PER_MASS` so eating
  at the cap still progresses the leaderboard.
- **Mitosis, merge-back and eject are build 2.** Their constants are declared in `growth.ts` so the
  contract is stable: `MITOSIS_MIN_MASS` 200, `MITOSIS_MAX_CELLS` 4, `MITOSIS_COOLDOWN_SECONDS` 8,
  `MITOSIS_MERGE_SECONDS` 20, `EJECT_MASS` 10. `GameInput.split` / `.eject` are validated and ignored;
  the `dividing` cell state is unreachable. #28 will specify the rules; engulf interactions are listed
  in §6.3 as open for that ticket.

## 6. Absorption and engulf

### 6.1 Rules

```
requiredRatio = ENGULF_MASS_RATIO + prey.membraneRatioBonus            (Cell Wall, TRAITS.md)
releaseRatio  = ENGULF_RELEASE_RATIO + prey.membraneRatioBonus         (hysteresis, < requiredRatio)
canStart      = predator.mass ≥ prey.mass × requiredRatio
canContinue   = predator.mass ≥ prey.mass × releaseRatio
inContact     = |predator.centre − prey.centre| ≤ predator.radius − prey.radius × ENGULF_COVERAGE_FRACTION
durationS     = ENGULF_BASE_DURATION_SECONDS
                × clamp(ENGULF_MASS_RATIO / (predator.mass / prey.mass), ENGULF_MIN_DURATION_FACTOR, 1)
                × prey.engulfDurationMultiplierAsPrey × predator.engulfDurationMultiplierAsPredator
```

Engulf is a process, not an event. An engulf starts on the first tick where `inContact` and `canStart`
both hold, and progresses on that same tick. While `inContact` holds, `progress += TICK_INTERVAL_S /
durationS` (with `durationS` recomputed from the current masses); while it does not, `progress −=
ENGULF_ESCAPE_DECAY_MULTIPLIER × TICK_INTERVAL_S / durationS`. The predator's `engulfSpeedFactor` is
`ENGULF_PREDATOR_SPEED_FACTOR`, the prey's is `ENGULF_PREY_SPEED_FACTOR` (membrane grip), both only
while progress > 0. **Hysteresis:** an engulf in progress is rechecked every tick against
`canContinue`, not `canStart`; the predator holds its prey until it drops below `releaseRatio`, so base
decay, toxin and spikes must move the ratio by a real margin rather than a rounding error before the
prey is released. Losing `canContinue` releases the prey immediately with progress 0. A prey is claimed
by at most one predator at a time. The modifiers read here are the ones folded at step 1 of the tick,
so a trait picked this tick affects this tick's engulf check.

**Payout at progress ≥ 1 − `ENGULF_PROGRESS_EPSILON`** (so thirty additions of 1/30 pay out on tick 30):

| Who      | Effect                                                                                                                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Predator | mass += prey.mass × `ENGULF_MASS_YIELD` (cap overflow → DNA, §5.4); DNA += `ENGULF_DNA_BASE` + prey.dnaCumulative × `ENGULF_DNA_SHARE`; tag points += prey tag points × `ENGULF_TAG_SHARE` plus `predatory` × `ENGULF_PREDATORY_TAG_POINTS`; absorptions += 1.                   |
| Dish     | detritus worth prey.mass × `DETRITUS_MASS_FRACTION` (§1).                                                                                                                                                                                                                        |
| Prey     | cell removed this tick (`cell_absorbed` effect); player `lifeState` = `spectating` for `RESPAWN_SPECTATE_SECONDS`, then respawn ([`GAME-DESIGN.md §5.2`](./GAME-DESIGN.md#52-spawn-death-and-respawn)). Keeps level, traits, stage and `dnaKeptOnDeathFraction` of its progress. |
| Reserved | trait steal: `ENGULF_TRAIT_STEAL_CHANCE` = 0 in build 1, declared so build 2 can turn it on.                                                                                                                                                                                     |

### 6.2 State diagram

Two records, two homes. The **cell** carries only simulation states (`CellState = 'free' |
'being_engulfed' | 'engulfing' | 'dividing'`); the **player** carries the lifecycle
(`PlayerProgressView.lifeState = 'alive' | 'spectating'`). An absorbed cell is removed from the world
the tick it is absorbed and emitted as a `cell_absorbed` effect, so the renderer never sees a ghost and
the spatial hash keeps no empty entry.

```
   cell:
              contact + canStart as prey            progress >= 1 − ε
   [free] --------------------------------> [being_engulfed] -----------> (cell removed, effect emitted)
     ^                                            |
     |   progress <= 0 or lost canContinue         |
     +--------------------------------------------+
     |
     |  contact + canStart as predator          prey absorbed / released
     +----------------------------------------> [engulfing] ------------------------> [free]

   [dividing]  (reserved, build 2: unreachable in build 1)

   player:
   [alive] --cell absorbed--> [spectating] --RESPAWN_SPECTATE_SECONDS--> respawn (new cell, [free]) --> [alive]
```

A cell can be `engulfing` and `being_engulfed` at once (a chain); the flags are independent.

### 6.3 Edge cases (resolved)

| Case                                 | Resolution                                                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mutual engulf                        | Impossible: `requiredRatio` ≥ 1.25 cannot hold both ways. Near-equal cells only push apart (§5.3).                                                                     |
| Two predators reach one prey         | The first to satisfy contact + eligibility claims it; the other waits. Ties within a tick: lower cell id (stable ordering, #74).                                       |
| Chain: B engulfs C while A engulfs B | Both run. If A finishes first, C is released (progress 0) and A's payout is B alone. If B finishes first, B's mass jumps and A's eligibility is rechecked next tick.   |
| Predator drops below `releaseRatio`  | Released immediately; the predator keeps no progress. Between `releaseRatio` and `requiredRatio` the engulf continues (hysteresis, §6.1).                              |
| Prey sprints away                    | Contact breaks, progress decays at 2× and hits 0 → released. This is the intended escape.                                                                              |
| Predator or prey disconnects         | No special case: an input-less cell is still a cell. If the prey is removed from the room mid-engulf, the predator gets no payout and the removed cell drops detritus. |
| Round enters `results` mid-engulf    | Engulf aborted, no payout.                                                                                                                                             |
| Level-up mid-engulf (either side)    | The draft opens normally; the simulation never pauses.                                                                                                                 |
| Engulf at the wall                   | Clamping only moves centres inward, so contact is never broken by the wall.                                                                                            |
| Predator at `CELL_MAX_MASS`          | Yield converts to DNA (§5.4).                                                                                                                                          |
| Same organism (build 2)              | Cells sharing `organismId` never engulf each other. Trivially true in build 1.                                                                                         |
| Engulf during split (build 2)        | Open for #28. Proposed: each daughter cell is an independent prey; a predator engulfing a cell that splits keeps the half it overlaps.                                 |
| Partial absorption / nibbling        | Not in v1 (GAME-DESIGN §10 non-goals).                                                                                                                                 |

## 7. Constants table

Home: `packages/shared/src/constants/<domain>.ts`.

### `ecology.ts`

| Constant                                                                          | Value                          | Unit            |
| --------------------------------------------------------------------------------- | ------------------------------ | --------------- |
| `ALGAE_MASS` / `ALGAE_DNA` / `ALGAE_RADIUS`                                       | 1 / 0 / 6                      | mass / DNA / wu |
| `BACTERIUM_MASS` / `BACTERIUM_DNA` / `BACTERIUM_RADIUS`                           | 3 / 1 / 8                      | mass / DNA / wu |
| `BACTERIUM_DRIFT_SPEED`                                                           | 20                             | wu/s            |
| `BACTERIUM_CLUSTER_SIZE` / `BACTERIUM_CLUSTER_RADIUS`                             | 5 / 60                         | count / wu      |
| `BACTERIUM_VARIANTS`                                                              | plain, aerobic, photosynthetic | ids             |
| `BACTERIUM_VARIANT_WEIGHTS_BY_ZONE`                                               | see §3                         | weights         |
| `BACTERIUM_TAG_BY_VARIANT`                                                        | see §1                         | tags            |
| `DETRITUS_MOTE_MASS` / `DETRITUS_RADIUS`                                          | 2 / 7                          | mass / wu       |
| `DETRITUS_MASS_FRACTION`                                                          | 0.2                            | ratio           |
| `DETRITUS_LIFETIME_SECONDS`                                                       | 30                             | s               |
| `DNA_FRAGMENT_DNA` / `DNA_FRAGMENT_RADIUS`                                        | 5 / 9                          | DNA / wu        |
| `DNA_FRAGMENT_DRIFT_SPEED`                                                        | 10                             | wu/s            |
| `FOOD_KIND_WEIGHTS`                                                               | algae 0.75, bacterium 0.25     | weights         |
| `FOOD_ZONE_WEIGHTS_BY_KIND`                                                       | see §3                         | weights         |
| `FOOD_CAP_BASE` / `FOOD_CAP_PER_PLAYER`                                           | 600 / 100                      | count           |
| `FOOD_SPAWN_PER_SECOND_BASE` / `FOOD_SPAWN_PER_SECOND_PER_PLAYER`                 | 6 / 1                          | motes/s         |
| `FOOD_INITIAL_FILL_FRACTION`                                                      | 0.6                            | ratio           |
| `DNA_FRAGMENT_CAP_BASE` / `DNA_FRAGMENT_CAP_PER_PLAYER`                           | 30 / 10                        | count           |
| `DNA_FRAGMENT_SPAWN_PER_SECOND_BASE` / `DNA_FRAGMENT_SPAWN_PER_SECOND_PER_PLAYER` | 0.5 / 0.1                      | fragments/s     |
| `DNA_FRAGMENT_INITIAL_FILL_FRACTION`                                              | 0.6                            | ratio           |
| `DNA_FRAGMENT_TAG_TABLE_BY_ZONE`                                                  | see §2                         | weights         |
| `FOOD_BLOOM_SPAWN_MULTIPLIER` / `DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER`             | 1.5 / 2                        | ×               |
| `SPAWN_POINT_MAX_ATTEMPTS`                                                        | 10                             | count           |
| `SHALLOWS_WIDTH` / `VENT_RADIUS`                                                  | 500 / 500                      | wu              |
| `GEL_PATCH_COUNT` / `GEL_PATCH_RADIUS` / `GEL_PATCH_MIN_SPACING`                  | 3 / 350 / 900                  | count / wu / wu |
| `VENT_DECAY_MULTIPLIER`                                                           | 1.5                            | ×               |
| `MASS_DECAY_RATE_PER_SECOND`                                                      | 0.002                          | 1/s             |

### `growth.ts`

| Constant                                                           | Value            | Unit         |
| ------------------------------------------------------------------ | ---------------- | ------------ |
| `CELL_STARTING_MASS`                                               | 20               | mass         |
| `CELL_MAX_MASS`                                                    | 5000             | mass         |
| `CELL_RADIUS_SCALE`                                                | 4                | wu/√mass     |
| `CELL_BASE_SPEED` / `CELL_MIN_SPEED`                               | 220 / 50         | wu/s         |
| `CELL_SPEED_MASS_EXPONENT`                                         | 0.25             | —            |
| `CELL_ACCELERATION_SECONDS`                                        | 0.25             | s            |
| `CELL_SEPARATION_FRACTION_PER_TICK`                                | 0.2              | ratio        |
| `GEL_MASS_SCALE` / `GEL_MIN_SPEED_FACTOR` / `GEL_MAX_SPEED_FACTOR` | 1000 / 0.4 / 0.9 | mass / × / × |
| `MASS_OVERFLOW_DNA_PER_MASS`                                       | 0.1              | DNA/mass     |
| `MITOSIS_*`, `EJECT_MASS`                                          | §5.4             | reserved     |

### `absorption.ts`

| Constant                                           | Value    | Unit           |
| -------------------------------------------------- | -------- | -------------- |
| `ENGULF_MASS_RATIO`                                | 1.25     | ×              |
| `ENGULF_RELEASE_RATIO`                             | 1.10     | ×              |
| `ENGULF_PROGRESS_EPSILON`                          | 1e-6     | progress       |
| `ENGULF_COVERAGE_FRACTION`                         | 0.5      | prey radii     |
| `ENGULF_BASE_DURATION_SECONDS`                     | 1.0      | s              |
| `ENGULF_MIN_DURATION_FACTOR`                       | 0.5      | ×              |
| `ENGULF_ESCAPE_DECAY_MULTIPLIER`                   | 2        | ×              |
| `ENGULF_PREDATOR_SPEED_FACTOR`                     | 0.6      | ×              |
| `ENGULF_PREY_SPEED_FACTOR`                         | 0.8      | ×              |
| `ENGULF_MASS_YIELD`                                | 0.8      | ratio          |
| `ENGULF_DNA_BASE` / `ENGULF_DNA_SHARE`             | 30 / 0.2 | DNA / ratio    |
| `ENGULF_TAG_SHARE` / `ENGULF_PREDATORY_TAG_POINTS` | 0.5 / 10 | ratio / points |
| `ENGULF_TRAIT_STEAL_CHANCE`                        | 0        | reserved       |

## 8. Acceptance scenarios

Given seed S and inputs I, after N ticks assert X. These conventions apply to every scenario table in
the design docs (GAME-DESIGN §13, PROGRESSION §7, TRAITS §6):

- **Placed** cells, motes and fragments come from the framework's fixture helpers; everything else
  comes from the seed. A row that places anything runs with the initial fill and both spawners
  disabled by the fixture, so no seeded mote interferes with the arithmetic.
- **Fixture-granted traits** bypass the ladder and the draft (a fixture may give a protocell cilia).
- **Pinned** = the fixture restores the cell's centre after the movement step every tick (movement
  and separation cannot move it).
- **"Target N radii east"** = every tick's input targets the point N × radius east of the cell's
  _current_ centre (full throttle, never reached).
- **Decay is never disabled.** Placed cells decay from tick 1 and expected masses include it:
  `decayed(m, n, k = 1) = CELL_STARTING_MASS + (m − CELL_STARTING_MASS) × (1 − MASS_DECAY_RATE_PER_SECOND × k / 60)^n`
  (k = the zone × trait decay multiplier). Mass assertions are ± 0.01 unless the row says otherwise.
- **Expected values assume the fixed step order** of [`init-game.md §3`](../init-game.md#3-server-edits)
  (inputs, round, movement, eating, metabolism, engulf, progression, spawners, respawn, leaderboard).
  In particular eating precedes decay within a tick, and metabolism precedes the engulf check, so a
  placed predator has already decayed when its first eligibility check runs.
- "Tick t" = the state after the t-th `stepWorld`; the fixture acts between ticks.

| #   | Given                                                                                                                     | Inputs                                                         | After      | Assert                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | seed 42, 1 player (nothing placed: seeded world)                                                                          | idle                                                           | 0 ticks    | food count = 420 (0.6 × 700), fragment count = 24 (0.6 × 40); every mote within `DISH_RADIUS − FOOD_EDGE_MARGIN`; algae share within 0.75 ± 0.06; no mote inside the player cell (initial fill runs after placement, §3).                                                                                                       |
| E2  | seed 42, 1 player (seeded world)                                                                                          | idle                                                           | 600 ticks  | food spawned in ticks 1–600 between 70 (7/s × 10 s) and 74 (cluster overshoot < `BACTERIUM_CLUSTER_SIZE`); fragments spawned = 6 (0.6/s × 10 s). Counters, not populations: the idle cell may eat a drifting mote.                                                                                                              |
| E3  | seed 42, 1 player (seeded world)                                                                                          | idle                                                           | 3000 ticks | food count = 700 (cap) ± 1; fragment count = 40 (cap) ± 1 (a mote eaten this tick is refilled next tick); no cluster ever pushes the count above the cap.                                                                                                                                                                       |
| E4  | seed 42, 1 player, algae mote placed 10 wu east of the centre                                                             | idle                                                           | 1 tick     | mass = 21 (± 0.01), mote gone. Same with a `plain` bacterium: mass = 23, DNA = 1, `motile` tag points = 1. With an `aerobic` bacterium: `metabolic` = 1 and `bacteriaEatenByVariant.aerobic` = 1.                                                                                                                               |
| E5  | seed 42, 1 player placed at mass 1020 in the open broth                                                                   | idle                                                           | 60 ticks   | mass = `decayed(1020, 60)` ≈ 1018.00. Placed in the vent (k = 1.5): ≈ 1017.00.                                                                                                                                                                                                                                                  |
| E6  | seed 42, 1 player placed at mass 320 (then 5000)                                                                          | target 5 radii east                                            | 120 ticks  | speed within 0.5 wu/s of 110.1 (then 55.4): maxSpeed of the decayed mass, blend converged to 99.97 %.                                                                                                                                                                                                                           |
| E7  | seed 42, 1 player placed at mass 80                                                                                       | idle                                                           | 1 tick     | radius = 35.78 (± 0.01).                                                                                                                                                                                                                                                                                                        |
| E8  | seed 42, 1 player placed at mass 500 at the centre of a gel patch                                                         | target 5 radii east                                            | 120 ticks  | speed within 0.5 wu/s of 49.4 (98.5 × gelSpeedFactor 0.502 for the decayed mass 498.1); the cell has travelled ≈ 87 wu and is still inside the patch (`GEL_PATCH_RADIUS` 350).                                                                                                                                                  |
| E9  | seed 42, 2 players placed: A mass 100, B mass 20, centres 10 wu apart                                                     | idle                                                           | 30 ticks   | engulf starts tick 1 (duration 0.5 s, 1/30 per tick), pays out on tick 30: B's cell removed, B `lifeState` = `spectating`; A mass = `decayed(100, 30)` + 16 ≈ 115.92; A DNA = 30; A absorptions = 1; detritus motes total mass = 4 (two motes of 2).                                                                            |
| E10 | seed 42, A placed at mass 24, B at 20, centres 10 wu apart                                                                | idle                                                           | 120 ticks  | no engulf (24 < 25 and decaying); separation has pushed them apart: `A.radius + B.radius − distance` < 0.01 wu (overlap × 0.8^120). With A placed at 26 (≥ 25 on tick 1 after decay, and ≥ `ENGULF_RELEASE_RATIO` × 20 = 22 throughout): B absorbed on tick 58 (durationS = 25 / A.mass ≈ 0.96 s); A mass ≈ 41.99 after payout. |
| E11 | seed 42, A placed at mass 100, B at 20, centres 10 wu apart                                                               | B: sprint + target 5 radii away from A from tick 10            | 200 ticks  | contact breaks around tick 22, progress decays at 2×, B `free` by tick 31; alive at tick 200, mass = 20 (sprint cost floored at starting mass); A `free`, absorptions = 0.                                                                                                                                                      |
| E12 | seed 42, A placed at mass 5000, algae placed inside A                                                                     | idle                                                           | 1 tick     | eating (step 4) takes A to 5001 → overflow 1 → DNA = 0.1 (`MASS_OVERFLOW_DNA_PER_MASS`), mass 5000; decay (step 5) then removes (5000 − 20) × 0.002 / 60: mass ≈ 4999.83.                                                                                                                                                       |
| E13 | seed 42, A engulfing B at progress 0.5, round timer forced to 0                                                           | idle                                                           | 1 tick     | `roundPhase` = `'results'`, both cells `free`, A absorptions = 0.                                                                                                                                                                                                                                                               |
| E14 | seed 42, 1 player (seeded world), run to `ROUND_BLOOM_START_FRACTION` × round with food held at 0 by the fixture          | idle                                                           | +600 ticks | food spawned in those 600 ticks between 105 (7 × 1.5 × 10) and 109 (cluster overshoot); fragments spawned = 12 (0.6 × 2 × 10).                                                                                                                                                                                                  |
| E15 | seed 42, 1 player with `nucleoid` I (fixture); one `photosynthetic` bacterium placed inside the cell per tick for 5 ticks | idle                                                           | 5 ticks    | `bacteriaEatenByVariant.photosynthetic` = 5, `.aerobic` = 0, `photic` tag points = 5, DNA = 5; `chloroplast` is a draft candidate (PROGRESSION P12 pins the pure rule at 4 vs 5). Separately: A (level 1, no traits) absorbs B who owns `mitochondrion` I → `bacteriaEatenByVariant.aerobic` ≥ 5.                               |
| E16 | seed 42, A placed at mass 30, B at 20, centres 10 wu apart (engulf from tick 1)                                           | fixture sets A.mass = 23 before tick 10, = 21.5 before tick 20 | 20 ticks   | tick 10–19: engulf continues (23 ≥ 22 = `ENGULF_RELEASE_RATIO` × 20 although 23 < 25), progress rising; tick 20: released, both cells `free`, B `engulfProgress` = 0, A absorptions = 0.                                                                                                                                        |
