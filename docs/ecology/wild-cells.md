# Evolution — Ecology, Growth and Absorption: wild cells and what a fresh protocell sees

§3.3–§3.4 of the split [`ECOLOGY.md`](../ECOLOGY.md), which keeps the shared context and the file list.

### 3.3 Wild cells

The dish is shared with two dozen wild cells that live their own lives. Each is born at its own size,
anywhere from half to twice the size of the world's average cell at that moment, so some are lunch and
some are threats from the first second. They only notice what is near them, about as far as a player
of their size sees on screen. Within that, they graze algae and scraps, hunt smaller cells (each other
included), run from bigger ones, and sprint to escape or to close the last gap, with the same sprint
and cooldown a player has. What happens to them sticks. A wild cell that eats keeps the meal and slowly
burns it off, just as a player does. A wild cell shrunk by a toxin stays shrunk and recovers over 10
to 18 seconds. As the round goes on, the world's average cell grows and learns new traits, and every
wild cell's base size and traits move with it, so the wild keeps pace with the players without having
to be fed. They are what "a world similar to itself" means (decision #141), and they are the average
the player must outpace: outgrow them and they are lunch, fall behind and they are threats (the human's
direction: tickets #517 and #544).

A wild cell has no player: no DNA, no tags, no drafts, no leaderboard row and no score. It moves,
sprints, eats, decays, is drained, engulfs and is engulfed by the same rules as a player cell. Four
things differ: part of its mass is the world's and never decays (§3.3.1), its ladder is the world's
(§3.3.2), it sees only as far as its sight range (§3.3.3), and it leaves bacteria and DNA fragments
uneaten (§3.3.3).

#### 3.3.1 Base size, growth and recovery (replaces the per-tick pin; #517, #544)

A wild cell's size has two parts. The **base size** is the world's average mass times the cell's own
size factor, drawn once when it is born; it grows with the world and never decays. The **growth** is
everything the cell has eaten on top of that. It is permanent and burns off only through the player's
own mass decay, which is faster the bigger the cell is. Together they make the cell's **full size**.
A cell lighter than its full size (bitten by a toxin, drained by a spiky prey, or after paying for a
sprint) **recovers** toward it: it gets back 81 % of the loss in 10 s and 95 % in 18 s. When a
wounded cell eats, the meal heals the wound first and only the rest becomes growth.

```
sizeFactor        = WILD_CELL_SIZE_FACTOR_MIN × (WILD_CELL_SIZE_FACTOR_MAX / WILD_CELL_SIZE_FACTOR_MIN) ^ u
                                                       u ~ uniform[0, 1) from the wildCells stream, drawn at each (re)spawn
                                                       (log-uniform: 0.5 × 4^u; half the cells are born below the world's
                                                       average and half above, and a 2× cell is as common as a 0.5× one)
baseMass(t)       = worldMass(t) × sizeFactor
growthCeiling(t)  = WILD_CELL_MAX_WORLD_MASS_MULTIPLE × worldMass(t)
fullMass          = min(baseMass + grownMass, max(baseMass, growthCeiling))
```

The **settle** runs at step 1 for every seated wild cell, in place of the old pin. It reads what the
cell's mass did since the last settle, turns gains into growth and relaxes losses, and lays the result
on the new full size:

```
offset          = cell.mass − seat.fullMass              (seat.fullMass = last tick's full size; everything steps 3–6 did to the
                                                         cell since then, meals, sprint cost and drains alike, is in it)
if offset > 0:    seat.grownMass += offset; offset = 0   (a net gain is kept whole: permanent growth)
if offset < 0:    offset = offset × (1 − TICK_INTERVAL_S / WILD_CELL_RECOVERY_SECONDS)   (a loss: × (1 − 1/360))
seat.grownMass  = max(0, seat.grownMass − decayPerSecond(cell.mass) × TICK_INTERVAL_S)
                                                         (decayPerSecond is §4's formula for this cell, zone and trait
                                                         multipliers included, read at the mass before the settle)
seat.fullMass   = min(baseMass(t) + seat.grownMass, max(baseMass(t), growthCeiling(t)))
seat.grownMass  = seat.fullMass − baseMass(t)            (growth above the ceiling is lost; never negative)
cell.mass       = max(min(CELL_STARTING_MASS, baseMass(t)), seat.fullMass + offset)
```

- **Recovery (#517 question 3).** A loss decays as `offset × (1 − 1/360)` per tick, an exponential
  approach with a 6 s time constant: after 10 s 18.8 % of the loss is still missing, after 15 s 8.2 %,
  after 18 s 5.0 %, after 20 s 3.6 %. It recovers toward the full size of the moment, which keeps
  growing with the world meanwhile. Recovery runs every tick, engulfing or not. A drain larger than the
  recovery still wins: a swallowed toxin dose of 150 mass/s beats a recovery of 13 mass/s at a 78-mass
  deficit. So the Toxin Vacuole escape works on a wild predator exactly as it does on a player (§3.3.4,
  W10).
- **Growth from eating (#517 question 2, #544: permanent).** A meal is kept. It becomes growth, which
  only the player's decay removes: `(mass − CELL_STARTING_MASS) × MASS_DECAY_RATE_PER_SECOND` per
  second (§4), taken from the growth alone. A wild cell of 1 020 mass loses 2 mass/s of growth, the
  same as a player of that mass. A wild cell with no growth left decays no further, because its base
  size belongs to the world (the world's growth pays its metabolism).
- **Base decay, drains and sprint.** Step 5 does not apply base decay to a wild cell, because the
  settle takes it from the growth. It applies every drain as it does to a player: toxin contact and
  aura, the swallowed dose, and spikes, whether the wild cell is free or engulfing. Photosynthesis
  counts as a gain. A sprint's `SPRINT_MASS_COST_FRACTION` is taken as it is from a player. All of
  these are losses or gains to the settle. Step 5's floor for a wild cell is
  `min(CELL_STARTING_MASS, its mass at the start of the step)`, so a drain never lifts a small wild cell
  to 20.
- **Placement and respawn set** `seat.grownMass` to 0, `seat.fullMass` to the new cell's base size, and
  the cell's mass to that value (offset 0).

**What stops one wild cell from snowballing (#517 question 2).** Four things, and three of them are
the player's own rules:

1. **Decay that grows with size** (the player's rule, §4). The bigger a wild cell grows, the faster
   its growth burns: 1 mass/s at 520, 2 at 1 020, 4 at 2 020.
2. **The prey is faster** (the player's rule, §5.1). `maxSpeed` ∝ mass^−0.25, so a sprinting hunter
   gains on a cruising prey only for the half second of its sprint. The prey sprints back with the same
   cooldown, so most chases in open water end with the prey getting away.
3. **Sight** (§3.3.3). A wild cell hunts only what it can see, roughly one screen, never the whole
   dish.
4. **The growth ceiling, tied to the world:** a wild cell never grows past
   `WILD_CELL_MAX_WORLD_MASS_MULTIPLE` (3) × the world's average mass. Why a ceiling is still needed:
   decay alone lets a lucky cell run away early. A 2× wild protocell (40 mass) that eats three of the
   biggest peers it can start on (32 each) in the first minute reaches 117, nearly three times its base
   size, and decay at 117 removes only 0.2 mass/s. Without the ceiling, a string of such meals leaves an early giant that no player of the
   world's size can ever eat. Why 3: it is the biggest newborn (2×) plus one meal of the biggest cell it
   may start on (2 / 1.25 = 1.6 × the world, times `ENGULF_MASS_YIELD` 0.8 = 1.28), so 3.28, rounded
   down. The ceiling
   rises with the world's clock, so a giant stays a giant only if the world grows into it, and no wild cell can
   ever eat a player at 2.4 × the world's mass (3 / 1.25), and a player at 3.75 × can eat every wild
   cell in the dish. A fixture-born cell whose base size is already above the
   ceiling (W rows at size 5.0 before #544) keeps its base size and cannot grow.

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

A grown wild cell is simply a heavy cell of the world's level. It does not level up and gains no trait.
A player that eats it gets the world's DNA share, no more. Eating a cell that owns an endosymbiont
gives a wild cell nothing, because it has no counters.

`WILD_CELL_BUILDS` (`constants/wild-cells.ts`): three lists, each a valid ladder (every entry's
`stage` and `requires` are met by the entries before it; the catalog test T10 pattern pins it):

| Build (seat mod 3) | Picks in order                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 0                  | `nucleoid`, `mitochondrion`, `nuclear_envelope`, `cytoskeleton`, `amoeba_pseudopods`, `ribosomes`, `simple_flagellum` |
| 1                  | `nucleoid`, `chloroplast`, `nuclear_envelope`, `cilia`, `paramecium_cilia`, `ribosomes`, `simple_flagellum`           |
| 2                  | `nucleoid`, `mitochondrion`, `nuclear_envelope`, `cell_wall`, `diatom_shell`, `ribosomes`, `food_vacuole`             |

#### 3.3.3 What a wild cell does (question 4)

A wild cell looks around twice a second, and it notices only what is within its sight: about as far
as a player of its size sees from the middle of the screen to the top edge. That is 300 world units for
a newborn protocell and about 800 for a 1 000-mass cell. If something that could swallow it is close,
it runs, and if the threat is very close it sprints. If something it could swallow is in sight, it
chases it and sprints for the last stretch. It will chase another wild cell at any time, but a player
only once the world has reached the endosymbiosis era (6:00), so a new player's first minutes are spent
grazing, not being hunted. Otherwise it swims to the nearest algae or scrap in sight and eats it; with
nothing in sight, it wanders. It eats what it touches the way a player does, except that it leaves
bacteria and DNA fragments alone, because those are the players' DNA and the endosymbiosis trip.

**Sight.** `sightRange(radius) = WILD_CELL_SIGHT_VIEW_MULTIPLE × viewHalfHeightFor(radius)`
(`packages/shared/src/camera/camera-follow.ts`, decision #324's zoom: `clamp(300 × (radius /
spawnRadius)^0.5, 300, 1500)` wu):

| Mass | Radius (wu) | Sight (wu) |
| ---- | ----------- | ---------- |
| 20   | 17.9        | 300.0      |
| 40   | 25.3        | 356.8      |
| 200  | 56.6        | 533.5      |
| 380  | 78.0        | 626.3      |
| 1000 | 126.5       | 797.7      |
| 2000 | 178.9       | 948.7      |
| 5000 | 282.8       | 1192.9     |

Why this number: it is fair and readable. A wild cell never reacts to anything a player of its size
could not see on their own screen, and because the screen is wider than it is tall (16:9), a player
of the same size sees at least as far as the wild cell, and further to the sides. It grows with the cell the same way the
player's view does, so a giant notices more of the dish than a protocell but never the whole of it (the dish radius is 3 000). One multiple (1.0) is the knob; nothing else is new.

The behaviour is the #15 bot strategies composed into one wild strategy
(`packages/server/src/game/wild/wild-strategy.ts`; #15 homes `wander`, `hunt`, `flee` and `grazer`
under `packages/server/src/game/bots/`, where both this file and the gameplay framework's `.bot()`
import them). The perception a wild seat hands them is filtered to entities whose centre lies within
its sight range. A seat decides every `WILD_CELL_DECISION_INTERVAL_SECONDS`, staggered by seat: seat
_n_ decides on ticks ≡ _n_ mod the interval in ticks, and `decideInTicks`, set at placement to the
ticks until that tick, counts down and restarts at the interval. Between decisions the seat latches
its target exactly as a player's input is latched. **A seat has no target (throttle 0) until its first
decision:** a fresh seat, a respawned seat and a seat whose cell a fixture placed all sit still until
their next decision tick. The first rule that applies wins:

| Rule   | When (only entities within sight are seen)                                                                                                                                                                   | Target                                                                                                                                                                                                | Sprint (if `sprintCooldownTicks` is 0, and never while engulfing or carried)                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| flee   | a cell, player or wild, for which `canEngulf(it, self)` holds has its centre within `WILD_CELL_FLEE_RANGE_RADII` × own radius (the nearest one if several), or this cell is `being_engulfed` before the seal | own centre + (own centre − threat centre) unit × `STEER_FULL_THROTTLE_RADII` × own radius                                                                                                             | when the threat's centre is within `WILD_CELL_SPRINT_FLEE_RADII` × own radius, or this cell is `being_engulfed` before the seal (the player's engulf-escape tool) |
| hunt   | the nearest cell for which `canEngulf(self, it)` holds; a wild cell counts from tick 0, a player cell only while `worldStage` ≥ `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE`                                         | that cell's centre                                                                                                                                                                                    | when that cell's centre is within `WILD_CELL_SPRINT_HUNT_RADII` × own radius                                                                                      |
| graze  | the catalogue's `grazer` over algae and detritus motes: the nearest one                                                                                                                                      | that mote's centre                                                                                                                                                                                    | never                                                                                                                                                             |
| wander | otherwise; with probability `WILD_CELL_TURN_CHANCE` per decision draw a new uniform heading from the `wildCells` stream, else keep it                                                                        | own centre + heading × `STEER_FULL_THROTTLE_RADII` × own radius; a target outside the disc of radius `DISH_RADIUS − SPAWN_EDGE_MARGIN` is redrawn (up to `SPAWN_POINT_MAX_ATTEMPTS`, then the origin) | never                                                                                                                                                             |

Flee, hunt and graze are the catalogue's `flee`, a nearest-first `hunter` and `grazer`, each a fresh
instance per decision, so a wild cell keeps no commitment between decisions. The wander rule is the
seat's own. Ties on distance go to the lower entity id (stable ordering). A sprint is the player's
sprint in every respect (game-design/controls-and-scope.md §6): × `SPRINT_SPEED_MULTIPLIER` 1.8 for
`SPRINT_DURATION_SECONDS` 0.5, costing `SPRINT_MASS_COST_FRACTION` 5 % of current mass (never below
`min(CELL_STARTING_MASS, current mass)`, step 5's wild floor: a wild cell under 20 sprints for free and is never lifted
to 20), with `SPRINT_COOLDOWN_SECONDS` 3 counted from the sprint's start. The strategy
sets the command's sprint flag, and the cell's own sprint counters apply it exactly as for a player's
input. A decision is the only moment a wild cell can start a sprint, so it reacts to an engulf within
0.5 s, as a player would. It never sprints while it is engulfing (the prey is already in hand) or once it
is sealed and carried (a sprint could not move it), so a sprint is never paid for nothing. Wild cells move through the shared kernel (§5.2, gel included), separate
(§5.3) and engulf (§6) exactly as players do. `canEngulf` reads mass only, so the danger chip and the
warning ring work on them unchanged (the chip names them `WILD <STAGE>`).

**Eating.** Step 4 no longer skips wild cells. A wild cell eats every algae and detritus mote whose
centre lies within its radius, by the eating rule of §1. It passes over bacteria and DNA fragments,
which stay where they are for a player. A mote's mass becomes growth at the next settle (§3.3.1) and
never goes through the overflow-to-DNA rule.

**The lunch is faster than the eater (#158).** A wild cell at 0.8 × the world's mass is 1.06 × faster
than a player at the world's mass. It reacts within one decision (0.5 s), starts fleeing at 8 own radii
and sprints at 4. In open water it is caught only when the hunter's sprint lands while its own is
cooling down, when it is in a gel patch or against the wall, or when it wanders into trouble. A
straight chase never catches it. The same holds between wild cells, so the population churns rather
than eating itself in the first minute. `WILD_CELL_FLEE_RANGE_RADII`,
`WILD_CELL_DECISION_INTERVAL_SECONDS`, the two sprint radii and a flee speed factor below 1 are the
knobs; #158 owns them. Smarter hunting and fleeing, food value, places to avoid, personalities and a
utility scorer are ticket #545's.

#### 3.3.4 Engulf outcomes

When a wild cell is eaten, it leaves scraps like any cell, and a new one is born elsewhere ten seconds
later. When it eats, it keeps the meal.

- **Wild eats player:** the player dies normally
  ([`game-design/session.md §5.2`](../game-design/session.md#52-spawn-death-and-respawn)). The wild cell
  gains `prey.mass × ENGULF_MASS_YIELD`, like any predator, and that becomes growth (§3.3.1).
- **Wild eats wild:** the same payout, mass only: no DNA, no tags and no score to anyone. The prey's
  seat respawns after `WILD_CELL_RESPAWN_SECONDS`, and detritus drops as usual (food for everyone).
- **Player eats wild** (§6.1 payout with these substitutions): mass += prey.mass × `ENGULF_MASS_YIELD`;
  DNA += `ENGULF_DNA_SHARE` × `worldDna` and no `ENGULF_DNA_BASE` (the bounty is for beating a player: a
  wild protocell is worth its mass, a wild eukaryote 48 DNA); tag points += `predatory` ×
  `ENGULF_PREDATORY_TAG_POINTS` and no tag share (wild cells have none); `wildAbsorptions` += 1,
  `absorptions` unchanged, so no `SCORE_ABSORPTION_BONUS`; detritus as usual. A wild cell that owns an
  endosymbiont credits the eater's `bacteriaEatenByVariant` counter in full, as a player prey does (§1):
  from the endosymbiosis era, eating the world is the third way onto that rung. A grown wild cell is a
  bigger meal: its growth is part of its mass.
- **The escape** (#514). A wild predator bleeds through step 5 exactly as a player predator does, so
  `canContinueEngulf` fails on the same tick it would for a player of that mass: a `ratio` release
  before payout (W10 mirrors the Toxin Vacuole escape row of traits/constants-and-acceptance.md §6,
  #145). The release leaves it shrunk, and it recovers with the 6 s time constant. A 1.3 × wild
  predator that let go of a Toxin Vacuole II cell at about 1.1 × needs about 8 s to be heavy enough
  (1.25 ×) to start on it again. The toxin cell gets those seconds to swim away, where the old pin gave
  it one tick. A wild prey sprints on its first decision after an engulf on it starts, as a player
  would.

#### 3.3.5 Placement, respawn and keeping pace (question 1)

A new wild cell is always born at its base size for the world of that moment. A cell born at 9:00 is a
eukaryote of 280 to 1 120 mass, never a protocell that has to catch up. From then on it lives freely:
its base size keeps growing with the world, and whatever it eats is its own.

At world creation, the `WILD_CELL_COUNT` seats are placed after the players and before the initial fill
(so E1's "no mote inside any cell" covers them). Each is placed from the `spawnPlacement` stream with the
safe-spawn rule of game-design/session.md §5.2, plus "no cell centre within `WILD_CELL_MIN_SPACING_WU`"
(`SAFE_SPAWN_MAX_ATTEMPTS`, then the farthest candidate). A seat whose cell is absorbed or removed
respawns after `WILD_CELL_RESPAWN_SECONDS` by the same placement, with a fresh size factor, no growth
and mass `baseMass`; the seat count never changes. `results` freezes wild cells with everything else,
and a rematch recreates them at protocell scale.

With the size factor log-uniform on [0.5, 2.0], a third of newborn wild cells (0.339) are lunch for a
player at exactly the world's mass (base size ≤ 0.8 ×), and a third are threats (≥ 1.25 ×). At 2.5 ×
`worldMass`, every newborn is lunch; at 0.4 ×, every one is a threat. Growth moves individual cells
up from there, never past 3 × `worldMass`, and wounds move them down for a few seconds at a time.

**Randomness.** The `wildCells` stream (label `wild_cells`) owns size factors, wander headings and turn
rolls. It is forked from the round seed like every other stream, so a wild turn never shifts a mote,
and its state is hashed ([`determinism/random-streams.md §3`](../determinism/random-streams.md#3-seeded-random-streams-packagessharedsrcrandom-73), [`determinism/ordering-and-state-hash.md §5`](../determinism/ordering-and-state-hash.md#5-state-hash-packagessharedsrcsimulationstate-hashts-packagesserversrcgameworldstate-hashts)).
The settle, sight, sprint and die-off choices are arithmetic on hashed state (`sizeFactor`,
`grownMass`, `fullMass`, `isStarving`, the cell's mass and sprint counters), so they need no stream of
their own.

#### 3.3.6 Die-off: the dish can only feed so much (#555)

The dish can feed only so much wild life: about half as much again as a freshly seeded dish holds.
While the wild cells together weigh more than that, the heaviest one starts to starve. It shrinks
steadily, first losing everything it ever ate and then its own body, until it is smaller than the
smallest newborn. Then it bursts into a cloud of scraps, and a fresh cell is born somewhere else ten
seconds later. Only one wild cell starves at a time, and once it has started it does not stop. So in a
crowded dish, now and then a giant withers and pops, leaving scraps for whoever is nearby, and a dish with room to spare sees no starving at all. There is no randomness: the same dish
always starves the same cell.

```
wildCarryingCapacity(t) = WILD_CELL_CARRYING_CAPACITY_MULTIPLE × WILD_CELL_COUNT × worldMass(t)
totalWildMass           = Σ mass of every seated wild cell, read at the start of step 1 (before any settle)
```

- **Choosing the starver.** At step 1, before the settles, the dish picks a starver if no seat is
  starving and `totalWildMass > wildCarryingCapacity`. The starver is the heaviest seated wild cell,
  with ties going to the lower seat number, and its seat's `isStarving` becomes true. Nothing else
  happens under the budget, and a respawning seat counts as 0 mass.
- **Starving** (inside that seat's settle, §3.3.1, right after `seat.fullMass` is computed and before
  the cell's mass is laid on it):
  `starvedMass = seat.fullMass × WILD_CELL_STARVATION_FRACTION_PER_SECOND × TICK_INTERVAL_S`. This is
  taken from `seat.grownMass` first. What is left is taken from the base size itself, by
  `seat.sizeFactor −= remainder / worldMass(t)`, then `seat.fullMass −= starvedMass`. The settle then
  runs as usual, so a wound on a starving cell still recovers, but only toward the shrinking full size.
  The starved mass is simply gone. Nothing drops until the cell bursts.
- **Bursting.** A starving cell whose `seat.fullMass` falls below `WILD_CELL_SIZE_FACTOR_MIN` ×
  `worldMass(t)`, the smallest newborn's size, dies at the end of its settle. It goes through
  `dissolveCell`, the way any cell leaves the world: every engulf it is part of is aborted, and
  detritus drops by the §1 rule (`DETRITUS_MASS_FRACTION` of its mass). The seat's `isStarving` resets,
  and the seat respawns after `WILD_CELL_RESPAWN_SECONDS` like an eaten one. A starving cell that is
  eaten first simply dies of that; its seat's `isStarving` resets at the payout. On the next tick,
  another starver may be chosen if the dish is still over its budget.
- **Committed until death.** A starver keeps starving even after the total drops back under the
  budget. The reason is that a cell which shrinks a little and then recovers is invisible to the
  player. A whole life ending is the event the human asked for ("feels alive"), and it overshoots the
  budget only by one cell's mass.

**Why these numbers.**

- **Capacity 1.5.** A fresh dish holds 24 newborns averaging 1.08 × `worldMass` (the mean of the
  log-uniform 0.5–2.0), so 26 × `worldMass`. The budget of 36 × `worldMass` leaves the wild about 40 %
  of room to grow before anything starves, and that room grows with the world. At 0:00 it is 720 mass;
  at 9:00 it is 20 160.
- **Starvation 10 % a second.** At that rate a starving cell halves in about 7 s. A cell at the world's
  average size bursts about 7 s after it starts starving, and a giant at the 3 × ceiling bursts about
  18 s after (ln 6 / 0.1). That is long enough to see it wither, and short enough that a crowded dish
  loses a whole cell within 20 s.
- **The burst floor reuses `WILD_CELL_SIZE_FACTOR_MIN`,** so a cell never dies bigger than a newborn
  could be born, and there is no third knob. The two knobs are `WILD_CELL_CARRYING_CAPACITY_MULTIPLE`
  (how crowded the dish gets) and `WILD_CELL_STARVATION_FRACTION_PER_SECOND` (how long a death takes).
- **Feed-back:** a burst drops 20 % of a cell that has already shrunk to half the world's mass, so
  about 0.1 × `worldMass` in scraps. That is a small meal. The starved mass itself is not returned,
  which is the point: the die-off takes mass out of the dish's food loop.

#### 3.3.7 Constants (`packages/shared/src/constants/wild-cells.ts`, balance domain `wildCells`)

| Constant                                   | Value                     | Unit                              | Change (#517, #544, #555)                                             |
| ------------------------------------------ | ------------------------- | --------------------------------- | --------------------------------------------------------------------- |
| `WILD_CELL_COUNT`                          | 24                        | seats                             | unchanged                                                             |
| `WILD_CELL_SIZE_FACTOR_MIN`                | 0.5                       | × `worldMass`                     | new (replaces `WILD_CELL_MASS_SPREAD` 0.3)                            |
| `WILD_CELL_SIZE_FACTOR_MAX`                | 2.0                       | × `worldMass`                     | new                                                                   |
| `WILD_CELL_RECOVERY_SECONDS`               | 6                         | s (time constant of a loss)       | new                                                                   |
| `WILD_CELL_MAX_WORLD_MASS_MULTIPLE`        | 3                         | × `worldMass`                     | new: the growth ceiling                                               |
| `WILD_CELL_SIGHT_VIEW_MULTIPLE`            | 1.0                       | × `viewHalfHeightFor`             | new                                                                   |
| `WILD_CELL_SPRINT_FLEE_RADII`              | 4                         | own radii                         | new                                                                   |
| `WILD_CELL_SPRINT_HUNT_RADII`              | 3                         | own radii                         | new                                                                   |
| `WILD_CELL_CARRYING_CAPACITY_MULTIPLE`     | 1.5                       | × `WILD_CELL_COUNT` × `worldMass` | new (#555): the die-off budget                                        |
| `WILD_CELL_STARVATION_FRACTION_PER_SECOND` | 0.1                       | of full size per second           | new (#555)                                                            |
| `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE`       | `endosymbiosis`           | stage                             | renamed from `WILD_CELL_HUNTS_FROM_STAGE`; now gates player prey only |
| `WILD_CELL_BUILDS`                         | the three lists of §3.3.2 | trait ids                         | unchanged                                                             |
| `WORLD_ORGANISM_ID`                        | —                         | —                                 | removed: a wild cell's `organismId` is its own id                     |
| `WILD_CELL_HUNT_RANGE_RADII`               | —                         | —                                 | removed: hunting reaches as far as sight                              |
| `WILD_CELL_RESPAWN_SECONDS`                | 10                        | s                                 | unchanged                                                             |
| `WILD_CELL_MIN_SPACING_WU`                 | 200                       | wu                                | unchanged                                                             |
| `WILD_CELL_DECISION_INTERVAL_SECONDS`      | 0.5                       | s                                 | unchanged                                                             |
| `WILD_CELL_FLEE_RANGE_RADII`               | 8                         | own radii                         | unchanged; now also flees wild predators, and only those in sight     |
| `WILD_CELL_TURN_CHANCE`                    | 0.25                      | per wander decision               | unchanged                                                             |

Sprint reuses `controls.ts` unchanged. The sprint radii follow from the speeds: fleeing at 4 radii,
a 0.5 s sprint at 1.8 × carries a protocell about 200 wu (11 radii), clear of a hunter's own sprint
reach. Hunting at 3 radii, the sprint covers the gap to contact before the prey's next decision.

Grazing is the food-competition risk. Twenty-four wild cells that graze algae compete with the player
for mass (not for DNA: bacteria and fragments are left alone). If the #98 playtest or the P rows show
the player's mass pace falling behind the §3.1 calibration, `WILD_CELL_SIGHT_VIEW_MULTIPLE` is the
first knob (a shorter sight means less active grazing; touch-eating stays), and `FOOD_CAP_BASE` is
the second.

**Contract (what the build ticket changes; the architect folds it into `architecture/entity-model.md`
§2, `architecture/server-simulation.md` §3 and `architecture/constants-files-tests.md` §10).**

- `WildSeatRecord` becomes (`seatNumber`, `cellId | null`, `sizeFactor`, `grownMass`, `fullMass`,
  `isStarving`, `respawnInTicks`, `headingX`, `headingY`, `decideInTicks`) (#555 adds `isStarving`,
  hashed like the rest). `CellView` gains `starving: boolean` (true only for a starving wild cell) so the
  renderer can show it withering; the look is the graphics designer's (a follow-up ticket). `massSpreadFactor` is renamed
  `sizeFactor`; `drainedMass` is replaced by `grownMass` and `fullMass`.
- Wild cells stay ordinary `CellRecord`s in `world.cells` with `playerId: null`, now with `organismId`
  equal to their own id. They carry the player's sprint counters, which the strategy drives through the
  command's sprint flag.
- `wild/wild-pin.ts` becomes `wild/wild-settle.ts`, with the pure `settleWildMass({ mass, fullMass,
grownMass, decayPerSecond, baseMass, worldMass }, balance)` → `{ mass, grownMass, fullMass }` (W11) and
  `wildSizeFactor(u, balance)`. `wildSightRange(radius, balance)` calls the shared `viewHalfHeightFor`.
- Step order: step 1 runs the wild strategy and the settle. Step 4 eats for wild cells (algae and
  detritus only). Step 5 skips base decay for wild cells and applies every drain, with the floor above.
  Step 9 runs wild respawn.
- Unchanged from #97: `WorldState.roundStartTick`, `CellView.kind: 'player' | 'wild'` (`CELL_KIND`),
  the `world_level_up` effect, `PlayerProgressView.wildAbsorptions` and `spectatingCellId`,
  `RANDOM_STREAM.wildCells`, the `worldClock` and `wildCells` balance domains, and the world reference,
  computed on both sides and never sent (`worldReference`, `stageOf` and `cumulativeDnaForLevel` in
  `simulation/`).
- The renderer (#99) keeps its wild palette and draws their organelles from `traits` like anyone's.
- Cost: 24 cells, one decision per 30 ticks each (three nearest-first queries within sight: threats,
  prey, motes) and one settle per tick each.

### 3.4 What a fresh protocell sees

At 0:00, one player, #141's option A render (seed 96) still describes the motes: 9 algae, 0 bacteria
and 1 fragment in the spawn camera (1067 × 600 wu). What changed is the company: 24 wild protocells
of mass 10–40 (radius 12.6–25.3 wu) spread over the placement disc (radius `DISH_RADIUS −
SPAWN_EDGE_MARGIN` = 2700 wu), 0.67 of them in the spawn camera on average and the nearest about
490 wu away (under half a spawn-camera width), so a peer is in sight within seconds
of drifting. About eight of the 24 (size ≤ 0.8) are lunch for a 20-mass player and about eight (size ≥ 1.25)
are threats; none hunts a player before 6:00 (§3.3.3), but they graze, chase and sprint after each other and
swallow a player they bump into, so the first minute is grazing among peers of visibly different sizes, and the first
threat hint ([`ui/input-and-onboarding.md §5`](../ui/input-and-onboarding.md#5-onboarding-the-first-two-minutes)) fires early and honestly.
If the first minute still reads as dark water in the #98 playtest, `FOOD_CAP_BASE` is the one knob
(#141 option B's 2 × cap looked right at spawn zoom); it is not changed here.
