# Evolution — Ecology, Growth and Absorption: wild cells and what a fresh protocell sees

§3.3–§3.4 of the split [`ECOLOGY.md`](../ECOLOGY.md), which keeps the shared context and the file list.

### 3.3 Wild cells

The dish is shared with two dozen wild cells that live their own lives. Each is born at its own size,
anywhere from half to twice the size of the world's average cell at that moment, so some are lunch and
some are threats from the first second. They graze algae and scraps, hunt smaller cells (each other
included) and run from bigger ones. What happens to them sticks: a wild cell that eats grows, and
digests back to its natural size over a minute or two; a wild cell shrunk by a toxin stays shrunk and
recovers over 10 to 20 seconds. As the round goes on the world's average cell grows and learns new
traits, and every wild cell's natural size and traits move with it, so the wild keeps pace with the
players without anyone having to feed it. They are what "a world similar to itself" means (decision
#141), and they are the average the player must outpace: outgrow them and they are lunch, fall behind
and they are threats (ticket #517 records the human's direction).

A wild cell has no player: no DNA, no tags, no drafts, no leaderboard row and no score. It moves,
eats, is drained, engulfs and is engulfed by the same rules as a player cell. Three things differ: its
mass settles toward a natural size instead of decaying (§3.3.1), its ladder is the world's (§3.3.2), and
it leaves bacteria and DNA fragments uneaten (§3.3.3).

#### 3.3.1 Natural size and the settle (replaces the per-tick pin, #517)

Every wild cell has a **natural size**: the world's average mass times the cell's own size factor,
drawn once when it is born. Nothing snaps a wild cell to its natural size; instead, every tick its mass
drifts toward it. A cell lighter than its natural size (bitten by a toxin, bled while holding a spiky
prey) **recovers** quickly: it gets back 81 % of the loss in 10 s and 95 % in 18 s. A cell heavier than
its natural size (it just ate) **digests** slowly: the surplus halves about every 42 s and is gone
after three minutes. Because the natural size grows with the world, a wild cell sitting at its natural
size grows exactly as fast as the world's average does.

```
sizeFactor        = WILD_CELL_SIZE_FACTOR_MIN × (WILD_CELL_SIZE_FACTOR_MAX / WILD_CELL_SIZE_FACTOR_MIN) ^ u
                                                       u ~ uniform[0, 1) from the wildCells stream, drawn at each (re)spawn
                                                       (log-uniform: 0.5 × 4^u; half the cells are born below the world's
                                                       average and half above, and a 2× cell is as common as a 0.5× one)
naturalMass(t)    = worldMass(t) × sizeFactor
```

The **settle** runs at step 1 for every seated wild cell, in place of the old pin. It reads what the
cell's mass did since the last settle, relaxes that difference, and lays it on the new natural size:

```
offset          = cell.mass − seat.naturalMass           (seat.naturalMass = last tick's natural size; everything steps
                                                         4–6 did to the cell since then, meals and drains alike, is in it)
relaxFactor     = 1 − TICK_INTERVAL_S / WILD_CELL_RECOVERY_SECONDS    when offset < 0  (a loss: 1 − 1/360)
                  1 − TICK_INTERVAL_S / WILD_CELL_DIGESTION_SECONDS   when offset > 0  (a meal: 1 − 1/3600)
                  (offset 0 stays 0)
seat.naturalMass = worldMass(t) × seat.sizeFactor       (t = this tick's elapsed seconds, §3.1)
cell.mass       = clamp(seat.naturalMass + offset × relaxFactor,
                        min(CELL_STARTING_MASS, seat.naturalMass),
                        min(seat.naturalMass × WILD_CELL_MAX_GROWTH_MULTIPLE, CELL_MAX_MASS))
```

- **Recovery (question 3 of #517).** A loss decays as `offset × (1 − 1/360)` per tick, an exponential
  approach with a 6 s time constant: after 10 s 18.8 % of the loss is still missing, after 15 s 8.2 %,
  after 18 s 5.0 %, after 20 s 3.6 %. It recovers toward the natural size of the moment, which keeps
  growing with the world meanwhile. Recovery runs every tick, engulfing or not; a drain larger than
  the recovery (a swallowed toxin dose of 150 mass/s against a recovery of 13 mass/s at a 78-mass
  deficit) still wins, so the Toxin Vacuole escape works on a wild predator exactly as on a player
  (§3.3.4, W10).
- **Growth from eating (question 2).** A meal is kept: it becomes surplus that digests with a 60 s time
  constant (half-life 41.6 s; 37 % left after 60 s, 5 % after 180 s). A wild cell that swallowed a
  player is visibly bigger for a minute or two and then back to its natural size.
- **The ceiling.** A wild cell never exceeds `WILD_CELL_MAX_GROWTH_MULTIPLE` (1.5) × its natural size;
  anything above is lost when the settle runs (a wild cell has no DNA to overflow into). The floor is
  the player's floor, `CELL_STARTING_MASS`, or the natural size when that is lower (a 0.5 cell at 0:00
  is born at 10).
- **Base decay is replaced, drains are not.** Step 5 skips a wild cell's base decay (the settle's
  digestion is its metabolism, and the player's pull toward 20 would fight the world's growth), and
  applies every drain as it does to a player: toxin contact and aura, the swallowed dose and spikes, on
  a free wild cell as on an engulfing one, and photosynthesis as a gain. Step 5's floor for a wild cell
  is `min(CELL_STARTING_MASS, its mass at the start of the step)`, so a drain never lifts a small wild
  cell to 20.
- **Placement and respawn set** `seat.naturalMass` to the new cell's natural size and the cell's mass to
  it (offset 0).

**What stops one wild cell from snowballing (question 2).** Four things, each simple:

1. **The ceiling:** 1.5 × its natural size, so no wild cell is ever heavier than 3 × the world's
   average (a size-2.0 cell at its ceiling).
2. **Digestion:** a surplus halves every 42 s; wild cells do not accumulate meals over a round.
3. **Satiety:** a wild cell at or above `WILD_CELL_SATED_MULTIPLE` (1.2) × its natural size neither
   hunts nor grazes (it only wanders and flees) until it has digested below it. One meal of a cell
   0.8 × its mass (the largest it can start on: `ENGULF_MASS_RATIO` 1.25) takes it to the ceiling, and
   digesting from 1.5 to 1.2 takes 55 s: one big meal, then a minute of rest.
4. **The prey is faster:** `maxSpeed` ∝ mass^−0.25 (§5.1), so a hunting wild cell catches a smaller
   one only in a gel patch, at the wall or by a blunder, exactly as a player does.

#### 3.3.2 Levels and traits (question 5)

A wild cell's ladder is the world's, never its own: eating makes it heavier, never cleverer. Every
tick the settle also sets:

```
level            = floor(worldLevel)
traits           = the first (level − 1) entries of WILD_CELL_BUILDS[seatNumber mod WILD_CELL_BUILDS.length]; the list wraps as tier upgrades (entry 8 = entry 1 at tier II)
stage            = stageOf(traits)                     (= worldStage at every level: worldStage is defined from build 0's picks (§3.1) and all three builds reach the endosymbiont at pick 2, the envelope at 3, a form's prerequisite at 4 and the form at 5; the modifier fold then runs as for any cell)
dnaCumulative    = worldDna                            (what a predator's ENGULF_DNA_SHARE reads)
organismId       = the cell's own id                   (as for a player cell: two wild cells are different organisms, so wild eats wild, §6.3)
```

A grown wild cell is simply a heavy cell of the world's level: it does not level up, gains no trait
and pays a player that eats it the world's DNA share, not more. Eating a cell that owns an
endosymbiont gives a wild cell nothing (it has no counters).

`WILD_CELL_BUILDS` (`constants/wild-cells.ts`): three lists, each a valid ladder (every entry's
`stage` and `requires` are met by the entries before it; the catalog test T10 pattern pins it):

| Build (seat mod 3) | Picks in order                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 0                  | `nucleoid`, `mitochondrion`, `nuclear_envelope`, `cytoskeleton`, `amoeba_pseudopods`, `ribosomes`, `simple_flagellum` |
| 1                  | `nucleoid`, `chloroplast`, `nuclear_envelope`, `cilia`, `paramecium_cilia`, `ribosomes`, `simple_flagellum`           |
| 2                  | `nucleoid`, `mitochondrion`, `nuclear_envelope`, `cell_wall`, `diatom_shell`, `ribosomes`, `food_vacuole`             |

#### 3.3.3 What a wild cell does (question 4)

A wild cell looks around twice a second. If something that could swallow it is close, it runs. If it
is hungry and something it could swallow is close, it chases it: another wild cell at any time, a
player only once the world has reached the endosymbiosis era (6:00), so a new player's first minutes
are grazing, not being hunted. Otherwise it swims to the nearest algae or scrap and eats it, and if
there is none in reach it wanders. It eats what it touches the way a player does, except that it
leaves bacteria and DNA fragments alone: those are the players' DNA and the endosymbiosis trip.

The behaviour is the #15 bot strategies composed into one wild strategy
(`packages/server/src/game/wild/wild-strategy.ts`; #15 homes `wander`, `hunt` and `flee` under
`packages/server/src/game/bots/`, where both this file and the gameplay framework's `.bot()` import
them). A seat decides every `WILD_CELL_DECISION_INTERVAL_SECONDS`, staggered by seat (seat _n_ decides
on ticks ≡ _n_ mod the interval in ticks; `decideInTicks`, set at placement to the ticks until that
tick, counts down and restarts at the interval), and latches its target between decisions exactly as a
player's input is latched. **A seat has no target (throttle 0) until its first decision:** a fresh
seat, a respawned seat and a seat whose cell a fixture placed all sit still until their next decision
tick. The first rule that applies wins:

| Rule   | When                                                                                                                                                                                                                                                                                       | Target                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| flee   | any cell, player or wild, for which `canEngulf(it, self)` holds has its centre within `WILD_CELL_FLEE_RANGE_RADII` × own radius (nearest such cell if several)                                                                                                                             | own centre + (own centre − threat centre) unit × `STEER_FULL_THROTTLE_RADII` × own radius                                                                                                             |
| hunt   | not sated (mass < `WILD_CELL_SATED_MULTIPLE` × natural size), and the nearest cell for which `canEngulf(self, it)` holds is within `WILD_CELL_HUNT_RANGE_RADII` × own radius; a wild cell counts from tick 0, a player cell only while `worldStage` ≥ `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE` | that cell's centre                                                                                                                                                                                    |
| graze  | not sated, and the nearest algae or detritus mote has its centre within `WILD_CELL_GRAZE_RANGE_RADII` × own radius                                                                                                                                                                         | that mote's centre                                                                                                                                                                                    |
| wander | otherwise; with probability `WILD_CELL_TURN_CHANCE` per decision draw a new uniform heading from the `wildCells` stream, else keep it                                                                                                                                                      | own centre + heading × `STEER_FULL_THROTTLE_RADII` × own radius; a target outside the disc of radius `DISH_RADIUS − SPAWN_EDGE_MARGIN` is redrawn (up to `SPAWN_POINT_MAX_ATTEMPTS`, then the origin) |

Flee and hunt are the catalogue's `flee` and a range-bound, nearest-first `hunter`, each a fresh
instance per decision (a wild cell keeps no commitment between decisions); graze is the same
nearest-first query over motes (algae and detritus only); the wander rule is the seat's own. Ties on
distance go to the lower entity id (stable ordering). Wild cells never sprint (only the command's
target is taken). They move through the shared kernel (§5.2, gel included), separate (§5.3) and
engulf (§6) exactly as players do; `canEngulf` reads mass only, so the danger chip and the warning
ring work on them unchanged (the chip names them `WILD <STAGE>`).

**Eating.** Step 4 no longer skips wild cells: a wild cell eats every algae and detritus mote whose
centre lies within its radius, by the eating rule of §1, and passes over bacteria and DNA fragments
(they stay where they are for a player). A mote's mass joins the cell's mass and so the settle's
surplus. The gain goes through the ceiling at the next settle, never through the overflow-to-DNA rule.

**The lunch is faster than the eater (#158).** A wild cell at 0.8 × the world's mass is 1.06 × faster
than a player at the world's mass, reacts within one decision (0.5 s) and starts fleeing at 8 own
radii; in open water it is caught by a sprint burst
([`game-design/controls-and-scope.md §6`](../game-design/controls-and-scope.md#6-controls)), in a gel
patch, against the wall or by a wander blunder, never by a straight chase. The same holds between wild
cells, which never sprint: wild-on-wild kills happen in gel, at the wall and when a grazer blunders into
a bigger cell, so the population churns slowly rather than eating itself in the first minute.
`WILD_CELL_FLEE_RANGE_RADII`, `WILD_CELL_DECISION_INTERVAL_SECONDS` and a flee speed factor below 1 are
the knobs; #158 owns them.

#### 3.3.4 Engulf outcomes

When a wild cell is eaten it leaves scraps like any cell and a new one is born elsewhere ten seconds
later; when it eats, it keeps the meal.

- **Wild eats player:** the player dies normally
  ([`game-design/session.md §5.2`](../game-design/session.md#52-spawn-death-and-respawn)); the wild cell
  gains `prey.mass × ENGULF_MASS_YIELD` like any predator, which the settle then digests (§3.3.1).
- **Wild eats wild:** the same payout (mass only: no DNA, no tags, no score to anyone); the prey's seat
  respawns after `WILD_CELL_RESPAWN_SECONDS`; detritus drops as usual (food for everyone).
- **Player eats wild** (§6.1 payout with these substitutions): mass += prey.mass × `ENGULF_MASS_YIELD`;
  DNA += `ENGULF_DNA_SHARE` × `worldDna` and no `ENGULF_DNA_BASE` (the bounty is for beating a player: a
  wild protocell is worth its mass, a wild eukaryote 48 DNA); tag points += `predatory` ×
  `ENGULF_PREDATORY_TAG_POINTS` and no tag share (wild cells have none); `wildAbsorptions` += 1,
  `absorptions` unchanged, so no `SCORE_ABSORPTION_BONUS`; detritus as usual. A wild cell that owns an
  endosymbiont credits the eater's `bacteriaEatenByVariant` counter in full, as a player prey does (§1):
  from the endosymbiosis era, eating the world is the third way onto that rung.
- **The escape** (#514). A wild predator bleeds through step 5 exactly as a player predator does, so
  `canContinueEngulf` fails on the same tick it would for a player of that mass: a `ratio` release
  before payout (W10 mirrors the Toxin Vacuole escape row of traits/constants-and-acceptance.md §6,
  #145). The release leaves it shrunk: it recovers toward its natural size with the 6 s time constant,
  so a 1.3 × wild predator that let go of a Toxin Vacuole II cell at ≈ 1.1 × needs about 8 s to be heavy
  enough (1.25 ×) to start on it again. The toxin cell gets those seconds to swim away; the old pin
  gave it one tick.

#### 3.3.5 Placement, respawn and keeping pace (question 1)

A new wild cell is always born at its natural size for the world of that moment: a cell born at 9:00
is a eukaryote of 280 to 1 120 mass, never a protocell that has to catch up. From then on it lives
freely, and its natural size keeps growing with the world.

At world creation the `WILD_CELL_COUNT` seats are placed after the players and before the initial fill
(so E1's "no mote inside any cell" covers them), each from the `spawnPlacement` stream with the
safe-spawn rule of game-design/session.md §5.2 plus "no cell centre within `WILD_CELL_MIN_SPACING_WU`"
(`SAFE_SPAWN_MAX_ATTEMPTS`, then the farthest candidate). A seat whose cell is absorbed or removed
respawns after `WILD_CELL_RESPAWN_SECONDS` by the same placement with a fresh size factor, at mass
`naturalMass` (offset 0); the seat count never changes. `results` freezes wild cells with everything
else; a rematch recreates them at protocell scale.

With the size factor log-uniform on [0.5, 2.0], a third of the wild cells (0.339) are lunch for a
player at exactly the world's mass (natural size ≤ 0.8 ×) and a third are threats (≥ 1.25 ×); at 2.5 ×
`worldMass` every wild cell at its natural size is lunch, at 0.4 × every one is a threat. Meals and
wounds move individual cells off those lines for a minute at a time.

**Randomness.** The `wildCells` stream (label `wild_cells`) owns size factors, wander headings and turn
rolls, forked from the round seed like every other stream so a wild turn never shifts a mote; its
state is hashed ([`determinism/random-streams.md §3`](../determinism/random-streams.md#3-seeded-random-streams-packagessharedsrcrandom-73), [`determinism/ordering-and-state-hash.md §5`](../determinism/ordering-and-state-hash.md#5-state-hash-packagessharedsrcsimulationstate-hashts-packagesserversrcgameworldstate-hashts)).
The settle is arithmetic on hashed state (`sizeFactor`, `naturalMass`, the cell's mass), so it needs no
stream of its own.

#### 3.3.6 Constants (`packages/shared/src/constants/wild-cells.ts`, balance domain `wildCells`)

| Constant                              | Value                     | Unit                        | Change (#517)                                                         |
| ------------------------------------- | ------------------------- | --------------------------- | --------------------------------------------------------------------- |
| `WILD_CELL_COUNT`                     | 24                        | seats                       | unchanged                                                             |
| `WILD_CELL_SIZE_FACTOR_MIN`           | 0.5                       | × `worldMass`               | new (replaces `WILD_CELL_MASS_SPREAD` 0.3)                            |
| `WILD_CELL_SIZE_FACTOR_MAX`           | 2.0                       | × `worldMass`               | new                                                                   |
| `WILD_CELL_RECOVERY_SECONDS`          | 6                         | s (time constant of a loss) | new                                                                   |
| `WILD_CELL_DIGESTION_SECONDS`         | 60                        | s (time constant of a meal) | new                                                                   |
| `WILD_CELL_MAX_GROWTH_MULTIPLE`       | 1.5                       | × natural size              | new                                                                   |
| `WILD_CELL_SATED_MULTIPLE`            | 1.2                       | × natural size              | new                                                                   |
| `WILD_CELL_GRAZE_RANGE_RADII`         | 6                         | own radii                   | new                                                                   |
| `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE`  | `endosymbiosis`           | stage                       | renamed from `WILD_CELL_HUNTS_FROM_STAGE`; now gates player prey only |
| `WILD_CELL_BUILDS`                    | the three lists of §3.3.2 | trait ids                   | unchanged                                                             |
| `WORLD_ORGANISM_ID`                   | —                         | —                           | removed: a wild cell's `organismId` is its own id                     |
| `WILD_CELL_RESPAWN_SECONDS`           | 10                        | s                           | unchanged                                                             |
| `WILD_CELL_MIN_SPACING_WU`            | 200                       | wu                          | unchanged                                                             |
| `WILD_CELL_DECISION_INTERVAL_SECONDS` | 0.5                       | s                           | unchanged                                                             |
| `WILD_CELL_FLEE_RANGE_RADII`          | 8                         | own radii                   | unchanged; now also flees wild predators                              |
| `WILD_CELL_HUNT_RANGE_RADII`          | 10                        | own radii                   | unchanged; now also hunts wild prey                                   |
| `WILD_CELL_TURN_CHANCE`               | 0.25                      | per wander decision         | unchanged                                                             |

The graze range is the food-competition knob: 24 wild cells that graze algae compete with the player
for mass (not for DNA: bacteria and fragments are left alone). If the #98 playtest or the P rows show
the player's mass pace falling behind the §3.1 calibration, `WILD_CELL_GRAZE_RANGE_RADII` 0 turns active
grazing off (touch-eating stays); `FOOD_CAP_BASE` is the other knob.

**Contract (what the build ticket changes; the architect folds it into `architecture/entity-model.md`
§2, `architecture/server-simulation.md` §3 and `architecture/constants-files-tests.md` §10).**
`WildSeatRecord` becomes (`seatNumber`, `cellId | null`, `sizeFactor`, `naturalMass`, `respawnInTicks`,
`headingX`, `headingY`, `decideInTicks`): `massSpreadFactor` is renamed `sizeFactor`, `drainedMass` is
replaced by `naturalMass`. Wild cells stay ordinary `CellRecord`s in `world.cells` with `playerId: null`,
now with `organismId` = their own id. `wild/wild-pin.ts` becomes `wild/wild-settle.ts` with the pure
`settleWildMass({ mass, naturalMass, nextNaturalMass }, balance)` (W11) and `wildSizeFactor(u, balance)`.
Step order: step 1 runs the wild strategy and the settle; step 4 eats for wild cells (algae and detritus
only); step 5 skips base decay for wild cells and applies every drain, with the floor above; step 9 runs
wild respawn. Unchanged from #97: `WorldState.roundStartTick`, `CellView.kind: 'player' | 'wild'`
(`CELL_KIND`), the `world_level_up` effect, `PlayerProgressView.wildAbsorptions` and
`spectatingCellId`, `RANDOM_STREAM.wildCells`, the `worldClock` and `wildCells` balance domains, and the
world reference computed on both sides and never sent (`worldReference`, `stageOf`,
`cumulativeDnaForLevel` in `simulation/`). The renderer (#99) keeps its wild palette and draws their
organelles from `traits` like anyone's. Cost: 24 cells, one decision per 30 ticks each (now three
nearest-first queries: threats, prey, motes) and one settle per tick each.

### 3.4 What a fresh protocell sees

At 0:00, one player, #141's option A render (seed 96) still describes the motes: 9 algae, 0 bacteria
and 1 fragment in the spawn camera (1067 × 600 wu). What changed is the company: 24 wild protocells
of mass 10–40 (radius 12.6–25.3 wu) spread over the placement disc (radius `DISH_RADIUS −
SPAWN_EDGE_MARGIN` = 2700 wu), 0.67 of them in the spawn camera on average and the nearest about
490 wu away (under half a spawn-camera width), so a peer is in sight within seconds
of drifting. About eight of the 24 (size ≤ 0.8) are lunch for a 20-mass player and about eight (size ≥ 1.25)
are threats; none hunts a player before 6:00 (§3.3.3), but they graze, chase each other and swallow a
player they bump into, so the first minute is grazing among peers of visibly different sizes, and the first
threat hint ([`ui/input-and-onboarding.md §5`](../ui/input-and-onboarding.md#5-onboarding-the-first-two-minutes)) fires early and honestly.
If the first minute still reads as dark water in the #98 playtest, `FOOD_CAP_BASE` is the one knob
(#141 option B's 2 × cap looked right at spawn zoom); it is not changed here.
