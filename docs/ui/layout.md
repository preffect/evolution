# Evolution — UI: HUD, overlays and onboarding: layout frame and lobby screens

§1–§2 of the split [`UI.md`](../UI.md), which keeps the shared context and the file list.

## 1. Layout frame

Reference viewport **`UI_REFERENCE_VIEWPORT_WIDTH_PX` × `UI_REFERENCE_VIEWPORT_HEIGHT_PX`** (1280 × 800 CSS
px), HUD scale 1. Every chrome size below is at scale 1. The scale is a unitless number, not a CSS expression:
`hud.component.ts` observes its host with a `ResizeObserver` and sets the kit's custom property `--ui-scale` from the
UI kit's pure function `uiScaleFor(width, height)` (`ui-kit/format/ui-scale.ts`, unit-tested; a `[uiSurface]` sets it
from the same function, components-and-constants.md §10.1; the HUD's own `--hud-scale` went in #381) =
`clamp(UI_SCALE_MIN, min(width / UI_REFERENCE_VIEWPORT_WIDTH_PX, height / UI_REFERENCE_VIEWPORT_HEIGHT_PX), UI_SCALE_MAX)`.
Every length in the HUD stylesheets is `calc(<px> * var(--ui-scale))`; there is no `transform: scale`, so
hit-testing, focus rings and the exclusion check below all happen in real pixels. Elements anchor to their corner
with `HUD_MARGIN_PX` × scale; centre-relative elements (the picker band, §3.2) are placed as offsets from the
viewport centre, never at absolute y. The canvas fills the viewport; the player's cell is at the screen centre
(game-design/controls-and-scope.md §7; the follow smoothing keeps it within a few px of it), so the **exclusion box** is the central
square of half-side `HUD_PLAYER_EXCLUSION_PX` = 120 px (scaled): **no DOM element** (chrome, hint, toast or card)
may enter it while the player is alive and the round is `playing`. The rule holds at and above the viewport the
`UI_SCALE_MIN` floor implies (1024 × 640); below that the floor stops shrinking the chrome while the box keeps its
120 px half-side, and the widened leaderboard overlaps it at around 794 px of width. That is under the smallest
viewport the game targets, so it is recorded rather than solved. **The only pixels inside the box besides the
dish are the own cell's indicators and legibility cues (hud.md §3.1.2, §3.1.5), drawn by the renderer in world
space**; they are not subject to the box and do not scale with `--ui-scale` (they follow the cell's on-screen size
with the px floors of §3.1.3). The cues (the mass chip, rate tags, floaters, zone pill and the relation labels) were
let in by decision #324: the box keeps DOM out, it never kept the renderer out, and a cue about the cell has to sit
on the cell. They may reach past the box (the rate-tag column at the cap), but never into the notice stack above
`NOTICE_STACK_MAX_Y_PX` (hud.md §3.1.5's inequality). `me` =
`MultiplayerService.playerId()`, `ownProgress` = `snapshot.ownProgress` (sent to `me` alone; `snapshot.players[id]`
is only the roster row `{ playerId, playerName }`, architecture/wire-contract.md §4.1), `ownCell` = the cell whose `playerId` is
`me` (absent while spectating).

```
 (0,0) ────────────────────────────────────────────────────────────────── 1280
 │ [connection banner when shown]      [toast]        leaderboard 240×162 (16,16 from right)
 │ [hold-Tab panel, overlays.md §3.7]
 │                                   ┌── 240 × 240 ──┐
 │                                   │  rate tags    │   no DOM element enters;
 │                                   │  mass chip    │   the renderer draws the
 │                                   │  own cell  +3 │   indicators and cues here
 │                                   │  ladder orbit │   (hud.md §3.1.2, §3.1.5)
 │                                   │  zone pill    │
 │                                   └───────────────┘
 │
 │                                    [hint pill]                                07:42
 800 ────────────────────────────────────────────────────────────────────────  ROUND
```

Client-only layout constants are declared by #100 in `packages/client/src/app/game/hud/hud-constants.ts`
(CODE-STANDARDS §2), except the scale's four, which #369 moved into the UI kit's `ui-kit/ui-kit-constants.ts`:

| Constant                           | Value                   | Unit  | Meaning                                                                                                                 |
| ---------------------------------- | ----------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------- |
| `UI_REFERENCE_VIEWPORT_WIDTH_PX`   | 1280                    | px    | Viewport width at which the scale is 1.                                                                                 |
| `UI_REFERENCE_VIEWPORT_HEIGHT_PX`  | 800                     | px    | Viewport height at which the scale is 1.                                                                                |
| `UI_SCALE_MIN`                     | 0.8                     | ×     | Lower bound of the scale.                                                                                               |
| `UI_SCALE_MAX`                     | 1.5                     | ×     | Upper bound of the scale.                                                                                               |
| `HUD_MARGIN_PX`                    | 16                      | px    | Corner margin at scale 1.                                                                                               |
| `HUD_PLAYER_EXCLUSION_PX`          | 120                     | px    | Half-side of the exclusion box; the floor of the picker dim's spotlight radius (overlays.md §3.2).                      |
| `PICKER_BAND_GAP_PX`               | 16                      | px    | Gap between the exclusion box's bottom edge and the picker title row (§3.2).                                            |
| `PICKER_ROW_GAP_PX`                | 12                      | px    | Gap between the picker's title row, timer bar and card row (§3.2).                                                      |
| `ROUND_LENGTH_CHOICES_SECONDS`     | 60, 300, 600, 900, 1800 | s     | Round-length `<select>` options (§2); every value is inside the session bounds.                                         |
| `HINT_DURATION_SECONDS`            | 4                       | s     | Timed onboarding hints (§5).                                                                                            |
| `TOAST_DURATION_SECONDS`           | 6                       | s     | Toasts (§3.6).                                                                                                          |
| `STEER_HINT_DISTANCE_WU`           | 200                     | wu    | Distance travelled that dismisses the steer hint.                                                                       |
| `SPRINT_HINT_AT_SECONDS`           | 30                      | s     | Round time at which the sprint hint shows if never sprinted.                                                            |
| `STATUS_ANNOUNCE_DNA_STEP_PERCENT` | 25                      | %     | The status mirror (§3.1.4) re-announces DNA only at multiples of this.                                                  |
| `NOTICE_STACK_MAX_Y_PX`            | 96                      | px    | Lowest edge of the connection banner and error rows (overlays.md §3.6); no renderer cue rises above it (hud.md §3.1.5). |
| `PICKER_BAND_ORBIT_CLEARANCE_PX`   | 4                       | px    | Least gap between the own cell's orbit extent at `CELL_MAX_MASS` and the picker title row (overlays.md §3.2).           |
| `LEADERBOARD_FOOTER_ROW_HEIGHT_PX` | 24                      | px    | The full board's score rule row (hud.md §3.1.1).                                                                        |
| `HINT_RIM_PX`                      | 2                       | px    | A coach beat's role-colour rim on the hint pill (input-and-onboarding.md §5).                                           |
| `COACH_QUEUE_MAX`                  | 2                       | beats | Coach beats waiting behind the pill that is up (input-and-onboarding.md §5).                                            |
| `COACH_SHRINK_HOLD_SECONDS`        | 3                       | s     | The mass trend reads `down` this long before the `shrink` beat fires: a sprint alone does not.                          |
| `COACH_PREY_REACH_RADII`           | 4                       | × r   | Edge-to-edge distance, in own radii, at which an edible cell fires the `prey` beat: before contact, so it can be read.  |
| `HINT_MIN_SECONDS`                 | 1.5                     | s     | The least time the `prey` pill stays up before the player's engulf can dismiss it.                                      |

The chrome's own sizes are §3.1.1's (panel widths, the header and row heights, the row counts, the name cut, the
200 ms re-sort slide, the swatch, the 12 % own-row tint and the last-ten-seconds pulse); they live in the same file,
named after the element they size, because they are HUD layout by the row above. Angular resolves a component's
styles at build time and so cannot interpolate a constant: the shell publishes every one of them as a `--hud-…`
custom property (`hud/format/hud-css-variables.ts`) and the stylesheets read `var(--hud-…)`, so the value still
has exactly one home. That indirection is only worth anything if it is enforced, so its spec is exhaustive rather
than a sample: it pins every published entry against its constant **and** asserts the published keys are exactly
that set, which is what stops a hand-typed number joining the map unnoticed. The type scale and the two font stacks are
visual-style/ui-type.md §7's and live beside the colours it owns, in `render/constants/ui-type.ts`.

The on-cell reading-floor constants are §3.1.3's table; their home is `render/constants.ts` because the renderer
applies them, and this doc owns their values. `SNAPSHOT_STALE_MS` (2000 ms: no snapshot for this long while
connected → `stale`, §3.6) is a networking fact, not a HUD one: it lives in `packages/shared/src/constants/netcode.ts`
beside `SNAPSHOT_BUFFER_SIZE`, and `net/snapshot-staleness.ts` waits it out through the injected `Scheduler` for the
`connectionState` signal (architecture/client.md §5: nothing in `game/` reads `Date.now` or `setTimeout`).

## 2. Screens (lobby)

The join flow is the template's (#100: "lobby tagline and join flow unchanged"), with the game's config fields and
stable test ids added. The lobby is one full-viewport kit surface (`.lobby[uiSurface]`, components-and-constants.md
§10.1) on the game's dark panel ground (decision #595, option A; #464). One `<section>` per panel, each drawn as a
kit panel. Every button is the kit's `uiButton`, ranked by variant: `primary` for the panel's main action (Connect,
Create, a row's Join), `secondary` for the rest (Disconnect, New seed, Start), `danger` for Delete, and `quiet` for
the header's `Encyclopedia`. The text and number fields are native `<input>`s dressed as the kit's search field
(the well, the panel rim, the unscaled focus ring), since the kit has no plain field yet.

| Element                                                                           | Source / target                                                                                                                                                                                                                                                                                                                                                            | `data-testid`                                                                                                  |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Name input, avatar row of 8 swatches (radio group), Connect                       | `joinLobby(name, avatarIndex)`; palette index 0–7 (`AVATAR_INDEX_MAX`)                                                                                                                                                                                                                                                                                                     | `lobby-name`, `lobby-avatar-<i>`, `lobby-connect`                                                              |
| Create: game name, max players 1–8, round length, seed                            | `GameSessionConfig`; round length is a `<select>` over `ROUND_LENGTH_CHOICES_SECONDS` (§1; default `ROUND_DURATION_SECONDS`, bounds `ROUND_DURATION_MIN_SECONDS` / `ROUND_DURATION_MAX_SECONDS` from `constants/session.ts`); seed is a number input prefilled from the client's random source with a "New seed" button; `mode` and `endCondition` are fixed and not shown | `create-name`, `create-max-players`, `create-round-seconds`, `create-seed`, `create-seed-new`, `create-submit` |
| Open games list: name, players/max, `started` badge, Join, Start (host), Delete   | `mp.games()`; joining a started game is a late join (PROGRESSION §5) while a seat is free: players/max counts humans only (connected plus in grace, bots excluded), and a full room, started or not, shows Join disabled (#337, game-design/session.md §5)                                                                                                                 | `games-list`, `game-row-<id>`, `game-join-<id>`, `game-start-<id>`, `game-delete-<id>`                         |
| Room (joined, not started): player list, "Waiting for the host to start" or Start | `mp.playerIds()`, `mp.isHost()`                                                                                                                                                                                                                                                                                                                                            | `room-waiting`, `room-start`                                                                                   |
| In game: the canvas host and the HUD overlay                                      | `game-setup.ts`                                                                                                                                                                                                                                                                                                                                                            | `game-canvas`, `hud`                                                                                           |
| Lobby header: `Encyclopedia` button                                               | opens the encyclopedia over the lobby (encyclopedia.md §11.1)                                                                                                                                                                                                                                                                                                              | `lobby-encyclopedia`                                                                                           |
