# Evolution — Ecology, Growth and Absorption: wild cells and what a fresh protocell sees

§3.3–§3.4 of the split [`ECOLOGY.md`](../ECOLOGY.md), which keeps the shared context and the file list.

### 3.3 Wild cells

The world's average made flesh. `WILD_CELL_COUNT` non-player cells live in the dish from tick 0 to
the end of the round: at 0:00 a fresh protocell drifts among two dozen other protocells; at 9:00 a
nucleated cell of 560 mass shares the broth with two dozen wild eukaryotes near that mass. They are
what "a world similar to itself" means, and they are the average the player must outpace: outgrow
them and they are lunch, fall behind and they are threats.

**A wild cell is the world clock, not a player.** It has no DNA, no tags, no drafts, no leaderboard
row and no score; it neither eats motes (the eating step skips it) nor decays. Every tick at step 1
its mass and ladder are pinned to the world reference:

```
mass             = max(CELL_STARTING_MASS, worldMass × massSpreadFactor − drainedMass)
                                                       massSpreadFactor ~ uniform[1 − WILD_CELL_MASS_SPREAD, 1 + WILD_CELL_MASS_SPREAD], drawn at each (re)spawn from the wildCells stream;
                                                       drainedMass = 0 except while the cell is engulfing ("Bleeding while engulfing" below)
level            = floor(worldLevel)
traits           = the first (level − 1) entries of WILD_CELL_BUILDS[seatNumber mod WILD_CELL_BUILDS.length]; the list wraps as tier upgrades (entry 8 = entry 1 at tier II)
stage            = stageOf(traits)                     (= worldStage at every level: worldStage is defined from build 0's picks (§3.1) and all three builds reach the endosymbiont at pick 2, the envelope at 3, a form's prerequisite at 4 and the form at 5; the modifier fold then runs as for any cell)
dnaCumulative    = worldDna                            (what a predator's ENGULF_DNA_SHARE reads)
organismId       = WORLD_ORGANISM_ID                   (wild never engulfs wild: §6.3 "same organism")
```

Half the wild cells are below the world's mass and half above; with a 30 % spread a player at
exactly `worldMass` can engulf the lightest sixth of them (mass ≤ 0.8 ×) and be engulfed by the
heaviest twelfth (≥ 1.25 ×); at 1.63 × `worldMass` every wild cell is lunch, at 0.56 × every one is a
threat. The timeline PNG (§3.1) draws both shares against the #138 player.

`WILD_CELL_BUILDS` (`constants/wild-cells.ts`): three lists, each a valid ladder (every entry's
`stage` and `requires` are met by the entries before it; the catalog test T10 pattern pins it):

| Build (seat mod 3) | Picks in order                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 0                  | `nucleoid`, `mitochondrion`, `nuclear_envelope`, `cytoskeleton`, `amoeba_pseudopods`, `ribosomes`, `simple_flagellum` |
| 1                  | `nucleoid`, `chloroplast`, `nuclear_envelope`, `cilia`, `paramecium_cilia`, `ribosomes`, `simple_flagellum`           |
| 2                  | `nucleoid`, `mitochondrion`, `nuclear_envelope`, `cell_wall`, `diatom_shell`, `ribosomes`, `food_vacuole`             |

**Behaviour** is the #15 bot strategies composed into one wild strategy
(`packages/server/src/game/wild/wild-strategy.ts`; #15 therefore homes `wander`, `hunt` and `flee`
under `packages/server/src/game/bots/`, where both this file and the gameplay framework's `.bot()`
import them, never under `testing/`). A seat decides every `WILD_CELL_DECISION_INTERVAL_SECONDS`,
staggered by seat (seat _n_ decides on ticks ≡ _n_ mod the interval in ticks), and latches its
target between decisions exactly as a player's input is latched. **A seat has no target (throttle 0)
until its first decision:** a fresh seat, a respawned seat and a seat whose cell a fixture placed
all sit still until their next decision tick (seat 0 on tick 30, 60, …; tick 0 is never stepped), so
the heading drawn at placement is used from that decision on and never earlier. Priority flee, then
hunt, then wander:

| Rule   | When                                                                                                                                                              | Target                                                                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| flee   | any player cell for which `canEngulf(it, self)` holds has its centre within `WILD_CELL_FLEE_RANGE_RADII` × own radius (nearest such cell if several)              | own centre + (own centre − threat centre) unit × `STEER_FULL_THROTTLE_RADII` × own radius                                                                                                             |
| hunt   | `worldStage` ≥ `WILD_CELL_HUNTS_FROM_STAGE` and the nearest player cell for which `canEngulf(self, it)` holds is within `WILD_CELL_HUNT_RANGE_RADII` × own radius | that cell's centre                                                                                                                                                                                    |
| wander | otherwise; with probability `WILD_CELL_TURN_CHANCE` per decision draw a new uniform heading from the `wildCells` stream, else keep it                             | own centre + heading × `STEER_FULL_THROTTLE_RADII` × own radius; a target outside the disc of radius `DISH_RADIUS − SPAWN_EDGE_MARGIN` is redrawn (up to `SPAWN_POINT_MAX_ATTEMPTS`, then the origin) |

Wild cells never sprint. They move through the shared kernel (§5.2, gel included), separate
(§5.3) and engulf (§6) exactly as players do; `canEngulf` reads mass only, so the danger chip and
the warning ring work on them unchanged (the chip names them `WILD <STAGE>`).

**Engulf outcomes.** Wild eats player: the player dies normally
([`game-design/session.md §5.2`](../game-design/session.md#52-spawn-death-and-respawn)); the wild cell's mass is
re-pinned next tick (the meal is not kept). Player eats wild (§6.1 payout with these substitutions):
mass += prey.mass × `ENGULF_MASS_YIELD`; DNA += `ENGULF_DNA_SHARE` × `worldDna` and no
`ENGULF_DNA_BASE` (the bounty is for beating a player: a wild protocell is worth its mass, a wild
eukaryote 48 DNA); tag points += `predatory` × `ENGULF_PREDATORY_TAG_POINTS` and no tag share (wild
cells have none); `wildAbsorptions` += 1, `absorptions` unchanged, so no `SCORE_ABSORPTION_BONUS`;
detritus as usual. A wild cell that owns an endosymbiont credits the eater's
`bacteriaEatenByVariant` counter in full, as a player prey does (§1): from the endosymbiosis era,
eating the world is the third way onto that rung.

**The lunch is faster than the eater (#158).** `maxSpeed` ∝ mass^−0.25 (§5.1), so a wild cell at
0.8 × the world's mass is 1.06 × faster than a player at the world's mass, reacts within one
decision (0.5 s) and starts fleeing at 8 own radii; in open water it is caught by a sprint burst
([`game-design/controls-and-scope.md §6`](../game-design/controls-and-scope.md#6-controls)), in a gel patch, against the wall or by a
wander blunder, never by a straight chase. So the active #148 player has a dozen "lunch" wild
cells in the dish all round and eats few of them: eating the world is a chance, not a diet.
`WILD_CELL_FLEE_RANGE_RADII`, `WILD_CELL_DECISION_INTERVAL_SECONDS` and a flee speed factor below
1 are the knobs; #158 owns them, nothing is changed here.

**Bleeding while engulfing (the escape).** The pin must not make a wild predator immune to the
drains that let a prey out (§6.1 hysteresis, §4.1; Toxin Vacuole and Diatom Shell,
[`traits/catalog-organelles.md §3`](../traits/catalog-organelles.md#3-build-1-catalog-sixteen-traits-fully-specified)). So the seat carries `drainedMass`: while its cell is
`engulfing`, everything step 5 removes from that cell (base decay, toxin, spikes) is added to
`drainedMass`, and the pin subtracts it (formula above), so the wild predator loses mass tick by
tick exactly as a player predator would and `canContinueEngulf` fails on the same tick it would
for a player of that mass: a `ratio` release before payout (W10 mirrors the Toxin Vacuole escape
row of traits/constants-and-acceptance.md §6, #145). `drainedMass` resets to 0 at payout, at release and at respawn. A `free`
wild cell is re-pinned in full: brushing a toxin against the world never whittles a heavier wild
cell down to lunch, because the world is an average, not a resource.

**Placement and respawn.** At world creation the `WILD_CELL_COUNT` seats are placed after the
players and before the initial fill (so E1's "no mote inside any cell" covers them), each from the
`spawnPlacement` stream with the safe-spawn rule of game-design/session.md §5.2 plus "no cell centre within
`WILD_CELL_MIN_SPACING_WU`" (`SAFE_SPAWN_MAX_ATTEMPTS`, then the farthest candidate). A seat whose
cell is absorbed or removed respawns after `WILD_CELL_RESPAWN_SECONDS` by the same placement with a
fresh spread factor; the seat count never changes. `results` freezes wild cells with everything
else; a rematch recreates them at protocell scale.

**Randomness.** The `wildCells` stream (label `wild_cells`) owns spread factors, wander headings and
turn rolls, forked from the round seed like every other stream so a wild turn never shifts a mote;
its state is hashed ([`determinism/random-streams.md §3`](../determinism/random-streams.md#3-seeded-random-streams-packagessharedsrcrandom-73), [`determinism/ordering-and-state-hash.md §5`](../determinism/ordering-and-state-hash.md#5-state-hash-packagessharedsrcsimulationstate-hashts-packagesserversrcgameworldstate-hashts)).

**Contract (what #97 adds; the architect folds it into `architecture/entity-model.md` §2, `architecture/server-simulation.md` §3 and `architecture/constants-files-tests.md` §10).**
`WorldState.roundStartTick` (0 at creation, the current tick at a rematch; `elapsedTicks` of §3.1 is
`tick − roundStartTick`, and the snapshot carries `roundStartTick` so the HUD derives the same number
from the snapshot's `tick`); `WorldState.wildSeats: WildSeatRecord[]` (`seatNumber`, `cellId | null`,
`massSpreadFactor`, `respawnInTicks`, `headingX`, `headingY`, `decideInTicks`, `drainedMass`); wild cells are ordinary `CellRecord`s in
`world.cells` with `playerId: null` and `organismId: WORLD_ORGANISM_ID`; `CellView.kind:
'player' | 'wild'` (`CELL_KIND`); `GameEffect` gains `world_level_up { level, stage }` (no position: it
happens everywhere); `PlayerProgressView` gains `wildAbsorptions` and its `spectatingPlayerId` becomes
`spectatingCellId` (a wild killer has no player, [`game-design/session.md §5.2`](../game-design/session.md#52-spawn-death-and-respawn));
`RANDOM_STREAM` gains `wildCells`; `DEFAULT_BALANCE` gains the `worldClock` and `wildCells` domains
([`architecture/constants-files-tests.md §9`](../architecture/constants-files-tests.md#9-constants-and-balance-decision-one-home)). The world
reference is computed on both sides, never sent: `worldElapsedSeconds(tick, roundStartTick,
roundDurationSeconds)` and `worldReference` (`simulation/world-clock.ts`), with `stageOf`
(`simulation/stage-of.ts`) and `cumulativeDnaForLevel` (`simulation/level-costs.ts`) beside them; the
broth variant row of §3.2 is `bacteriumVariantWeightsForZone(zone, worldStage, balance.ecology)`
(`simulation/bacterium-variant-weights.ts`, the `BACTERIUM_VARIANT_WEIGHTS_BY_ZONE` table keeps only the
two fixed trip rows). Step
order: step 1 also runs the wild strategy and the pin; step 4 skips wild cells; step 9 also runs
wild respawn. The renderer (#99) needs one wild palette (a desaturated, palette-independent rim so a
wild cell never reads as a player; `visual-style/principles-and-palette.md §2` owns the value) and draws their organelles
from `traits` like anyone's. Cost: 24 cells and one decision per 30 ticks each.

### 3.4 What a fresh protocell sees

At 0:00, one player, #141's option A render (seed 96) still describes the motes: 9 algae, 0 bacteria
and 1 fragment in the spawn camera (1067 × 600 wu). What changed is the company: 24 wild protocells
of mass 14–26 (radius 15–20 wu) spread over the placement disc (radius `DISH_RADIUS −
SPAWN_EDGE_MARGIN` = 2700 wu), 0.67 of them in the spawn camera on average and the nearest about
490 wu away (under half a spawn-camera width), so a peer is in sight within seconds
of drifting. Four of the 24 (spread ≤ 0.8) are lunch for a 20-mass player, two (spread ≥ 1.25) are
threats, and all of them wander and flee: the first minute is grazing among peers, the first
threat hint ([`ui/input-and-onboarding.md §5`](../ui/input-and-onboarding.md#5-onboarding-the-first-two-minutes)) fires early and honestly.
If the first minute still reads as dark water in the #98 playtest, `FOOD_CAP_BASE` is the one knob
(#141 option B's 2 × cap looked right at spawn zoom); it is not changed here.
