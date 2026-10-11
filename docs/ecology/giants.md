# Evolution — Ecology, Growth and Absorption: giant cells

§3.5 of the split [`ECOLOGY.md`](../ECOLOGY.md), which keeps the shared context and the file list.

### 3.5 Giant cells

Three giant cells share the dish from the first second of every round: a giant amoeba that hunts, a
paramecium that grazes and a giant diatom that drifts. They are about 50 times a newborn's mass and
about a third of a player's top size. While you are small they ignore you: the amoeba swims past you
to a wild cell worth the effort, and none of them can swallow you. Once you weigh a quarter of the
amoeba it starts to hunt you, but it is slow, so you can swim or sprint away. Grow past them and the
roles turn: they run from you like any wild cell, and swallowing one pays a big DNA prize and shows a
real-life fact about the organism. An eaten giant comes back a minute and a half later.

The human's decision (ticket #821): **1A**, giants hunt you only once you are big enough to be worth
it (a quarter of their mass, up to what they can swallow); **2A**, all three; **3A**, in the dish from
the start of the round. Epic #757; the mockups are the design canvas
<https://claude.ai/artifact/V3CruikuDsEYHhMnch6Q6z> (the cast board, "Ignored", "Hunted" and "It runs").

#### 3.5.1 The cast

| Giant (`GiantSpecies`)          | Role    | Born mass (uniform) | Cruise speed     | Eats                                | Hunts                                       | Flees and sprints |
| ------------------------------- | ------- | ------------------- | ---------------- | ----------------------------------- | ------------------------------------------- | ----------------- |
| Giant amoeba (`giant_amoeba`)   | hunter  | 900–1 500           | 154 wu/s (slow)  | cells only                          | cells from ¼ of its mass to what it engulfs | yes               |
| Paramecium (`giant_paramecium`) | grazer  | 900–1 300           | 226 wu/s (fast)  | algae, detritus and bacteria, ahead | never                                       | yes               |
| Giant diatom (`giant_diatom`)   | drifter | 1 000–1 500         | 81 wu/s (drifts) | nothing: it lives on light          | never                                       | never             |

Speeds are cruise speeds with no gel; a player cell with no speed trait cruises at 220 wu/s. So the
amoeba is the giant you can always outswim, the paramecium the one you need speed or a corner to
catch, and the diatom the one that cannot get away but is the hardest to swallow (§3.5.4). The three
prizes ask for three different skills: size, speed and persistence.

#### 3.5.2 A giant is a wild cell, with these differences

A giant is a wild cell (§3.3) with a species. It is an ordinary `CellRecord` with `kind` `wild` and
`playerId` null, held by its own seat. Everything §3.3 says of a wild cell holds for a giant unless this
section changes it.

**Shared, unchanged:**

- **Movement, separation and engulf.** It moves through the shared kernel (§5.2), separates (§5.3) and
  engulfs and is engulfed by §6, as predator and as prey, through the folded modifiers of its build.
- **Sight** (§3.3.3): `WILD_CELL_SIGHT_VIEW_MULTIPLE × viewHalfHeightFor(radius)`, 777 wu at 900
  mass, 883 wu at 1 500.
- **Sprint** (§3.3.3): the player's own sprint, started only on a decision, never while engulfing or
  carried, taken only when it can land (`wild/wild-hunt-sprint.ts`). The drifter never sprints.
- **Fleeing** (§3.3.3): from any cell in sight that can engulf it, within `WILD_CELL_FLEE_RANGE_RADII`
  own radii, sprinting within `WILD_CELL_SPRINT_FLEE_RADII`, and the engulf-escape rule. The drifter
  never flees (§3.5.5).
- **Recovery** (§3.3.1): a wound recovers toward the full size with `WILD_CELL_RECOVERY_SECONDS` (6 s),
  so the Toxin Vacuole escape works on a giant hunter as on a wild one.
- **The hunt's aim, charge, hold and rest** (ticket #738): `WILD_CELL_HUNT_CHARGE_RADII`, the hold and
  `WILD_CELL_HUNT_REST_SECONDS` (15 s) unchanged; the closer-rival rule unchanged (ticket #737).
- **Decisions** every `WILD_CELL_DECISION_INTERVAL_SECONDS`, staggered by seat number (§3.5.9).

**Different:**

| What               | A wild cell (§3.3)                                         | A giant (this section)                                                                    |
| ------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Size               | `worldMass × sizeFactor`, grows with the world             | a born mass drawn once per life, never moves with the world (§3.5.3)                      |
| Growth ceiling     | 3 × `worldMass`                                            | `GIANT_MASS_CEILING`, 1 500 mass, fixed                                                   |
| Decay of growth    | the player's decay                                         | the player's decay × `GIANT_DECAY_MULTIPLIER` (0.25)                                      |
| Ladder             | the world's (`WILD_CELL_BUILDS`, level follows worldLevel) | a fixed build per species at fixed tiers, level 6 all round (§3.5.4)                      |
| Who it may engulf  | any cell `canEngulf` allows                                | the hunter: only cells of at least ¼ its mass; grazer and drifter: no cell (§3.5.6)       |
| Players as prey    | from `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE` (6:00)           | from tick 0, gated by mass alone (decision 1A)                                            |
| Hunt give-up       | `WILD_CELL_HUNT_GIVE_UP_SECONDS` (5 s)                     | `GIANT_HUNT_GIVE_UP_SECONDS` (8 s): it is slow (§3.5.6)                                   |
| Food               | algae and detritus                                         | hunter none; grazer algae, detritus and bacteria, ahead of it, while hungry; drifter none |
| Speed              | its traits                                                 | its traits × `GIANT_SPEED_MULTIPLIER_BY_SPECIES`                                          |
| Wander turn chance | `WILD_CELL_TURN_CHANCE` (0.25)                             | `GIANT_TURN_CHANCE_BY_SPECIES`                                                            |
| Die-off            | counts toward the carrying capacity, may starve            | outside it: never counted, never starves (§3.5.10)                                        |
| Eaten by a player  | `ENGULF_DNA_SHARE × worldDna`                              | `GIANT_DNA_BONUS` (200) and the fact popup (§3.5.8)                                       |
| Respawn            | `WILD_CELL_RESPAWN_SECONDS` (10 s)                         | `GIANT_RESPAWN_SECONDS` (90 s), well away from every player (§3.5.9)                      |

#### 3.5.3 Size, growth and recovery

A giant's **born mass** is drawn once per life from the `giants` stream, uniform on its species' range,
and plays the part a wild cell's base size plays: it never decays, never moves with the world, and the
cell never wastes below it. What a giant eats is **growth** on top, kept and burnt off as a wild cell's
is, up to one fixed ceiling for every species.

```
bornMass       = GIANT_BORN_MASS_MIN_BY_SPECIES[s] + (GIANT_BORN_MASS_MAX_BY_SPECIES[s] − GIANT_BORN_MASS_MIN_BY_SPECIES[s]) × u
                                                       u ~ uniform[0, 1) from the giants stream, at each (re)spawn
fullMass       = min(bornMass + grownMass, max(bornMass, GIANT_MASS_CEILING))
```

The settle is §3.3.1's, with `bornMass` for `baseMass(t)`, `GIANT_MASS_CEILING` for `growthCeiling(t)`
and the decay taken from the growth multiplied by `GIANT_DECAY_MULTIPLIER`. Its floor is
`min(CELL_STARTING_MASS, bornMass)` as for a wild cell, which a giant never nears.

**Why these numbers.**

- **The ranges** are the mockup's, which the human chose: every giant starts between 45 and 75 times a
  newborn's 20 and well under a player's `CELL_MAX_MASS` of 5 000, so a player outgrows all three.
  The diatom starts heaviest because it never eats; the paramecium lightest because it is the
  smallest of the three in life (about 0.25 mm against 0.5 mm and 0.75 mm). Uniform rather than
  log-uniform: the range is narrow (a ratio of 1.4 to 1.67), so the two draws read the same and uniform
  is the simpler formula.
- **`GIANT_MASS_CEILING` 1 500**, the ticket's figure: a player swallows any amoeba or paramecium from
  1 875 (1 500 × `ENGULF_MASS_RATIO` 1.25) and any diatom from 2 100 (1 500 × 1.40, §3.5.4), all far
  below 5 000. The ceiling binds the amoeba, which eats cells: a 1 400 amoeba that swallows a
  411-mass wild cell stops at 1 500 (G11). The paramecium's appetite stops it near its born mass
  (§3.5.7); the diatom never grows.
- **`GIANT_DECAY_MULTIPLIER` 0.25.** At the player's rate a 1 500 amoeba would burn its growth at
  2.5 mass/s (with its Mitochondrion's 0.85) and lose a whole meal of 300 in two minutes; a giant
  should stay fat after a meal for most of a round. At a quarter it burns 0.63 mass/s at 1 500. The
  same multiplier keeps the grazer's steady appetite small: a paramecium that holds its growth near
  its appetite eats only what its growth burns, 0.50 mass/s at 1 200 mass, about 4 % of the food mass
  the dish spawns for one player (7 motes a second of 1.5 to 2 mass each, ecology/food-and-spawn.md §3)
  and less with more players. Big organisms burn less per unit of mass than small ones, so the rule
  is also true to life.

#### 3.5.4 Build, level and armour

A giant's traits are its species' fixed build (`GIANT_BUILDS_BY_SPECIES`), each a valid ladder ending
in its form, owned at the tiers below for its whole life. Its level is the picks plus one (6), its
stage `stageOf(traits)` = `specialised`, and its `dnaCumulative` 0 (no payout reads it, §3.5.8).
The renderer draws its form from these traits like anyone's (§3.5.11).

| Species            | Build (tier)                                                                                        | What the tiers do for it                                                                                                                                                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `giant_amoeba`     | `nucleoid` I, `mitochondrion` I, `nuclear_envelope` I, `cytoskeleton` I, `amoeba_pseudopods` **II** | Pseudopods II's grip (0.2) is the lowest that holds a cruising prey: held in cover at 0.85 − 0.2 = 0.65 × 220 = 143 wu/s, it is slower than the amoeba's 154; sprinting (257 wu/s) it breaks free. That is the mockup's "it is slow, so sprint away", exactly. The arm grab reaches 0.6175 own radii (96 wu at 1 500). |
| `giant_paramecium` | `nucleoid` I, `mitochondrion` I, `nuclear_envelope` I, `cilia` I, `paramecium_cilia` I              | Cilia I × Paramecium Cilia I = 1.21 speed, with the struggle and grip resistance of a ciliate, so a held paramecium slips a weak grip.                                                                                                                                                                                 |
| `giant_diatom`     | `nucleoid` I, `chloroplast` I, `nuclear_envelope` I, `cell_wall` I, `diatom_shell` I                | The armour, below. Its Chloroplast photosynthesises in the shallows (0.3 mass/s), less than its growth burns (0.44 mass/s at 1 000), so it never grows: light pays its keep.                                                                                                                                           |

**The diatom's armour, through existing traits only.** Cell Wall I adds `membraneRatioBonus` 0.15, so
a predator needs 1.40 × the diatom's mass to start (1 400 for the lightest, 2 100 for the heaviest)
and keeps it down to 1.25 ×. Cell Wall I × Diatom Shell I make it 1.68 × slower to digest. The shell's
spines drain a predator 2 % of the diatom's mass a second while the engulf runs (24 mass/s on a 1 200
diatom) and spit it out at 0.4 a second in wrap and absorb. At the threshold ratio a swallow takes about
1.4 s, of which 1.26 s roll for the spit-out: about 60 % of tries land (e^(−0.4 × 1.26)), so a big cell
usually needs two. Tier I and not higher: Cell Wall II (1.55) would push the heaviest diatom to 2 325,
past what most players reach in a default 10-minute round (the world's average is 620 at 10:00), and
Diatom Shell II would spit out two tries in three. Tier I already makes it the hardest of the three.
The danger and relation rings read all of it unchanged: the diatom shows the edible ring with
`EDIBLE · SPINY` (ui/hud.md §3.1) to a cell heavy enough.

#### 3.5.5 Movement

Speed cap (§5.2) = `CELL_BASE_SPEED × sprint × zone × speedMultiplier × engulf`, where the giant's
`speedMultiplier` is its folded traits' × `GIANT_SPEED_MULTIPLIER_BY_SPECIES[s]` (folded at step 1 with
the rest of its modifiers, so the movement step, the hunt-sprint kernel and the client's prediction
read one value).

| Species            | Traits' speed | Species multiplier | Cruise (wu/s) | Sprint (wu/s, mitochondrion's +0.1) | Turn chance per wander decision |
| ------------------ | ------------- | ------------------ | ------------- | ----------------------------------- | ------------------------------- |
| `giant_amoeba`     | 1.0           | 0.7                | 154.0         | 292.6                               | 0.25                            |
| `giant_paramecium` | 1.21          | 0.85               | 226.3         | 429.9                               | 0.1                             |
| `giant_diatom`     | 0.9215        | 0.4                | 81.1          | never sprints                       | 0.05                            |

- **Amoeba 0.7.** Slow enough that any cell outswims it at cruise (220 against 154), so being hunted
  is a warning, not a death sentence; fast enough that its sprint (292.6 for 0.5 s) closes 36 wu on a
  cruising prey, so a cell that ignores it gets grabbed. Real amoebae crawl.
- **Paramecium 0.85.** Its ciliate traits alone (1.21, 266 wu/s) would outrun every cell without a
  speed trait for good. At 0.85 it cruises at 226: faster than a plain cell (220), slower than a cell
  with any speed trait (Simple Flagellum I 231, Cilia I 242). So it is the fast giant, and catching it is
  the prize of a speed build, a wall or a gel patch.
- **Diatom 0.4.** It drifts at 81 wu/s: slow enough to read as carried by the water rather than
  swimming. Real diatoms have no flagella.
- **Turn chances.** The amoeba wanders like a wild cell (`WILD_CELL_TURN_CHANCE` 0.25, a new heading
  about every 2 s). The paramecium keeps a heading about 5 s (0.1), so it sweeps long lanes. The
  diatom keeps one about 10 s (0.05): a slow, straight drift. The wander's wall rule (§3.3.3) keeps all
  three inside the placement disc.
- **The drifter never flees and never sprints.** Its decision is the wander rule alone, every time:
  its defence is its shell, and a slow diatom turning to run would look like swimming. (Open question
  2, §3.5.16.)
- Every species multiplier is at most 1, so `interestMaxCellSpeedFor` (the interest margin's bound,
  `camera/interest-margin.ts`) still bounds every cell and needs no change.

#### 3.5.6 The hunt window (decision 1A)

Only the hunter engulfs cells, and only those worth it:

```
canEngulf(predator, prey) = predator.isCellEater
                            ∧ prey.mass ≥ predator.preyMinMassFraction × predator.mass
                            ∧ predator.mass ≥ prey.mass × (ENGULF_MASS_RATIO + prey.membraneRatioBonus)
```

`isCellEater` is true and `preyMinMassFraction` 0 for every player and wild cell, so the predicate is
unchanged for them. For a giant both come from its species: the hunter `true` and
`GIANT_HUNT_MIN_PREY_MASS_FRACTION` (0.25), the grazer and the drifter `false`. Both are mirrored on
the `CellView` at step 1 like `membraneRatioBonus`, so the predicate keeps its one home and its three
callers (step 6's engulf start, the HUD's threat label and the warning ring, absorption.md §6.1) still
agree. `canContinueEngulf` is unchanged: the window gates the start only, so a prey drained below a
quarter during the swallow is still swallowed.

What follows from that one rule:

- **Ignored means ignored.** A cell under a quarter of the amoeba's mass is not its prey: it is not
  hunted, and it is not swallowed if it touches the amoeba (separation pushes the two apart). It sees
  no red ring and no `GIANT AMOEBA` threat label: the mockup's "Ignored" frame. The paramecium and the
  diatom never threaten anyone. (Open question 1, §3.5.16.)
- **Players from tick 0, by mass alone.** `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE` does not apply to a
  giant: decision 1A puts the gate on the prey's mass, not on the era. In practice the two agree in
  feel: the lightest amoeba's window opens at 225 mass, which a player at the world's pace reaches
  around 3:25 (`worldMass` = 20 + _t_), and the window rises with the amoeba (375 at 1 500).
- **A fresh cell is never prey.** `GIANT_BORN_MASS_MIN_BY_SPECIES[giant_amoeba]` ×
  `GIANT_HUNT_MIN_PREY_MASS_FRACTION` (225) > `ENTRY_MAX_MASS` (200, PROGRESSION §5), so a late
  joiner or a respawn is never born inside a giant's window. The balance test pins it (G14).
- **Wild cells see it too.** Their flee and closer-rival rules read `canEngulf`, so a wild cell below
  the amoeba's window does not run from it, and no wild cell flees the grazer or the drifter. The
  amoeba hunts wild cells and players alike, and the other giants when they fall inside its window
  (a 1 500 amoeba can start on a paramecium of up to 1 200, as real amoebae eat paramecia, though at
  154 wu/s it rarely catches one). A wild cell grown past 1.25 × a giant may eat it, as any cell may.
- **Why a quarter.** It is the ticket's and the mockup's number, and it puts the hunted band where the
  player is mid-round: 225 to 720 for the lightest amoeba, 375 to 1 200 for the heaviest. Below a
  quarter, a 900 amoeba would chase 100-mass cells across the dish in the first minutes, which 1A
  rules out; above, the band would close (at 0.8 it would be empty).

**The #738 timers.** A giant keeps the seat's `huntPreyId`, `huntStartTick`, `givenUpPreyId` and
`huntRestUntilTick` exactly as a wild seat (`wild/wild-hunt-give-up.ts`), with one value changed:

- **`GIANT_HUNT_GIVE_UP_SECONDS` 8.** At 5 s a slow amoeba would give up on a still prey at the edge
  of its sight before reaching it. 8 s is the time to cross its own sight at cruise (882.8 / 154 =
  5.7 s), plus a whole swallow (≤ 1.2 s) and one decision (0.5 s), rounded up. A prey that runs is
  still given up on: the amoeba is slower, so 8 s of chase that lands nothing ends it.
- **Rest unchanged (`WILD_CELL_HUNT_REST_SECONDS`, 15 s).** After a give-up the amoeba hunts nothing
  for 15 s and leaves that prey alone until it gives up on another: a player who escaped it gets the
  same 15 s to leave that a wild hunter gives, and the slow amoeba needs them less, not more.

#### 3.5.7 The grazer's diet

The paramecium's decision is flee, then **graze**, then wander; it never hunts. Its graze is the wild
rule with three changes:

- **Bacteria too.** It targets and eats algae and detritus (`isWildFood`'s kinds) **and bacteria**,
  never DNA fragments. Real paramecia live on bacteria. So the giant competes for a
  little of the players' DNA food, which is its role in the mockup: "it steals your food rather than
  you". A bacterium it eats is mass only (3), as a wild meal is; it credits nothing.
- **Ahead of it.** The target is the nearest such mote in sight whose bearing lies within
  `GIANT_GRAZER_FORWARD_HALF_ANGLE_DEGREES` (60°) of its forward direction; only when none does, the
  nearest in sight; ties to the lower entity id. Forward is its velocity's direction, or its seat's
  wander heading while it is at rest. A 120° cone keeps most food it swims to ahead of it, and it never
  doubles back for a mote behind while one lies ahead: it sweeps lanes, which reads as a paramecium
  sweeping food into its groove and lets a player predict it.
- **Only while hungry.** It targets and eats food (step 4, by §1's eating rule, every mote whose centre
  lies within its radius) only while its `grownMass` is below `GIANT_GRAZER_APPETITE_MASS` (100). A
  sated paramecium passes over food. The test is made once per tick before step 4, so one tick's meal
  may overshoot by a few motes. Why 100: it bounds the first feed to about 50 to 70 motes, after which
  it eats only what its growth burns (0.50 mass/s, §3.5.3), so over a default round it eats about 400
  mass in all, about 5 % of what the dish spawns for one player.

The hunter eats no motes at all (step 4 skips it): it is a hunter, and a 1 500-mass body sweeping the
dish would take more food than the grazer. The drifter eats nothing.

#### 3.5.8 Being eaten: the payout, the fact and the respawn

A giant is eaten by §6's rules, so it bleeds, struggles, spits out (the diatom) and is carried as any
prey. At the payout:

- **Player eats a giant** (§3.3.4's "player eats wild", with these substitutions): DNA +=
  `GIANT_DNA_BONUS` (200) and no `ENGULF_DNA_SHARE × worldDna`, no `ENGULF_DNA_BASE`; mass +=
  `prey.mass × ENGULF_MASS_YIELD` as usual (cap overflow to DNA, §5.4); tag points += `predatory` ×
  `ENGULF_PREDATORY_TAG_POINTS`; `wildAbsorptions` += 1 and `absorptions` unchanged (no
  `SCORE_ABSORPTION_BONUS`); its endosymbiont credits the eater's counter as a wild prey's does;
  detritus as usual. The DNA counts toward the score as any earned DNA does.
- **The fact.** The `cell_absorbed` effect carries `preyGiantSpecies`. When the own cell is the
  predator and it is not null, the client shows ticket #783's form popup (ui/overlays.md §3.8: large,
  centred, about 5 s) with the giant's name, `+200 DNA` and its real-life line (§3.5.12). A giant eaten
  by anything else shows nothing.
- **Giant eats a cell:** the cell's normal death; the meal becomes growth up to the ceiling. **Wild or
  giant eats a giant:** mass only, as wild eats wild.
- **Why 200 DNA.** A level's worth at the levels a player has when they can first eat one: leaving
  level 6 costs 160 DNA, level 7 180, level 8 200 (`LEVEL_UP_COST_BASE_DNA` 40 + 20 × level), so a
  giant is about one draft. It is four times a wild eukaryote at 9:00 (48) and about twice a player
  kill's bounty mid-round (30 + 20 % of the prey's earned DNA). Three giants at most every 90 s keep it
  a prize, not an income.

The seat respawns its giant `GIANT_RESPAWN_SECONDS` (90 s) after it is absorbed or removed, with a
fresh born mass, no growth and its build. Why 90: long enough that eating one clears that threat or
prize from the dish for a while (15 % of a default round), short enough that one eaten at 8:00 is back
for the last minute.

#### 3.5.9 Placement, respawn and randomness

- **Seats.** `GIANT_SPECIES_IN_DISH` (amoeba, paramecium, diatom) has one seat each. Giant seats are
  numbered after the wild seats, `WILD_CELL_COUNT` + _i_ (24, 25, 26), so the decision stagger
  (§3.3.3: seat _n_ decides on ticks ≡ _n_ mod 30) and the stable ordering need no new rule. The seat
  count never changes.
- **World creation:** after the players and **before** the wild seats and the initial fill, so the
  wild placement's threat clearance (`SAFE_SPAWN_RADIUS` 600 from any cell of 40 mass or more) keeps
  every wild cell clear of the giants, and E1's "no mote inside any cell" covers them.
- **The giant clearance:** a candidate is safe when every player cell centre is at least
  `GIANT_MIN_PLAYER_DISTANCE_WU` (1 500) away, every other giant's at least
  `GIANT_MIN_GIANT_DISTANCE_WU` (1 500) and every other cell's at least `GIANT_MIN_CELL_DISTANCE_WU`
  (450): `min(nearest player − 1 500, nearest giant − 1 500, nearest cell − 450)`, by
  `findSafeSpawnPoint` with `SAFE_SPAWN_MAX_ATTEMPTS`, then the farthest candidate. Respawn uses the
  same rule.
  - **1 500 from players:** the tallest view's half-height plus the biggest giant's radius
    (1 192.9 + 154.9 = 1 348) rounded up, so a giant is rarely born on anyone's screen.
  - **1 500 between giants:** the three start in different parts of the dish (three points 1 500 apart
    fit easily in the 2 700 wu placement disc), so no screen starts with two.
  - **450 from any cell:** the biggest giant's radius and arm reach (154.9 + 95.7) plus the radius of a
    wild cell at its ceiling at 10:00 (172.5), 423, rounded up, so a respawned giant never lands on or
    within reach of another cell.
- **The `giants` stream** (label `giants`), forked from the round seed like every stream: born masses,
  placement candidates, wander headings and turn rolls. A giant's draw never shifts a mote, a wild
  cell's draw or a player's spawn; the stream's state is hashed with the others
  (determinism/random-streams.md §3). The giant seats' fields are hashed like the wild seats'.
- `results` freezes the giants with everything else; a rematch recreates them.

#### 3.5.10 Outside the die-off

Giants are not wild life the dish must feed: they live on their born mass (the drifter on light).
`totalWildMass` (§3.3.6) sums only the 24 wild seats, a giant is never chosen to starve, and
`isStarving` is always false on a giant. Counting them would put a fresh dish (one giant alone weighs
more than the 720 budget at 0:00) into starvation at tick 1.

#### 3.5.11 How they look

Each giant is drawn as its existing form at a large size, from its traits: the amoeba's lobes and arms
(`amoeba_pseudopods`), the paramecium's ciliate body (`paramecium_cilia`, `cilia`) and the diatom's
shell (`diatom_shell`). The renderer gets `CellView.giantSpecies` and uses it for:

- **A palette per species, new art** (the mockup's): the amoeba violet (`#77729a` to `#25263d`, rim
  `#cfc8ff`), the paramecium sea-green (`#5f9a86` to `#1a3330`, rim `#b8f6e0`), the diatom glass grey
  (`#c9d4de` to `#3c4856`, rim `#e6ecf2`) with golden-brown chloroplasts (`#c88a2a`). Without it a giant
  reads as a big wild cell. The graphics designer fixes the ramps against
  visual-style/principles-and-palette.md and the threat and edible rings' contrast.
- **New detail only where the form lacks it at giant size:** the paramecium's oral groove (the
  mockup's curved line) and the diatom's concentric rings of pores and radial ribs. The graphics
  designer checks each form at radius 120 to 155 wu first and adds only what is missing.
- **Names:** the threat label says `GIANT AMOEBA` where a wild cell's says `WILD <STAGE>`; the respawn
  line says "Eaten by a giant amoeba". The paramecium and the diatom never get a threat label (they
  threaten no one); a diatom a player can eat gets `EDIBLE · SPINY`.
- **No new HUD state.** The mockup's `TOO SMALL TO NOTICE` and `HUNTING · MASS 420` pills are
  annotations of the idea, not UI: the existing rings say it (no red ring when ignored, the red ring
  when in the window, the green ring when edible).

#### 3.5.12 Real-life lines

Short, true and in the form popup's style (no full stop, ui/overlays.md §3.8). Each is different from
its form's own line (`hud/format/form-facts.ts`), so a player who has seen the form popup learns
something new.

| Species            | Line                                                            | Checked against                                                                                                |
| ------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `giant_amoeba`     | `Real giant amoebae can grow almost a millimetre across`        | _Amoeba proteus_ 0.25 to 0.75 mm; _Chaos carolinense_ larger (Wikipedia "Amoeba"; MicrobeWiki, Kenyon College) |
| `giant_paramecium` | `Real paramecia sweep food into a groove that works as a mouth` | the oral groove and cytostome (Wikipedia "Paramecium")                                                         |
| `giant_diatom`     | `Real diatoms make at least a fifth of Earth's oxygen`          | estimates of 20 % to 50 % of the oxygen produced each year (Wikipedia "Diatom")                                |

The mockup's diatom line ("a fifth of the oxygen you breathe") is reworded: the sources give a range
for the oxygen the planet produces, not for what one person breathes. The amoeba's "big enough to see
without a microscope" is dropped: the sources disagree on whether a typical one is.

#### 3.5.13 Salt or fresh water (ticket #790)

The cast depends on the setting. No rule or number changes with the answer; only names, lines and
art do, so the build proceeds on the current cast and #790's answer is a data change.

| Role    | A: kelp shore, sea-water cousins                                                                                                                                                                                                                                                   | B: splash pool (fresh)                                                                                                                                                      | C: inland pond (fresh) |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Hunter  | **changes** to a giant foram: a shelled amoeboid with a net of thread-like pseudopods. New art (a chambered shell); the shell is drawn only, not armour, so the diatom stays the hard one. New line, for example about beaches whose sand is made of foram shells (to be checked). | giant amoeba, as designed                                                                                                                                                   | as B                   |
| Grazer  | **changes** to a sea-water ciliate, for example _Euplotes_, which walks on tufts of fused cilia (cirri). The ciliate form stays; cirri are new detail; new line.                                                                                                                   | paramecium, as designed                                                                                                                                                     | as B                   |
| Drifter | giant diatom as designed: _Coscinodiscus_, the mockup's model, is a sea diatom                                                                                                                                                                                                     | **changes** its model only: a freshwater diatom (the encyclopedia names a freshwater genus with a source; the round shell and both lines still hold for diatoms as a group) | as B                   |

The species ids, display names and lines are data rows (§3.5.14 and the client's lines), so each
answer edits rows, not rules.

#### 3.5.14 Constants (`packages/shared/src/constants/giants.ts`, balance domain `giants`)

`GiantSpecies` (`giant_amoeba`, `giant_paramecium`, `giant_diatom`) and `GiantRole` (`hunter`,
`grazer`, `drifter`) are wire enums in `types/game.ts`; the records below are keyed by species.

| Constant                                  | Value                      | Unit                         | Reason (section)                                                                   |
| ----------------------------------------- | -------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| `GIANT_SPECIES_IN_DISH`                   | amoeba, paramecium, diatom | species, one seat each       | decision 2A and 3A (§3.5.9)                                                        |
| `GIANT_ROLE_BY_SPECIES`                   | hunter, grazer, drifter    | role                         | the mockup's roles; the role sets the decision rules and the diet (§3.5.6, §3.5.7) |
| `GIANT_BORN_MASS_MIN_BY_SPECIES`          | 900, 900, 1 000            | mass                         | the mockup's ranges (§3.5.3)                                                       |
| `GIANT_BORN_MASS_MAX_BY_SPECIES`          | 1 500, 1 300, 1 500        | mass                         | the mockup's ranges (§3.5.3)                                                       |
| `GIANT_MASS_CEILING`                      | 1 500                      | mass                         | a player outgrows every giant (§3.5.3)                                             |
| `GIANT_DECAY_MULTIPLIER`                  | 0.25                       | × the player's decay         | a meal lasts; the grazer's steady appetite stays near 4 % of the food (§3.5.3)     |
| `GIANT_BUILDS_BY_SPECIES`                 | the three builds of §3.5.4 | trait ids and tiers          | the form, the grip and the armour (§3.5.4)                                         |
| `GIANT_SPEED_MULTIPLIER_BY_SPECIES`       | 0.7, 0.85, 0.4             | × the traits' speed          | slow, fast, drifting (§3.5.5)                                                      |
| `GIANT_TURN_CHANCE_BY_SPECIES`            | 0.25, 0.1, 0.05            | per wander decision          | wander, sweep, drift (§3.5.5)                                                      |
| `GIANT_HUNT_MIN_PREY_MASS_FRACTION`       | 0.25                       | × the hunter's mass          | decision 1A (§3.5.6)                                                               |
| `GIANT_HUNT_GIVE_UP_SECONDS`              | 8                          | s                            | its sight crossed at its speed, plus a swallow (§3.5.6)                            |
| `GIANT_GRAZER_FORWARD_HALF_ANGLE_DEGREES` | 60                         | degrees either side of ahead | sweeps lanes, never doubles back (§3.5.7)                                          |
| `GIANT_GRAZER_APPETITE_MASS`              | 100                        | mass of growth               | bounds the first feed (§3.5.7)                                                     |
| `GIANT_DNA_BONUS`                         | 200                        | DNA                          | about one level when a player can first eat one (§3.5.8)                           |
| `GIANT_RESPAWN_SECONDS`                   | 90                         | s                            | a while gone, back within the round (§3.5.8)                                       |
| `GIANT_MIN_PLAYER_DISTANCE_WU`            | 1 500                      | wu                           | rarely born on screen (§3.5.9)                                                     |
| `GIANT_MIN_GIANT_DISTANCE_WU`             | 1 500                      | wu                           | the three spread over the dish (§3.5.9)                                            |
| `GIANT_MIN_CELL_DISTANCE_WU`              | 450                        | wu                           | never born on or within reach of a cell (§3.5.9)                                   |

Reused unchanged: `WILD_CELL_SIGHT_VIEW_MULTIPLE`, `WILD_CELL_FLEE_RANGE_RADII`, both sprint radii,
`WILD_CELL_HUNT_CHARGE_RADII`, `WILD_CELL_HUNT_REST_SECONDS`, `WILD_CELL_RECOVERY_SECONDS`,
`WILD_CELL_DECISION_INTERVAL_SECONDS`, the controls' sprint, and the trait tier tables. The client's
`GIANT_REAL_LIFE_LINES` and display names live beside `FORM_REAL_LIFE_LINES` (`hud/format/`), as the
form lines do. The balance test pins: every build a valid ladder ending in its form; every born
range inside `[CELL_STARTING_MASS, GIANT_MASS_CEILING]`; `GIANT_MASS_CEILING × (ENGULF_MASS_RATIO +`
the build's `membraneRatioBonus) < CELL_MAX_MASS`; every species multiplier ≤ 1; and the hunter's
`GIANT_BORN_MASS_MIN × GIANT_HUNT_MIN_PREY_MASS_FRACTION > ENTRY_MAX_MASS` (G14).

#### 3.5.15 Contract (what the build changes; the architect folds it into `architecture/entity-model.md` §2, `architecture/server-simulation.md` §3 and `architecture/constants-files-tests.md` §10)

- `CellView` gains `giantSpecies: GiantSpecies | null` (null for player and wild cells), and the
  mirrored `isCellEater: boolean` and `preyMinMassFraction: number` that `canEngulf` reads (§3.5.6).
  The kind stays `wild`, so every wild rule and every `isPlayerCell` test covers a giant without a new
  branch; the architect may prefer a third `CELL_KIND`, which costs a branch at every `kind` test.
- `CellAbsorbedEffect` gains `preyGiantSpecies: GiantSpecies | null`.
- A giant seat is a wild seat record plus `species` and `bornMass` (replacing `sizeFactor`; no
  `isStarving`), in its own list beside `world.wildSeats` so the die-off's sum and `WILD_CELL_COUNT`
  stay the wild seats'. The settle, strategy, hunt aim, give-up and respawn take a seat profile
  (size, ladder, rules, diet, timers) instead of reading the wild constants directly.
- `RANDOM_STREAM.giants` (label `giants`), hashed.
- Steps: step 1 settles and decides for the giant seats after the wild seats (seat order); step 4
  eats for the grazer while it is hungry and skips the hunter and the drifter (§3.5.7); step 9 respawns
  giant seats.
- Debug MCP: `debug_spawn(gameId, 'giant', x, y, { species, mass })` places (or replaces) that
  species' giant; `debug_get_entities` shows `giantSpecies` through the view.
- Scenario fixture: `placeGiant({ species, bornMass, grownMass = 0, at | eastOfFirstCellWu, heading? })`
  seats the species' cell at `bornMass + grownMass` with that growth, no target, velocity or sprint
  counters (as a respawn), and the heading given (default east). Placing anything vacates the giant
  seats too, as it does the wild seats (testing/scenario-runner.md §8.1).
- Cost: three more cells deciding once per 30 ticks; the grazer's cone test is one dot product per
  mote in sight.

#### 3.5.16 Open questions (the build follows the default until the human answers)

1. **Can a small cell bump into the giant amoeba safely?**
   **A (default, recommended): yes.** It ignores you completely until you are a quarter of its size:
   it doesn't chase you, can't swallow you even if you touch it, and you see no red ring. This is what
   the "Ignored" mockup shows.
   **B:** it never chases you while you're small, but touching it still gets you swallowed, and the red
   ring always shows near it.
   Why A: the ring then always tells the truth, and the mockup promised it.
2. **Does the giant diatom swim away when something can eat it?**
   **A (default, recommended): no.** It only drifts; its glass shell is its defence.
   **B:** it slowly swims away, like the other two giants.
   Why A: real diatoms can't swim, and at its slow speed running away would look odd and change
   nothing.
