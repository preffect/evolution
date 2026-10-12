# Evolution — Ecology, Growth and Absorption: giant cells

§3.5 of the split [`ECOLOGY.md`](../ECOLOGY.md), which keeps the shared context and the file list.

### 3.5 Giant cells

Three giant cells share the dish from the first second of every round: a giant amoeba that hunts, a
paramecium that grazes and a giant diatom that drifts. They are about 50 times a newborn's mass and
about a third of a player's top size. While you are small the amoeba does not bother with you: it
swims past you to a wild cell worth the effort, though bumping into it still gets you swallowed. The
paramecium and the diatom never eat a cell. Once you weigh a quarter of the amoeba it starts to hunt
you, but it is slow, so you can swim away, and if it grabs you, sprint at once. Grow past them and the
roles turn: all three run from you like any wild cell, and swallowing one pays a big DNA prize and
shows a real-life fact about the organism. An eaten giant comes back a minute and a half later.

The human's decision (ticket #821): **1A**, giants hunt you only once you are big enough to be worth
it (a quarter of their mass, up to what they can swallow); **2A**, all three; **3A**, in the dish from
the start of the round. Epic #757; the mockups are the design canvas
<https://claude.ai/artifact/V3CruikuDsEYHhMnch6Q6z> (the cast board, "Ignored", "Hunted" and "It runs").
The human's answers to this section's two open questions (2026-10-11, PR #823) are recorded in §3.5.16:
the amoeba swallows a small cell that touches it but never chases one, and the diatom swims and flees.

#### 3.5.1 The cast

| Giant (`GiantSpecies`)          | Role    | Born mass (uniform) | Cruise speed       | Eats                                       | Hunts                                       | Flees and sprints |
| ------------------------------- | ------- | ------------------- | ------------------ | ------------------------------------------ | ------------------------------------------- | ----------------- |
| Giant amoeba (`giant_amoeba`)   | hunter  | 900–1 500           | 154 wu/s (slow)    | cells only (any it touches and can engulf) | cells from ¼ of its mass to what it engulfs | yes               |
| Paramecium (`giant_paramecium`) | grazer  | 900–1 300           | 226 wu/s (fast)    | algae, detritus and bacteria, ahead        | never                                       | yes               |
| Giant diatom (`giant_diatom`)   | drifter | 1 000–1 500         | 122 wu/s (slowest) | nothing: it lives on light                 | never                                       | yes               |

Speeds are cruise speeds with no gel; a player cell with no speed trait cruises at 220 wu/s. So the
amoeba is the giant you can always outswim, the paramecium the one you need speed or a corner to
catch, and the diatom the one that runs but can never outrun you (even its sprint is under 220) and is
the hardest to swallow (§3.5.4). The three prizes ask for three different skills: size, speed and
persistence.

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
  carried, taken only when it can land (`wild/wild-hunt-sprint.ts`). All three sprint; the drifter only to
  flee, since it never hunts.
- **Fleeing** (§3.3.3): from any cell in sight that can engulf it, within `WILD_CELL_FLEE_RANGE_RADII`
  own radii, sprinting within `WILD_CELL_SPRINT_FLEE_RADII`, and the engulf-escape rule. All three
  flee, the drifter included (§3.5.5, the human's answer 2).
- **Recovery** (§3.3.1): a wound recovers toward the full size with `WILD_CELL_RECOVERY_SECONDS` (6 s),
  so the Toxin Vacuole escape works on a giant hunter as on a wild one.
- **The hunt's aim, charge, hold and rest** (ticket #738): `WILD_CELL_HUNT_CHARGE_RADII`, the hold and
  `WILD_CELL_HUNT_REST_SECONDS` (15 s) unchanged; the closer-rival rule unchanged (ticket #737).
- **Decisions** every `WILD_CELL_DECISION_INTERVAL_SECONDS`, staggered by seat number (§3.5.9).

**Different:**

| What               | A wild cell (§3.3)                                         | A giant (this section)                                                                        |
| ------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Size               | `worldMass × sizeFactor`, grows with the world             | a born mass drawn once per life, never moves with the world (§3.5.3)                          |
| Growth ceiling     | 3 × `worldMass`                                            | `GIANT_MASS_CEILING`, 1 500 mass, fixed                                                       |
| Decay of growth    | the player's decay                                         | the player's decay × `GIANT_DECAY_MULTIPLIER` (0.25)                                          |
| Ladder             | the world's (`WILD_CELL_BUILDS`, level follows worldLevel) | a fixed build per species at fixed tiers; level = picks + 1: amoeba 7, the others 6 (§3.5.4)  |
| Who it may engulf  | any cell `canEngulf` allows                                | the hunter: any cell `canEngulf` allows, as a wild cell; grazer and drifter: no cell (§3.5.6) |
| Whom it hunts      | any cell it may engulf                                     | the hunter: only cells of at least ¼ its mass (the hunt window, §3.5.6); the others: none     |
| Players as prey    | hunted from `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE` (6:00)    | hunted from tick 0, gated by mass alone (decision 1A)                                         |
| Hunt give-up       | `WILD_CELL_HUNT_GIVE_UP_SECONDS` (5 s)                     | `GIANT_HUNT_GIVE_UP_SECONDS` (8 s): it is slow (§3.5.6)                                       |
| Food               | algae and detritus                                         | hunter none; grazer algae, detritus and bacteria, ahead of it, while hungry; drifter none     |
| Speed              | its traits                                                 | its traits × `GIANT_SPEED_MULTIPLIER_BY_SPECIES`                                              |
| Wander turn chance | `WILD_CELL_TURN_CHANCE` (0.25)                             | `GIANT_TURN_CHANCE_BY_SPECIES`                                                                |
| Die-off            | counts toward the carrying capacity, may starve            | outside it: never counted, never starves (§3.5.10)                                            |
| Eaten by a player  | `ENGULF_DNA_SHARE × worldDna`                              | `GIANT_DNA_BONUS` (200) and the fact popup (§3.5.8)                                           |
| Respawn            | `WILD_CELL_RESPAWN_SECONDS` (10 s)                         | `GIANT_RESPAWN_SECONDS` (90 s), well away from every player (§3.5.9)                          |

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
in its form, owned at the tiers below for its whole life. Its level is derived from the build, as a
wild cell's is (`wild-build.ts`: a cell at level L owns L − 1 picks, and each tier is a pick): picks + 1,
so the amoeba is level 7 (Amoeba Pseudopods II is two picks) and the paramecium and the diatom level 6.
No constant names a giant's level, so it cannot drift from the build. Its stage is `stageOf(traits)` =
`specialised`. The renderer draws its form from these traits like anyone's (§3.5.11).

| Species            | Build (tier)                                                                                        | What the tiers do for it                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `giant_amoeba`     | `nucleoid` I, `mitochondrion` I, `nuclear_envelope` I, `cytoskeleton` I, `amoeba_pseudopods` **II** | The grip, below. The arm grab reaches 0.6175 own radii (96 wu at 1 500).                                                                                                     |
| `giant_paramecium` | `nucleoid` I, `mitochondrion` I, `nuclear_envelope` I, `cilia` I, `paramecium_cilia` I              | Cilia I × Paramecium Cilia I = 1.21 speed, with the struggle and grip resistance of a ciliate, so a held paramecium slips a weak grip.                                       |
| `giant_diatom`     | `nucleoid` I, `chloroplast` I, `nuclear_envelope` I, `cell_wall` I, `diatom_shell` I                | The armour, below. Its Chloroplast photosynthesises in the shallows (0.3 mass/s), less than its growth burns (0.44 mass/s at 1 000), so it never grows: light pays its keep. |

**The amoeba's grip, under ticket #819's kept grab.** A started grab holds, and seals, while any of the
prey is under the amoeba (centres within `R + r`), except while the prey's sprint runs, when the start's
bound applies to both (centres within `R − 0.5 r`, absorption.md §6.1). Pseudopods II's grip (0.2) holds a
plain prey at 0.85 − 0.2 = 0.65 of its speed in cover and 0.6 in wrap. So:

- **Swimming does not get you out.** A cruising prey is held at 0.65 × 220 = 143 wu/s, under the amoeba's
  154, and to break the kept grab it would have to open the 1.5 r between the two bounds (104 wu for a
  300-mass prey) against a faster cell. A grabbed cell that only swims is sealed where it is held, and
  swallowed (G15's no-sprint variant).
- **A sprint at once gets you out.** Sprinting, it is held at 0.65 × 396 = 257 wu/s, 103 wu/s faster than the
  amoeba, and the start's bound applies. A prey grabbed near the amoeba's rim leaves that bound within its
  0.5 s sprint, and its progress, which climbs only 1/72 a tick in cover while it struggles (a prey of
  40 % of the amoeba's mass or less, `massFactor` 0.5), drains at 1/18 a tick out of contact, so it is
  released `escaped` before the sprint ends (G15).
- **A late sprint fails.** A prey the amoeba has got on top of cannot cross the start's bound in one sprint
  (from rest it covers about 76 wu in the 30 ticks at 257 wu/s), and when the sprint ends the kept grab
  holds it again; the next sprint is 3 s away, and a prey of 40 % of the amoeba's mass or less struggling
  all the way is sealed 30 ticks (0.5 s) after the grab. So the lesson the amoeba teaches is the mockup's
  "it is slow, so sprint away", sharpened to _sprint the moment it grabs you_ (G15's deep variant).
- **Tier II, not I.** Under the kept grab any grip holds a cruising prey, so the tier sets only how hard the
  sprint escape is. Pseudopods I (0.1) would let a sprinting prey go at 0.75 × 396 = 297 wu/s, nearly twice
  the amoeba's speed, and the escape would be a formality; II keeps it a reaction. II also wraps faster
  (× 0.75), and a giant's arms should hold harder than a player's first pick.

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
| `giant_diatom`     | 0.9215        | 0.6                | 121.6         | 218.9 (no mitochondrion)            | 0.05                            |

- **Amoeba 0.7.** Slow enough that any cell outswims it at cruise (220 against 154), so being hunted
  is a warning, not a death sentence; fast enough that its sprint (292.6 for 0.5 s) closes 36 wu on a
  cruising prey, so a cell that ignores it gets grabbed, and a grabbed cell must sprint (§3.5.4). Real
  amoebae crawl.
- **Paramecium 0.85.** Its ciliate traits alone (1.21, 266 wu/s) would outrun every cell without a
  speed trait for good. At 0.85 it cruises at 226: faster than a plain cell (220), slower than a cell
  with any speed trait (Simple Flagellum I 231, Cilia I 242). So it is the fast giant, and catching it is
  the prize of a speed build, a wall or a gel patch.
- **Diatom 0.6** (the human's answer 2: _"we'll need to break from reality a bit. Not moving won't be
  fun"_). It swims at 122 wu/s, the slowest giant, and sprints at 218.9 wu/s (Cell Wall I and Diatom
  Shell I cost it speed, and it has no Mitochondrion): just under a plain cell's 220 cruise, so a cell
  that can eat it never loses ground on it, even while it sprints. It runs, which reads as alive, but its
  shell stays its defence: the chase is easy, the swallow is not (§3.5.4). Real diatoms have no
  flagella; some glide on a film of mucus.
- **Turn chances.** The amoeba wanders like a wild cell (`WILD_CELL_TURN_CHANCE` 0.25, a new heading
  about every 2 s). The paramecium keeps a heading about 5 s (0.1), so it sweeps long lanes. The
  diatom keeps one about 10 s (0.05): a slow, straight drift. The wander's wall rule (§3.3.3) keeps all
  three inside the placement disc.
- **The drifter flees and sprints like the others** (§3.3.3's flee rule, the human's answer 2). Its
  decision is flee, then wander: it never hunts and never grazes.
- Every species multiplier is at most 1, so `interestMaxCellSpeedFor` (the interest margin's bound,
  `camera/interest-margin.ts`) still bounds every cell and needs no change.

#### 3.5.6 Who eats cells, and the hunt window (decision 1A, the human's answer 1)

Two rules, kept apart:

- **Who may engulf a cell** is `canEngulf`, the one shared predicate (absorption.md §6.1). It stays today's
  mass-ratio rule for every cell, the amoeba included, plus one predator-side test: the grazer and the
  drifter engulf no cell.
- **Whom the amoeba hunts** is a seat-side rule of its decision, the **hunt window**: it picks as a hunt
  target only a cell it may engulf whose mass is at least `GIANT_HUNT_MIN_PREY_MASS_FRACTION` (0.25) × its
  own. The window gates the chase, never the swallow.

```
canEngulf(predator, prey)     = isCellEaterSpecies(predator.giantSpecies)
                                ∧ predator.mass ≥ prey.mass × (ENGULF_MASS_RATIO + prey.membraneRatioBonus)
isCellEaterSpecies(species)   = species = null ∨ GIANT_ROLE_BY_SPECIES[species] = hunter
isGiantHuntTarget(seat, prey) = canEngulf(giant, prey) ∧ prey.mass ≥ GIANT_HUNT_MIN_PREY_MASS_FRACTION × giant.mass
```

`isCellEaterSpecies` is true for every player and wild cell (`giantSpecies` null), so `canEngulf` is
unchanged for them. It reads only `giantSpecies`, which the view carries for the renderer anyway
(§3.5.15), and `GIANT_ROLE_BY_SPECIES`, a fixed constant rather than a balance leaf (a role is what a
species is, and no patch changes it), so the predicate gains no balance input and no mirrored view field.
`canContinueEngulf` is unchanged. The window lives in the giant seat's profile (`hunt.minPreyMassFraction`:
0.25 for the hunter, 0 for a wild seat, §3.5.15), read only by the hunt's candidate filter at a decision.

What follows:

- **Not chased, but not safe to touch.** A cell under a quarter of the amoeba's mass is never its hunt
  target: on a decision the amoeba swims past it to prey worth the effort, or wanders. But a cell it can
  engulf that touches it, or that its arm reaches while the cell is not steering away, is swallowed by §6
  as any prey (G4). The danger ring and the threat label follow `canEngulf`, as they do for every cell, so
  a small cell near the amoeba sees its red ring and its name from the first second: the truth, since a
  bump swallows it. The mockup's "Ignored" frame is the chase, not the ring.
- **The paramecium and the diatom never eat a cell.** No engulf ever starts with either as predator, no
  cell sees a ring or a threat label for them, and no wild cell flees them (`wild-perception.ts` reads
  `canEngulf`). They push a small cell aside by separation instead (§5.3): QA should expect a crowd of
  small cells to be bulldozed by a passing paramecium or diatom, and by an amoeba crossing cells too big
  for it to swallow; nothing steers a giant around them, and that is not a bug.
- **Players hunted from tick 0, by mass alone.** `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE` does not apply to a
  giant: decision 1A puts the gate on the prey's mass, not on the era. In practice the two agree in feel:
  the lightest amoeba's window opens at 225 mass, which a player at the world's pace reaches around 3:25
  (`worldMass` = 20 + _t_), and the window rises with the amoeba (375 at 1 500).
- **A fresh cell is never hunted.** `GIANT_BORN_MASS_MIN_BY_SPECIES[giant_amoeba]` ×
  `GIANT_HUNT_MIN_PREY_MASS_FRACTION` (225) > `ENTRY_MAX_MASS` (200, PROGRESSION §5), so a late joiner or
  a respawn is never born inside a giant's window (the balance test pins it, G14), and the spawn's threat
  clearance (`threatClearance`, mass-based) keeps it 600 wu from any giant, so it is not born touching one.
- **Wild cells see it too.** Their flee and closer-rival rules read `canEngulf`, so a wild cell flees the
  amoeba as it flees any cell that can engulf it, and none flees the grazer or the drifter. The amoeba
  hunts wild cells and players alike inside its window, and the other giants when they fall inside it
  (a 1 500 amoeba can start on a paramecium of up to 1 200, as real amoebae eat paramecia, though at
  154 wu/s it rarely catches one). A wild cell grown past 1.25 × a giant may eat it, as any cell may. Accepted: the closer-rival
  rule reads `canEngulf`, not the amoeba's hunt filter, so a wild hunter gives up a small cell when the
  amoeba is nearer to it, though the amoeba will never chase that cell.
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

- **Bacteria too.** It targets and eats algae and detritus (a wild cell's food) **and bacteria**,
  never DNA fragments. Real paramecia live on bacteria. So the giant competes for a
  little of the players' DNA food, which is its role in the mockup: "it steals your food rather than
  you". A bacterium it eats is mass only (3), as a wild meal is; it credits nothing.
- **Ahead of it.** The target is the nearest such mote in sight whose bearing lies within
  `GIANT_GRAZER_FORWARD_HALF_ANGLE_DEGREES` (60°) of its forward direction; only when none does, the
  nearest in sight; ties to the lower entity id. Forward is its velocity's direction, or its seat's
  wander heading while it is at rest, which means a velocity of exactly (0, 0), as a placement or a
  respawn leaves it (the test is exact, with no threshold). A 120° cone keeps most food it swims to ahead of it, and it never
  doubles back for a mote behind while one lies ahead: it sweeps lanes, which reads as a paramecium
  sweeping food into its groove and lets a player predict it.
- **Only while hungry.** It targets and eats food (step 4, by §1's eating rule, every mote whose centre
  lies within its radius) only while its `grownMass` is below `GIANT_GRAZER_APPETITE_MASS` (100). A
  sated paramecium passes over food: step 4 skips it, and its decision skips the graze and wanders
  (G5's and G6's sated variants). The eating test is made once per tick before step 4, so the last hungry
  tick's meal is eaten whole, however far it carries the growth past the appetite: a mote or two in open water,
  but tens of motes on a death pile (seen live in ticket #827's review: a paramecium sweeping a removed cell's detritus stopped
  at a growth of about 147, 47 over its appetite, the last tick's meal alone about 25). The test reads the growth after the tick's settle, which has taken the tick's decay:
  a grazer at exactly 100 is hungry again one tick later, so its steady state eats what its growth burns. Why 100: it bounds the first feed to about 50 to 70 motes (more on a death pile), after which
  it eats only what its growth burns (0.50 mass/s, §3.5.3), so over a default round it eats about 400
  mass in all, about 5 % of what the dish spawns for one player.

The hunter eats no motes at all (step 4 skips it): it is a hunter, and a 1 500-mass body sweeping the
dish would take more food than the grazer. The drifter eats nothing. Step 4 reads each cell's diet
(`simulation/cell-diet.ts`; before ticket #827 it fed every non-player cell the algae and detritus it covered), so
G5 pins them: a mote inside the amoeba or the diatom is still there after the tick.

#### 3.5.8 Being eaten: the payout, the fact and the respawn

A giant is eaten by §6's rules, so it bleeds, struggles, spits out (the diatom) and is carried as any
prey. At the payout:

- **Player eats a giant** (§3.3.4's "player eats wild", with these substitutions): DNA +=
  `GIANT_DNA_BONUS` (200) and no `ENGULF_DNA_SHARE × worldDna`, no `ENGULF_DNA_BASE`, paid through
  `gainDna(…, predator.modifiers.dnaGainMultiplier)` like every other DNA gain (`engulf-payout.ts`), so a
  Nucleoid I eater gets 210 and a Nucleoid III eater 230 (G9's variant); mass +=
  `prey.mass × ENGULF_MASS_YIELD` as usual (cap overflow to DNA, §5.4); tag points += `predatory` ×
  `ENGULF_PREDATORY_TAG_POINTS`; `wildAbsorptions` += 1 and `absorptions` unchanged (no
  `SCORE_ABSORPTION_BONUS`); its endosymbiont credits the eater's counter as a wild prey's does;
  detritus as usual. The DNA counts toward the score as any earned DNA does.
- **The fact.** The `cell_absorbed` effect carries `preyGiantSpecies`. When the own cell is the
  predator and it is not null, the client shows ticket #783's form popup (ui/overlays.md §3.8: large,
  centred, about 5 s) with the giant's name, the DNA gained (`+200 DNA` with no Nucleoid) and its real-life
  line (§3.5.12). A giant eaten
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
  numbered after the wild seats by the species' place in the fixed `GiantSpecies` order (amoeba,
  paramecium, diatom), `WILD_CELL_COUNT` + _i_ (24, 25, 26), not by its place in
  `GIANT_SPECIES_IN_DISH`, so a giant seated by `debug_spawn` or the test fixture has the same seat
  whether or not the list names it (a test balance may empty it; the default names all three since slice 6). The count is the one the world was
  created with (`world.firstGiantSeatNumber`), so a mid-round patch of `WILD_CELL_COUNT` never
  renumbers a giant seat. The decision stagger
  (§3.3.3: seat _n_ decides on ticks ≡ _n_ mod 30) and the stable ordering need no new rule.
  `GIANT_SPECIES_IN_DISH` is read once, at world creation, so the seat count never changes during a
  round; a `debug_set_balance` patch of it takes effect at the next round or rematch.
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
    (1 192.9 + 154.9 = 1 348) rounded up. That keeps a giant off a newborn's and a mid-round player's
    screen, and off any screen's top and bottom. A top-size player's screen is wider (at least 16:9, and
    the interest area 2.4:1, `INTEREST_VIEW_ASPECT_RATIO`: a half-width of about 2 120 to 2 860 wu, most
    of the 2 700 wu placement disc), so a giant can be born at the side of a big player's screen. That is
    accepted: with several players the farthest-candidate fallback often decides anyway, and for a player
    big enough to see that far a giant appearing at the edge is a prize, not an ambush.
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

- **A palette per species, new art** (the mockup's): the amoeba violet (`#77729a` to `#25263d`), the
  paramecium sea-green (`#5f9a86` to `#1a3330`), the diatom glass grey (`#c9d4de` to `#3c4856`, rim
  `#e6ecf2`) with golden-brown chloroplasts (`#c88a2a`), and no seat-mark beads. Without it a giant reads
  as a big wild cell. Fixed against the palette rules by #828 (visual-style/cells-and-organelles.md
  §4.1): the amoeba's and the paramecium's rims are desaturated to `#d4d2e5` and `#cfe9e0`, since the
  mockup's `#cfc8ff` and `#b8f6e0` were the Violet and Mint player rims within ΔE 3, and a rim colours the
  arms and the fringe.
- **New detail only where the form lacks it at giant size** (#828 checked each form at radius 120 to 155
  wu, visual-style/cells-and-organelles.md §4.1): the paramecium's oral groove (the mockup's curved line),
  its two star-shaped contractile vacuoles and its fringe of fine cilia hairs in place of a player's tufts,
  the amoeba's contractile vacuole and two digestive vacuoles, the diatom's concentric rings of pores (its
  radial ribs were already drawn) and its plastids drawn golden brown.
- **The diatom keeps its trait tells.** Its 8 spines and its cyan cell-wall band are not in the mockup's
  plain disc, but they are what a player diatom shows for the same two rules: the spines spit a predator
  out, and the wall means a predator needs 1.40 × its mass (the armour paragraph above). A giant drawn
  without them would hide the rule that makes it the hardest of the three to swallow.
- **Names, one home.** `cellDisplayName` (`hud/format/threats-for.ts`) returns a giant's display name
  from `GIANT_DISPLAY_NAME_BY_SPECIES` (`Giant amoeba`, `Paramecium`, `Giant diatom`, beside
  `GIANT_REAL_LIFE_LINES`) where it returns `Wild cell` for a wild cell, so the threat label and the
  hold-Tab panel name it. `respawn-lines.ts` drops its own `WILD_KILLER` constant and builds the killer
  from `cellDisplayName` too (`A ` + the name, upper-cased: `ENGULFED BY A WILD CELL` as today,
  `ENGULFED BY A GIANT AMOEBA` for the amoeba; ui/overlays.md §3.3). The paramecium and the diatom never
  get a threat label (they eat no cell); a diatom a player can eat gets `EDIBLE · SPINY`.
- **No new HUD state.** The mockup's `TOO SMALL TO NOTICE` and `HUNTING · MASS 420` pills are
  annotations of the idea, not UI: the existing rings say who can eat whom (the amoeba's red ring for
  any cell it can swallow, none for the paramecium and the diatom, the green ring when edible). Whether
  the amoeba is chasing you is read from its movement, as a wild hunter's is. The hold-Tab panel's
  `Eats you ≥ X` row (`hud/format/affecting-size.ts`, ui/overlays.md §3.7) stays as it is: it is
  `ENGULF_MASS_RATIO` × your mass, which is true for the amoeba (it swallows any cell it touches and can
  engulf). It overstates for the paramecium and the diatom, which eat no cell; that is accepted, since
  the row is a mass threshold and the ring and label on each cell are the per-cell truth.

#### 3.5.12 Real-life lines

Short, true and in the form popup's style (no full stop, ui/overlays.md §3.8). Each is different from
its form's own line (`hud/format/form-facts.ts`), so a player who has seen the form popup learns
something new.

| Species            | Line                                                            | Checked against                                                                                                |
| ------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `giant_amoeba`     | `Real giant amoebae can grow almost a millimetre across`        | _Amoeba proteus_ 0.25 to 0.75 mm; _Chaos carolinense_ larger (Wikipedia "Amoeba"; MicrobeWiki, Kenyon College) |
| `giant_paramecium` | `Real paramecia sweep food into a groove that works as a mouth` | the oral groove and cytostome (Wikipedia "Paramecium")                                                         |
| `giant_diatom`     | `Real diatoms make at least a fifth of Earth's oxygen`          | estimates of 20 % to 50 % of the oxygen produced each year (Wikipedia "Diatom")                                |

**Real sizes** (`GIANT_REAL_SIZES`, the encyclopedia's real-life note, ui/encyclopedia.md §11.4), in words, since
encyclopedia copy types no digit, each beside a thing the reader can picture:

| Species            | Real size                                                                 | Checked against                                                                                       |
| ------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `giant_amoeba`     | `About half a millimetre long, hundreds of times longer than a bacterium` | _Amoeba proteus_ about 0.2 to 0.75 mm; a bacterium 1 to 2 µm (Wikipedia "Amoeba proteus", "Bacteria") |
| `giant_paramecium` | `About a quarter of a millimetre long, like a grain of fine sand`         | _Paramecium caudatum_ 0.17 to 0.33 mm; fine sand 0.125 to 0.25 mm (Wikipedia "Paramecium", "Sand")    |
| `giant_diatom`     | `Up to half a millimetre across, as big as a grain of sand`               | _Coscinodiscus_ up to about 0.5 mm across; sand 0.0625 to 2 mm (Wikipedia "Coscinodiscus", "Sand")    |

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
`grazer`, `drifter`) are wire enums in `types/game.ts`; the records below are keyed by species. Every
row is a balance leaf of the `giants` domain except `GIANT_ROLE_BY_SPECIES`, a plain constant in the same
file: a role is what a species is, `canEngulf` reads it (§3.5.6), and no patch may change it. The ledger's rows
are the `giants.ts` table of [`constants.md` §7](./constants.md); `GIANT_SPECIES_IN_DISH` names all three
species since the giants-on slice (§3.5.17).

| Constant                                  | Value                      | Unit                         | Reason (section)                                                                   |
| ----------------------------------------- | -------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| `GIANT_SPECIES_IN_DISH`                   | amoeba, paramecium, diatom | species, one seat each       | decision 2A and 3A; read at world creation only (§3.5.9)                           |
| `GIANT_ROLE_BY_SPECIES`                   | hunter, grazer, drifter    | role (not a balance leaf)    | the mockup's roles; the role sets the decision rules and the diet (§3.5.6, §3.5.7) |
| `GIANT_BORN_MASS_MIN_BY_SPECIES`          | 900, 900, 1 000            | mass                         | the mockup's ranges (§3.5.3)                                                       |
| `GIANT_BORN_MASS_MAX_BY_SPECIES`          | 1 500, 1 300, 1 500        | mass                         | the mockup's ranges (§3.5.3)                                                       |
| `GIANT_MASS_CEILING`                      | 1 500                      | mass                         | a player outgrows every giant (§3.5.3)                                             |
| `GIANT_DECAY_MULTIPLIER`                  | 0.25                       | × the player's decay         | a meal lasts; the grazer's steady appetite stays near 4 % of the food (§3.5.3)     |
| `GIANT_BUILDS_BY_SPECIES`                 | the three builds of §3.5.4 | trait ids and tiers          | the form, the grip and the armour (§3.5.4)                                         |
| `GIANT_SPEED_MULTIPLIER_BY_SPECIES`       | 0.7, 0.85, 0.6             | × the traits' speed          | slow, fast, slowest; the diatom's sprint stays under 220 (§3.5.5)                  |
| `GIANT_TURN_CHANCE_BY_SPECIES`            | 0.25, 0.1, 0.05            | per wander decision          | wander, sweep, drift (§3.5.5)                                                      |
| `GIANT_HUNT_MIN_PREY_MASS_FRACTION`       | 0.25                       | × the hunter's mass          | decision 1A: gates the hunt target, never the swallow (§3.5.6)                     |
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
`GIANT_REAL_LIFE_LINES`, `GIANT_DISPLAY_NAME_BY_SPECIES` and `GIANT_REAL_SIZES` live in the neutral
`game/giants/giant-facts.ts`, since the HUD and the encyclopedia both read them and the encyclopedia never imports
`hud/` (ticket #831). The balance test (`constants/giants.test.ts`) pins: every build a valid
ladder ending in its form; every born range inside `[CELL_STARTING_MASS, GIANT_MASS_CEILING]`; `GIANT_MASS_CEILING ×
(ENGULF_MASS_RATIO +` the build's `membraneRatioBonus) < CELL_MAX_MASS`; every species multiplier ≤ 1; and
the hunter's `GIANT_BORN_MASS_MIN × GIANT_HUNT_MIN_PREY_MASS_FRACTION > ENTRY_MAX_MASS` (G14).

`debug_set_balance` refuses a patch whose result breaks one of those, as the wild builds refuse a wrap
past the top tier (#671, `isPastTopTraitTier`), whichever domain it names (`traits.TRAIT_TIER_COUNT` under the
amoeba's Pseudopods II, `growth.CELL_STARTING_MASS` over a born minimum): a build that is not a valid ladder ending
in a form, a born minimum above its maximum, a born range outside `[CELL_STARTING_MASS, GIANT_MASS_CEILING]`, and a
speed multiplier above 1 (which would break `interestMaxCellSpeedFor`'s bound, which G14 checks only on
`DEFAULT_BALANCE`). The rules have one home, `giantBalanceProblems` (`shared/simulation/giant-balance.ts`), which the
balance test and the refusal both call. `GIANT_SPECIES_IN_DISH` and `GIANT_BUILDS_BY_SPECIES` are arrays, so
structure a patch cannot name (`debug_set_balance` writes number leaves only, as for `WILD_CELL_BUILDS`): a test or
fixture balance sets the species list, read at world creation (§3.5.9), and the giants-on slice set it in
`DEFAULT_BALANCE`; a seeded-world unit test about something else runs on `NO_GIANTS_BALANCE`
(`server/src/testing/world-builders.ts`), which empties it.

#### 3.5.15 Contract (what the build changes; the architect folds it into `architecture/entity-model.md` §2, `architecture/server-simulation.md` §3, `architecture/constants-files-tests.md` §10 and `architecture/wire-contract.md` §4.1)

- **The kind stays `wild`, with `giantSpecies` as the discriminator** (the architect's ruling on PR #823).
  Every wild rule and every `isPlayerCell` / `kind` test covers a giant without a new branch. The sites
  that read `giantSpecies` are `canEngulf` (§3.5.6), the diet (`simulation/cell-diet.ts`), the payout,
  `cellDisplayName` and the respawn lines, the palette, and the encyclopedia's cell-kind entries.
- **`CellView` gains one field, `giantSpecies: GiantSpecies | null`** (null for player and wild cells).
  The hunt window is a seat rule (§3.5.6), so no hunt field is mirrored on the view. Wire cost: cells
  are not culled and every field is plain JSON (`serialize.ts` `toCellView`), so the field costs about
  20 B a cell, about 0.7 KB a snapshot with 8 players, 24 wild cells and the 3 giants, plus the three
  giant cells themselves; slice 1 updates wire-contract.md §4.1's cells rows (3 more cells, the per-cell
  bytes). **State hash:** `giantSpecies` is in `CELL_HASHED_FIELDS`; nothing is mirrored, so nothing is
  added to `DERIVED_FIELDS`.
- **`canEngulf` widens its predator** from `Pick<CellView, 'mass'>` to `Pick<CellView, 'mass' |
'giantSpecies'>` (`canContinueEngulf` and the hold keep the mass-only `EngulfHoldPredator`). It has about 12
  call sites, not three: the "three callers" comment in `engulf-eligibility.ts` and absorption.md §6.1's "Three
  callers" sentence were corrected with it (ticket #825). The sites that changed:
  - `wild/wild-hunt-sprint.ts` builds a synthetic predator `{ mass: massAfterHuntSprint(…) }`; it becomes
    `{ ...hunter, mass }`, or a giant hunter's sprint test loses its species.
  - `testing/bot-builders.ts` keeps a hand-rolled copy of the predicate, which would silently ignore the
    species; it is replaced by the shared call.
  - `bots/perception.ts` (`EngulfPredatorView`, `BotCellView`) and
    `testing/scenarios/trait-engulf-setups.ts` gain the field.
  - Every `CellView` literal gains it: `serialize.ts`, `world/cell-record.ts`, the shared and client
    `testing/builders.ts`, `bench-scene.ts`, `preview-frame.ts` and `toy-adapter.ts`; every `cell_absorbed`
    literal gains `preyGiantSpecies` (`session/death.ts` from the prey, the client's bench and engulf preview
    scenes, the test builders).

  The other callers pick the rule up unchanged, which is the point of one home: `contact.ts`, `engulf.ts`
  (the body start and the arm grab's start, through `canStartEngulf`), `wild-perception.ts` (flee, hunt,
  closer rival), `bots/evolution-binding.ts` (the bots' perception and the strategies that ask it),
  `relations-for.ts`, `threats-for.ts`, `cell-instance-builder.ts`, `snapshot-transitions.ts` and `escape-scene.ts`.

- `CellAbsorbedEffect` gains `preyGiantSpecies: GiantSpecies | null`.
- **Seat records.** A shared base type, `SeatMindRecord`, holds what every seat's mind reads: `seatNumber`,
  `cellId`, the growth and full mass, `respawnInTicks`, the heading, `decideInTicks`, and the four hunt
  fields (`huntPreyId`, `huntStartTick`, `givenUpPreyId`, `huntRestUntilTick`). `WildSeatRecord` extends
  it with `sizeFactor` and `isStarving`; `GiantSeatRecord` with `species` and `bornMass`. Giant seats live
  in their own list beside `world.wildSeats`, so the die-off's sum and `WILD_CELL_COUNT` stay the wild
  seats'. `isHuntStale`, `giveUpStaleHunt`, `latchHunt`, `aimWildHunt` and the wander take the base type.
- **The seat profile** (`wild/seat-profile.ts`, ticket #827). The settle, strategy, give-up, wander and respawn read a
  profile instead of the wild constants: the growth ceiling (3 × `worldMass`, or `GIANT_MASS_CEILING`), the decision
  rules (the role's order: hunter flee, hunt, wander; grazer flee, graze, wander; drifter flee, wander), the diet
  (`simulation/cell-diet.ts`, which step 4 reads too), the give-up and rest seconds, the hunt window's
  `hunt.minPreyMassFraction` (0 for a wild seat), the stage players become prey from (a giant's: tick 0), the turn
  chance, the random stream (`wildCells`, or `giants`), and the respawn's countdown and what a vacated seat forgets
  (ticket #826's per-kind respawn policy, folded in). The base size (`sizeFactor` × `worldMass`, or the born mass) and
  the ladder (the world's, or the fixed build through `applyGiantBuild`) stay with each kind's settle
  (`wild-settle.ts`, `giant-settle.ts`), since each reads its own seat's fields.
- **The species speed multiplier has one home.** `applyWorldLadder` → `refreshCellDerivedStateFromTraits`
  refolds the modifiers every tick, so a giant's ladder step is one function that refreshes from traits
  and then applies `GIANT_SPEED_MULTIPLIER_BY_SPECIES` to the folded `speedMultiplier`, and every refresh
  of a giant goes through it. A refresh that skipped it would drop the multiplier without an error; a
  unit test refreshes a giant twice and checks G8's speeds.
- **`RANDOM_STREAM.giants`** (label `giants`), hashed, lands with its first consumer (slice 2), not in
  slice 1: `hashRandomStreams` walks every stream, so adding it moves every world's state hash. Forking is
  by label (`stream-forking.ts`), so no other stream's draws shift.
- Steps: step 1 settles and decides for the giant seats after the wild seats (seat order); step 4
  eats for the grazer while it is hungry and skips the hunter and the drifter (§3.5.7); step 9 respawns
  giant seats.
- Debug MCP (architecture/debug-mcp.md §8): `debug_spawn(gameId, 'giant', x, y, { species, mass })` places
  (or replaces) that species' giant, whether or not `GIANT_SPECIES_IN_DISH` seats it, at a born `mass` in
  [`CELL_STARTING_MASS`, `GIANT_MASS_CEILING`] (refused outside it); the seat respawns its giant until the
  rematch, list or not. `debug_get_entities` shows `giantSpecies` through the view.
- Scenario fixture: `placeGiant({ species, bornMass, grownMass = 0, at | eastOfFirstCellWu, heading? })`
  seats the species' cell at `bornMass + grownMass` with that growth, no target, velocity (exactly
  (0, 0)) or sprint counters (as a respawn), and the heading given (default east). Placing anything
  vacates the giant seats too, as it does the wild seats (testing/scenario-runner.md §8.1).
- Cost: three more cells deciding once per 30 ticks; the grazer's cone test is one dot product per
  mote in sight.

#### 3.5.16 Decided: the human's answers (2026-10-11, recorded on PR #823)

1. **Can a small cell bump into the giant amoeba safely? No (B, adjusted).** The amoeba does not chase a
   cell under a quarter of its mass, but one that touches it is swallowed. The hunt window gates the
   chase, not the swallow; `canEngulf` keeps today's ratio rule for the amoeba, and the danger ring and
   the threat label follow `canEngulf` as they do today (§3.5.6).
2. **Does the giant diatom swim away when something can eat it? Yes (B).** _"The player will play an
   amoeba so we'll need to break from reality a bit. Not moving won't be fun."_ It swims at a real,
   slowish speed, sprints and flees like the other giants, and its shell stays its main defence (§3.5.4,
   §3.5.5).

#### 3.5.17 Build slices (each one subsystem, at most about 40 files)

The dish held no giant on the human's live game until the last server slice: `GIANT_SPECIES_IN_DISH`
shipped empty in `DEFAULT_BALANCE`, and giants were seated only through `placeGiant` or `debug_spawn`, until
their minds, art and HUD had landed; slice 6 (ticket #830) seats them in every round. Main deploys to the human's game on every merge, and a giant
without its mind would sit still and swallow whatever touched it.

1. **Shared contract and constants** (architect and engineer): `constants/giants.ts` (balance domain
   `giants`, with `GIANT_SPECIES_IN_DISH` empty in `DEFAULT_BALANCE`), the `GiantSpecies` and `GiantRole`
   enums, `CellView.giantSpecies` (null on every cell) in `CELL_HASHED_FIELDS`, `isCellEaterSpecies` in
   `canEngulf` and every call site of §3.5.15, `CellAbsorbedEffect.preyGiantSpecies`, the
   `debug_set_balance` refusals for `giants`, regenerated `balance.json`, the constants ledger, and the
   architecture docs (entity-model §2, server-simulation §3, constants-files-tests §10, wire-contract
   §4.1). Rows G14 and the predicate part of G4. No world changes.
2. **Server: giant seats and lifecycle**: `SeatMindRecord` and the giant seat list, world-creation order,
   the giant clearance, respawn, the settle with born mass, ceiling and decay multiplier, the fixed builds
   and derived level, the speed multiplier's one home, die-off exclusion, the seat fields in the state
   hash, `RANDOM_STREAM.giants`, the payout (DNA bonus through the multiplier, the effect field), the
   `placeGiant` fixture, and `debug_spawn` for `giant` (debug-mcp.md §8). Rows G1 (on a balance whose
   `GIANT_SPECIES_IN_DISH` is all three), G8, G9, G11 (its tick-34 mass with slice 3's step 4), G12. A seated
   giant has no mind yet: its seat's decision countdown is set at placement and counted from slice 3, and step 4
   still feeds it the motes it covers. Depends on 1.
3. **Server: giant minds**: the seat profile in the wild strategy (role decision orders, the hunt window
   as the hunter's target filter, the 8 s give-up, the drifter's flee then wander, the turn chances, the
   profile's stream and ceiling), and the grazer's diet (bacteria, the forward cone, appetite, step 4
   eating and skipping). Rows G3, G4, G5, G6, G7, G10, G13, G11's tick-34 mass, and G15 once ticket #819's kept
   grab is on main. Depends on 2.
4. **Client render** (graphics-designer): per-species palettes, a giant-size check of the amoeba,
   ciliate and diatom forms (the oral groove, the rings of pores and radial ribs where missing). Evidence
   on a private stack, with giants placed by `debug_spawn('giant')`. Depends on 1 and 2.
5. **Client HUD** (ui-designer): `GIANT_DISPLAY_NAME_BY_SPECIES` through `cellDisplayName` (the threat
   label and the hold-Tab panel), `respawn-lines.ts` building its killer from it, and the giant popup:
   #783's form popup on `cell_absorbed` with the own cell as predator and a non-null `preyGiantSpecies`,
   with `GIANT_REAL_LIFE_LINES` beside `form-facts.ts`. Depends on 1.
6. **Giants on** (small server slice): `GIANT_SPECIES_IN_DISH` = amoeba, paramecium, diatom in
   `DEFAULT_BALANCE`, regenerated `balance.json`, and every seeded-world pin re-pinned (W2, W3, W9, the
   replay and state-hash goldens, the bot integration tests, every seed-42 gameplay scenario): giants
   are placed before the wild seats, which moves every wild centre. G1 on the default balance. Depends
   on 3, 4 and 5, so the first giant the human meets has its mind, art and names.
7. **Encyclopedia entries** for the three giants (optional, ui-designer). Depends on 1.
8. **Gameplay QA measurement** after 6: default rounds over seeds 1–3 with one idle and one grazing
   player. Report giant swallows a round, players eaten by the amoeba a minute (by a hunt and by a
   bump), the paramecium's share of the food mass (target ≤ 6 %) and how many giants players eat. Tune
   the knobs in §3.5.14 if needed.
