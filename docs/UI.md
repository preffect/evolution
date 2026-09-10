# Evolution — UI: HUD, overlays and onboarding

Ticket: #30, reworked for decision #143 in #146 (**option C, diegetic**: progress is shown on the player's own cell;
the only chrome is the leaderboard and the round clock). Epic #2. Implemented by #100. Rules and numbers this doc
draws on live elsewhere and are linked, never restated: controls, session and camera in
[`GAME-DESIGN.md`](./GAME-DESIGN.md) §5–§7; offers and catch-up in [`PROGRESSION.md`](./PROGRESSION.md) §4–§5; the
catalog in [`TRAITS.md`](./TRAITS.md); the endosymbiosis counters in [`ECOLOGY.md §1`](./ECOLOGY.md#1-food-kinds);
every snapshot field named below in [`ARCHITECTURE.md §2`](./ARCHITECTURE.md#2-entity-model) and §4; the look in
[`VISUAL-STYLE.md`](./VISUAL-STYLE.md) (#34), which owns colours (§2) and type (§7); **how the on-cell indicators
are drawn** in [`RENDERING.md §10`](./RENDERING.md#10-own-cell-indicators-and-world-anchored-labels-146). The
decision frames are `qa/decisions/hud-layout/` (branch `decisions/hud-layout`) and the frames that solve the reading
floor inside C are [`qa/decisions/hud-layout/diegetic/`](../qa/decisions/hud-layout/diegetic/README.md). Sheet 03's
HUD panel ([`concept-art/README.md`](./concept-art/README.md#sheet-03--motion-studies-and-hud-motion-and-hudsvg-106))
is superseded by this doc where they differ. This doc holds no hex value and no type size: colours are cited by
role (DNA, level gold, danger, accent, panel gradient and rim, callout backing, timer-bar track, identity ring, text
/ label / muted, and the organelle colours `MITO_BASE` / `CHLORO_LIGHT`) and text by type role (`number`,
`headline`, `clock`, `title`, `value`, `card_name`, `body`, `label`, `caption`, VISUAL-STYLE §7's ids verbatim);
the sizes, fonts and case of each role are VISUAL-STYLE §7's. Balance numbers named below are read from
`game_state.balance` (`balance.<domain>.<NAME>`, ARCHITECTURE §9), never imported from `constants/`: the client
keeps no copy of a balance number (CODE-STANDARDS §2).

Four facts this doc owns: **the HUD reads `WorldStore` through `GameStateService` signals and never touches Pixi**
(ARCHITECTURE §6), **the trait picker never pauses the dish** (PROGRESSION §4), **the exclusion box
(`HUD_PLAYER_EXCLUSION_PX`, §1) is defined here**, and **what the own cell shows, and the reading floor it must meet,
is defined here (§3.1)**; the renderer draws it and RENDERING §10 owns the how. VISUAL-STYLE §6 and RENDERING §6
cite the box.

## 1. Layout frame

Reference viewport **`HUD_REFERENCE_VIEWPORT_WIDTH_PX` × `HUD_REFERENCE_VIEWPORT_HEIGHT_PX`** (1280 × 800 CSS
px), HUD scale 1. Every chrome size below is at scale 1. The scale is a unitless number, not a CSS expression:
`hud.component.ts` observes its host with a `ResizeObserver` and sets the custom property `--hud-scale` from the
pure function `hudScaleFor(width, height)` (`hud/format/hud-scale.ts`, unit-tested) =
`clamp(HUD_SCALE_MIN, min(width / HUD_REFERENCE_VIEWPORT_WIDTH_PX, height / HUD_REFERENCE_VIEWPORT_HEIGHT_PX), HUD_SCALE_MAX)`.
Every length in the HUD stylesheets is `calc(<px> * var(--hud-scale))`; there is no `transform: scale`, so
hit-testing, focus rings and the exclusion check below all happen in real pixels. Elements anchor to their corner
with `HUD_MARGIN_PX` × scale; centre-relative elements (the picker band, §3.2) are placed as offsets from the
viewport centre, never at absolute y. The canvas fills the viewport; the player's cell is at the screen centre
(GAME-DESIGN §7; the follow smoothing keeps it within a few px of it), so the **exclusion box** is the central
square of half-side `HUD_PLAYER_EXCLUSION_PX` = 120 px (scaled): **no DOM element** (chrome, hint, toast or card)
may enter it while the player is alive and the round is `playing`. **The only pixels inside the box besides the
dish are the own cell's indicators (§3.1), drawn by the renderer in world space**; they are not subject to the box
and do not scale with `--hud-scale` (they follow the cell's on-screen size with the px floors of §3.1.3). `me` =
`MultiplayerService.playerId()`, `ownProgress` = `snapshot.players[me]`, `ownCell` = the cell whose `playerId` is
`me` (absent while spectating).

```
 (0,0) ────────────────────────────────────────────────────────────────── 1280
 │ [connection banner when shown]      [toast]        leaderboard 240×146 (16,16 from right)
 │
 │                                   ┌── 240 × 240 ──┐
 │                                   │   own cell    │   no DOM element enters;
 │                                   │  ring · level │   the renderer draws the
 │                                   │  ladder orbit │   indicators here (§3.1)
 │                                   └───────────────┘
 │
 │                                    [hint pill]                                07:42
 800 ────────────────────────────────────────────────────────────────────────  ROUND
```

Client-only layout constants are declared by #100 in `packages/client/src/app/game/hud/hud-constants.ts`
(CODE-STANDARDS §2; the directory does not exist yet):

| Constant                           | Value                   | Unit | Meaning                                                                         |
| ---------------------------------- | ----------------------- | ---- | ------------------------------------------------------------------------------- |
| `HUD_REFERENCE_VIEWPORT_WIDTH_PX`  | 1280                    | px   | Viewport width at which `--hud-scale` is 1.                                     |
| `HUD_REFERENCE_VIEWPORT_HEIGHT_PX` | 800                     | px   | Viewport height at which `--hud-scale` is 1.                                    |
| `HUD_SCALE_MIN`                    | 0.8                     | ×    | Lower bound of `--hud-scale`.                                                   |
| `HUD_SCALE_MAX`                    | 1.5                     | ×    | Upper bound of `--hud-scale`.                                                   |
| `HUD_MARGIN_PX`                    | 16                      | px   | Corner margin at scale 1.                                                       |
| `HUD_PLAYER_EXCLUSION_PX`          | 120                     | px   | Half-side of the exclusion box; also the picker dim's spotlight radius.         |
| `PICKER_BAND_GAP_PX`               | 16                      | px   | Gap between the exclusion box's bottom edge and the picker title row (§3.2).    |
| `PICKER_ROW_GAP_PX`                | 12                      | px   | Gap between the picker's title row, timer bar and card row (§3.2).              |
| `ROUND_LENGTH_CHOICES_SECONDS`     | 60, 300, 600, 900, 1800 | s    | Round-length `<select>` options (§2); every value is inside the session bounds. |
| `HINT_DURATION_SECONDS`            | 4                       | s    | Timed onboarding hints (§5).                                                    |
| `TOAST_DURATION_SECONDS`           | 6                       | s    | Toasts (§3.6).                                                                  |
| `STEER_HINT_DISTANCE_WU`           | 200                     | wu   | Distance travelled that dismisses the steer hint.                               |
| `SPRINT_HINT_AT_SECONDS`           | 30                      | s    | Round time at which the sprint hint shows if never sprinted.                    |
| `STATUS_ANNOUNCE_DNA_STEP_PERCENT` | 25                      | %    | The status mirror (§3.1.4) re-announces DNA only at multiples of this.          |

The on-cell reading-floor constants are §3.1.3's table; their home is `render/constants.ts` because the renderer
applies them, and this doc owns their values. `SNAPSHOT_STALE_MS` (2000 ms: no snapshot for this long while
connected → `stale`, §3.6) is a networking fact, not a HUD one: it lives in `packages/shared/src/constants/netcode.ts`
beside `SNAPSHOT_BUFFER_SIZE`, and `net/` computes the `connectionState` signal from it through the injected `Clock`
(ARCHITECTURE §5: nothing in `game/` reads `Date.now`).

## 2. Screens (lobby)

The join flow is the template's (#100: "lobby tagline and join flow unchanged"), with the game's config fields and
stable test ids added. One `<section>` per panel; every control is a native `<input>`, `<select>` or `<button>`.

| Element                                                                           | Source / target                                                                                                                                                                                                                                                                                                                                                            | `data-testid`                                                                                                  |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Name input, avatar row of 8 swatches (radio group), Connect                       | `joinLobby(name, avatarIndex)`; palette index 0–7 (`AVATAR_INDEX_MAX`)                                                                                                                                                                                                                                                                                                     | `lobby-name`, `lobby-avatar-<i>`, `lobby-connect`                                                              |
| Create: game name, max players 1–8, round length, seed                            | `GameSessionConfig`; round length is a `<select>` over `ROUND_LENGTH_CHOICES_SECONDS` (§1; default `ROUND_DURATION_SECONDS`, bounds `ROUND_DURATION_MIN_SECONDS` / `ROUND_DURATION_MAX_SECONDS` from `constants/session.ts`); seed is a number input prefilled from the client's random source with a "New seed" button; `mode` and `endCondition` are fixed and not shown | `create-name`, `create-max-players`, `create-round-seconds`, `create-seed`, `create-seed-new`, `create-submit` |
| Open games list: name, players/max, `started` badge, Join, Start (host), Delete   | `mp.games()`; joining a started game is a late join (PROGRESSION §5)                                                                                                                                                                                                                                                                                                       | `games-list`, `game-row-<id>`, `game-join-<id>`, `game-start-<id>`, `game-delete-<id>`                         |
| Room (joined, not started): player list, "Waiting for the host to start" or Start | `mp.playerIds()`, `mp.isHost()`                                                                                                                                                                                                                                                                                                                                            | `room-waiting`, `room-start`                                                                                   |
| In game: the canvas host and the HUD overlay                                      | `game-setup.ts`                                                                                                                                                                                                                                                                                                                                                            | `game-canvas`, `hud`                                                                                           |

## 3. In-round HUD and overlays

Every element: source, placement, size, states, text, test id. Text is short and literal (values, not sentences)
except hints and toasts. Numbers are integers; masses round down.

### 3.1 In-round elements (visible while `roundPhase === 'playing'` and `lifeState === 'alive'`)

Option C has two kinds of in-round element. **Chrome** (§3.1.1) is DOM in the corners: the leaderboard and the
round clock, nothing else. **Own-cell indicators** (§3.1.2) are drawn on and around the player's cell by the
renderer from one record the HUD derives (`OwnCellIndicators`, §3.1.4); the level ring, mass readout, DNA line,
ladder hint, minimap, trait strip, sprint meter, key hints and danger chip of the pre-#146 spec are gone, and
their facts live on the cell, in the full leaderboard (mass, §3.1.1), in the menu's trait list (§3.5) and in the
status mirror (§3.1.4) that tests and assistive technology read.

#### 3.1.1 Chrome

| Element     | Source                                                                                                                                                          | Placement, size                                                           | States and text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `data-testid`                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Leaderboard | `snapshot.leaderboard`, names from `players[id].playerName`, swatches from `mp.avatarAssignments()`; the full list adds `LeaderboardRow.mass` and `absorptions` | top-right (16,16), 240 × (26 header + 24 per row), max 5 rows compact     | Columns rank, swatch 10 px, name (ellipsis at 12 chars), level, score in `body`. The swatch is the palette base with a rim-colour ring and `seatMarkBeadCount(avatarIndex)` beads (`hud/format/seat-mark.ts`, §7) = `SEAT_MARK_BEADS[avatarIndex]` = `avatarIndex + 1`, from the shared constant the renderer's seat mark reads (VISUAL-STYLE §2), so a player can match dish to board; the results table (§3.4) reuses the same swatch. Own row tinted (VISUAL-STYLE §7) and always present: if outside the top 5 it replaces row 5; **it is where the level is always legible as text**. Header `LEADERBOARD` in `caption` with `TAB` right-aligned in `caption` muted. **Tab held** (or the header clicked) sets `openOverlay = 'leaderboard'` and expands to the full list: up to 8 rows, 360 wide, adds mass and absorptions columns. Rows re-sort with a 200 ms slide. | `leaderboard`, `leaderboard-row-<playerId>`, `leaderboard-full` |
| Round timer | `snapshot.roundTimeLeftMs`, `mp.sessionConfig().roundDurationSeconds`, `balance.session.ROUND_BLOOM_START_FRACTION`                                             | bottom-right (16,16); `clock` role `07:42`, `ROUND` in `caption` under it | Formatted `m:ss` floor. In bloom the clock turns level gold and the caption reads `BLOOM`. Last 10 s: pulses once per second. `results` phase: hidden (the results overlay shows the countdown).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `hud-round-clock`, `hud-round-phase`                            |

There is no key-hint line: Tab is printed on the leaderboard header, Space is taught by the `sprint` onboarding
beat (§5; the pill reads `TAP sprint` on touch devices), Escape is not taught.

#### 3.1.2 Own-cell indicators (what is shown; RENDERING §10 owns how)

All six live in the own cell's undeformed frame (they never bend with the membrane) and follow the cell's
on-screen radius `r_px` with the floors of §3.1.3. Angles are clockwise from 12 o'clock. Colours are roles.

| Indicator         | Source (ARCHITECTURE §2)                                                                                                                                                                                                                                                                                                                                                                                                                                       | Placement, size                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | States                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DNA ring**      | `ownProgress.dnaTowardNextLevel`, `levelUpCost(level, balance.progression)` (shared `simulation/level-costs.ts`, PROGRESSION §2), `balance.progression.MAX_LEVEL`; the `level_up` effect                                                                                                                                                                                                                                                                       | the nucleus halo: a ring centred on the cell at radius `max(DNA_RING_RADIUS_FRACTION × r_px, DNA_RING_MIN_RADIUS_PX)`, stroke `DNA_RING_STROKE_PX`, always inside the body (organelle slots keep out of it, RENDERING §10); a faint track in the player's rim colour at `DNA_RING_TRACK_ALPHA`, the fill an arc from 12 o'clock clockwise in the DNA colour, round caps                                                                                                                                                                                                                                | `dnaFraction = dnaTowardNextLevel / levelUpCost`, tweened ≤ 200 ms. At `MAX_LEVEL` the ring is full in level gold. On `level_up` (the clip's burst keyframe, RENDERING §4) the ring flashes gold for 300 ms, then the new, near-empty fill shows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Level numeral** | `ownProgress.level`                                                                                                                                                                                                                                                                                                                                                                                                                                            | the ring's centre; `value` role (20 px mono), text colour `WHITE`, on a `LEVEL_NUMERAL_OUTLINE_PX` outline in the callout-backing colour @70 % so it reads over a lit nucleus; never scales                                                                                                                                                                                                                                                                                                                                                                                                            | `1` … `12`; the ring floor (§3.1.3) is chosen so two digits fit inside it. Flashes with the ring on `level_up`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Ladder orbit**  | `ownCell.stage`, `STAGE_GATE_TRAITS` (`constants/ladder.ts`), `ownProgress.bacteriaEatenByVariant`, `balance.ladder.ENDOSYMBIOSIS_BACTERIA_REQUIRED`, `ownCell.traits`, `previewTraitId` (§7)                                                                                                                                                                                                                                                                  | an arc band just outside the identity ring: radius `selfRingPx + LADDER_ORBIT_GAP_PX` (`selfRingPx` = VISUAL-STYLE §2's `SELF_RING_RADIUS_FRACTION × r_px` with its `SELF_RING_MIN_PX` floor). Items lie along the arc on a callout-backing arc `LADDER_BACKING_PX` wide @45 %. A **ghost** is the dashed silhouette of the organelle the next rung draws (nucleoid loop, mitochondrion bean with cristae, chloroplast lens with granules, envelope circle with pores, slipper outline for a form), `LADDER_GHOST_PX` long, tangent to the arc, in its organelle colour (rim colour for nucleus parts) | Per stage. `protocell` → one ghost (nucleoid) at `LADDER_ORBIT_ANGLE_SINGLE_DEG` 180. `prokaryote` → two **counters** at `LADDER_ORBIT_ANGLES_PAIR_DEG` (aerobic 225, photosynthetic 135): ghost, then `ENDOSYMBIOSIS_BACTERIA_REQUIRED` pips clockwise (⌀ `LADDER_PIP_PX`, gap `LADDER_PIP_GAP_PX`), lit in the organelle colour as `bacteriaEatenByVariant[variant]` grows; at `required` the ghost gains a level-gold ring until the trait is picked (this is the counter gameplay-qa flagged: without it the vent trip is a hidden requirement). An owned endosymbiont hides its counter; the other keeps its angle. `endosymbiosis` → envelope ghost at 180; `eukaryote` → form ghost at 180; `specialised` → none. While the picker (§3.2) previews a rung card, that rung's orbit ghost hides (the preview shows the real organelle). |
| **Sprint ring**   | `ownCell.sprintCooldownRemainingTicks` (no client estimate), `ownCell.sprintRemainingTicks`, `balance.controls.SPRINT_COOLDOWN_SECONDS`                                                                                                                                                                                                                                                                                                                        | **the identity ring itself** (VISUAL-STYLE §2's self ring: its radius, dash, width, rotation and colour are unchanged)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Ready (`sprintCooldownRemainingTicks === 0`): the full dashed ring. Cooling: the ring is drawn as an arc from 12 o'clock to `sprintMeterFill` = `1 − remaining / secondsToTicks(SPRINT_COOLDOWN_SECONDS)` clamped to [0, 1] (a cooldown shortened by a folded modifier starts partly drawn). Sprinting (`sprintRemainingTicks > 0`): full ring at the sprint rim brightness (VISUAL-STYLE §5). Reaching ready: one 200 ms brighten, no sound of its own.                                                                                                                                                                                                                                                                                                                                                                                     |
| **Escape arc**    | `ownCell.states` contains `being_engulfed`, `ownCell.engulfProgress`                                                                                                                                                                                                                                                                                                                                                                                           | replaces the ladder orbit on its radius while `being_engulfed`: a danger-colour arc, stroke `ESCAPE_ARC_STROKE_PX`, on a 20 % danger track; a label `SPRINT TO ESCAPE` (`label` role, danger, on the callout backing) `THREAT_LABEL_GAP_PX` above the arc                                                                                                                                                                                                                                                                                                                                              | Fill = `1 − engulfProgress` (drains clockwise from full; escape is possible until it is empty, ECOLOGY §6.1); the label pulses at 1 Hz. The predator's own membrane shows the same progress (its arms and seal, RENDERING §4), so no other bar exists. Hidden otherwise.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Threat label**  | `threats` = `threatsFor(cells, ownCell, cameraExtent, balance.absorption)`: cells for which `canEngulf(cell, ownCell, balance.absorption)` holds (the shared predicate of ECOLOGY §6.1, `shared/simulation/engulf-eligibility.ts`, the same call the server's engulf check and the renderer's warning ring make, so label, ring and engulf agree exactly, Cell Wall included) inside `cameraExtent` (§7), nearest first; `players[threat.playerId].playerName` | on the **nearest** threat's warning ring (the renderer's, VISUAL-STYLE §5), on the side of the ring that faces the own cell (so it is never off-screen and never under a corner panel), `THREAT_LABEL_GAP_PX` off the ring; `label` role bold, danger, on the callout backing; upright, never rotated                                                                                                                                                                                                                                                                                                  | `AMOEBOID CAN ENGULF YOU` (the threat's name, uppercase by role); one label at a time; hidden while `being_engulfed` (the escape arc takes over) and when no threat is on screen. The rings on every threat stay the renderer's.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

**Mass** has no indicator: the cell's size is the mass (ECOLOGY §5.1), the eat pulse and the renderer's `+N`
floaters show gains, and the exact number is on the full leaderboard and in the status mirror. **Owned traits**
are the organelles themselves (VISUAL-STYLE §4); their names, tiers and effects are listed in the menu (§3.5) and
the status mirror.

#### 3.1.3 The reading floor (the fact #146 solves)

Option C as drawn scaled everything with the cell and failed at the sizes the camera actually produces: the own
cell is 24 px at spawn and 33 px for most of a round on the reference viewport, 32 / 45 px at 1080p, 102 px only
at `CELL_MAX_MASS` (VISUAL-STYLE §6, GAME-DESIGN §7). **Rule: every indicator has a size in screen px that never
goes below its floor, whatever `r_px` is**, the same idiom as the self ring's `SELF_RING_MIN_PX` and the warning
ring's `ENGULF_WARNING_RING_MIN_PX`. Sizes tied to the cell use `max(fraction × r_px, floor)`; the rest are fixed
px. Nothing here scales with `--hud-scale`, and nothing here falls back to chrome at any size. Home:
`packages/client/src/app/game/render/constants.ts` (RENDERING §10 applies them); values owned here.

| Constant                             | Value    | Unit | Floor rationale                                                                                                   |
| ------------------------------------ | -------- | ---- | ----------------------------------------------------------------------------------------------------------------- |
| `DNA_RING_RADIUS_FRACTION`           | 0.44     | × r  | Hugs the nucleus sprite's glow (0.40 r, RENDERING §3): "the nucleus halo" of option C.                            |
| `DNA_RING_MIN_RADIUS_PX`             | 17       | px   | The smallest ring whose inside (15 px) holds a two-digit `value` numeral (24 × 14 px box, half-diagonal 14).      |
| `DNA_RING_STROKE_PX`                 | 4        | px   | The width of every chrome fill bar (picker timer, the old sprint meter); a 3 px arc was the failure in C.         |
| `DNA_RING_TRACK_ALPHA`               | 0.18     | ×    | Track visible enough to show where 100 % is, never competing with the fill.                                       |
| `DNA_RING_KEEP_OUT_FRACTION`         | 0.56     | × r  | Organelle slots start here (RENDERING §3), so no sprite sits under the ring at full LOD.                          |
| `LEVEL_NUMERAL_OUTLINE_PX`           | 2        | px   | Keeps the numeral ≥ 7:1 over the lit nucleus and the DNA fill.                                                    |
| `LADDER_ORBIT_GAP_PX`                | 8        | px   | Clear of the self ring's dash and its 20 °/s rotation.                                                            |
| `LADDER_GHOST_PX`                    | 14       | px   | The smallest silhouette that still tells bean (cristae) from lens (granules) from loop.                           |
| `LADDER_PIP_PX`, `LADDER_PIP_GAP_PX` | 4, 3     | px   | Five pips countable at a glance (the seat mark's beads are countable at a 2 px radius; these are 2 px with gaps). |
| `LADDER_ITEM_GAP_PX`                 | 4        | px   | Ghost to first pip.                                                                                               |
| `LADDER_BACKING_PX`                  | 20       | px   | Callout backing under an orbit item, so pips read over a bright zone tint.                                        |
| `LADDER_ORBIT_ANGLE_SINGLE_DEG`      | 180      | °    | A lone ghost sits at 6 o'clock, away from the seat mark's anchor (−135°) and the glint.                           |
| `LADDER_ORBIT_ANGLES_PAIR_DEG`       | 225, 135 | °    | Aerobic lower-left, photosynthetic lower-right; both counters fit with ≥ 8° between them down to 24 px.           |
| `ESCAPE_ARC_STROKE_PX`               | 4        | px   | As the DNA ring.                                                                                                  |
| `THREAT_LABEL_GAP_PX`                | 6        | px   | Label box to ring.                                                                                                |

Geometry at the sizes that matter (what `own-cell-indicators.spec.ts` pins, RENDERING §10; all px):

| Own cell `r_px` | When                            | DNA ring radius (ρ) | Self ring | Ladder orbit | One counter spans | Orbit extent (backing edge) |
| --------------- | ------------------------------- | ------------------- | --------- | ------------ | ----------------- | --------------------------- |
| 24              | spawn on the reference viewport | 17 (0.71)           | 26.9      | 34.9         | 82°               | 45                          |
| 32              | spawn at 1080p                  | 17 (0.53)           | 35.8      | 43.8         | 65°               | 54                          |
| 45              | most of a round at 1080p        | 19.8 (0.44)         | 50.4      | 58.4         | 49°               | 68                          |
| 102             | `CELL_MAX_MASS` at 1080p        | 44.9 (0.44)         | 114.2     | 122.2        | 23°               | 132                         |

The orbit's extent at the cap (132) stays under `HUD_PLAYER_EXCLUSION_PX + PICKER_BAND_GAP_PX` (136), so the
picker band never touches it; the spec pins that inequality. Below `CELL_LOD_FULL_MIN_PX` (a 19 px cell for the
first seconds on the smallest supported viewport, 1024 × 640) the ring band may reach the membrane; accepted.

#### 3.1.4 The `OwnCellIndicators` record and the status mirror

`GameStateService.ownCellIndicators` (§7) is a derived signal built by the pure `ownCellIndicatorsFor(...)`
(`state/own-cell-indicators.ts`, unit-tested with no DOM and no WebGL) from the signals above:

```ts
export interface OwnCellIndicators {
  level: number;
  dnaFraction: number; // 0..1; 1 at MAX_LEVEL
  isMaxLevel: boolean;
  isLevelUpFlash: boolean; // true for 300 ms after the level_up effect
  ladder: { kind: 'none' } | { kind: 'ghost'; traitId: TraitId } | { kind: 'counters'; counters: LadderCounter[] };
  sprintFill: number; // 0..1, 1 = ready
  isSprinting: boolean;
  escape: { progress: number } | null; // set while being_engulfed
  nearestThreat: { cellId: EntityId; label: string } | null; // 'AMOEBOID CAN ENGULF YOU'
}
export interface LadderCounter {
  traitId: TraitId; // mitochondrion | chloroplast
  variant: BacteriumVariant;
  eaten: number;
  required: number;
  angleDeg: number; // from LADDER_ORBIT_ANGLES_PAIR_DEG
}
```

Two consumers, one truth: the renderer draws it (the fourth HUD → Pixi crossing, §7), and the **status mirror**
speaks it. The mirror is one visually hidden element (`hud-own-cell`, `role="status"`, `aria-live="polite"`, the
`visually-hidden` clip pattern, never `display: none`) whose **attributes** update every snapshot and whose
**text** is rewritten only on an event, so assistive technology hears changes and never a 60 Hz stream:

| Attribute                             | Value                                    |
| ------------------------------------- | ---------------------------------------- |
| `data-level`, `data-max-level`        | `4`, `true` / `false`                    |
| `data-dna-percent`                    | `62` (floor)                             |
| `data-aerobic`, `data-photosynthetic` | `2/5`; absent when the counter is hidden |
| `data-ladder`                         | `ghost:nucleoid`, `counters`, `none`     |
| `data-sprint`                         | `ready`, `cooling`, `sprinting`          |
| `data-engulfed`                       | `35` (engulf progress %) or absent       |
| `data-threat`                         | the nearest threat's `cellId` or absent  |
| `data-traits`                         | `nucleoid:1 flagellum:2` (catalog order) |
| `data-mass`                           | `128`                                    |

Text (`body`, hidden): `Level 4 · DNA 62 % · Aerobic 2 of 5 · Photosynthetic 0 of 5 · Sprint ready`, rewritten on
a level change, on every `STATUS_ANNOUNCE_DNA_STEP_PERCENT` crossed, on a counter change, when a threat appears
(`Amoeboid can engulf you`), on `being_engulfed` (`Engulfed · sprint to escape`) and on sprint ready. Playwright
reads the attributes (§8); nothing in the mirror is interactive.

### 3.2 Trait pick overlay (`ownProgress.offer !== null`)

Cards are built from `offer.cards[i]` (`traitId`, `tier`) and the catalog (`TRAIT_CATALOG`, `TRAIT_TIERS`); the
effect text is generated by `describeTierModifiers(traitId, tier)` from the tier's modifier row through a label
table (`speedMultiplier: 1.15` → `+15 % speed`; two lines max), so no card copy is hand-written. The table is
pinned: a unit test asserts every key of `DEFAULT_CELL_MODIFIERS` (TRAITS §2) has a label, so a new modifier
without copy fails the gate instead of rendering `undefined`.

- **Placement.** The band hangs from the exclusion box, so it is placed relative to the viewport centre
  (`centreX`, `centreY` = half the host size, the own cell's screen position), never at an absolute y. With `s` =
  `--hud-scale`: title row top at `centreY + (HUD_PLAYER_EXCLUSION_PX + PICKER_BAND_GAP_PX) × s`
  (`LEVEL 5 · CHOOSE A TRAIT`, `title` role, level gold, centred on `centreX`); timer bar 470 × 4
  `PICKER_ROW_GAP_PX` under the title row (level gold on the timer-bar track, drains left to right); three cards
  150 × 184 with 10 px gaps `PICKER_ROW_GAP_PX` under the bar, centred on `centreX`; key chips `1` `2` `3`
  (`caption`) centred 8 px under each card. Worked example at 1280 × 800: centre (640, 400), title y 536, bar
  y 564, cards y 580–764 at x 405–875. At 1280 × 1000 (scale still 1, capped by width) the band starts at y 636
  and still clears the box; on a viewport shorter than the reference at `HUD_SCALE_MIN` the key chips may touch
  the bottom edge, which is accepted: the cards never enter the box, and the own cell's orbit never reaches the
  band (§3.1.3). The hint pill is hidden while the offer is open; the own-cell indicators, timer and leaderboard
  stay.
- **Dim.** A DOM overlay owned by this doc, not a Pixi quad: a 55 % black `<div>` over the canvas with a
  soft-edged clear disc of radius `HUD_PLAYER_EXCLUSION_PX` × `s` around the centre (`mask-image` radial
  gradient); the HUD never touches Pixi, so VISUAL-STYLE §8's "trait-picker dim" quad is superseded by this
  element (corrected on #34). The dish keeps simulating and the cell keeps steering: pointer input is not captured
  by the overlay (`pointer-events: none` on everything but the cards).
- **Card.** Glyph medallion 56 px, category in `caption`, name in `card_name` bold with tier numeral
  (`Cilia Fringe II`), two effect lines in `label` (mixed case), rarity chip in `caption` (`COMMON` / `UNCOMMON` /
  `RARE`, text as well as colour). A card whose trait is in `STAGE_GATE_TRAITS[next stage]` carries a `RUNG`
  ribbon (the rung card of PROGRESSION §3, which reserves the first card for it; the ribbon text and the test id
  share the one word); its silhouette is the one the ladder orbit has been showing as a ghost (§3.1.2), which is
  the whole point of the ghost. An upgrade card (trait already owned) shows `I → II` in place of the tier.
- **Highlight = hover = keyboard focus = preview.** Exactly one card is highlighted at a time (lift 8 px, accent
  glow); hovering or focusing it writes `HudStateService.previewTraitId` (§7) and the renderer, which receives that
  signal through `game-setup.ts`, draws the trait's organelle ghost on the own cell (RENDERING §3) and hides the
  matching orbit ghost. No card is highlighted until hovered or focused; arrow keys move focus.
- **Pick.** Click, Enter/Space on the focused card, or keys `1` `2` `3` send `traitChoice: { offerId, cardIndex }`
  (one send per offer; the overlay closes on the next snapshot without the offer). Timer text right of the bar:
  `6.5 s` (`value` role) from `(offer.expiresAtTick − serverTickEstimate) / TICK_HZ`. **Timeout is the server's pick** (highest
  draft weight, PROGRESSION §4); the footer reads `At 0 s the dish picks for you`. Sheet 03's "auto-picks the
  highlighted card" is superseded by that rule: the client never sends on the player's behalf, and never sends
  after its local timer reaches 0. Space while focus is inside `trait-offer` picks the focused card and does not
  sprint (§4).
- Test ids: `trait-offer`, `trait-offer-timer`, `trait-card-<i>`, `trait-card-<i>-pick`, `trait-card-rung`,
  `trait-card-upgrade`; the overlay is `role="dialog"` `aria-label="Choose a trait"`.

### 3.3 Death and spectate (`ownProgress.lifeState === 'spectating'`)

The camera follows the killer (GAME-DESIGN §7), so the overlay keeps the centre clear: a 30 % dim and a text
block at top-centre from y 96, 360 wide: `ENGULFED BY AMOEBOID` (`title` role, danger; name from
`players[spectatingPlayerId].playerName`, `ENGULFED` alone if the killer has left), `Respawning in 3` (`value`
role, `ceil(respawnInTicks / TICK_HZ)`, `aria-live="polite"`), `Level 4 and 3 traits kept · 40 DNA lost` (`body`
muted). A spectating player has no cell and `PlayerProgressView` carries no traits (ARCHITECTURE §2), so both
figures come from the `lastAliveOwnCell` signal (§7: the own cell of the last snapshot in which the player was
alive): traits kept = `lastAliveOwnCell.traits.length`, DNA lost = the drop in `dnaTowardNextLevel` between that
snapshot and this one. An open trait offer stays visible and pickable (PROGRESSION §4, P11). There is no own cell,
so there are no own-cell indicators (`ownCellIndicators` is `null` and the mirror reads `data-level` with
`data-spectating="true"`); leaderboard and timer stay. On respawn the indicators return with the `respawn` clip
(VISUAL-STYLE §5). Test ids: `respawn-overlay`, `respawn-killer`, `respawn-countdown`, `respawn-kept`.

### 3.4 Round results and rematch (`roundPhase === 'results'`)

Cells freeze and input is ignored (GAME-DESIGN §5.4), so the exclusion rule is suspended. A 70 % dim and a centred
panel 560 wide: `ROUND OVER` in `label`, `Amoeboid wins` in `headline` with the winner's swatch (`leaderboard[0]`;
`You win` when it is `me`), the full table in `body` (rank, swatch, name, level, mass, absorptions, score; own row
tinted), then `Next round in 17 s` (`body`; counted client-side from the first snapshot whose phase is `results`,
`balance.session.RESULTS_SCREEN_SECONDS` long; `Next round soon` when that snapshot is a late join) and one button
`Leave to lobby` (`mp.disconnect()`, then the lobby screen). Rematch is automatic; there is no button for it. When
the phase returns to `playing` the panel fades out over 300 ms and the HUD resets. Test ids: `results-overlay`,
`results-winner`, `results-row-<rank>`, `results-countdown`, `results-leave`.

### 3.5 Menu (Escape)

Escape closes the topmost open overlay (`openOverlay = 'leaderboard'`) and, with none open, sets
`openOverlay = 'menu'`: a 320-wide centred panel with `Resume` (autofocus), **`Your traits`** (`caption` header
over one `body` line per owned trait, `Cilia Fringe II · +30 % speed`, name and tier from the catalog, effects
from `describeTierModifiers`, catalog order; `No traits yet` before the first pick: this list is where the
pre-#146 trait strip's tooltips went), `Leave to lobby` (`body`), and the line `The dish keeps running while this
is open.` (`body` muted; it does: the sim never pauses). Focus is trapped inside; Escape or Resume closes it and
returns focus to the canvas host. Steering input continues to send the latched target; sprint is swallowed while
the menu is open. **Trait keys stay live:** an open offer keeps its timer running under the menu, so `1` `2` `3`
still pick while the menu is open (the picker stays visible behind the panel); otherwise a player who opened the
menu during an offer would silently get the server's pick. Test ids: `menu-overlay`, `menu-resume`, `menu-traits`,
`menu-trait-<traitId>`, `menu-leave`.

### 3.6 Notices: toasts and connection states

One toast at a time, top-centre at y 16, `body` on the callout backing, `TOAST_DURATION_SECONDS`, newest replaces
oldest, `aria-live="polite"`. Test id `toast` with `data-toast-kind`:

| Kind                    | Trigger                                                                                               | Text                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `late_join`             | first `game_state` with `ownProgress.dnaCatchUpGift > 0`                                              | `Joined late: you start at level 2 with 60 DNA of catch-up. Pick your traits.` |
| `endosymbiont_unlocked` | a `bacteriaEatenByVariant` counter reaches `ENDOSYMBIOSIS_BACTERIA_REQUIRED` for an unowned organelle | `Mitochondrion unlocked: offered at your next level-up.`                       |
| `bloom`                 | the clock enters bloom                                                                                | `Bloom: food and DNA multiply.`                                                |
| `stage`                 | `ownCell.stage` changes                                                                               | `You are a eukaryote.`                                                         |

Connection banner, full width, 32 px tall, `body`, top of the viewport above everything (`connection-banner`,
`data-connection-state`): `disconnected` (danger) `Connection lost · reconnecting…` while the socket is down (the
cell coasts for `DISCONNECT_GRACE_MS`, GAME-DESIGN §5.2); `stale` (level gold) `Waiting for server…` when no
snapshot has arrived for `SNAPSHOT_STALE_MS` (§1, `constants/netcode.ts`) while connected (also what a `debug_pause_room` looks like). Input keeps
being sent in both states; the HUD shows the last snapshot, dimmed 20 %. When the server removes the player the
lobby screen returns with `lobby-notice` = `You were disconnected from the game.`

## 4. Input mapping and keyboard reachability

| Input                | Pointer / touch                                         | Keyboard                                                           | Sent as (ARCHITECTURE §4)                                                                             |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Steer                | pointer position over the canvas → world via the camera | WASD / arrows synthesise a target (GAME-DESIGN §6)                 | `targetX/targetY` every client tick; the pointer's last position is latched when it leaves the canvas |
| Sprint               | left click / tap on the canvas                          | Space (edge-triggered, no repeat) with focus outside `trait-offer` | `sprint: true` once per press                                                                         |
| Pick trait           | click a card                                            | `1` `2` `3`; Enter/Space with focus on a card                      | `traitChoice`                                                                                         |
| Full leaderboard     | click the leaderboard header (toggles)                  | Tab held                                                           | local                                                                                                 |
| Menu / close overlay | —                                                       | Escape                                                             | local                                                                                                 |
| Owned traits         | Escape → `Your traits` (§3.5)                           | Escape, then Tab through the list                                  | local                                                                                                 |

- Hotkeys are handled by `input/keyboard-input.ts` on `document` while `mp.inGame()`; they are ignored when focus is
  in a text field, and all but `1` `2` `3` are ignored while the menu is open (§3.5). Tab is `preventDefault`ed only
  while no overlay with focusable controls is open, so the trait picker, menu and results remain fully tab-navigable.
- **Space precedence.** Space is both sprint and "pick the focused card". The handler checks `document.activeElement`:
  inside `trait-offer` it picks (the card's own key handler runs, the sprint path does not); anywhere else it sprints.
  Opening the picker never moves focus by itself, so a player who keeps swimming keeps sprinting with Space until
  they Tab or arrow into a card.
- Every interactive element is a native `<button>` or form control with a visible focus ring (2 px, text colour);
  overlays trap focus and restore it on close; the canvas host has `tabindex="0"` and takes focus on click. The
  own-cell indicators are not interactive; their facts reach keyboard and screen-reader users through the status
  mirror (§3.1.4) and the menu (§3.5).
- Touch: pointer events only (GAME-DESIGN §10); no layout changes beyond the sprint hint's text.

## 5. Onboarding: the first two minutes

Diegetic and text hints, no modal tutorial. Hints show in the hint pill (bottom-centre, `HUD_MARGIN_PX` from the
bottom edge, `body` on the callout backing, `hint`, `data-hint-id`); `OnboardingService` keeps seen-flags in memory
for the session (a reload replays them; a rematch does not). One hint at a time, in this order; each is dismissed
by its trigger or after `HINT_DURATION_SECONDS` once its dismissal condition is met. Every beat points at
something on the cell, never at a corner.

| Beat         | When                                                      | What the player sees                                                                                                                                                                                             | Dismissed by                       | `data-hint-id`  |
| ------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------- |
| Spawn        | first alive snapshot of the session                       | The protocell at centre with its empty ring, the `1` and the nucleoid ghost below it; a pointer reticle and a dotted line cell → pointer (renderer, world-anchored); pill `Move the pointer · your cell follows` | `STEER_HINT_DISTANCE_WU` travelled | `steer`         |
| First eat    | after `steer`, until the first `eat` effect for `ownCell` | Pill `Swallow motes to grow`; on the first eat the cell's eat pulse (renderer)                                                                                                                                   | first eat                          | `eat`           |
| First DNA    | first snapshot with `dnaCumulative > 0`                   | The ring's first fill lights; pill `DNA fills the ring around your nucleus · fill it to evolve`                                                                                                                  | timer                              | `dna`           |
| Sprint       | round time ≥ `SPRINT_HINT_AT_SECONDS` and never sprinted  | Pill `SPACE sprint · costs mass · your white ring recharges` (`TAP sprint …` on touch)                                                                                                                           | first sprint or timer              | `sprint`        |
| First offer  | first `offer` shown                                       | The picker with an extra footer line `1 2 3 or click · you keep swimming`; the `RUNG` ribbon on the nucleoid card, whose silhouette the orbit ghost has been showing                                             | pick / timeout                     | `offer`         |
| Prokaryote   | stage becomes `prokaryote`                                | The two counters appear on the orbit; toast `stage`; pill `Eat 5 orange rods at the warm vent or 5 green in the shallows · the pips count them`                                                                  | timer                              | `endosymbiosis` |
| First threat | first time `nearestThreat` is non-null                    | The renderer's ring and the label on the threat; pill `Bigger cells engulf you · sprint away`                                                                                                                    | timer                              | `threat`        |

## 6. Readability during play

- **Exclusion box** (§1) is absolute for DOM while alive and playing; the picker's dim keeps its spotlight; toasts
  and the connection banner stack from the top, never downward past y 96. Inside the box the own cell and its
  indicators are the only drawn things besides the dish (§3.1.2).
- **Floors.** Every on-cell indicator meets §3.1.3's floors at every camera zoom; the fact carriers are the DNA
  fill (≥ 4 px), the numeral (`value`), the pips (countable) and the threat label (`label`); a ghost is a hint and
  may be the only thing that shrinks toward its 14 px floor.
- **Backing.** Text over the dish always sits on the callout backing role (VISUAL-STYLE §2, blurred for DOM; a
  flat backing sprite for the renderer's labels); panels use the panel gradient and rim roles. Contrast: `body`
  text ≥ 4.5:1 against its backing, values, the numeral and the threat label ≥ 7:1, muted labels ≥ 3:1 and never
  carry a fact on their own.
- **Type.** Roles only (VISUAL-STYLE §7), in the DOM and in the renderer's text alike. The smallest role this doc
  uses is `caption` (11 px there: clock caption, leaderboard header, chips); nothing is set smaller, and no
  element in this doc uses a size outside the role list. Anything a player must read is `label` or larger; changing
  numbers (clock, countdowns, the level numeral, picker timer) use the mono roles (`number`, `clock`, `value`) so
  tabular digits do not jitter. `label` and `caption` are uppercase by role; an element written in mixed case above
  (card effect lines, menu trait lines) keeps the role's size, weight and tracking without the uppercase transform.
- **Motion.** HUD values tween ≤ 200 ms; nothing in the HUD moves during play except fills (DNA ring, sprint ring,
  escape arc, timer bar) and the leaderboard's 200 ms re-sort; flashes ≤ 300 ms, at most one per second. The
  indicators ride the cell's predicted position (RENDERING §1) and never lag it.
- **Colour is never the only carrier**: rarity, danger, bloom and stage all have a text label as well; the two
  counters differ by silhouette (bean vs lens) and angle, not only by orange vs green; a full counter is a gold ring
  plus five lit pips.
- **Coverage.** HUD chrome ≤ 8 % of the viewport at scale 1 (leaderboard and clock, 5 % at the reference size);
  overlays (picker, respawn) ≤ 40 %; results may cover the centre because the dish is frozen.

## 7. Angular component plan

Standalone, `OnPush`, signal inputs, no game logic: components format and lay out; every decision is a pure function
under `hud/format/` (or `state/` for the record, §3.1.4) with unit tests, and every fact comes from `GameStateService`
(the signal facade of `WorldStore`, ARCHITECTURE §5). Files ≤ 250 lines, one component per file
(`packages/client/src/app/game/hud/`). **This table is the one home of the HUD component and file list**:
ARCHITECTURE §6 points here and §10's file plan lists the same files without naming components.

| Component / file                                                 | Reads (signals)                                                                                                                                                                                                                                                                                                                                                               | Writes                                | Owns test ids                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `hud.component.ts` (shell, `hud`)                                | `roundPhase`, `lifeState`, `offer`, `openOverlay`; `ResizeObserver` on the host → `--hud-scale` (§1)                                                                                                                                                                                                                                                                          | —                                     | `hud`, layout slots                                                                        |
| `own-cell-status.component.ts` (the status mirror, §3.1.4)       | `ownCellIndicators`, `ownCell`, `ownProgress`, catalog                                                                                                                                                                                                                                                                                                                        | —                                     | `hud-own-cell`                                                                             |
| `leaderboard-panel.component.ts`                                 | `leaderboard`, `players`, `avatarAssignments`, `openOverlay`                                                                                                                                                                                                                                                                                                                  | `openOverlay` (`'leaderboard'`)       | `leaderboard*`                                                                             |
| `round-timer.component.ts`                                       | `roundTimeLeftMs`, `sessionConfig`, `balance.session`                                                                                                                                                                                                                                                                                                                         | —                                     | `hud-round-*`                                                                              |
| `trait-offer-overlay.component.ts`, `trait-card.component.ts`    | `offer`, `serverTickEstimate`, catalog, `describeTierModifiers`                                                                                                                                                                                                                                                                                                               | `previewTraitId`, `sendTraitChoice()` | `trait-offer*`, `trait-card-*`                                                             |
| `respawn-overlay.component.ts`                                   | `ownProgress`, `players`, `lastAliveOwnCell`                                                                                                                                                                                                                                                                                                                                  | —                                     | `respawn-*`                                                                                |
| `results-overlay.component.ts`                                   | `leaderboard`, `players`, `resultsStartedAtTick`, `balance.session`                                                                                                                                                                                                                                                                                                           | `leave()`                             | `results-*`                                                                                |
| `menu-overlay.component.ts`                                      | `openOverlay`, `ownCell.traits`, catalog, `describeTierModifiers`                                                                                                                                                                                                                                                                                                             | `openOverlay`, `leave()`              | `menu-*`                                                                                   |
| `hint.component.ts`, `toast.component.ts`                        | `OnboardingService.current`, `ToastService.current`                                                                                                                                                                                                                                                                                                                           | —                                     | `hint`, `toast`                                                                            |
| `connection-banner.component.ts`                                 | `connectionState`                                                                                                                                                                                                                                                                                                                                                             | —                                     | `connection-banner`                                                                        |
| `hud/format/*.ts` (pure)                                         | `hudScaleFor`, `formatRoundClock`, `describeTierModifiers` (label table pinned against every `DEFAULT_CELL_MODIFIERS` key), `threatsFor` (over the shared `canEngulf`), `seatMarkBeadCount` (over the shared `SEAT_MARK_BEADS`, `constants/lobby.ts` beside `AVATAR_INDEX_MAX`), `sprintMeterFill`, `formatDnaLoss`, `formatOwnCellStatus` (the mirror's text and attributes) | —                                     | unit-tested, no DOM                                                                        |
| `state/own-cell-indicators.ts` (pure)                            | `ownCellIndicatorsFor(ownCell, ownProgress, balance, threats, players, previewTraitId, levelUpFlashUntilTick)` → `OwnCellIndicators`; `ladderFor(stage, traits, counters, previewTraitId)`                                                                                                                                                                                    | —                                     | unit-tested, no DOM                                                                        |
| `hud/hud-state.service.ts`                                       | —                                                                                                                                                                                                                                                                                                                                                                             | the writable UI signals (below)       | —                                                                                          |
| `hud/onboarding.service.ts`, `hud/toast.service.ts`              | `GameStateService`, effects                                                                                                                                                                                                                                                                                                                                                   | `current`, `reticleVisible`           | —                                                                                          |
| `hud/hud-constants.ts`, `hud/test-ids.ts`, `hud/trait-glyphs.ts` | §1's constants; `HUD_TEST_ID` (`as const`, camelCase keys, the id strings of this doc as values); one inline SVG glyph per `TraitId` for the picker cards and the menu list, pinned by a test that every catalog id has one                                                                                                                                                   | —                                     | components and the Playwright loop both import `HUD_TEST_ID`; no id literal is typed twice |

Two services, two kinds of signal:

- `state/game-state.service.ts` (`GameStateService`, the facade of `WorldStore`, never a second model) holds only
  **derived** signals: `me`, `ownCell`, `ownProgress`, `balance` (the snapshot's `game_state.balance`), `threats`,
  `ownCellIndicators` (§3.1.4; `null` while spectating), `connectionState`, `resultsStartedAtTick`,
  `serverTickEstimate`, `lastAliveOwnCell` (the own cell of the last snapshot with `lifeState === 'alive'`, kept
  until the next alive snapshot; §3.3) and `cameraExtent` (a world-space rectangle written by the render loop each
  frame through `game-setup.ts`; §3.1.2 `threatsFor` reads it, and it is the only render-side fact the HUD consumes).
- `hud/hud-state.service.ts` (`HudStateService`) holds the **writable** UI signals: `previewTraitId`
  (`TraitId | null`), `openOverlay` (`'none' | 'menu' | 'leaderboard'`; the full leaderboard is an overlay, so
  there is no separate expanded flag) and the onboarding `reticleVisible` flag.

The HUD ↔ Pixi crossings are exactly four, all wired in `game-setup.ts` so that `render/` never imports from
`hud/` or `state/` services: the renderer receives `previewTraitId`, `reticleVisible` and `ownCellIndicators` as
read-only signals, and writes `cameraExtent`. Nothing else crosses; the renderer draws the indicators from the
record alone and computes only geometry (RENDERING §10).

## 8. Acceptance (the Playwright loop #100 drives)

`OC` = `hud-own-cell` (§3.1.4). Pixel checks on the cell are graphics-qa's screenshot baselines (RENDERING §9,
which gain the four sizes of §3.1.3), not this loop.

| #   | Steps                                                    | Assert (by test id)                                                                                                                                                                                                              |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | connect, create (seed 42, 60 s), start                   | `game-canvas`, `hud`, `OC[data-level]` = 1, `OC[data-dna-percent]` = 0, `OC[data-ladder]` = `ghost:nucleoid`, `hud-round-clock` ≈ `1:00`, `hint[data-hint-id=steer]` visible                                                     |
| U2  | move the pointer 300 px right for 1 s                    | steer hint gone, `OC[data-mass]` unchanged or larger, `leaderboard-row-<me>` present                                                                                                                                             |
| U3  | `debug_grant_dna` 20                                     | `trait-offer` visible with three `trait-card-*`, `trait-card-rung` on the nucleoid card (its `RUNG` ribbon)                                                                                                                      |
| U4  | press `1`                                                | `trait-offer` gone within 2 snapshots, `OC[data-traits]` contains `nucleoid:1`, `OC[data-ladder]` = `counters`, `OC[data-aerobic]` = `0/5`, `OC[data-photosynthetic]` = `0/5`                                                    |
| U5  | `debug_spawn` a 200-mass cell adjacent, wait             | `OC[data-threat]` set, then `OC[data-engulfed]` set, then `respawn-overlay` with `respawn-countdown` 3 → 1, then `OC[data-mass]` = starting mass and `OC[data-level]` kept                                                       |
| U6  | hold Tab; press Escape; wait for the timer to reach zero | `leaderboard-full` while held; `menu-overlay` with focus on `menu-resume` and `menu-trait-nucleoid` listed; ids read from `HUD_TEST_ID`; `results-overlay` with `results-row-1`, then `hud` again after `RESULTS_SCREEN_SECONDS` |
| U7  | `debug_set_player` sprint on cooldown; wait              | `OC[data-sprint]` = `cooling`, then `ready`                                                                                                                                                                                      |
