# Evolution — Ecology, Growth and Absorption

Tickets: #23 (food ecology), #26 (size, mass, speed, mitosis), #27 (absorption). Epic #2.
World geometry, the evolution ladder, session rules and controls: [`GAME-DESIGN.md`](./GAME-DESIGN.md).
DNA and levels: [`PROGRESSION.md`](./PROGRESSION.md). Trait modifiers named below: [`TRAITS.md`](./TRAITS.md).

Units: world units (wu), mass units (mass), seconds (s), ticks at `TICK_HZ` = 60 (`constants/network.ts`).
All randomness comes from the seeded `spawner` stream (#73) except gel placement (`zones`), safe
spawn placement (`spawnPlacement`, [`GAME-DESIGN.md §5.2`](./GAME-DESIGN.md#52-spawn-death-and-respawn))
and mote motion (`moteMotion`, label `mote_motion`: bacteria random-walk headings every tick and a
fragment's drift direction at spawn, so the number of living bacteria never shifts a spawn point)
and the spit-out rolls of §6.1 (`engulf`, label `engulf`: one draw per tick per wrapped or sealed prey
whose `spitOutChancePerSecond` is positive, and none otherwise); nothing here uses wall time. Stream labels: [`DETERMINISM.md §3`](./DETERMINISM.md#3-seeded-random-streams-packagessharedsrcrandom-73).

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
  uniformly within 2 × the dead cell's radius). Rounding: motes = floor(fraction × mass /
  `DETRITUS_MOTE_MASS`), the remainder is dropped (a 23-mass cell drops 4.6 → two motes, 4 mass).
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
- **Kind then zone then point.** `FOOD_KIND_WEIGHTS` (algae 0.75, bacterium 0.25) are **per-mote
  shares**. A bacterium event spawns a whole cluster, so a spawn event draws its kind with the
  event weights algae 0.75 : bacterium 0.25 / `BACTERIUM_CLUSTER_SIZE` = 0.05 (renormalised
  0.9375 / 0.0625; derived in code from those two constants, never a third one). The expected mote
  mix is then 0.75 / 0.25 and the pace estimate below holds. Next a zone from that kind's zone
  weights, then a uniform point inside that zone, rejecting points within `FOOD_EDGE_MARGIN` of the
  wall or inside any cell (retry up to `SPAWN_POINT_MAX_ATTEMPTS`, then skip this spawn).
- **Bacteria spawn as clusters** of `BACTERIUM_CLUSTER_SIZE` within `BACTERIUM_CLUSTER_RADIUS` of
  the drawn point, all of one variant drawn from `BACTERIUM_VARIANT_WEIGHTS_BY_ZONE` for the zone.
  The cluster is truncated to the room left under the cap (never exceeds it) and consumes one
  accumulator unit per member actually spawned (the accumulator may go negative and recovers), so
  over a window the spawner overshoots its accumulated budget by fewer than `BACTERIUM_CLUSTER_SIZE`.
  The initial fill uses the same kind draw and spawns clusters too, so the vent is clustered at
  tick 0 (each member is redrawn on rejection, and the last cluster is truncated to the fill count).
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
drainFraction = Σ toxinDrainFractionPerSecond (of every cell whose toxin reaches this one; × ENGULF_SWALLOWED_TOXIN_MULTIPLIER
                  for the prey this cell is engulfing while that engulf is past cover, §6.1)
              + spikeDrainFractionPerSecond (of the prey this cell is engulfing, while progress > 0)
mass' = max(CELL_STARTING_MASS, mass − decayPerSecond × TICK_INTERVAL_S − mass × drainFraction × TICK_INTERVAL_S)
        + photosynthesisMassPerSecond × TICK_INTERVAL_S           (only inside sunlit_shallows)
```

Drained mass is lost to the dish. The step runs after eating and before the engulf update
([`ARCHITECTURE.md`](./ARCHITECTURE.md), fixed step order), which is why a predator that
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
way through ([`TRAITS.md §3.12`](./TRAITS.md)). Trait factors: [`TRAITS.md`](./TRAITS.md).
`engulfSpeedFactor` is per phase (§6.1: prey 1 / held / 0 in cover / wrap / absorb, predator 0.6 before
the seal and 1 after) and reads the engulf state at the end of the previous tick. The kernel exposes
`steerCommand(cell)` (direction and throttle of this tick) so the engulf step's struggle reads the same
command the movement step used, never a second copy of the throttle arithmetic. A carried prey (§6.1
absorb) skips this step: its centre is set from its predator's after the predator has moved.

### 5.3 Cell-to-cell contact

Two cells that overlap and where neither can engulf the other (§6.1) are pushed apart along the
centre line by `CELL_SEPARATION_FRACTION_PER_TICK` of the overlap each tick, split by inverse mass
(the lighter cell moves more). Separation never applies to a predator and its current prey: while an
engulf is in progress the pair is left alone until payout or release, whatever the mass ratio has
drifted to (E16). A pair inside a spit-out refractory (§6.1) is separated as if neither could engulf the
other, so a spat-out prey is pushed clear (T4). Cells never bounce; the renderer draws the contact dent.

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

Decision #139 (direction, confirmed on #145): **escape and absorption depend on the traits involved.**
Movement and agility get the prey out before the seal, spikes get it spat out, armour makes it slow
to dissolve, the predator's pseudopods and vacuoles pull the other way. Every build-1 trait's engulf
effect, as predator and as prey, is the table in [`TRAITS.md §3.18`](./TRAITS.md#318-engulf-effects-at-a-glance);
this section is the process those effects plug into.

### 6.1 Rules

**Eligibility (mass only, one home).**

```
requiredRatio = ENGULF_MASS_RATIO + prey.membraneRatioBonus            (Cell Wall, TRAITS.md)
releaseRatio  = ENGULF_RELEASE_RATIO + prey.membraneRatioBonus         (hysteresis, < requiredRatio)
canStart      = predator.mass ≥ prey.mass × requiredRatio
canContinue   = predator.mass ≥ prey.mass × releaseRatio
inContact     = |predator.centre − prey.centre| ≤ predator.radius − prey.radius × ENGULF_COVERAGE_FRACTION
```

`canStart` is the pure predicate `canEngulf(predator, prey, balance.absorption)` in
`packages/shared/src/simulation/engulf-eligibility.ts`, which takes two `CellView`s and reads only
`predator.mass`, `prey.mass`, `prey.membraneRatioBonus` (folded server-side and carried on the view,
[`ARCHITECTURE.md §2`](./ARCHITECTURE.md#2-entity-model)) and `ENGULF_MASS_RATIO`. Three callers, no
copies of the ratio arithmetic: the server engulf system (step 6), the HUD danger chip (`threatsFor`,
[`UI.md §3.1`](./UI.md#31-hud-elements-visible-while-roundphase--playing-and-lifestate--alive)) and the
renderer's engulf-warning ring ([`VISUAL-STYLE.md §5`](./VISUAL-STYLE.md#5-membrane-and-motion-language)),
so the three can never disagree about who can engulf whom. `canContinue` is `canContinueEngulf` in the same
file (same inputs, `ENGULF_RELEASE_RATIO`); only the server calls it. **Their signatures do not change**
with this rework: the chip and the ring warn about mass, not touch, effort or luck. Everything below that
needs more than mass is a second shared pure function in the same folder:

```ts
// packages/shared/src/simulation/engulf-pace.ts — formulas, numbers in, numbers out (ARCHITECTURE §3.1)
export type EngulfPhase = 'cover' | 'wrap' | 'absorb';
export function engulfPhaseOf(progress: number, balance: EngulfPaceBalance): EngulfPhase;
export function engulfProgressDelta(
  input: {
    phase: EngulfPhase;
    predatorMass: number;
    preyMass: number;
    isInContact: boolean;
    awayEffort: number; // 0..1, the prey's steer command away from the predator (below)
    predator: Pick<CellModifiers, 'wrapDurationMultiplierAsPredator' | 'absorbDurationMultiplierAsPredator'>;
    prey: Pick<CellModifiers, 'absorbDurationMultiplierAsPrey' | 'struggleSlowdownBonus'>;
  },
  balance: EngulfPaceBalance,
): number; // signed; the caller clamps and releases
export function preyHeldSpeedFactor(
  phase: EngulfPhase,
  predatorGripStrengthBonus: number,
  preyGripResistanceBonus: number,
  balance: EngulfPaceBalance,
): number;
export function predatorEngulfSpeedFactor(phase: EngulfPhase, balance: EngulfPaceBalance): number;
export function spitOutChancePerTick(preySpitOutChancePerSecond: number): number;
// packages/shared/src/simulation/engulf-eligibility.ts — the hold verdict beside the two predicates
export type EngulfReleaseReason = 'escaped' | 'spat_out' | 'ratio' | 'aborted';
export function resolveEngulfHold(
  predator: EngulfPredator,
  prey: EngulfPrey,
  hold: { phase: EngulfPhase; spitOutRoll: number | null; spitOutChancePerTick: number },
  balance: EngulfRatioBalance,
): 'hold' | Extract<EngulfReleaseReason, 'ratio' | 'spat_out'>;
```

`EngulfPaceBalance` and `EngulfRatioBalance` are `Pick`s of `BalanceConfig['absorption']`
([`ARCHITECTURE.md §9`](./ARCHITECTURE.md#9-constants-and-balance-decision-one-home)), so every caller, server and client, passes
`balance.absorption` (the room's live copy) and the thresholds follow a `debug_set_balance` patch.
`spitOutRoll` is `null` when no draw was made (chance 0); `engulfPhaseOf` is what the HUD chip and the
renderer read to show the phase ([`UI.md §3.1`](./UI.md#31-hud-elements-visible-while-roundphase--playing-and-lifestate--alive)),
so **`CellView` gains no field**: `engulfProgress` plus the shared thresholds say everything the client needs.

**The process: cover → wrap → seal → absorb.** Progress runs 0..1; the phase is a band of it. The
band widths are the phase durations' shares of the base duration, so the HUD bar moves evenly in
time while nobody fights:

```
ENGULF_BASE_DURATION_SECONDS = ENGULF_COVER_SECONDS + ENGULF_WRAP_SECONDS + ENGULF_ABSORB_SECONDS   (0.2 + 0.4 + 0.6 = 1.2, derived)
ENGULF_WRAP_START_PROGRESS   = ENGULF_COVER_SECONDS / ENGULF_BASE_DURATION_SECONDS                   (1/6, derived)
ENGULF_SEAL_PROGRESS         = (ENGULF_COVER_SECONDS + ENGULF_WRAP_SECONDS) / ENGULF_BASE_DURATION_SECONDS   (0.5, derived)
phase(progress) = absorb if progress ≥ ENGULF_SEAL_PROGRESS − ε; wrap if ≥ ENGULF_WRAP_START_PROGRESS − ε; else cover   (ε = ENGULF_PROGRESS_EPSILON)

massFactor       = clamp(ENGULF_MASS_RATIO / (predator.mass / prey.mass), ENGULF_MIN_DURATION_FACTOR, 1)
baseRatePerTick  = TICK_INTERVAL_S / (ENGULF_BASE_DURATION_SECONDS × massFactor)
phaseRatePerTick = baseRatePerTick / phaseMultiplier
   cover   phaseMultiplier = 1
   wrap    phaseMultiplier = predator.wrapDurationMultiplierAsPredator                                   (Amoeba Pseudopods)
   absorb  phaseMultiplier = prey.absorbDurationMultiplierAsPrey × predator.absorbDurationMultiplierAsPredator   (Cell Wall, Diatom Shell / Food Vacuole)
```

| Phase      | Band                                                 | What it is                                                                      | Prey speed cap ×                                                                                                                                        | Predator speed cap ×                  | How the prey gets out                                                                                                                                                                                                                                                                                                       |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cover**  | `[0, ENGULF_WRAP_START_PROGRESS)`                    | The predator's membrane lies over the prey's centre (`inContact`). No grip yet. | 1                                                                                                                                                       | `ENGULF_PREDATOR_SPEED_FACTOR`        | **Leave.** The tick `inContact` fails the prey is released with progress 0 (nothing was held). Steering away also slows the cover (struggle, below).                                                                                                                                                                        |
| **Wrap**   | `[ENGULF_WRAP_START_PROGRESS, ENGULF_SEAL_PROGRESS)` | Pseudopods close around the prey. Grip.                                         | `clamp(ENGULF_PREY_SPEED_FACTOR − predator.gripStrengthBonus + prey.gripResistanceBonus, ENGULF_PREY_SPEED_FACTOR_FLOOR, 1)` (Amoeba grips, Cilia slip) | `ENGULF_PREDATOR_SPEED_FACTOR`        | **Break contact:** progress then decays by `ENGULF_ESCAPE_DECAY_MULTIPLIER × baseRatePerTick` per tick and the prey is released the tick it falls below `ENGULF_WRAP_START_PROGRESS` (the grip is gone). **Struggle:** steering away slows the wrap. **Spit-out** rolls (spines). **Ratio** release (toxin, spikes, decay). |
| **Seal**   | the tick progress reaches `ENGULF_SEAL_PROGRESS`     | The membrane closes: the prey is inside.                                        | —                                                                                                                                                       | —                                     | The prey's `carriedOffset` = prey.centre − predator.centre is recorded and its velocity zeroed. From here the prey rides with the predator: movement no longer helps. Chip goes solid, bar locks ([`UI.md §3.1`](./UI.md#31-hud-elements-visible-while-roundphase--playing-and-lifestate--alive)).                          |
| **Absorb** | `[ENGULF_SEAL_PROGRESS, 1]`                          | Digestion. `inContact` holds by construction (carried).                         | 0 (carried: `prey.centre = predator.centre + carriedOffset` after the movement step, velocity = the predator's)                                         | `ENGULF_PREDATOR_SPEED_FACTOR_SEALED` | **Spit-out** rolls (spines). **Ratio** release: swallowed toxin and spikes drain the predator until `canContinue` fails, then the prey is ejected at its offset. Nothing else.                                                                                                                                              |

**Struggle (cover and wrap, while `inContact`).** The prey's steer command of this tick
(`steerCommand` of the shared movement kernel, §5.2: the same direction and throttle the movement
step used) is projected away from the predator:

```
awayEffort = throttle × max(0, direction · normalise(prey.centre − predator.centre))     (0 when the centres coincide)
slowdown   = min(ENGULF_STRUGGLE_SLOWDOWN_CAP, ENGULF_STRUGGLE_SLOWDOWN + prey.struggleSlowdownBonus) × awayEffort
progress  += phaseRatePerTick × (1 − slowdown)
```

Steering straight away at full throttle halves the pace (0.5); a Cytoskeleton Lattice or Paramecium
prey pushes the slowdown toward the cap (0.9). Sprint does not enter this formula: its job is speed,
which breaks contact. Both routes are the direction's "moving should help escape": the struggle keeps
movement useful when contact cannot be broken (gel, a strong grip, a corner), and speed and agility
traits shorten the time to break it (E11, TRAITS T13–T17).

**Spit-out (wrap and absorb).** Once per tick, for a prey whose `spitOutChancePerSecond` > 0, the engulf
step draws `roll = streams.engulf.nextFloat()` ([`DETERMINISM.md §3`](./DETERMINISM.md#3-seeded-random-streams-packagessharedsrcrandom-73),
label `engulf`; no draw when the chance is 0, so a dish without spiny cells never touches the stream)
and spits the prey out when `roll < spitOutChancePerSecond × TICK_INTERVAL_S`. Spat out: prey released
with progress 0 at its current centre, `cell_released` with reason `spat_out`, and the predator records a
**refractory** keyed by that prey (`spitOutRefractoryUntilTickByPreyId.set(preyCellId, tick + ENGULF_SPIT_OUT_REFRACTORY_SECONDS × TICK_HZ)`,
one entry per spat-out prey, so a predator that spits out X and then Y within the second still remembers X;
expired entries are pruned at step 1): it cannot start on that prey until the tick after, and the pair is
separated meanwhile (§5.3) so the prey is pushed clear. Only the Diatom Shell sets the chance in build 1 (TRAITS §3.15).

**Swallowed toxin (wrap and absorb).** A prey's `toxinDrainFractionPerSecond` counts
`ENGULF_SWALLOWED_TOXIN_MULTIPLIER` times against its engulfer while the engulf is past cover (§4.1):
the poison is inside the membrane. Spikes (`spikeDrainFractionPerSecond`) drain as before in every
phase from the tick after the start. Both work through the ratio: the predator sheds mass until
`canContinue` fails and the prey is released (`ratio`), in whatever phase, seal included.

**Order inside the engulf step, per pair** (stable id order, #74; the numbers the scenarios quote come
from this order):

1. No engulf: start when `inContact` ∧ `canStart` ∧ the predator has no live refractory on this prey.
   Progress 0, then continue below on the same tick.
2. `¬canContinue` → release, reason `ratio`.
3. `phase` = `engulfPhaseOf(progress, balance.absorption)` from the progress at the start of the step.
4. Wrap or absorb with a positive chance: draw and compare → release, reason `spat_out`, refractory.
5. Cover or wrap: in contact → `progress += phaseRatePerTick × (1 − slowdown)`; out of contact → cover:
   release (`escaped`); wrap: `progress −= ENGULF_ESCAPE_DECAY_MULTIPLIER × baseRatePerTick`, release
   (`escaped`) when it is below `ENGULF_WRAP_START_PROGRESS − ε`. Absorb: `progress += phaseRatePerTick`.
6. Progress ≥ 1 − ε → payout. Progress crossed `ENGULF_SEAL_PROGRESS` this tick → seal (offset recorded,
   prey velocity zeroed). A tick that crosses a band boundary runs entirely at the rate of the phase it
   started in; the overshoot (under one tick) is spent in the next phase.

`massFactor`, the phase multipliers and the held speed factor are recomputed every tick from the
current masses and the modifiers folded at step 1, so a trait picked this tick affects this tick's
engulf. The speed factors the movement step applies (§5.2) read the engulf state at the end of the
previous tick (movement runs before engulf). **Hysteresis:** an engulf in progress is rechecked every tick
against `canContinue`, not `canStart`; the predator holds its prey until it drops below `releaseRatio`,
so decay, toxin and spikes must move the ratio by a real margin rather than a rounding error before
the prey is released. A prey is claimed by at most one predator at a time. Every release sets the prey
`free` with progress 0 and emits `cell_released { cellId, predatorCellId, reason }`.

**Payout at progress ≥ 1 − `ENGULF_PROGRESS_EPSILON`** (so thirty-six additions of 1/36 pay out on tick 36):

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
   cell (prey side; the phase is a band of engulfProgress, engulfPhaseOf):
              contact + canStart              1/6                  seal (0.5)              progress >= 1 − ε
   [free] ----------------------> [being_engulfed: cover] ---> [wrap] ---------> [absorb, carried] ---------> (cell removed, cell_absorbed)
     ^                               |                    |                       |
     |  left contact (escaped)       |                    |                       |
     +-------------------------------+                    |                       |
     |  decayed below 1/6 (escaped) · spat out · ratio    |                       |
     +----------------------------------------------------+                       |
     |  spat out · ratio · aborted (chain, round end)                             |
     +----------------------------------------------------------------------------+
        every release: progress 0, cell_released { reason }

   cell (predator side):
              contact + canStart as predator          prey absorbed / released
   [free] ----------------------------------------> [engulfing] ------------------------> [free]

   [dividing]  (reserved, build 2: unreachable in build 1)

   player:
   [alive] --cell absorbed--> [spectating] --RESPAWN_SPECTATE_SECONDS--> respawn (new cell, [free]) --> [alive]
```

A cell can be `engulfing` and `being_engulfed` at once (a chain); the flags are independent.

### 6.3 Edge cases (resolved)

| Case                                 | Resolution                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mutual engulf                        | Impossible: `requiredRatio` ≥ 1.25 cannot hold both ways. Near-equal cells only push apart (§5.3).                                                                                                                                                                                                                                                                                  |
| Two predators reach one prey         | The first to satisfy contact + eligibility claims it; the other waits. Ties within a tick: lower cell id (stable ordering, #74).                                                                                                                                                                                                                                                    |
| Chain: B engulfs C while A engulfs B | Both run. If A finishes first, C is released (`aborted`, progress 0, at B's last centre, so it now sits inside A: A may start on it next tick) and A's payout is B alone. If B finishes first, B's mass jumps and A's eligibility is rechecked next tick. A sealed B keeps engulfing C from its carried centre.                                                                     |
| Predator drops below `releaseRatio`  | Released immediately (`ratio`) in any phase, seal included; the predator keeps no progress. Between `releaseRatio` and `requiredRatio` the engulf continues (hysteresis, §6.1). A prey ejected from the absorb phase reappears at its carried offset, overlapping the predator, and separation (§5.3) pushes it clear because the predator can no longer engulf it.                 |
| Prey moves away before the seal      | Cover: released the tick contact breaks. Wrap: contact breaks, progress decays at 2× the base rate and the prey is released when it falls below the wrap band (E11). This is the intended escape; the struggle slows the wrap meanwhile.                                                                                                                                            |
| Prey moves away after the seal       | Nothing: the prey is carried (`carriedOffset`), its input is latched but its speed cap is 0 (E11b). Spines and swallowed toxin are the only ways out.                                                                                                                                                                                                                               |
| Spat out, still overlapping          | The refractory (`ENGULF_SPIT_OUT_REFRACTORY_SECONDS`, one per spat-out prey, so two Diatoms spat out in turn each keep theirs) blocks a restart on that prey and separation pushes the pair apart meanwhile; after it, an idle pair sits just past touching and nothing restarts unless the predator closes in again (T4). Another predator may start on the spat-out prey at once. |
| Predator or prey disconnects         | No special case: an input-less cell is still a cell. If the prey is removed from the room mid-engulf, the predator gets no payout and the removed cell drops detritus. If a predator carrying a sealed prey is removed, the prey is released (`aborted`) where it is.                                                                                                               |
| Round enters `results` mid-engulf    | Engulf aborted (`aborted`), no payout.                                                                                                                                                                                                                                                                                                                                              |
| Level-up mid-engulf (either side)    | The draft opens normally; the simulation never pauses.                                                                                                                                                                                                                                                                                                                              |
| Engulf at the wall                   | Clamping only moves centres inward, so contact is never broken by the wall.                                                                                                                                                                                                                                                                                                         |
| Predator at `CELL_MAX_MASS`          | Yield converts to DNA (§5.4).                                                                                                                                                                                                                                                                                                                                                       |
| Same organism (build 2)              | Cells sharing `organismId` never engulf each other. Trivially true in build 1.                                                                                                                                                                                                                                                                                                      |
| Engulf during split (build 2)        | Open for #28. Proposed: each daughter cell is an independent prey; a predator engulfing a cell that splits keeps the half it overlaps.                                                                                                                                                                                                                                              |
| Partial absorption / nibbling        | Not in v1 (GAME-DESIGN §10 non-goals).                                                                                                                                                                                                                                                                                                                                              |

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
| `FOOD_KIND_WEIGHTS`                                                               | algae 0.75, bacterium 0.25     | per-mote shares |
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

Against PR #142's `absorption.ts` (#97): `ENGULF_BASE_DURATION_SECONDS` goes from a 1.0 s literal to
the 1.2 s sum of the three phase seconds (sheet 03's timing; E9 pays out on tick 36, not 30), and the
eleven names from `ENGULF_COVER_SECONDS` to `ENGULF_SPIT_OUT_REFRACTORY_SECONDS` are new, so the
constants-ledger pin for this section moves from 70 to 81 names.

| Constant                                                               | Value     | Unit                                                              |
| ---------------------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| `ENGULF_MASS_RATIO`                                                    | 1.25      | ×                                                                 |
| `ENGULF_RELEASE_RATIO`                                                 | 1.10      | ×                                                                 |
| `ENGULF_PROGRESS_EPSILON`                                              | 1e-6      | progress                                                          |
| `ENGULF_COVERAGE_FRACTION`                                             | 0.5       | prey radii                                                        |
| `ENGULF_COVER_SECONDS`                                                 | 0.2       | s                                                                 |
| `ENGULF_WRAP_SECONDS`                                                  | 0.4       | s                                                                 |
| `ENGULF_ABSORB_SECONDS`                                                | 0.6       | s                                                                 |
| `ENGULF_BASE_DURATION_SECONDS`                                         | 1.2       | s (derived: the three phase seconds summed; sheet 03's 1.2 s)     |
| `ENGULF_WRAP_START_PROGRESS` / `ENGULF_SEAL_PROGRESS`                  | 1/6 / 0.5 | progress (derived from the phase seconds, never a fourth literal) |
| `ENGULF_MIN_DURATION_FACTOR`                                           | 0.5       | ×                                                                 |
| `ENGULF_ESCAPE_DECAY_MULTIPLIER`                                       | 2         | ×                                                                 |
| `ENGULF_STRUGGLE_SLOWDOWN` / `ENGULF_STRUGGLE_SLOWDOWN_CAP`            | 0.5 / 0.9 | ratio of the phase rate                                           |
| `ENGULF_PREDATOR_SPEED_FACTOR` / `ENGULF_PREDATOR_SPEED_FACTOR_SEALED` | 0.6 / 1.0 | × (cover and wrap / absorb)                                       |
| `ENGULF_PREY_SPEED_FACTOR` / `ENGULF_PREY_SPEED_FACTOR_FLOOR`          | 0.8 / 0.3 | × (wrap; cover is 1, absorb is 0)                                 |
| `ENGULF_SWALLOWED_TOXIN_MULTIPLIER`                                    | 6         | × on the prey's toxin drain against its engulfer, wrap and absorb |
| `ENGULF_SPIT_OUT_REFRACTORY_SECONDS`                                   | 1.0       | s (per spat-out prey: the predator keeps one entry per prey)      |
| `ENGULF_MASS_YIELD`                                                    | 0.8       | ratio                                                             |
| `ENGULF_DNA_BASE` / `ENGULF_DNA_SHARE`                                 | 30 / 0.2  | DNA / ratio                                                       |
| `ENGULF_TAG_SHARE` / `ENGULF_PREDATORY_TAG_POINTS`                     | 0.5 / 10  | ratio / points                                                    |
| `ENGULF_TRAIT_STEAL_CHANCE`                                            | 0         | reserved                                                          |

## 8. Acceptance scenarios

Given seed S and inputs I, after N ticks assert X. These conventions apply to every scenario table in
the design docs (GAME-DESIGN §13, PROGRESSION §7, TRAITS §6):

- **Placed** cells, motes and fragments come from the framework's fixture helpers; everything else
  comes from the seed. A row that places anything runs with the initial fill and both spawners
  disabled by the fixture, so no seeded mote interferes with the arithmetic.
- **Default placement.** A placed cell sits at the broth point (1500, 0) unless the row says
  otherwise: mid-broth, 1000 wu from both the vent and the shallows, so no wall, vent or light
  effect reaches an expected value (decay factor k = 1). The helper fails the scenario if a seeded
  gel patch comes within 350 wu of that point (pick another seed; never tolerate it). A second placed cell
  sits east of the first on the x axis at the row's centre distance. "In the vent" = the origin;
  "in the shallows" = (`DISH_RADIUS` − `SHALLOWS_WIDTH` / 2, 0) = (2750, 0).
- **Fixture-granted traits** bypass the ladder and the draft (a fixture may give a protocell cilia).
- **Pinned** = the fixture restores the cell's centre after the movement step every tick (movement
  and separation cannot move it).
- **"Target N radii east"** (or west) = every tick's input targets the point N × radius east (west) of
  the cell's _current_ centre (full throttle, never reached).
- **"Steers away from tick t"** = from tick t every input targets the point 5 radii from the cell's
  current centre along the line from the other placed cell's centre through its own (full throttle,
  `awayEffort` = 1, §6.1). **"Sprints away at tick t"** = steers away from tick t and presses sprint on
  tick t. Placed cells are never pinned in these rows: the predator is idle and stays put unless the row
  gives it an input (E9b), the prey moves by the movement step alone.
- **Decay is never disabled.** Placed cells decay from tick 1 and expected masses include it:
  `decayed(m, n, k = 1) = CELL_STARTING_MASS + (m − CELL_STARTING_MASS) × (1 − MASS_DECAY_RATE_PER_SECOND × k / 60)^n`
  (k = the zone × trait decay multiplier). Mass assertions are ± 0.01 unless the row says otherwise.
- **Expected values assume the fixed step order** of [`ARCHITECTURE.md`](./ARCHITECTURE.md)
  (inputs, round, movement, eating, metabolism, engulf, progression, spawners, respawn, leaderboard).
  In particular eating precedes decay within a tick, and metabolism precedes the engulf check, so a
  placed predator has already decayed when its first eligibility check runs.
- "Tick t" = the state after the t-th `stepWorld`; the fixture acts between ticks.

| #    | Given                                                                                                                     | Inputs                                                         | After      | Assert                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1   | seed 42, 1 player (nothing placed: seeded world)                                                                          | idle                                                           | 0 ticks    | food count = 420 (0.6 × 700), fragment count = 24 (0.6 × 40); every mote within `DISH_RADIUS − FOOD_EDGE_MARGIN`; algae share of motes within 0.75 ± 0.06 (per-mote shares, §3; the spread across seeds is ≈ 0.05, so this holds for the pinned seed only); no mote inside the player cell (initial fill runs after placement, §3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| E2   | seed 42, 1 player (seeded world)                                                                                          | idle                                                           | 600 ticks  | food spawned in ticks 1–600 between 70 (7/s × 10 s) and 74 (cluster overshoot < `BACTERIUM_CLUSTER_SIZE`); fragments spawned = 6 (0.6/s × 10 s). Counters, not populations: the idle cell may eat a drifting mote.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| E3   | seed 42, 1 player (seeded world)                                                                                          | idle                                                           | 3000 ticks | food count = 700 (cap) ± 1; fragment count = 40 (cap) ± 1 (a mote eaten this tick is refilled next tick); no cluster ever pushes the count above the cap.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| E4   | seed 42, 1 player, algae mote placed 10 wu east of the centre                                                             | idle                                                           | 1 tick     | mass = 21 (± 0.01), mote gone. Same with a `plain` bacterium: mass = 23, DNA = 1, `motile` tag points = 1. With an `aerobic` bacterium: `metabolic` = 1 and `bacteriaEatenByVariant.aerobic` = 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| E5   | seed 42, 1 player placed at mass 1020 at the default broth point (1500, 0)                                                | idle                                                           | 60 ticks   | mass = `decayed(1020, 60)` ≈ 1018.00. Placed in the vent (k = 1.5): ≈ 1017.00.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| E6   | seed 42, 1 player placed at mass 320 (then 5000)                                                                          | target 5 radii east                                            | 120 ticks  | speed within 0.5 wu/s of 110.1 (then 55.4): maxSpeed of the decayed mass, blend converged to 99.97 %.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| E7   | seed 42, 1 player placed at mass 80                                                                                       | idle                                                           | 1 tick     | radius = 35.78 (± 0.01).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| E8   | seed 42, 1 player placed at mass 500 at the centre of a gel patch                                                         | target 5 radii east                                            | 120 ticks  | speed within 0.5 wu/s of 49.4 (98.5 × gelSpeedFactor 0.502 for the decayed mass 498.1); the cell has travelled ≈ 87 wu and is still inside the patch (`GEL_PATCH_RADIUS` 350).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| E9   | seed 42, 2 players placed: A mass 100, B mass 20, centres 10 wu apart                                                     | idle                                                           | 36 ticks   | engulf starts tick 1 at ratio 5 (`massFactor` 0.5, 1/36 per tick; B idle so no struggle): cover ticks 1–6 (progress 1/6 on tick 6), wrap 7–18, seal on tick 18 (progress 0.5, B carried at 10 wu east), absorb 19–36, payout on tick 36: B's cell removed, B `lifeState` = `spectating`; A mass = `decayed(100, 36)` + 16 ≈ 115.90; A DNA = 30; A absorptions = 1; detritus motes total mass = 4 (two motes of 2). A's speed cap is × 0.6 on ticks 2–18 and × 1 from tick 19 (the movement step reads the previous tick's phase: tick 18 ends at progress 0.5, the absorb band); an idle A has speed 0 under any cap, so the cap is observed in E9b.                                                                                                                                                                                                                                                                   |
| E9b  | E9 setup                                                                                                                  | A targets 5 radii west from tick 1                             | 36 ticks   | The engulf runs exactly as E9 (cover 1–6, seal on tick 18 at progress 0.5, payout on tick 36, A mass ≈ 115.90, A DNA = 30): B is idle and A drags its cover along, so contact holds while the centres drift apart (22.53 wu at the seal, under the 31.05 wu contact bound; B carried ≈ 22.53 wu east of A's centre from tick 18 to payout). A's speed (`CellView.velocity`, ± 0.5 wu/s) shows the cap: tick 1 blends toward `maxSpeed(100)` = 147.1 (no engulf at the start of the tick; 9.8 wu/s), ticks 2–18 toward 147.1 × `ENGULF_PREDATOR_SPEED_FACTOR` = 88.3 (64.0 wu/s on tick 18), ticks 19–36 toward 147.1 × `ENGULF_PREDATOR_SPEED_FACTOR_SEALED` (69.5 wu/s on tick 19, 121.4 on tick 35). Tick 18 is still capped at 0.6 although it ends at progress 0.5, and tick 19 is the first tick at × 1: the movement step reads the previous tick's phase. A's centre is ≈ 12.5 wu west of its start on tick 18. |
| E10  | seed 42, A placed at mass 24, B at 20, centres 10 wu apart                                                                | idle                                                           | 120 ticks  | no engulf (24 < 25 and decaying); separation has pushed them apart: `A.radius + B.radius − distance` < 0.01 wu (overlap × 0.8^120). With A placed at 26 (≥ 25 on tick 1 after decay, and ≥ `ENGULF_RELEASE_RATIO` × 20 = 22 throughout): `massFactor` = 25 / A.mass ≈ 0.9615, so ≈ 0.01444 per tick; cover ends tick 12, seal on tick 35 (progress ≈ 0.5055), B absorbed on tick 70; A mass ≈ 41.99 after payout.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| E11  | seed 42, A placed at mass 100, B at 20, centres 10 wu apart                                                               | B sprints away at tick 10                                      | 200 ticks  | B is in wrap (progress 0.25 after tick 9). From tick 10 the struggle halves the wrap (`awayEffort` 1, slowdown 0.5: +1/72 per tick) and B's cap is 220 × 1.8 × 0.8 = 316.8 wu/s (held factor 0.8). Contact breaks on tick 21 (B has moved past 40 − 17.89 × 0.5 = 31.06 wu from A's centre; A radius 40, B radius 17.89); progress then decays by 2/36 per tick from ≈ 0.4028 and is below 1/6 on tick 25 → B released on tick 25 (`cell_released` reason `escaped`), both `free`; B alive at tick 200, mass = 20 (sprint cost floored at starting mass); A `free`, absorptions = 0. **Reaction window:** the same input from tick 13 still escapes (contact breaks tick 24, released tick 29); from tick 14 B is sealed on tick 23 and absorbed on tick 41. Steering away without sprint from tick 10: contact breaks tick 26, released tick 31.                                                                      |
| E11b | E11 setup                                                                                                                 | B sprints away at tick 19                                      | 40 ticks   | B was sealed on tick 18 (E9): its input is latched, its speed cap is 0, its centre stays at A's centre + (10, 0) every tick; absorbed on tick 36 exactly as E9. Movement after the seal changes nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| E12  | seed 42, A placed at mass 5000, algae placed inside A                                                                     | idle                                                           | 1 tick     | eating (step 4) takes A to 5001 → overflow 1 → DNA = 0.1 (`MASS_OVERFLOW_DNA_PER_MASS`), mass 5000; decay (step 5) then removes (5000 − 20) × 0.002 / 60: mass ≈ 4999.83.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| E13  | seed 42, A engulfing B at progress 0.5, round timer forced to 0                                                           | idle                                                           | 1 tick     | `roundPhase` = `'results'`, both cells `free`, A absorptions = 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| E14  | seed 42, 1 player (seeded world), run to `ROUND_BLOOM_START_FRACTION` × round with food held at 0 by the fixture          | idle                                                           | +600 ticks | food spawned in those 600 ticks between 105 (7 × 1.5 × 10) and 109 (cluster overshoot); fragments spawned = 12 (0.6 × 2 × 10).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| E15  | seed 42, 1 player with `nucleoid` I (fixture); one `photosynthetic` bacterium placed inside the cell per tick for 5 ticks | idle                                                           | 5 ticks    | `bacteriaEatenByVariant.photosynthetic` = 5, `.aerobic` = 0, `photic` tag points = 5, `dnaCumulative` = 5.25 (± 0.01: 5 × 1.05, `nucleoid` I's `dnaGainMultiplier` applies to every gain, TRAITS §2); `chloroplast` is a draft candidate (PROGRESSION P12 pins the pure rule at 4 vs 5). Separately: A (level 1, no traits) absorbs B who owns `mitochondrion` I → `bacteriaEatenByVariant.aerobic` ≥ 5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| E16  | seed 42, A placed at mass 30, B at 20, centres 10 wu apart (engulf from tick 1)                                           | fixture sets A.mass = 23 before tick 10, = 21.5 before tick 20 | 20 ticks   | ticks 1–9 at ratio 1.5 (`massFactor` 0.8333, 1/60 per tick); ticks 10–19: engulf continues (23 ≥ 22 = `ENGULF_RELEASE_RATIO` × 20 although 23 < 25) at 1/72 per tick, progress ≈ 0.2889 after tick 19 (wrap); tick 20: released (`ratio`), both cells `free`, B `engulfProgress` = 0, A absorptions = 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| E16b | E16 setup                                                                                                                 | fixture sets A.mass = 23 before tick 10, = 21.5 before tick 40 | 40 ticks   | sealed on tick 35 (progress ≈ 0.5111), ticks 36–39 in absorb with B carried; tick 40: released from the absorb phase (`ratio`), no payout, B `free` at its carried offset with progress 0, A absorptions = 0; from tick 41 separation pushes the pair apart (A can no longer engulf B).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
