# Evolution — Ecology, Growth and Absorption: constants table

§7 of the split [`ECOLOGY.md`](../ECOLOGY.md), which keeps the shared context and the file list.

## 7. Constants table

Home: `packages/shared/src/constants/<domain>.ts`.

### `ecology.ts`

| Constant                                                                          | Value                          | Unit                           |
| --------------------------------------------------------------------------------- | ------------------------------ | ------------------------------ |
| `ALGAE_MASS` / `ALGAE_DNA` / `ALGAE_RADIUS` / `ALGAE_TAG` / `FOOD_TAG_POINTS`     | 1 / 0 / 6 / `photic` / 1       | mass / DNA / wu / tag / points |
| `BACTERIUM_MASS` / `BACTERIUM_DNA` / `BACTERIUM_RADIUS`                           | 3 / 1 / 8                      | mass / DNA / wu                |
| `BACTERIUM_DRIFT_SPEED`                                                           | 20                             | wu/s                           |
| `BACTERIUM_CLUSTER_SIZE` / `BACTERIUM_CLUSTER_RADIUS`                             | 5 / 60                         | count / wu                     |
| `BACTERIUM_VARIANTS`                                                              | plain, aerobic, photosynthetic | ids                            |
| `BACTERIUM_VARIANT_WEIGHTS_BY_ZONE`                                               | §3; broth and gel §3.2         | weights                        |
| `BACTERIUM_TAG_BY_VARIANT`                                                        | see §1                         | tags                           |
| `DETRITUS_MOTE_MASS` / `DETRITUS_RADIUS`                                          | 2 / 7                          | mass / wu                      |
| `DETRITUS_MASS_FRACTION`                                                          | 0.2                            | ratio                          |
| `DETRITUS_LIFETIME_SECONDS` / `DETRITUS_SCATTER_RADIUS_FACTOR`                    | 30 / 2                         | s / × radius                   |
| `DNA_FRAGMENT_DNA` / `DNA_FRAGMENT_RADIUS`                                        | 5 / 9                          | DNA / wu                       |
| `DNA_FRAGMENT_DRIFT_SPEED`                                                        | 10                             | wu/s                           |
| `FOOD_KIND_WEIGHTS_BY_WORLD_STAGE`                                                | §3.2; protocell 0.75 / 0.25    | shares / stage                 |
| `BROTH_VARIANT_SHARE_BY_WORLD_STAGE`                                              | 0/0.2/0.4/0.6/0.6 (§3.2)       | ratio / stage                  |
| `FOOD_ZONE_WEIGHTS_BY_KIND`                                                       | see §3                         | weights                        |
| `FOOD_CAP_BASE` / `FOOD_CAP_PER_PLAYER`                                           | 600 / 100                      | count                          |
| `FOOD_SPAWN_PER_SECOND_BASE` / `FOOD_SPAWN_PER_SECOND_PER_PLAYER`                 | 6 / 1                          | motes/s                        |
| `FOOD_INITIAL_FILL_FRACTION`                                                      | 0.6                            | ratio                          |
| `DNA_FRAGMENT_CAP_BASE` / `DNA_FRAGMENT_CAP_PER_PLAYER`                           | 30 / 10                        | count                          |
| `DNA_FRAGMENT_SPAWN_PER_SECOND_BASE` / `DNA_FRAGMENT_SPAWN_PER_SECOND_PER_PLAYER` | 0.3 / 0.1                      | fragments/s                    |
| `DNA_FRAGMENT_INITIAL_FILL_FRACTION`                                              | 0.6 (#138 option A: unchanged) | ratio                          |
| `DNA_FRAGMENT_TAG_TABLE_BY_ZONE`                                                  | see §2                         | weights                        |
| `FOOD_BLOOM_SPAWN_MULTIPLIER` / `DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER`             | 1.5 / 2                        | ×                              |
| `SPAWN_POINT_MAX_ATTEMPTS`                                                        | 10                             | count                          |
| `SHALLOWS_WIDTH` / `VENT_RADIUS`                                                  | 500 / 500                      | wu                             |
| `GEL_PATCH_COUNT` / `GEL_PATCH_RADIUS` / `GEL_PATCH_MIN_SPACING`                  | 3 / 350 / 900                  | count / wu / wu                |
| `VENT_DECAY_MULTIPLIER`                                                           | 1.5                            | ×                              |
| `MASS_DECAY_RATE_PER_SECOND`                                                      | 0.002                          | 1/s                            |

### `growth.ts`

| Constant                                                           | Value            | Unit         |
| ------------------------------------------------------------------ | ---------------- | ------------ |
| `CELL_STARTING_MASS`                                               | 20               | mass         |
| `CELL_MAX_MASS`                                                    | 5000             | mass         |
| `CELL_RADIUS_SCALE`                                                | 4                | wu/√mass     |
| `CELL_BASE_SPEED`                                                  | 220              | wu/s         |
| `CELL_ACCELERATION_SECONDS`                                        | 0.25             | s            |
| `CELL_SEPARATION_FRACTION_PER_TICK`                                | 0.2              | ratio        |
| `CELL_MIN_CENTRE_DISTANCE_FRACTION`                                | 0.5              | ratio        |
| `GEL_MASS_SCALE` / `GEL_MIN_SPEED_FACTOR` / `GEL_MAX_SPEED_FACTOR` | 1000 / 0.4 / 0.9 | mass / × / × |
| `MASS_OVERFLOW_DNA_PER_MASS`                                       | 0.1              | DNA/mass     |
| `MITOSIS_*`, `EJECT_MASS`                                          | §5.4             | reserved     |

### `wild-cells.ts` (§3.3; the world clock itself is `world-clock.ts`, [`game-design/constants-and-acceptance.md §12`](../game-design/constants-and-acceptance.md#12-constants-table))

| Constant                                   | Value                   | Unit                              |
| ------------------------------------------ | ----------------------- | --------------------------------- |
| `WILD_CELL_COUNT`                          | 24                      | seats                             |
| `WILD_CELL_SIZE_FACTOR_MIN`                | 0.5                     | × `worldMass`                     |
| `WILD_CELL_SIZE_FACTOR_MAX`                | 2.0                     | × `worldMass`                     |
| `WILD_CELL_RECOVERY_SECONDS`               | 6                       | s (time constant)                 |
| `WILD_CELL_MAX_WORLD_MASS_MULTIPLE`        | 3                       | × `worldMass`                     |
| `WILD_CELL_SIGHT_VIEW_MULTIPLE`            | 1.0                     | × `viewHalfHeightFor`             |
| `WILD_CELL_SPRINT_FLEE_RADII`              | 4                       | own radii                         |
| `WILD_CELL_SPRINT_HUNT_RADII`              | 3                       | own radii                         |
| `WILD_CELL_CARRYING_CAPACITY_MULTIPLE`     | 1.5                     | × `WILD_CELL_COUNT` × `worldMass` |
| `WILD_CELL_STARVATION_FRACTION_PER_SECOND` | 0.1                     | of full size per second           |
| `WILD_CELL_FEAST_MASS_FRACTION`            | 0.8                     | of the burst cell's mass          |
| `WILD_CELL_BUILDS`                         | the three lists of §3.3 | trait ids                         |
| `WILD_CELL_RESPAWN_SECONDS`                | 10                      | s                                 |
| `WILD_CELL_MIN_SPACING_WU`                 | 200                     | wu                                |
| `WILD_CELL_DECISION_INTERVAL_SECONDS`      | 0.5                     | s                                 |
| `WILD_CELL_FLEE_RANGE_RADII`               | 8                       | own radii                         |
| `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE`       | `endosymbiosis`         | `CellStage`                       |
| `WILD_CELL_TURN_CHANCE`                    | 0.25                    | per decision                      |

### `absorption.ts`

Against PR #142's `absorption.ts` (#97): `ENGULF_BASE_DURATION_SECONDS` goes from a 1.0 s literal to
the 1.2 s sum of the three phase seconds (sheet 03's timing; E9 pays out on tick 36, not 30), and the
eleven names from `ENGULF_COVER_SECONDS` to `ENGULF_SPIT_OUT_REFRACTORY_SECONDS` are new (#167 pinned
the ledger for this section at 81 names). The evolving world (#161) adds `BROTH_VARIANT_SHARE_BY_WORLD_STAGE`
and the eleven `wild-cells.ts` rows; the simulation core (#152) adds `ALGAE_TAG`, `FOOD_TAG_POINTS` and
`DETRITUS_SCATTER_RADIUS_FACTOR` (§1's numbers that had no constant), so the pin was 96 names; the wild cells
that live their own lives (#517, #544) replace `WILD_CELL_MASS_SPREAD`, `WORLD_ORGANISM_ID` and
`WILD_CELL_HUNT_RANGE_RADII` with the seven new `wild-cells.ts` rows above and rename
`WILD_CELL_HUNTS_FROM_STAGE`, so the pin was 100 names; the die-off (#555) adds two, so it is 102. The three
`derived` rows are computed from the phase seconds whenever they are read and are not balance leaves (their named
defaults live in `absorption-derived.ts`): patch a phase second, not them (#367, architecture/constants-files-tests.md
§9).

| Constant                                                                                         | Value            | Unit                                                                                 |
| ------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------ |
| `ENGULF_MASS_RATIO`                                                                              | 1.25             | ×                                                                                    |
| `ENGULF_RELEASE_RATIO`                                                                           | 1.10             | ×                                                                                    |
| `ENGULF_PROGRESS_EPSILON`                                                                        | 1e-6             | progress                                                                             |
| `ENGULF_COVERAGE_FRACTION`                                                                       | 0.5              | prey radii                                                                           |
| `ENGULF_COVER_SECONDS`                                                                           | 0.2              | s                                                                                    |
| `ENGULF_WRAP_SECONDS`                                                                            | 0.4              | s                                                                                    |
| `ENGULF_ABSORB_SECONDS`                                                                          | 0.6              | s                                                                                    |
| `ENGULF_BASE_DURATION_SECONDS`                                                                   | 1.2              | s (derived: the three phase seconds summed; sheet 03's 1.2 s)                        |
| `ENGULF_WRAP_START_PROGRESS` / `ENGULF_SEAL_PROGRESS`                                            | 1/6 / 0.5        | progress (derived from the phase seconds, never a fourth literal)                    |
| `ENGULF_MIN_DURATION_FACTOR`                                                                     | 0.5              | ×                                                                                    |
| `ENGULF_ESCAPE_DECAY_MULTIPLIER`                                                                 | 2                | × (cover and wrap out of contact; released at 0, #634)                               |
| `ENGULF_STRUGGLE_SLOWDOWN` / `ENGULF_STRUGGLE_SLOWDOWN_CAP`                                      | 0.5 / 0.9        | ratio of the phase rate                                                              |
| `ENGULF_PREDATOR_SPEED_FACTOR` / `ENGULF_PREDATOR_SPEED_FACTOR_SEALED`                           | 1.0 / 1.0        | × (cover and wrap / absorb; holding costs no speed, #634)                            |
| `ENGULF_PREY_SPEED_FACTOR_COVER` / `ENGULF_PREY_SPEED_FACTOR` / `ENGULF_PREY_SPEED_FACTOR_FLOOR` | 0.85 / 0.8 / 0.3 | × (the grab in cover, #634 / wrap / the floor of both; absorb is 0)                  |
| `ENGULF_SWALLOWED_TOXIN_MULTIPLIER`                                                              | 8                | × on the prey's toxin fraction, read against the prey's mass (#154), wrap and absorb |
| `ENGULF_SPIT_OUT_REFRACTORY_SECONDS`                                                             | 1.0              | s (per spat-out prey: the predator keeps one entry per prey)                         |
| `ENGULF_MASS_YIELD`                                                                              | 0.8              | ratio                                                                                |
| `ENGULF_DNA_BASE` / `ENGULF_DNA_SHARE`                                                           | 30 / 0.2         | DNA / ratio                                                                          |
| `ENGULF_TAG_SHARE` / `ENGULF_PREDATORY_TAG_POINTS`                                               | 0.5 / 10         | ratio / points                                                                       |
