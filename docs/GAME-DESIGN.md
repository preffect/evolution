# Evolution — Game Design

Tickets: #22 (core design), #29 (session model). Epic #2. This is the design document; the companions
below hold the numbers for their domain (one fact, one home).

## 1. Companion documents

| Document                               | Covers                                                                                                    | Tickets       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------- |
| this file                              | Core fantasy, the evolution ladder, loop, session model, controls, camera, dish, win/lose, constants      | #22, #29      |
| [`ECOLOGY.md`](./ECOLOGY.md)           | Food kinds and bacterium variants, zones, spawn model, decay, mass/speed curves, mitosis, absorption      | #23, #26, #27 |
| [`PROGRESSION.md`](./PROGRESSION.md)   | DNA, tags, level thresholds, draft rules filtered by the ladder, entering the dish (late join, respawn)   | #24           |
| [`TRAITS.md`](./TRAITS.md)             | Modifier model, the sixteen build-1 traits (organelles and forms) mapped onto the ladder, later traits    | #25           |
| [`VISUAL-STYLE.md`](./VISUAL-STYLE.md) | Palette, cell layer stack, organelle vocabulary, motion language, legibility at play scale, render intent | #34           |
| [`UI.md`](./UI.md)                     | HUD, overlays, onboarding beats, input mapping, readability rules, Angular component plan                 | #30           |

Technical contracts and the file plan: [`ARCHITECTURE.md`](./ARCHITECTURE.md) (#112); the build itself is
epic #96 and its tickets (planning lives in GitHub issues, never in a markdown plan). Still to come under this
epic: multi-cell organisms (#28), cross-player fusion decision
(#79), audio manifest (#35).

**One fact, one home.** Every number in this document is a named constant whose home is
`packages/shared/src/constants/<domain>.ts`. Other docs link here rather than repeating. Where a
number belongs to another doc, this doc names the constant and links.

## 2. Core fantasy

_A single cell that becomes something more._ You begin as a bare **protocell**: a lipid membrane, a
few granules, no nucleus, drifting in a dark-field petri dish. You steer toward the pointer, swallow
motes of food, grow heavy and slow, and absorb the DNA of what you eat. DNA buys organelles, and
organelles climb biology's own ladder: a nucleoid, a flagellum, a wall; a mitochondrion or a
chloroplast stolen by engulfing the bacterium that carries it; a nuclear envelope, a cytoskeleton,
vacuoles, cilia; and finally one of the great single-cell forms (amoeba, paramecium, euglena,
diatom, stentor). What you eat shapes what you become: the traits offered at each level-up are
weighted by the DNA you absorbed. Bigger cells engulf smaller ones. You are not alone: the dish is
populated by **wild cells** at your own scale, and the world they make up evolves on its own clock,
from a broth of protocells to a food web of nucleated hunters, whether you keep up or not. The round
is a race against that average: outgrow the world and it is lunch, fall behind and it eats you
(section 5.5). Build 1 is one cell, one round, one leaderboard; colonies and multicellular life are
build 2.

## 3. The evolution ladder

The ladder is the progression spine of build 1. It is a shared enum, and every trait in
[`TRAITS.md`](./TRAITS.md) is an organelle or a form that sits on one of its rungs.

```ts
// packages/shared/src/types/game.ts: the ids; packages/shared/src/constants/ladder.ts: the order and the gates
export const CELL_STAGE = {
  protocell: 'protocell',
  prokaryote: 'prokaryote',
  endosymbiosis: 'endosymbiosis',
  eukaryote: 'eukaryote',
  specialised: 'specialised',
} as const;
export type CellStage = (typeof CELL_STAGE)[keyof typeof CELL_STAGE];
export const STAGE_ORDER = [
  CELL_STAGE.protocell,
  CELL_STAGE.prokaryote,
  CELL_STAGE.endosymbiosis,
  CELL_STAGE.eukaryote,
  CELL_STAGE.specialised,
] as const satisfies readonly CellStage[];
export const STAGE_GATE_TRAITS: Record<CellStage, readonly TraitId[]> = {
  protocell: [], // the starting stage has no gate
  prokaryote: ['nucleoid'],
  endosymbiosis: ['mitochondrion', 'chloroplast'],
  eukaryote: ['nuclear_envelope'],
  specialised: ['amoeba_pseudopods', 'paramecium_cilia', 'euglena_eyespot', 'diatom_shell', 'stentor_trumpet'],
};
```

| Stage           | Reached when                                                    | What it unlocks (traits whose `stage` is this one)                           | Biology                  |
| --------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------ |
| `protocell`     | start of every round and every respawn                          | `nucleoid`, `simple_flagellum`, `cell_wall`                                  | membrane + granules      |
| `prokaryote`    | `nucleoid` owned                                                | `ribosomes`, `mitochondrion`, `chloroplast`                                  | bacterium / archaeon     |
| `endosymbiosis` | `mitochondrion` or `chloroplast` owned                          | `nuclear_envelope`                                                           | the engulfed bacterium   |
| `eukaryote`     | `nuclear_envelope` owned                                        | `cytoskeleton`, `cilia`, `food_vacuole`, `toxin_vacuole`, and the five forms | true nucleus, organelles |
| `specialised`   | one form owned (`body_plan` exclusion group: one form per cell) | nothing new; the remaining picks deepen tiers                                | amoeba, paramecium, …    |

Rules (home of the pure functions: `packages/server/src/game/progression/ladder.ts`):

- **A cell's stage** is the last stage `S` in `STAGE_ORDER` such that every stage after `protocell`
  up to and including `S` has at least one of its `STAGE_GATE_TRAITS` owned (any tier). A fixture
  that grants `chloroplast` to a cell without `nucleoid` therefore leaves it a protocell: the walk
  stops at the first missing gate.
- **Trait eligibility** (the candidate rule, [`PROGRESSION.md §3`](./PROGRESSION.md#3-draft-pool-and-weights)):
  a trait can be offered only when the cell has reached the trait's `stage`, owns every id in its
  `requires`, and, for endosymbionts, has met its `unlockedBy` counter
  (`ENDOSYMBIOSIS_BACTERIA_REQUIRED` bacteria of the matching variant eaten, [`ECOLOGY.md §1`](./ECOLOGY.md#1-food-kinds)).
- **The rung card.** Whenever a gate trait of the cell's _next_ stage is a candidate, one of the
  three draft cards is reserved for it, so the ladder is always climbable when its prerequisites are
  met. Tag weighting still biases the other cards.
- **Endosymbiosis** is the only rung with an unlock outside the draft: eat
  `ENDOSYMBIOSIS_BACTERIA_REQUIRED` = 10 aerobic bacteria (two full clusters of `BACTERIUM_CLUSTER_SIZE`
  = 5; they cluster around the warm vent) and the mitochondrion becomes a candidate; eat
  `ENDOSYMBIOSIS_BACTERIA_REQUIRED` = 10 photosynthetic bacteria (the same constant; they cluster in the
  sunlit shallows) and the chloroplast does. Absorbing a player cell that owns an endosymbiont credits that unlock in full.
- **The protocell is the baseline.** The mass, radius and speed curves in
  [`ECOLOGY.md §5`](./ECOLOGY.md#5-size-mass-and-speed) and the identity `DEFAULT_CELL_MODIFIERS`
  ([`TRAITS.md §2`](./TRAITS.md#2-modifier-model)) describe the protocell. There is no separate
  protocell speed multiplier: a flagellate is faster than a protocell because the flagellum is a trait
  (`speedMultiplier` > 1), not because the protocell is penalised. "Drifting" is the visual language
  (a wobbly, translucent, nucleus-free blob, [`TRAITS.md §3.0`](./TRAITS.md#30-what-each-stage-looks-like)).
- **Death keeps the ladder.** Level, traits and therefore stage survive death and respawn
  (section 5.2); only mass and part of the progress toward the next level are lost.
- **Pace target** (decision #138, option A "slow dawn"; the #138 pace model, ± 20 s). A fast player
  is a bare protocell for about three minutes and owns a nucleoid at level 2 (~2:50), an endosymbiont
  at level 3 (~5:40, after a vent or shallows trip that eats two clusters), the nuclear envelope at
  level 4 (~8:00) and a form at level 5 (~9:40). Levels 6–12 deepen tiers and add the remaining
  organelles; they fall outside a `ROUND_DURATION_SECONDS` = 600 round (section 5.1). The mass curve
  is unchanged by the decision: engulf is gated by mass, not by the ladder, so a three-minute
  protocell is a fat one (mass ~200, radius ~57 wu) that already hunts.
- **Build 2** adds colonies and multicellular organisms above `specialised`; they are not stages of
  this enum (a colony is several cells), so the enum is closed for build 1.
- **The world climbs the same ladder.** The world clock ([`ECOLOGY.md §3.1`](./ECOLOGY.md#31-the-world-clock))
  gives the dish itself a `worldStage` from this enum: the stage of the world's own picks,
  `stageOf` of wild build 0's first floor(`worldLevel`) − 1 traits (protocell 0:00, prokaryote 3:00,
  endosymbiosis 6:00, eukaryote 9:00 in a 600 s round; `eukaryote` spans levels 4 and 5, because the
  fifth pick is a form's prerequisite and the form itself is the sixth); the wild cells wear that
  stage's organelles, and a player's standing is read against it (section 5.5). Late joiners and
  respawns enter the ladder no lower than the world's level (section 5.2, [`PROGRESSION.md §5`](./PROGRESSION.md#5-entering-the-dish-late-join-and-respawn)).

## 4. Moment-to-moment loop

```
 steer -> eat motes -> grow (mass up, radius up, speed down)
    ^                           |
    |        absorb DNA <-------+---> hunt smaller / avoid bigger
    |             |                          |
    +-- choose 1 of 3 traits <-- level up    +--> engulf / be engulfed
                  |
                  +--> climb a rung of the ladder (organelle or form)
```

Reserved for build 2 (hooks only, section 11): split (mitosis), bond (colonies).

## 5. Session structure (#29)

| Decision            | Build 1 value                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mode                | Free-for-all only. `mode: 'colony'` is reserved and rejected by the server until build 2.                                                                 |
| Players per room    | 1 to `MAX_PLAYERS_PER_GAME` = 8 (the template's constant, `constants/lobby.ts`). Solo play is valid.                                                      |
| Round length        | `ROUND_DURATION_SECONDS` = 600, set at create time.                                                                                                       |
| Round end           | Timer only. Dominant-organism and DNA-target end conditions are reserved (`endCondition`).                                                                |
| Late join           | Allowed at any time; the joiner enters at the world's level at least ([`PROGRESSION.md §5`](./PROGRESSION.md#5-entering-the-dish-late-join-and-respawn)). |
| Death               | Engulfed cell spectates `RESPAWN_SPECTATE_SECONDS` = 3, then respawns at the world's level at least (section 5.2).                                        |
| World clock         | The dish climbs the ladder on its own: one world level per `WORLD_LEVEL_SECONDS` = 180 (section 5.5).                                                     |
| Leaderboard         | Ranked by `score` (section 5.3); shows mass, level, absorptions alongside.                                                                                |
| Results and rematch | Results screen `RESULTS_SCREEN_SECONDS` = 20, then an automatic new round (section 5.4).                                                                  |
| Alliances / teams   | None in build 1. Reserved.                                                                                                                                |

### 5.1 Round timeline and pace curve

Decision #138 (option A, "slow dawn", applied by #144) sets this curve; times are the #138 pace model
for one active player who takes the trip at the first chance, ± 20 s.

| Phase | Round time   | What players are doing                                                                                                                                                   |
| ----- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dawn  | 0:00 – 3:00  | A bare protocell: learn to steer, eat algae, the first DNA fragments; grow heavy (mass ~200 by 3:00) and start to hunt by mass alone; nucleoid around 2:50 solo.         |
| Trip  | 3:00 – 4:30  | The first deliberate decision: the warm vent (mitochondrion) or the sunlit shallows (chloroplast); two clusters of one variant (`ENDOSYMBIOSIS_BACTERIA_REQUIRED` = 10). |
| Hunt  | 4:30 – 8:00  | Levels 3–4: the endosymbiont around 5:40, the nuclear envelope around 8:00; engulfs decide the leaderboard; nobody is specialised yet.                                   |
| Bloom | 8:00 – 10:00 | Food and DNA spawn multiply (`ROUND_BLOOM_START_FRACTION` = 0.8): catch-up + chaos; the most active player takes a form at level 5 around 9:40.                          |

Bloom multipliers live in [`ECOLOGY.md`](./ECOLOGY.md#3-spawn-model) (`FOOD_BLOOM_SPAWN_MULTIPLIER`,
`DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER`).

**What option A gives up inside 600 s.** The former Apex phase (5:00 – 8:00, two or three heavy
specialised cells ruling the open broth) no longer exists as designed: a form arrives at ~9:40 for
the fastest player and levels 6–12 are not reached, so the tier upgrades and the later organelles
(cytoskeleton, cilia, vacuoles) are content for longer rounds. `ROUND_DURATION_SECONDS` is a separate
constant (`session.ts`, set at create time) that #138 did not touch; whether to lengthen the round
so the top rungs are playable is a possible follow-up decision for the human, not a change this
document makes. Acceptance scenarios that need a specialised cell grant the form by fixture
([`ECOLOGY.md §8`](./ECOLOGY.md#8-acceptance-scenarios) conventions) rather than reaching it in a round.

### 5.2 Spawn, death and respawn

- **Safe spawn placement.** A candidate point is drawn from the `spawnPlacement` random stream
  (uniform in the disc of radius `DISH_RADIUS − SPAWN_EDGE_MARGIN`); it is a separate fork from the
  `spawner` stream so a respawn never changes later mote positions. It is rejected while any other
  cell with mass ≥ `SAFE_SPAWN_THREAT_MASS_RATIO` × `CELL_STARTING_MASS` lies within
  `SAFE_SPAWN_RADIUS`. After `SAFE_SPAWN_MAX_ATTEMPTS` rejections the candidate farthest from the
  nearest threat is used.
- **Death** = being fully engulfed ([`ECOLOGY.md`](./ECOLOGY.md#6-absorption-and-engulf)), by a
  player or by a wild cell. The victim keeps level, traits and stage, loses all mass and
  `(1 − dnaKeptOnDeathFraction)` of its `dnaTowardNextLevel` (the Nuclear Envelope keeps part of it,
  [`TRAITS.md §3.7`](./TRAITS.md)), spectates the killer (`spectatingCellId`: a wild killer has no
  player) for `RESPAWN_SPECTATE_SECONDS`, then respawns via safe placement **through the entry rule**
  ([`PROGRESSION.md §5`](./PROGRESSION.md#5-entering-the-dish-late-join-and-respawn)): a player below
  the world's level is lifted to it (a score-neutral gift, drafts queued; the stage still needs its gates,
  [`PROGRESSION.md §5`](./PROGRESSION.md#5-entering-the-dish-late-join-and-respawn)), a player at or above it
  keeps its own, and the respawn mass is `ENTRY_MASS_FRACTION` of the world's mass clamped to
  [`CELL_STARTING_MASS`, `ENTRY_MAX_MASS`] (20 in the first minutes, 200 from 6:20 on: 0.5 × 410 clamps to `ENTRY_MAX_MASS` at 6:30 and 0.5 × 560 at 9:00). The
  cell entity is removed the tick it is absorbed; the player's `lifeState` is the only record of
  death ([`ECOLOGY.md §6.2`](./ECOLOGY.md#62-state-diagram)). Scenarios G8, G13.
- **Disconnect.** A disconnected player's cell stays in the dish for the template's
  `DISCONNECT_GRACE_MS` (30 s) with no input (it coasts to a stop) and can be eaten. When the room
  removes the player, the cell dissolves into detritus (`DETRITUS_MASS_FRACTION` of its mass).

### 5.3 Leaderboard and score

```
score = (dnaCumulative − dnaCatchUpGift) + SCORE_ABSORPTION_BONUS × absorptions
```

`dnaCumulative` never decreases, so dying costs time and mass, not score. The late-join gift
([`PROGRESSION.md §5`](./PROGRESSION.md#5-entering-the-dish-late-join-and-respawn), late join and respawn alike) buys levels, not rank. Ties break by current
mass, then by earliest join. Winner at round end = highest score. The leaderboard row shows: rank,
name, level, mass, absorptions, score. It is part of the snapshot (every client sees the same list).

### 5.4 Round end and rematch

At `roundTimeLeftMs` = 0 the room enters `roundPhase: 'results'` for `RESULTS_SCREEN_SECONDS`. Input
is ignored, cells freeze, the results overlay shows the final leaderboard. Then the module resets the
world with `seed + ROUND_SEED_INCREMENT` (1), everyone present respawns at level 1 as a protocell, and
`roundPhase` returns to `'playing'`. The lobby's `started` flag never flips back, so no room plumbing
changes. Boundary rule: the phase flips on the tick the timer reaches zero (tick 36 000 of a
10-minute round) and the results screen ends on the tick its elapsed count reaches
`RESULTS_SCREEN_SECONDS` × `TICK_HZ` (tick 37 200).

### 5.5 The evolving world

The human's direction on decision #141, quoted: "a fresh cell starts in a world similar to itself,
and that world evolves as time passes, its up to the players to evolve faster than the average if
they can." The mechanics have one home, [`ECOLOGY.md §3.1–§3.4`](./ECOLOGY.md#31-the-world-clock):

- **The world clock** turns round time into the world's average cell (`worldLevel`, `worldStage`,
  `worldMass`, `worldDna`): one world level per `WORLD_LEVEL_SECONDS`, `WORLD_MASS_GAIN_PER_SECOND`
  of mass per second, in absolute seconds so it tracks player pace, not round length. The world
  levels up on ticks 10 800, 21 600 and 32 400 of a 600 s round (`world_level_up` effect).
- **What it drives:** the mote mix (more bacteria as the world ages), the broth's share of
  organelle-carrying bacteria (zone character), and the wild cells
  ([`ECOLOGY.md §3.3`](./ECOLOGY.md#33-wild-cells)): 24 non-player cells whose mass and ladder are
  pinned to the world with a ± 30 % spread, wandering and fleeing from the start, hunting from the
  endosymbiosis era.
- **Entering the dish** (late join and respawn) floors the player at the world's level
  ([`PROGRESSION.md §5`](./PROGRESSION.md#5-entering-the-dish-late-join-and-respawn)).
- **Standing.** `standingAgainstWorld` reads `'ahead' | 'with' | 'behind'` (level first, then mass
  within `WORLD_STANDING_MASS_TOLERANCE`). The HUD expresses it as a second, thin marker on the level
  ring at `worldLevel` and the trait strip's stage caption gaining `· AHEAD OF THE WORLD` / `· WITH
THE WORLD` / `· BEHIND THE WORLD`; [`UI.md`](./UI.md) (#146) specifies placement, the
  `world_level_up` toast and the wild-cell name in the danger chip.
- **Round shape under the clock** (the pace of §5.1 is unchanged; this is the backdrop): 0:00–3:00 a
  broth of protocells, some lunch and some threats; 3:00–6:00 the wild cells grow nucleoids and the
  first variant clusters appear in the broth; 6:00–9:00 the world carries endosymbionts and starts
  to hunt, so a player behind the average is prey; 9:00–10:00 a nucleated world under the bloom.
  The timeline: `qa/decisions/dish-play-scale/evolving/evolving-world-timeline.png`.

## 6. Controls

| Action      | Mouse / touch                 | Keyboard            | Build |
| ----------- | ----------------------------- | ------------------- | ----- |
| Steer       | Cell moves toward the pointer | WASD / arrows       | 1     |
| Sprint      | Left click / tap              | Space               | 1     |
| Pick trait  | Click card                    | 1 / 2 / 3           | 1     |
| Leaderboard | Always visible (compact)      | Tab holds full list | 1     |
| Split       | —                             | reserved            | 2     |
| Eject mass  | —                             | reserved            | 2     |

- **Pointer steering.** The client sends the pointer's world position as `targetX/targetY` each
  tick. Steering throttle ramps from 0 when the pointer is within `STEER_DEAD_ZONE_RADII` × radius of
  the centre to 1 at `STEER_FULL_THROTTLE_RADII` × radius. Keyboard steering synthesises a target at
  `STEER_FULL_THROTTLE_RADII` × radius in the pressed direction.
- **Sprint.** Speed × `SPRINT_SPEED_MULTIPLIER` for `SPRINT_DURATION_SECONDS`, costs
  `SPRINT_MASS_COST_FRACTION` of current mass (never below `CELL_STARTING_MASS`), cooldown
  `SPRINT_COOLDOWN_SECONDS` measured from sprint start. Sprint is also the engulf-escape tool.
- Movement math (acceleration, drag, walls) is in [`ECOLOGY.md`](./ECOLOGY.md#5-size-mass-and-speed).
- The trait-choice timer is a progression rule: `TRAIT_CHOICE_TIMEOUT_SECONDS` lives in
  [`PROGRESSION.md §6`](./PROGRESSION.md#6-constants-table--packagessharedsrcconstantsprogressionts).

## 7. Camera

The camera centres on the player's cell and zooms out as the cell grows so the cell always occupies
a similar share of the screen:

```
viewHalfHeightWu = clamp(CAMERA_VIEW_RADII × radius,
                         CAMERA_MIN_VIEW_HALF_HEIGHT_WU, CAMERA_MAX_VIEW_HALF_HEIGHT_WU)
```

Position follows with time constant `CAMERA_FOLLOW_SECONDS`; zoom with `CAMERA_ZOOM_SECONDS`
(exponential smoothing, client side, purely cosmetic). While spectating, the camera follows the
killer at its zoom. Screen aspect is whatever the canvas is; the vertical extent is authoritative.

## 8. The petri dish

A circular world of radius `DISH_RADIUS` world units (wu), centred at the origin. Zones (geometry,
effects and spawn weights in [`ECOLOGY.md`](./ECOLOGY.md#2-zones)):

```
            . . . sunlit shallows (outer ring) . . .
         .                                          .
        .        open broth                          .
       .     (gel)          (gel)                     .
       .             [warm vent]                      .
        .                         (gel)              .
         .                                          .
            . . . . . . . . . . . . . . . . . . . .
```

The zones are also where the ladder's endosymbionts live: aerobic bacteria cluster in the warm vent,
photosynthetic bacteria in the sunlit shallows ([`ECOLOGY.md §3`](./ECOLOGY.md#3-spawn-model)).

**Edge behaviour.** A cell's centre is clamped to `DISH_RADIUS − radius`; the radial velocity
component is zeroed on contact (no bounce). Food never spawns closer than `FOOD_EDGE_MARGIN` to the
wall. The renderer draws the wall as a soft glass rim.

## 9. Win / lose and the feel of a round

You cannot lose a round, only fall behind: death costs mass and progress toward the next level,
never score, traits or your place on the ladder. The round is won on score. The intended feel: the
first three minutes are a calm protocell grazing and growing; the trip to the vent or the shallows for
an endosymbiont is the first deliberate decision; from there the dish is a food web where every
other cell is either lunch or a threat, decided purely by the mass ratio; the last two minutes are a
bloom that lets a small cell climb a level and punish an overextended giant, and hands the fastest
player a form and its readable silhouette just before the whistle (section 5.1).

## 10. Explicit non-goals for build 1

Co-op colonies, cross-player fusion (#79), multi-cell organisms (#28), mitosis / split / eject,
NPC microbes with their own progression (cells that eat motes, grow or draft on their own account;
build 1's wild cells are the world clock made flesh, [`ECOLOGY.md §3.3`](./ECOLOGY.md#33-wild-cells),
not that), trait stealing, partial absorption
(nibbling), viruses, alliances, persistence or accounts, anti-cheat, touch-layout polish (pointer
events work, nothing more), real audio assets (hooks only, #101), spectator-only clients, stages
beyond `specialised`.

## 11. Reserved hooks for build 2

| Hook                                    | Where                        | Build-1 behaviour                   |
| --------------------------------------- | ---------------------------- | ----------------------------------- |
| `GameSessionConfig.mode`                | `'free_for_all' \| 'colony'` | server rejects `'colony'`           |
| `GameSessionConfig.endCondition`        | `'timer'` only               | other values rejected               |
| `Cell.organismId`                       | equals the cell's own id     | grouping key for colonies           |
| `GameInput.shouldSplit`, `.shouldEject` | booleans, optional           | validated, ignored                  |
| `CellState.dividing`                    | state in the engulf diagram  | unreachable                         |
| Mitosis constants                       | `growth.ts`                  | declared, unused (see ECOLOGY §5.4) |

## 12. Constants table

Home: `packages/shared/src/constants/<domain>.ts`. Units in the name or the column. Values are
build-1 defaults; `data/balance.json` (if #72 adopts it) is generated from these names, never the
other way round. Values that follow from other constants (for example the per-tick steer blend) are
derived in code and never listed here.

### Template files (`units.ts`, `network.ts`, `lobby.ts`, `identity.ts`; already split, see [`ARCHITECTURE.md`](./ARCHITECTURE.md))

The design reads these as they are; there is no alias for the tick rate (`TICK_HZ` is the one name).

| Constant               | File         | Value | Unit    | Meaning                                                                                        |
| ---------------------- | ------------ | ----- | ------- | ---------------------------------------------------------------------------------------------- |
| `TICK_HZ`              | `network.ts` | 60    | Hz      | Fixed step; `TICK_INTERVAL_MS` is derived beside it.                                           |
| `DISCONNECT_GRACE_MS`  | `network.ts` | 30000 | ms      | Section 5.2.                                                                                   |
| `MAX_PLAYERS_PER_GAME` | `lobby.ts`   | 8     | players | Upper bound for `maxPlayers`; also the palette count.                                          |
| `MIN_PLAYERS_PER_GAME` | `lobby.ts`   | 1     | players | Lower bound for `maxPlayers`.                                                                  |
| `AVATAR_INDEX_MAX`     | `lobby.ts`   | 7     | index   | Was 5; eight archetypes (eight player palettes, §1).                                           |
| `SEAT_MARK_BEADS`      | `lobby.ts`   | 1..8  | beads   | `[index] = index + 1`; the non-colour player tell ([`VISUAL-STYLE.md` §2](./VISUAL-STYLE.md)). |

### `world.ts`

| Constant                       | Value | Unit  | Meaning                                     |
| ------------------------------ | ----- | ----- | ------------------------------------------- |
| `DISH_RADIUS`                  | 3000  | wu    | World is the disc of this radius.           |
| `FOOD_EDGE_MARGIN`             | 40    | wu    | No food spawns nearer to the wall.          |
| `SPAWN_EDGE_MARGIN`            | 300   | wu    | No cell spawns nearer to the wall.          |
| `SAFE_SPAWN_RADIUS`            | 600   | wu    | Threat-free radius required around a spawn. |
| `SAFE_SPAWN_THREAT_MASS_RATIO` | 2     | ×     | A threat is ≥ this × starting mass.         |
| `SAFE_SPAWN_MAX_ATTEMPTS`      | 20    | count | Draws before taking the best candidate.     |

### `session.ts`

| Constant                     | Value      | Unit  | Meaning                                               |
| ---------------------------- | ---------- | ----- | ----------------------------------------------------- |
| `ROUND_DURATION_SECONDS`     | 600        | s     | Default round length.                                 |
| `ROUND_DURATION_MIN_SECONDS` | 60         | s     | Lower bound accepted at create time.                  |
| `ROUND_DURATION_MAX_SECONDS` | 1800       | s     | Upper bound accepted at create time.                  |
| `SEED_MAX`                   | 4294967295 | —     | Largest accepted seed (unsigned 32-bit, written out). |
| `ROUND_BLOOM_START_FRACTION` | 0.8        | ratio | Bloom begins at this fraction of the round.           |
| `RESULTS_SCREEN_SECONDS`     | 20         | s     | Results overlay before auto-rematch.                  |
| `ROUND_SEED_INCREMENT`       | 1          | —     | Next round seed = seed + this.                        |
| `RESPAWN_SPECTATE_SECONDS`   | 3          | s     | Spectate the killer before respawn.                   |
| `SCORE_ABSORPTION_BONUS`     | 25         | score | Score per player absorbed (wild cells never count).   |

### `world-clock.ts` (section 5.5, [`ECOLOGY.md §3.1`](./ECOLOGY.md#31-the-world-clock))

| Constant                        | Value | Unit               | Meaning                                                                |
| ------------------------------- | ----- | ------------------ | ---------------------------------------------------------------------- |
| `WORLD_LEVEL_SECONDS`           | 180   | s per world level  | `worldLevel = min(1 + elapsed / this, MAX_LEVEL)`.                     |
| `WORLD_MASS_GAIN_PER_SECOND`    | 1     | mass/s             | `worldMass = min(CELL_STARTING_MASS + this × elapsed, CELL_MAX_MASS)`. |
| `WORLD_STANDING_MASS_TOLERANCE` | 0.1   | ratio of worldMass | Band around `worldMass` that reads as `with` the world at equal level. |

### `controls.ts`

| Constant                    | Value | Unit  | Meaning                                    |
| --------------------------- | ----- | ----- | ------------------------------------------ |
| `STEER_DEAD_ZONE_RADII`     | 0.5   | radii | Pointer inside this: throttle 0.           |
| `STEER_FULL_THROTTLE_RADII` | 2.0   | radii | Pointer beyond this: throttle 1.           |
| `SPRINT_SPEED_MULTIPLIER`   | 1.8   | ×     | Max speed while sprinting.                 |
| `SPRINT_DURATION_SECONDS`   | 0.5   | s     | Sprint length.                             |
| `SPRINT_COOLDOWN_SECONDS`   | 3     | s     | From sprint start to next allowed sprint.  |
| `SPRINT_MASS_COST_FRACTION` | 0.05  | ratio | Of current mass, floored at starting mass. |

### `ladder.ts`

| Constant                          | Value                                  | Unit   | Meaning                                                                                 |
| --------------------------------- | -------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| `STAGE_ORDER`                     | the five stages of section 3, in order | stages | Walk order of `CELL_STAGE`; pinned complete against it.                                 |
| `STAGE_GATE_TRAITS`               | the table in section 3                 | ids    | Owning any listed trait reaches the stage.                                              |
| `ENDOSYMBIOSIS_BACTERIA_REQUIRED` | 10                                     | count  | Bacteria of one variant eaten to unlock its endosymbiont (two clusters; decision #138). |

### `camera.ts` (client only)

| Constant                         | Value | Unit  | Meaning                             |
| -------------------------------- | ----- | ----- | ----------------------------------- |
| `CAMERA_VIEW_RADII`              | 12    | radii | Half the view height in cell radii. |
| `CAMERA_MIN_VIEW_HALF_HEIGHT_WU` | 300   | wu    | Zoom-in limit.                      |
| `CAMERA_MAX_VIEW_HALF_HEIGHT_WU` | 1500  | wu    | Zoom-out limit.                     |
| `CAMERA_FOLLOW_SECONDS`          | 0.08  | s     | Position smoothing time constant.   |
| `CAMERA_ZOOM_SECONDS`            | 0.6   | s     | Zoom smoothing time constant.       |

Growth, ecology, absorption and progression constants live with their rules in the companion docs.

## 13. Acceptance scenarios

Format: given seed S and inputs I, after N ticks assert X. All run on the gameplay test framework
(#75) with the manual clock; "idle" means no `player_input` at all. Fixture conventions (placement,
pinning, decay in expected values, the meaning of "target N radii east") are stated once in
[`ECOLOGY.md §8`](./ECOLOGY.md#8-acceptance-scenarios) and apply to every table in these docs.

| #   | Given                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Inputs                                | After        | Assert                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | seed 42, 1 player, default config                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | idle                                  | 1 tick       | player cell exists, mass = `CELL_STARTING_MASS`, level 1, stage `protocell`, no traits, `roundPhase` = `'playing'`, `roundTimeLeftMs` = 600 000 − `TICK_INTERVAL_MS` (± 1 ms).                                                                                                                                                                                                                                                                                                |
| G2  | seed 42, 1 player                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | idle                                  | 36 000 ticks | `roundPhase` = `'results'` on tick 36 000 exactly (`'playing'` on 35 999); after a further `RESULTS_SCREEN_SECONDS` × 60 ticks (tick 37 200 exactly) `roundPhase` = `'playing'`, world seed = 43, player level 1, stage `protocell`.                                                                                                                                                                                                                                          |
| G3  | seed 42, 2 players, player B placed by test at mass 100 within 200 wu of A's spawn candidate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | idle                                  | 1 tick       | A's spawn is ≥ `SAFE_SPAWN_RADIUS` from B (safe placement rejected the candidate).                                                                                                                                                                                                                                                                                                                                                                                            |
| G4  | seed 42, 1 player, target 5 radii east                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | same target every tick                | 60 ticks     | velocity.x ≈ 216.5 (`CELL_BASE_SPEED` × (1 − (1 − 1/15)^60), ± 0.5), velocity.y = 0.                                                                                                                                                                                                                                                                                                                                                                                          |
| G5  | seed 42, 1 player, pointer target inside `STEER_DEAD_ZONE_RADII`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | same target every tick                | 60 ticks     | speed = 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| G6  | seed 42, 1 player at position (2900, 0) with target (4000, 0)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | same target every tick                | 120 ticks    | centre.x = `DISH_RADIUS` − radius (clamped), velocity.x = 0.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| G7  | seed 42, 1 player placed at mass 100                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | sprint at tick 1, target 5 radii east | 2 ticks      | mass = `decayed(95, 2)` ≈ 95.00 (the 5 % cost, then two ticks of decay); sprint active, speed cap = `SPRINT_SPEED_MULTIPLIER` × maxSpeed; at tick 31 sprint inactive; sprint at tick 100 ignored (cooldown); sprint at tick 181 accepted (181 − 1 = 180 ticks = 3 s).                                                                                                                                                                                                         |
| G8  | ECOLOGY E9 setup (A absorbs B at tick 36)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | idle                                  | 37 ticks     | leaderboard[0] = A with score = A.dnaCumulative + 25 = 55; B `lifeState` = `'spectating'`, `spectatingCellId` = A's cell, no cell for B; at tick 217 (36 + 180 + 1) B alive at starting mass (entry rule: 0.5 × `worldMass`(3.62 s) = 11.81 < 20), level, traits and stage unchanged (world level 1.02: no lift).                                                                                                                                                             |
| G9  | PROGRESSION P7 setup (2 players, third joins at tick 6000)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | idle                                  | join + 1     | joiner's cell exists, placed safely, stage `protocell`, `roundTimeLeftMs` unchanged by the join.                                                                                                                                                                                                                                                                                                                                                                              |
| G10 | seed 42, 1 player, no input from tick 600; the fixture calls `removePlayer` at tick 2400 (600 + `DISCONNECT_GRACE_MS` / 1000 × 60: the room's wall-clock timer, which the fixture drives; the module never sees the disconnect)                                                                                                                                                                                                                                                                                                                                                                      | idle                                  | 2401 ticks   | no cell for that player; detritus motes total mass = `DETRITUS_MOTE_MASS` × floor(`DETRITUS_MASS_FRACTION` × the cell's mass at removal / `DETRITUS_MOTE_MASS`) (ECOLOGY §1 rounding).                                                                                                                                                                                                                                                                                        |
| G11 | seed 42, 1 player                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | idle                                  | 37 200 ticks | `world_level_up` effects on ticks 10 800 (`{ level: 2, stage: 'prokaryote' }`), 21 600 (3, `endosymbiosis`) and 32 400 (4, `eukaryote`) and on no other tick (`elapsedTicks` is the integer tick in progress, ECOLOGY §3.1: 10 800 / 60 = 180 s exactly at step 1); through `results` (ticks 36 000–37 199) `worldReference` stays at 600 s (level 4.33); at tick 37 200 (rematch, seed 43) elapsed is 0: world level 1, every wild cell a protocell at mass 20 × its spread. |
| G12 | pure function `standingAgainstWorld(level, mass, worldReference(180))` (world level 2.0, mass 200)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | —                                     | —            | (3, 50) → `ahead`; (1, 900) → `behind`; (2, 221) → `ahead`; (2, 220) → `with`; (2, 200) → `with`; (2, 180) → `with`; (2, 179) → `behind`. At `worldReference(0)`: (1, 20) → `with`.                                                                                                                                                                                                                                                                                           |
| G13 | seed 42, 1 player A; run to tick 23 365; at tick 23 365 the fixture places A at level 1, mass 20 (no DNA) and wild seat 0 at spread 5.0 (mass ≈ 2047 vs 20: `massFactor` 0.5, 1/36 per tick, ECOLOGY §6.1) 10 wu east of A (the W6 pattern with the ECOLOGY W5 pair: the seeded wild cells never meet an idle A before the fixture does), so seat 0's engulf of A starts on 23 365, seals A on 23 382 (seat 0's hunt decision on 23 370 targets A's centre 0.06 radii away, inside `STEER_DEAD_ZONE_RADII`: throttle 0, it does not move; A is idle, no struggle) and pays out on tick 23 400 (6:30) | idle                                  | 23 581 ticks | A alive on tick 23 581 (23 400 + 180 + 1); `elapsedTicks` 23 581 → 393.017 s → world level 3.18 → A `dnaCumulative` = 140 = `dnaCatchUpGift`, level 3, `dnaTowardNextLevel` = 0, one offer shown (the protocell draft) and one queued, score 0, no tag points; mass = min(0.5 × 413.017, `ENTRY_MAX_MASS`) = 200 exactly (respawn runs at step 9, after this tick's decay). With A placed at `dnaCumulative` 200 (level 3) instead: gift 0, level 3, still mass 200.          |
| G14 | seed 42, 1 player idle; a second player joins before tick 18 000 steps (5:00)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | idle                                  | join + 1     | median term 0 (the living player has no DNA) but the world floor is level floor(2.667) = 2: joiner `dnaCumulative` = 60 = `dnaCatchUpGift`, level 2, one offer shown; mass = 0.5 × max(20, 320) = 160, then one tick of decay ≈ 160.00 (± 0.01; 159.995); score 0. PROGRESSION P8 holds unchanged (its world floor is level 1); P7's mass moves to the cap (0.5 × 400 clamps to 200, one tick of decay ≈ 199.994).                                                            |
