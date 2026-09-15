# Evolution — Ecology, Growth and Absorption: food, zones and the spawn model

§1–§3.2 of the split [`ECOLOGY.md`](../ECOLOGY.md), which keeps the shared context and the file list.

## 1. Food kinds

| Kind          | Constant prefix | Mass | DNA  | Tag points           | Motion                                 | Radius (wu) | Lifetime                    |
| ------------- | --------------- | ---- | ---- | -------------------- | -------------------------------------- | ----------- | --------------------------- |
| Algae mote    | `ALGAE_`        | 1    | 0    | `photic` × 1         | static                                 | 6           | none                        |
| Bacterium     | `BACTERIUM_`    | 3    | 1    | one tag by variant   | random walk, `BACTERIUM_DRIFT_SPEED`   | 8           | none                        |
| Detritus mote | `DETRITUS_`     | 2    | 0    | none                 | static                                 | 7           | `DETRITUS_LIFETIME_SECONDS` |
| DNA fragment  | `DNA_FRAGMENT_` | 0    | 5    | one tag by zone (§2) | slow drift, `DNA_FRAGMENT_DRIFT_SPEED` | 9           | none                        |
| Wild cell     | `WILD_CELL_`    | §3.3 | §3.3 | none                 | steered by the wild strategy (§3.3)    | §5.1        | respawns, §3.3              |

- **Eating rule.** A mote is eaten the tick its centre lies within the cell's radius. Any cell can eat
  any mote; no minimum size. Mass is added instantly (the renderer animates the gulp); DNA and tag
  points go to the progression counters ([`PROGRESSION.md`](../PROGRESSION.md#1-dna-and-tags)).
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
gate the endosymbiont traits at `ENDOSYMBIOSIS_BACTERIA_REQUIRED` = 10, two full clusters of one
variant ([`game-design/core.md §3`](../game-design/core.md#3-the-evolution-ladder); decision #138, option A). Absorbing a player cell that owns
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
- **Kind then zone then point.** `FOOD_KIND_WEIGHTS_BY_WORLD_STAGE[worldStage]` (§3.2; the
  protocell-era row is algae 0.75, bacterium 0.25, and every number in this section quotes that row)
  are **per-mote shares**. A bacterium event spawns a whole cluster, so a spawn event draws its
  kind with the event weights algae 0.75 : bacterium 0.25 / `BACTERIUM_CLUSTER_SIZE` = 0.05
  (renormalised 0.9375 / 0.0625; derived in code from the row and the cluster size, never a third
  constant). The expected mote mix is then 0.75 / 0.25 and the pace estimate below holds. Next a zone from that kind's zone
  weights, then a uniform point inside that zone, rejecting points within `FOOD_EDGE_MARGIN` of the
  wall or inside any cell (retry up to `SPAWN_POINT_MAX_ATTEMPTS`, then skip this spawn).
- **Bacteria spawn as clusters** of `BACTERIUM_CLUSTER_SIZE` within `BACTERIUM_CLUSTER_RADIUS` of
  the drawn point, all of one variant drawn from `BACTERIUM_VARIANT_WEIGHTS_BY_ZONE` for the zone.
  The cluster is truncated to the room left under the cap (never exceeds it) and consumes one
  accumulator unit per member actually spawned (the accumulator may go negative and recovers), so
  over a window the spawner overshoots its accumulated budget by fewer than `BACTERIUM_CLUSTER_SIZE`.
  The initial fill uses the same kind draw and spawns clusters too, so the vent is clustered at
  tick 0 (each member is redrawn on rejection, and the last cluster is truncated to the fill count).
- **Zone weights per kind:** algae shallows 0.70 / broth 0.25 / vent 0.05; bacterium vent 0.50 /
  broth 0.30 / shallows 0.20 (#119, from 0.60 / 0.30 / 0.10); DNA fragment vent 0.40 / broth 0.40 / shallows 0.20.
- **The two trips are unequal by design, but not by a factor of ten (#119).** The vent is 2.8 % of the dish
  and the shallows 30.6 %, so no weight makes their densities match; what a player feels is the time to
  find two clusters. At 0.60 / 0.10 a solo dish in the trip era holds ≈ 42 bacterium clusters, ≈ 17.6
  aerobic ones inside the vent (all on one screen: seconds) and ≈ 2.9 photosynthetic ones spread round
  the 17 300 wu ring of the shallows (≈ 6 000 wu apart: ≈ 100 s of cruising at mass 200, 124 wu/s). At
  0.50 / 0.20 the vent keeps ≈ 14.7 (still one screen) and the ring holds ≈ 5.9 (≈ 2 900 wu apart:
  ≈ 50 s). The vent stays the short, crowded, decaying trip and the shallows the long, safe cruise; the
  chloroplast is no longer a hunt. How a player sees it: a green cluster is in sight within a minute of
  reaching the rim.
- **Variant weights per zone** (`BACTERIUM_VARIANT_WEIGHTS_BY_ZONE`): vent plain 0.3 / aerobic 0.7 /
  photosynthetic 0; shallows plain 0.3 / aerobic 0 / photosynthetic 0.7; broth and gel plain 0.6 /
  aerobic 0.2 / photosynthetic 0.2. A vent trip is the mitochondrion, a shallows trip the chloroplast;
  with `ENDOSYMBIOSIS_BACTERIA_REQUIRED` = 10 a trip means two clusters (about 90 s at the vent or
  the shallows in the #138 pace model), never one.
- **Bloom.** From `ROUND_BLOOM_START_FRACTION` of the round, food rate × `FOOD_BLOOM_SPAWN_MULTIPLIER`
  and fragment rate × `DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER`; caps unchanged.
- **Expected time to level 2, solo (design estimate).** Level 2 needs 60 DNA
  ([`PROGRESSION.md`](../PROGRESSION.md#2-level-thresholds)). Fragments refill at 0.4/s solo
  (`DNA_FRAGMENT_SPAWN_PER_SECOND_BASE` 0.3 plus 0.1 per player), so a grazing player reaches one
  every ~20 s at spawn size, faster as the cell's sweep grows (5 DNA each), plus a bacterium every
  ~10 s (1 DNA): about 2:50 (decision #138, option A, pace model). Acceptance bound: 6:00 = 21 600
  ticks (scenario P1).

### 3.1 The world clock

The dish has its own place on the ladder. The **world clock** turns round time into the **world's
average cell**: a reference level, stage and mass that everything non-player in the dish is measured
against. It is the human's direction on decision #141, quoted: "a fresh cell starts in a world similar
to itself, and that world evolves as time passes, its up to the players to evolve faster than the
average if they can" (designed in #147). One pure function, one home:
`worldReference(elapsedSeconds, balance)` in `packages/shared/src/simulation/world-clock.ts` (shared,
so the HUD reads the same numbers the server acts on; nothing about the world's clock rides on the
wire); constants in `constants/world-clock.ts` ([`game-design/constants-and-acceptance.md §12`](../game-design/constants-and-acceptance.md#12-constants-table)).

```
elapsedTicks   = min(tick − roundStartTick, roundDurationSeconds × TICK_HZ)          (integer; `tick` is the tick being stepped, so every step of tick 10 800 reads 10 800; frozen during `results`; 0 again after a rematch)
elapsedSeconds = elapsedTicks / TICK_HZ                                               (10 800 / 60 = 180 exactly; never derived from `roundTimeLeftMs`, which step 2 updates after the pin at step 1 and lands on either side of 180.0)
worldLevel     = min(1 + elapsedSeconds / WORLD_LEVEL_SECONDS, MAX_LEVEL)            (continuous: 2.5 is halfway from level 2 to 3)
worldStage     = stageOf(WILD_CELL_BUILDS[0].slice(0, floor(worldLevel) − 1))         (the stage of the world's own picks, §3.3: nucleoid at 2, endosymbiont at 3, envelope at 4, a form's prerequisite at 5, the form at 6)
worldMass      = min(CELL_STARTING_MASS + WORLD_MASS_GAIN_PER_SECOND × elapsedSeconds, CELL_MAX_MASS)
worldDna       = cumulative DNA of level floor(worldLevel)                             (PROGRESSION §2: 0, 60, 140, 240, 360, …)
```

| Round time (600 s round) | `worldLevel` | `worldStage`    | `worldMass` | `worldDna` |
| ------------------------ | ------------ | --------------- | ----------- | ---------- |
| 0:00                     | 1.00         | `protocell`     | 20          | 0          |
| 3:00                     | 2.00         | `prokaryote`    | 200         | 60         |
| 6:00                     | 3.00         | `endosymbiosis` | 380         | 140        |
| 9:00                     | 4.00         | `eukaryote`     | 560         | 240        |
| 10:00                    | 4.33         | `eukaryote`     | 620         | 240        |
| 12:00 (longer rounds)    | 5.00         | `eukaryote`     | 740         | 360        |
| 15:00 (longer rounds)    | 6.00         | `specialised`   | 920         | 500        |
| 33:00 (longer rounds)    | 12.00 (cap)  | `specialised`   | 2000        | 1760       |

- **Absolute seconds, not a fraction of the round.** Player pace is DNA per second
  ([`PROGRESSION.md §2`](../PROGRESSION.md#2-level-thresholds)), so the world tracks seconds: a 60 s
  round never leaves the protocell era, a 1800 s round is specialised from 15:00. The bloom stays a
  fraction of the round ([`game-design/session.md §5.1`](../game-design/session.md#51-round-timeline-and-pace-curve))
  and is independent of the clock; in a 600 s round it coincides with the eukaryote era.
- **Calibration.** The world lags the #138 option A player (one active player who takes the trip at
  the first chance, pace model ± 20 s): nucleoid 2:51 vs the world's 3:00, endosymbiont 5:42 vs 6:00,
  envelope 8:01 vs 9:00, a form 9:42 vs never; mass 212 vs 200 at 3:00, 507 vs 380 at 6:00, 853 vs
  620 at 10:00 (`qa/decisions/dish-play-scale/evolving/evolving-world-timeline.png`). That model has
  no wild-cell absorptions (§3.3), so a player who eats peers runs further ahead; a greedy-bot
  player is at the world's pace by construction (P1's bound, level 2 by 6:00, is twice the world's
  3:00). The first playtest of #98 re-tunes `WORLD_LEVEL_SECONDS` and `WORLD_MASS_GAIN_PER_SECOND`
  and nothing else.
- **World level-up.** On the tick `floor(worldLevel)` increments (the tick whose `elapsedTicks` =
  `n × WORLD_LEVEL_SECONDS × TICK_HZ`: 10 800, 21 600 and 32 400 in a 600 s round) the round step
  (step 2) emits a `world_level_up` effect carrying the new level and stage, every wild cell gains
  its next pick the same tick (§3.3; the pin at step 1 already reads the new level, because
  `elapsedTicks` counts the tick in progress), and the spawn tables switch rows (§3.2). The HUD toasts it
  ([`UI.md`](../UI.md), #146).
- **Ahead of the world** (the player's goal). One pure function beside `worldReference`,
  `standingAgainstWorld(level, mass, reference)` → `'ahead' | 'with' | 'behind'`: the level decides
  first (`level` above `floor(worldLevel)` is ahead, below is behind); at the world's level the mass
  decides, with a band of `WORLD_STANDING_MASS_TOLERANCE` × `worldMass` either side of `worldMass`
  that reads as `with` (at 3:00: 180–220 is with the world, 221 ahead, 179 behind). The HUD reads it
  ([`game-design/session.md §5.5`](../game-design/session.md#55-the-evolving-world)); scenario G12. Expect WITH to be
  the first caption most players see: the #138 option A player's mass sits inside the band until
  about 5:00 (212 vs 200 at 3:00, 285 vs 260 at 4:00) and its level leads the world's only from
  8:01, so AHEAD first appears by mass around 5:00. `WORLD_STANDING_MASS_TOLERANCE` 0.05 would
  reward the active player from about 3:00; that is a #158 knob, not changed here.

### 3.2 What the world stage drives

| `worldStage`    | `FOOD_KIND_WEIGHTS_BY_WORLD_STAGE` algae : bacterium | `BROTH_VARIANT_SHARE_BY_WORLD_STAGE` | Wild cells own (§3.3)                                             | Wild behaviour (§3.3) |
| --------------- | ---------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------- | --------------------- |
| `protocell`     | 0.75 : 0.25                                          | 0                                    | nothing                                                           | wander, flee          |
| `prokaryote`    | 0.70 : 0.30                                          | 0.2                                  | `nucleoid`                                                        | wander, flee          |
| `endosymbiosis` | 0.60 : 0.40                                          | 0.4                                  | + `mitochondrion` or `chloroplast`                                | wander, flee, hunt    |
| `eukaryote`     | 0.50 : 0.50                                          | 0.6                                  | + `nuclear_envelope` (level 4), + a form's prerequisite (level 5) | wander, flee, hunt    |
| `specialised`   | 0.50 : 0.50                                          | 0.6                                  | + the form (level 6), then tiers                                  | wander, flee, hunt    |

- **Spawn mix.** The kind draw reads the row of the current world stage (a draw on the level-up
  tick already uses the new row: step 8 runs after step 2). The dish grows heavier, not busier:
  caps and rates never change, the mean mote mass rises from 1.5 (0.75 × 1 + 0.25 × 3) to 2.0 and
  bacteria, the only motes that carry DNA, double their share by the eukaryote era.
- **Zone character.** The vent and shallows rows of `BACTERIUM_VARIANT_WEIGHTS_BY_ZONE` are fixed
  (the trip is always a trip). The broth and gel row is derived from the share: plain = 1 − share,
  aerobic = photosynthetic = share / 2, so the plain 0.6 / aerobic 0.2 / photosynthetic 0.2 quoted
  above is the endosymbiosis-era row; in the protocell era every broth cluster is plain and by the
  eukaryote era the row is 0.4 / 0.3 / 0.3. Organelles spread through the world as it ages: early,
  only a trip finds them; late, a laggard stumbles on them in the broth (catch-up). The renderer
  may key the zone tint peak to the world stage (a `render/constants.ts` number that
  [`visual-style/principles-and-palette.md §2`](../visual-style/principles-and-palette.md#2-palette) would own); nothing in build 1 needs it.
- **Density is flat over the round.** `FOOD_CAP_*`, `DNA_FRAGMENT_CAP_*` and `WILD_CELL_COUNT` do
  not vary with the world stage. Sprites at cap, solo: 700 motes + 40 fragments + 24 wild cells + 1
  player (#141 option A's mote numbers; the human's answer moved the question from motes to peers,
  §3.4). The dish fills by getting heavier and more dangerous, never by adding sprites.
