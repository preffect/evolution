# Evolution — Game Design Document

Tickets: #22 (core design), #29 (session model). Epic #2.
Companions: [`ECOLOGY.md`](./ECOLOGY.md) (food, growth, absorption), [`PROGRESSION.md`](./PROGRESSION.md)
(DNA, levels, trait drafts), [`TRAITS.md`](./TRAITS.md) (the catalog). Build plan: [`../init-game.md`](../init-game.md).

**One fact, one home.** Every number in this document is a named constant whose home is
`packages/shared/src/constants/<domain>.ts`. Other docs link here rather than repeating. Where a
number belongs to another doc, this doc names the constant and links.

## 1. Core fantasy

_A single cell that becomes something more._ You are one bioluminescent cell in a dark-field petri
dish. You drift toward the pointer, swallow motes of food, grow heavy and slow, and absorb the DNA of
what you eat. What you eat shapes what you become: the traits offered at each level-up are weighted
by the DNA you absorbed. Bigger cells engulf smaller ones. In build 2 you split, bond and become a
colony; build 1 is one cell, one round, one leaderboard.

## 2. Moment-to-moment loop

```
 steer -> eat motes -> grow (mass up, radius up, speed down)
    ^                           |
    |        absorb DNA <-------+---> hunt smaller / avoid bigger
    |             |                          |
    +-- choose 1 of 3 traits <-- level up    +--> engulf / be engulfed
```

Reserved for build 2 (hooks only, see section 9): split (mitosis), bond (colonies).

## 3. Session structure (#29)

| Decision            | Build 1 value                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Mode                | Free-for-all only. `mode: 'colony'` is reserved and rejected by the server until build 2.         |
| Players per room    | 1 to `ROOM_MAX_PLAYERS` = 8 (template lobby bound). Solo play is a valid session.                 |
| Round length        | `ROUND_DURATION_SECONDS` = 600, set at create time.                                               |
| Round end           | Timer only. Dominant-organism and DNA-target end conditions are reserved (`endCondition`).        |
| Late join           | Allowed at any time; catch-up rules in [`PROGRESSION.md`](./PROGRESSION.md#5-late-join-catch-up). |
| Death               | Engulfed cell spectates `RESPAWN_SPECTATE_SECONDS` = 3, then respawns (section 3.2).              |
| Leaderboard         | Ranked by `score` (section 3.3); shows mass, level, absorptions alongside.                        |
| Results and rematch | Results screen `RESULTS_SCREEN_SECONDS` = 20, then an automatic new round (section 3.4).          |
| Alliances / teams   | None in build 1. Reserved.                                                                        |

### 3.1 Round timeline and pace curve

| Phase | Round time   | What players are doing                                                              |
| ----- | ------------ | ----------------------------------------------------------------------------------- |
| Graze | 0:00 – 2:00  | Learn to steer, eat algae, first DNA fragments, level 2 around 0:45 solo.           |
| Hunt  | 2:00 – 5:00  | Levels 3–6, first engulfs, players start choosing zones (vent vs shallows).         |
| Apex  | 5:00 – 8:00  | Two or three heavy cells dominate the open broth; small cells live in the gel.      |
| Bloom | 8:00 – 10:00 | Food and DNA spawn multiply (`ROUND_BLOOM_START_FRACTION` = 0.8): catch-up + chaos. |

Bloom multipliers live in [`ECOLOGY.md`](./ECOLOGY.md#3-spawn-model) (`FOOD_BLOOM_SPAWN_MULTIPLIER`,
`DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER`).

### 3.2 Spawn, death and respawn

- **Safe spawn placement.** A candidate point is drawn from the `spawner` random stream (uniform in
  the disc of radius `DISH_RADIUS − SPAWN_EDGE_MARGIN`). It is rejected while any other cell with mass
  ≥ `SAFE_SPAWN_THREAT_MASS_RATIO` × `CELL_STARTING_MASS` lies within `SAFE_SPAWN_RADIUS`. After
  `SAFE_SPAWN_MAX_ATTEMPTS` rejections the candidate farthest from the nearest threat is used.
- **Death** = being fully engulfed ([`ECOLOGY.md`](./ECOLOGY.md#6-absorption-and-engulf)). The victim
  keeps level and traits, loses all mass and the partial DNA progress toward the next level, spectates
  the killer for `RESPAWN_SPECTATE_SECONDS`, then respawns at `CELL_STARTING_MASS` via safe placement.
- **Disconnect.** A disconnected player's cell stays in the dish for the template's
  `DISCONNECT_GRACE_MS` (30 s) with no input (it coasts to a stop) and can be eaten. When the room
  removes the player, the cell dissolves into detritus (`DETRITUS_MASS_FRACTION` of its mass).

### 3.3 Leaderboard and score

```
score = (dnaCumulative − dnaCatchUpGift) + SCORE_ABSORPTION_BONUS × absorptions
```

`dnaCumulative` never decreases, so dying costs time and mass, not score. The late-join gift
([`PROGRESSION.md §5`](./PROGRESSION.md#5-late-join-catch-up)) buys levels, not rank. Ties break by current
mass, then by earliest join. Winner at round end = highest score. The leaderboard row shows: rank,
name, level, mass, absorptions, score. It is part of the snapshot (every client sees the same list).

### 3.4 Round end and rematch

At `roundTimeLeftMs` = 0 the room enters `roundPhase: 'results'` for `RESULTS_SCREEN_SECONDS`. Input
is ignored, cells freeze, the results overlay shows the final leaderboard. Then the module resets the
world with `seed + ROUND_SEED_INCREMENT` (1), everyone present respawns at level 1, and `roundPhase`
returns to `'playing'`. The lobby's `started` flag never flips back, so no room plumbing changes.

## 4. Controls

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
  `SPRINT_COOLDOWN_SECONDS`. Sprint is also the engulf-escape tool.
- Movement math (acceleration, drag, walls) is in [`ECOLOGY.md`](./ECOLOGY.md#5-size-mass-and-speed).

## 5. Camera

The camera centres on the player's cell and zooms out as the cell grows so the cell always occupies
a similar share of the screen:

```
viewHalfHeightWu = clamp(CAMERA_VIEW_RADII × radius,
                         CAMERA_MIN_VIEW_HALF_HEIGHT_WU, CAMERA_MAX_VIEW_HALF_HEIGHT_WU)
```

Position follows with time constant `CAMERA_FOLLOW_SECONDS`; zoom with `CAMERA_ZOOM_SECONDS`
(exponential smoothing, client side, purely cosmetic). While spectating, the camera follows the
killer at its zoom. Screen aspect is whatever the canvas is; the vertical extent is authoritative.

## 6. The petri dish

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

**Edge behaviour.** A cell's centre is clamped to `DISH_RADIUS − radius`; the radial velocity
component is zeroed on contact (no bounce). Food never spawns closer than `FOOD_EDGE_MARGIN` to the
wall. The renderer draws the wall as a soft glass rim.

## 7. Win / lose and the feel of a round

You cannot lose a round, only fall behind: death costs mass and progress toward the next level,
never score or traits. The round is won on score. The intended feel: the first minute is calm
grazing; from level 3 the dish becomes a food web where every other cell is either lunch or a
threat, decided purely by the mass ratio; the last two minutes are a bloom that lets a small cell
climb two levels and punish an overextended giant.

## 8. Explicit non-goals for build 1

Co-op colonies, cross-player fusion (#79), multi-cell organisms (#28), mitosis / split / eject,
NPC microbes, trait stealing, partial absorption (nibbling), viruses, alliances, persistence or
accounts, anti-cheat, touch-layout polish (pointer events work, nothing more), real audio assets
(hooks only, #101), spectator-only clients.

## 9. Reserved hooks for build 2

| Hook                             | Where                        | Build-1 behaviour                   |
| -------------------------------- | ---------------------------- | ----------------------------------- |
| `GameSessionConfig.mode`         | `'free_for_all' \| 'colony'` | server rejects `'colony'`           |
| `GameSessionConfig.endCondition` | `'timer'` only               | other values rejected               |
| `Cell.organismId`                | equals the cell's own id     | grouping key for colonies           |
| `GameInput.split`, `.eject`      | booleans, optional           | validated, ignored                  |
| `CellState.dividing`             | state in the engulf diagram  | unreachable                         |
| Mitosis constants                | `growth.ts`                  | declared, unused (see ECOLOGY §5.4) |

## 10. Constants table

Home: `packages/shared/src/constants/<domain>.ts`. Units in the name or the column. Values are
build-1 defaults; `data/balance.json` (if #72 adopts it) is generated from these names, never the
other way round.

### `world.ts`

| Constant                       | Value | Unit  | Meaning                                       |
| ------------------------------ | ----- | ----- | --------------------------------------------- |
| `SIMULATION_TICK_HZ`           | 60    | Hz    | Fixed step; aliases the template's `TICK_HZ`. |
| `DISH_RADIUS`                  | 3000  | wu    | World is the disc of this radius.             |
| `FOOD_EDGE_MARGIN`             | 40    | wu    | No food spawns nearer to the wall.            |
| `SPAWN_EDGE_MARGIN`            | 300   | wu    | No cell spawns nearer to the wall.            |
| `SAFE_SPAWN_RADIUS`            | 600   | wu    | Threat-free radius required around a spawn.   |
| `SAFE_SPAWN_THREAT_MASS_RATIO` | 2     | ×     | A threat is ≥ this × starting mass.           |
| `SAFE_SPAWN_MAX_ATTEMPTS`      | 20    | count | Draws before taking the best candidate.       |

### `session.ts`

| Constant                     | Value    | Unit    | Meaning                                     |
| ---------------------------- | -------- | ------- | ------------------------------------------- |
| `ROOM_MAX_PLAYERS`           | 8        | players | Upper bound for `maxPlayers`.               |
| `ROUND_DURATION_SECONDS`     | 600      | s       | Default round length.                       |
| `ROUND_DURATION_MIN_SECONDS` | 60       | s       | Lower bound accepted at create time.        |
| `ROUND_DURATION_MAX_SECONDS` | 1800     | s       | Upper bound accepted at create time.        |
| `SEED_MAX`                   | 2^32 − 1 | —       | Seeds are unsigned 32-bit integers.         |
| `ROUND_BLOOM_START_FRACTION` | 0.8      | ratio   | Bloom begins at this fraction of the round. |
| `RESULTS_SCREEN_SECONDS`     | 20       | s       | Results overlay before auto-rematch.        |
| `ROUND_SEED_INCREMENT`       | 1        | —       | Next round seed = seed + this.              |
| `RESPAWN_SPECTATE_SECONDS`   | 3        | s       | Spectate the killer before respawn.         |
| `SCORE_ABSORPTION_BONUS`     | 25       | score   | Score per player absorbed.                  |

### `controls.ts`

| Constant                       | Value | Unit  | Meaning                                    |
| ------------------------------ | ----- | ----- | ------------------------------------------ |
| `STEER_DEAD_ZONE_RADII`        | 0.5   | radii | Pointer inside this: throttle 0.           |
| `STEER_FULL_THROTTLE_RADII`    | 2.0   | radii | Pointer beyond this: throttle 1.           |
| `SPRINT_SPEED_MULTIPLIER`      | 1.8   | ×     | Max speed while sprinting.                 |
| `SPRINT_DURATION_SECONDS`      | 0.5   | s     | Sprint length.                             |
| `SPRINT_COOLDOWN_SECONDS`      | 3     | s     | From sprint start to next allowed sprint.  |
| `SPRINT_MASS_COST_FRACTION`    | 0.05  | ratio | Of current mass, floored at starting mass. |
| `TRAIT_CHOICE_TIMEOUT_SECONDS` | 10    | s     | See PROGRESSION §4.                        |

### `camera.ts` (client only)

| Constant                         | Value | Unit  | Meaning                             |
| -------------------------------- | ----- | ----- | ----------------------------------- |
| `CAMERA_VIEW_RADII`              | 12    | radii | Half the view height in cell radii. |
| `CAMERA_MIN_VIEW_HALF_HEIGHT_WU` | 300   | wu    | Zoom-in limit.                      |
| `CAMERA_MAX_VIEW_HALF_HEIGHT_WU` | 1500  | wu    | Zoom-out limit.                     |
| `CAMERA_FOLLOW_SECONDS`          | 0.08  | s     | Position smoothing time constant.   |
| `CAMERA_ZOOM_SECONDS`            | 0.6   | s     | Zoom smoothing time constant.       |

Growth, ecology, absorption and progression constants live with their rules in the companion docs.

## 11. Acceptance scenarios

Format: given seed S and inputs I, after N ticks assert X. All run on the gameplay test framework
(#75) with the manual clock; "idle" means no `player_input` at all.

| #   | Given                                                                                        | Inputs                                | After        | Assert                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1  | seed 42, 1 player, default config                                                            | idle                                  | 1 tick       | player cell exists, mass = `CELL_STARTING_MASS`, level 1, `roundPhase` = `'playing'`, `roundTimeLeftMs` = 600 000 − `TICK_INTERVAL_MS` (± 1 ms).                         |
| G2  | seed 42, 1 player                                                                            | idle                                  | 36 000 ticks | `roundPhase` = `'results'`; after a further `RESULTS_SCREEN_SECONDS` × 60 ticks `roundPhase` = `'playing'`, world seed = 43, player level 1.                             |
| G3  | seed 42, 2 players, player B placed by test at mass 100 within 200 wu of A's spawn candidate | idle                                  | 1 tick       | A's spawn is ≥ `SAFE_SPAWN_RADIUS` from B (safe placement rejected the candidate).                                                                                       |
| G4  | seed 42, 1 player, pointer target at 5 radii due east                                        | same target every tick                | 60 ticks     | velocity.x ≥ 216 and < 220 wu/s (`CELL_BASE_SPEED` × (1 − (1 − 1/15)^60)), velocity.y = 0.                                                                               |
| G5  | seed 42, 1 player, pointer target inside `STEER_DEAD_ZONE_RADII`                             | same target every tick                | 60 ticks     | speed = 0.                                                                                                                                                               |
| G6  | seed 42, 1 player at position (2900, 0) with target (4000, 0)                                | same target every tick                | 120 ticks    | centre.x = `DISH_RADIUS` − radius (clamped), velocity.x = 0.                                                                                                             |
| G7  | seed 42, 1 player, mass 100                                                                  | sprint at tick 1, target 5 radii east | 2 ticks      | mass = 95, sprint active, max speed = `SPRINT_SPEED_MULTIPLIER` × base; at tick 31 sprint inactive; sprint at tick 100 ignored (cooldown), sprint at tick 181 accepted.  |
| G8  | seed 42, 2 players, A absorbs B (per ECOLOGY E1)                                             | idle                                  | absorb + 1   | leaderboard[0] = A with score = A.dnaCumulative + 25; B spectating, `spectatingPlayerId` = A; after 180 more ticks B alive at starting mass, level and traits unchanged. |
| G9  | seed 42, 1 player, third player joins at tick 6000 (see PROGRESSION P7)                      | idle                                  | join + 1     | joiner's cell exists, placed safely, `roundTimeLeftMs` unchanged by the join.                                                                                            |
| G10 | seed 42, 1 player, player disconnects at tick 600 and is removed at tick 600 + grace         | idle                                  | removal + 1  | no cell for that player; detritus motes total mass = `DETRITUS_MASS_FRACTION` × the cell's mass at removal.                                                              |
