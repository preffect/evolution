# Evolution — Game Design: session structure

§5 of the split [`GAME-DESIGN.md`](../GAME-DESIGN.md), which keeps the shared context and the file list.

## 5. Session structure (#29)

| Decision            | Build 1 value                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mode                | Free-for-all only. `mode: 'colony'` is reserved and rejected by the server until build 2.                                                                  |
| Players per room    | 1 to `MAX_PLAYERS_PER_GAME` = 8 (the template's constant, `constants/lobby.ts`). Solo play is valid.                                                       |
| Round length        | `ROUND_DURATION_SECONDS` = 600, set at create time.                                                                                                        |
| Round end           | Timer only. Dominant-organism and DNA-target end conditions are reserved (`endCondition`).                                                                 |
| Late join           | Allowed at any time; the joiner enters at the world's level at least ([`PROGRESSION.md §5`](../PROGRESSION.md#5-entering-the-dish-late-join-and-respawn)). |
| Death               | Engulfed cell spectates `RESPAWN_SPECTATE_SECONDS` = 3, then respawns at the world's level at least (section 5.2).                                         |
| World clock         | The dish climbs the ladder on its own: one world level per `WORLD_LEVEL_SECONDS` = 180 (section 5.5).                                                      |
| Leaderboard         | Ranked by `score` (section 5.3); shows mass, level, absorptions alongside.                                                                                 |
| Results and rematch | Results screen `RESULTS_SCREEN_SECONDS` = 20, then an automatic new round (section 5.4).                                                                   |
| Alliances / teams   | None in build 1. Reserved.                                                                                                                                 |

### 5.1 Round timeline and pace curve

Decision #138 (option A, "slow dawn", applied by #144) sets this curve; times are the #138 pace model
for one active player who takes the trip at the first chance, ± 20 s.

| Phase | Round time   | What players are doing                                                                                                                                                   |
| ----- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dawn  | 0:00 – 3:00  | A bare protocell: learn to steer, eat algae, the first DNA fragments; grow heavy (mass ~200 by 3:00) and start to hunt by mass alone; nucleoid around 2:50 solo.         |
| Trip  | 3:00 – 4:30  | The first deliberate decision: the warm vent (mitochondrion) or the sunlit shallows (chloroplast); two clusters of one variant (`ENDOSYMBIOSIS_BACTERIA_REQUIRED` = 10). |
| Hunt  | 4:30 – 8:00  | Levels 3–4: the endosymbiont around 5:40, the nuclear envelope around 8:00; engulfs decide the leaderboard; nobody is specialised yet.                                   |
| Bloom | 8:00 – 10:00 | Food and DNA spawn multiply (`ROUND_BLOOM_START_FRACTION` = 0.8): catch-up + chaos; the most active player takes a form at level 5 around 9:40.                          |

Bloom multipliers live in [`ecology/food-and-spawn.md`](../ecology/food-and-spawn.md#3-spawn-model) (`FOOD_BLOOM_SPAWN_MULTIPLIER`,
`DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER`).

**What option A gives up inside 600 s.** The former Apex phase (5:00 – 8:00, two or three heavy
specialised cells ruling the open broth) no longer exists as designed: a form arrives at ~9:40 for
the fastest player and levels 6–12 are not reached, so the tier upgrades and the later organelles
(cytoskeleton, cilia, vacuoles) are content for longer rounds. `ROUND_DURATION_SECONDS` is a separate
constant (`session.ts`, set at create time) that #138 did not touch; whether to lengthen the round
so the top rungs are playable is a possible follow-up decision for the human, not a change this
document makes. Acceptance scenarios that need a specialised cell grant the form by fixture
([`ecology/acceptance.md §8`](../ecology/acceptance.md#8-acceptance-scenarios) conventions) rather than reaching it in a round.

### 5.2 Spawn, death and respawn

- **Safe spawn placement.** A candidate point is drawn from the `spawnPlacement` random stream
  (uniform in the disc of radius `DISH_RADIUS − SPAWN_EDGE_MARGIN`); it is a separate fork from the
  `spawner` stream so a respawn never changes later mote positions. It is rejected while any other
  cell with mass ≥ `SAFE_SPAWN_THREAT_MASS_RATIO` × `CELL_STARTING_MASS` lies within
  `SAFE_SPAWN_RADIUS`. After `SAFE_SPAWN_MAX_ATTEMPTS` rejections the candidate farthest from the
  nearest threat is used.
- **Death** = being fully engulfed ([`ecology/absorption.md`](../ecology/absorption.md#6-absorption-and-engulf)), by a
  player or by a wild cell. The victim keeps level, traits and stage, loses all mass and
  `(1 − dnaKeptOnDeathFraction)` of its `dnaTowardNextLevel` (the Nuclear Envelope keeps part of it,
  [`traits/catalog-organelles.md §3.7`](../traits/catalog-organelles.md)), spectates the killer (`spectatingCellId`: a wild killer has no
  player) for `RESPAWN_SPECTATE_SECONDS`, then respawns via safe placement **through the entry rule**
  ([`PROGRESSION.md §5`](../PROGRESSION.md#5-entering-the-dish-late-join-and-respawn)): a player below
  the world's level is lifted to it (a score-neutral gift, drafts queued; the stage still needs its gates,
  [`PROGRESSION.md §5`](../PROGRESSION.md#5-entering-the-dish-late-join-and-respawn)), a player at or above it
  keeps its own, and the respawn mass is `ENTRY_MASS_FRACTION` of the world's mass clamped to
  [`CELL_STARTING_MASS`, `ENTRY_MAX_MASS`] (20 in the first minutes, 200 from 6:20 on: 0.5 × 410 clamps to `ENTRY_MAX_MASS` at 6:30 and 0.5 × 560 at 9:00). The
  cell entity is removed the tick it is absorbed; the player's `lifeState` is the only record of
  death ([`ecology/absorption.md §6.2`](../ecology/absorption.md#62-state-diagram)). **Tick convention (#211):** the tick the
  cell died is spectated too — the payout runs at step 6 and the respawn countdown at step 9 of that
  same tick — so a death on tick _t_ places the new cell on tick _t_ +
  `RESPAWN_SPECTATE_SECONDS` × `TICK_HZ` + 1, the tick G8, G13 and
  [`ecology/acceptance.md §8.1`](../ecology/acceptance.md#81-the-evolving-world-3134) W4 state. Scenarios G8, G13.
- **Disconnect.** A disconnected player's cell stays in the dish for the template's
  `DISCONNECT_GRACE_MS` (30 s) with no input (it coasts to a stop) and can be eaten. When the room
  removes the player, the cell dissolves into detritus (`DETRITUS_MASS_FRACTION` of its mass).
- **Leave.** A player who leaves the room for the lobby (`leave_game`,
  [`architecture/wire-contract.md §4`](../architecture/wire-contract.md#4-wire-contract-packagessharedsrctypesmessagests))
  gets no grace: the room removes the player at once, and the cell dissolves into detritus the same way.
  Joining or creating another room while still seated in one (a second tab shares the player's identity) leaves
  the old room this way first (#334), so a player is seated in one room at most.

### 5.3 Leaderboard and score

```
score = (dnaCumulative − dnaCatchUpGift) + SCORE_ABSORPTION_BONUS × absorptions
```

`dnaCumulative` never decreases, so dying costs time and mass, not score. The late-join gift
([`PROGRESSION.md §5`](../PROGRESSION.md#5-entering-the-dish-late-join-and-respawn), late join and respawn alike) buys levels, not rank, and not the rank of whoever eats the gifted cell: the
absorption share reads the prey's earned DNA, `dnaCumulative − dnaCatchUpGift`
([`ecology/absorption.md §6.1`](../ecology/absorption.md#61-rules), #271). Ties break by current
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
they can." The mechanics have one home, [`ecology/food-and-spawn.md §3.1–§3.4`](../ecology/food-and-spawn.md#31-the-world-clock):

- **The world clock** turns round time into the world's average cell (`worldLevel`, `worldStage`,
  `worldMass`, `worldDna`): one world level per `WORLD_LEVEL_SECONDS`, `WORLD_MASS_GAIN_PER_SECOND`
  of mass per second, in absolute seconds so it tracks player pace, not round length. The world
  levels up on ticks 10 800, 21 600 and 32 400 of a 600 s round (`world_level_up` effect).
- **What it drives:** the mote mix (more bacteria as the world ages), the broth's share of
  organelle-carrying bacteria (zone character), and the wild cells
  ([`ecology/wild-cells.md §3.3`](../ecology/wild-cells.md#33-wild-cells)): 24 non-player cells whose mass and ladder are
  pinned to the world with a ± 30 % spread, wandering and fleeing from the start, hunting from the
  endosymbiosis era.
- **Entering the dish** (late join and respawn) floors the player at the world's level
  ([`PROGRESSION.md §5`](../PROGRESSION.md#5-entering-the-dish-late-join-and-respawn)).
- **Standing.** `standingAgainstWorld` reads `'ahead' | 'with' | 'behind'` (level first, then mass
  within `WORLD_STANDING_MASS_TOLERANCE`). The HUD expresses it as a second, thin marker on the level
  ring at `worldLevel` and the trait strip's stage caption gaining `· AHEAD OF THE WORLD` / `· WITH
THE WORLD` / `· BEHIND THE WORLD`; [`UI.md`](../UI.md) (#146) specifies placement, the
  `world_level_up` toast and the wild-cell name in the danger chip.
- **Round shape under the clock** (the pace of §5.1 is unchanged; this is the backdrop): 0:00–3:00 a
  broth of protocells, some lunch and some threats; 3:00–6:00 the wild cells grow nucleoids and the
  first variant clusters appear in the broth; 6:00–9:00 the world carries endosymbionts and starts
  to hunt, so a player behind the average is prey; 9:00–10:00 a nucleated world under the bloom.
  The timeline: `qa/decisions/dish-play-scale/evolving/evolving-world-timeline.png`.
