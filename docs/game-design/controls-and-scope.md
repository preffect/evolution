# Evolution — Game Design: controls, camera, dish and scope

§6–§11 of the split [`GAME-DESIGN.md`](../GAME-DESIGN.md), which keeps the shared context and the file list.

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
  tick, and no target (nor a sprint) while it has no own cell, so nothing it sends while spectating steers
  the respawned cell (#346). Steering throttle ramps from 0 when the pointer is within `STEER_DEAD_ZONE_RADII` × radius of
  the centre to 1 at `STEER_FULL_THROTTLE_RADII` × radius. Keyboard steering synthesises a target at
  `STEER_FULL_THROTTLE_RADII` × radius in the pressed direction.
- **Sprint.** Speed × `SPRINT_SPEED_MULTIPLIER` for `SPRINT_DURATION_SECONDS`, costs
  `SPRINT_MASS_COST_FRACTION` of current mass (never below `CELL_STARTING_MASS`), cooldown
  `SPRINT_COOLDOWN_SECONDS` measured from sprint start. Sprint is also the engulf-escape tool.
- Movement math (acceleration, drag, walls) is in [`ecology/mass-and-movement.md`](../ecology/mass-and-movement.md#5-size-mass-and-speed).
- The trait-choice timer is a progression rule: `TRAIT_CHOICE_TIMEOUT_SECONDS` lives in
  [`PROGRESSION.md §6`](../PROGRESSION.md#6-constants-table--packagessharedsrcconstantsprogressionts).

## 7. Camera

The camera centres on the player's cell and zooms out as the cell grows, but more slowly than the cell grows, so
a bigger cell is visibly bigger on screen and a shrinking one visibly shrinks (decision #324, **Z1 · partial
zoom**; the size lock it replaces held the own cell at 33 px on the reference viewport from mass 39 to 977 and hid
both growth and decay, `qa/decisions/legibility/audit.md` on PR #325):

```
spawnRadius      = radiusForMass(CELL_STARTING_MASS)                       (17.9 wu)
viewHalfHeightWu = clamp(CAMERA_MIN_VIEW_HALF_HEIGHT_WU × (radius / spawnRadius) ^ CAMERA_VIEW_RADIUS_EXPONENT,
                         CAMERA_MIN_VIEW_HALF_HEIGHT_WU, CAMERA_MAX_VIEW_HALF_HEIGHT_WU)
```

`CAMERA_VIEW_RADIUS_EXPONENT` is 0.5 (`constants/camera.ts`, replacing `CAMERA_VIEW_RADII` 12, which is retired): the
view grows with √radius, ≈ 70.9 × √radius wu, and leaves its floor exactly at the starting mass, so a fresh cell
sees the same view as before. 1 would be a size lock again, 0 no zoom at all. The clamps are unchanged, and
`CELL_MAX_MASS` (radius 283 wu, view 1193 wu) stays under the ceiling.

| Mass           | Radius (wu) | View half-height (wu) | Radii ahead | Own cell at 800 px tall (px) | At 1080 px (px) |
| -------------- | ----------- | --------------------- | ----------- | ---------------------------- | --------------- |
| 20 (spawn)     | 17.9        | 300                   | 16.8        | 23.9                         | 32.2            |
| 80             | 35.8        | 424                   | 11.9        | 33.7                         | 45.5            |
| 312            | 70.7        | 596                   | 8.4         | 47.4                         | 64.0            |
| 900            | 120.0       | 777                   | 6.5         | 61.8                         | 83.4            |
| 5000 (the cap) | 282.8       | 1193                  | 4.2         | 94.8                         | 128.0           |

"Radii ahead" is the view half-height over the radius: how far ahead a cell sees, in its own sizes (12 under the
size lock). The cost of Z1 is that a giant sees less of the dish around it; ecology does not read the camera, so it
changes nothing in the simulation. Own-cell px is `radius × (viewport height / 2) / viewHalfHeightWu`.

Position follows with time constant `CAMERA_FOLLOW_SECONDS`; zoom with `CAMERA_ZOOM_SECONDS`
(exponential smoothing, client side, purely cosmetic). While spectating, the camera follows the
killer at its zoom. Screen aspect is whatever the canvas is; the vertical extent is authoritative.

## 8. The petri dish

A circular world of radius `DISH_RADIUS` world units (wu), centred at the origin. Zones (geometry,
effects and spawn weights in [`ecology/food-and-spawn.md`](../ecology/food-and-spawn.md#2-zones)):

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
photosynthetic bacteria in the sunlit shallows ([`ecology/food-and-spawn.md §3`](../ecology/food-and-spawn.md#3-spawn-model)).

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
build 1's wild cells are the world clock made flesh, [`ecology/wild-cells.md §3.3`](../ecology/wild-cells.md#33-wild-cells),
not that), trait stealing, partial absorption
(nibbling), viruses, alliances, persistence or accounts, anti-cheat, touch-layout polish (pointer
events work, nothing more), real audio assets (hooks only, #101), spectator-only clients, stages
beyond `specialised`.

## 11. Reserved hooks for build 2

| Hook                                    | Where                        | Build-1 behaviour                                        |
| --------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| `GameSessionConfig.mode`                | `'free_for_all' \| 'colony'` | server rejects `'colony'`                                |
| `GameSessionConfig.endCondition`        | `'timer'` only               | other values rejected                                    |
| `Cell.organismId`                       | equals the cell's own id     | grouping key for colonies                                |
| `GameInput.shouldSplit`, `.shouldEject` | booleans, optional           | validated, ignored                                       |
| `CellState.dividing`                    | state in the engulf diagram  | unreachable                                              |
| Mitosis constants                       | `growth.ts`                  | declared, unused (see ecology/mass-and-movement.md §5.4) |
