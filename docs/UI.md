# Evolution — UI: HUD, overlays and onboarding

Ticket: #30. Epic #2. Implemented by #100. Rules and numbers this doc draws on live elsewhere and are linked,
never restated: controls, session and camera in [`GAME-DESIGN.md`](./GAME-DESIGN.md) §5–§7; offers and
catch-up in [`PROGRESSION.md`](./PROGRESSION.md) §4–§5; the catalog in [`TRAITS.md`](./TRAITS.md); the
endosymbiosis counters in [`ECOLOGY.md §1`](./ECOLOGY.md#1-food-kinds); every snapshot field named below in
[`ARCHITECTURE.md §2`](./ARCHITECTURE.md#2-entity-model) and §4; the look in the HUD and picker panels of concept
sheet 03 ([`concept-art/README.md`](./concept-art/README.md#sheet-03--motion-studies-and-hud-motion-and-hudsvg-106))
and [`VISUAL-STYLE.md`](./VISUAL-STYLE.md) (#34), which owns colours (§2) and type (§7). This doc holds no hex
value and no type size: colours are cited by role (DNA, level gold, danger, accent, panel gradient and rim,
callout backing, timer-bar track, identity ring, text / label / muted) and text by type role (`number`,
`headline`, `clock`, `title`, `value`, `card name`, `body`, `label`, `caption`); the sizes, fonts and case of
each role are VISUAL-STYLE §7's. Balance numbers named below are read from `game_state.balance`
(`balance.<domain>.<NAME>`, ARCHITECTURE §9), never imported from `constants/`: the client keeps no copy of a
balance number (CODE-STANDARDS §2).

Three facts this doc owns: **the HUD reads `WorldStore` through `GameStateService` signals and never touches
Pixi** (ARCHITECTURE §6), **the trait picker never pauses the dish** (PROGRESSION §4), and **the exclusion box
(`HUD_PLAYER_EXCLUSION_PX`, §1) is defined here**; VISUAL-STYLE §6 and sheet 03 link to it.

## 1. Layout frame

Reference viewport **`HUD_REFERENCE_VIEWPORT_WIDTH_PX` × `HUD_REFERENCE_VIEWPORT_HEIGHT_PX`** (1280 × 800 CSS
px), HUD scale 1. Every size below is at scale 1. The scale is a unitless number, not a CSS expression:
`hud.component.ts` observes its host with a `ResizeObserver` and sets the custom property `--hud-scale` from the
pure function `hudScaleFor(width, height)` (`hud/format/hud-scale.ts`, unit-tested) =
`clamp(HUD_SCALE_MIN, min(width / HUD_REFERENCE_VIEWPORT_WIDTH_PX, height / HUD_REFERENCE_VIEWPORT_HEIGHT_PX), HUD_SCALE_MAX)`.
Every length in the HUD stylesheets is `calc(<px> * var(--hud-scale))`; there is no `transform: scale`, so
hit-testing, focus rings and the exclusion check below all happen in real pixels. Elements anchor to their corner
with `HUD_MARGIN_PX` × scale; centre-relative elements (the picker band, §3.2) are placed as offsets from the
viewport centre, never at absolute y. The canvas fills the viewport; the player's cell is always at the screen
centre (GAME-DESIGN §7), so the **exclusion box** is the central square of half-side `HUD_PLAYER_EXCLUSION_PX`
= 120 px (scaled): no HUD element, hint, toast or card may enter it while the player is alive and the round is
`playing`. This constant and the fact that it scales are owned here; VISUAL-STYLE §6 and sheet 03 cite it. `me` = `MultiplayerService.playerId()`, `ownProgress` =
`snapshot.players[me]`, `ownCell` = the cell whose `playerId` is `me` (absent while spectating).

```
 (0,0) ────────────────────────────────────────────────────────────────── 1280
 │ (16,16) level ring ⌀72 · 128 mass        [danger chip]       leaderboard 240×146 (16 from right)
 │         DNA 62 % · 18 to level 5         [toast]
 │         aerobic 2/5 vent · photosynthetic 0/5 shallows
 │
 │                                   ┌── 240 × 240 ──┐
 │                                   │   own cell    │   nothing drawn here
 │                                   └───────────────┘
 │
 │ minimap ⌀120 (16,16 from            [hint pill]                  07:42  ROUND
 │ bottom-left)                    PROKARYOTE · trait strip     SPACE sprint · TAB board · ESC menu
 800 ─────────────────────────────────────────────────────────────────────
```

Client-only layout constants are declared by #100 in `packages/client/src/app/game/hud/hud-constants.ts`
(CODE-STANDARDS §2; the directory does not exist yet):

| Constant                           | Value                   | Unit  | Meaning                                                                         |
| ---------------------------------- | ----------------------- | ----- | ------------------------------------------------------------------------------- |
| `HUD_REFERENCE_VIEWPORT_WIDTH_PX`  | 1280                    | px    | Viewport width at which `--hud-scale` is 1.                                     |
| `HUD_REFERENCE_VIEWPORT_HEIGHT_PX` | 800                     | px    | Viewport height at which `--hud-scale` is 1.                                    |
| `HUD_SCALE_MIN`                    | 0.8                     | ×     | Lower bound of `--hud-scale`.                                                   |
| `HUD_SCALE_MAX`                    | 1.5                     | ×     | Upper bound of `--hud-scale`.                                                   |
| `HUD_MARGIN_PX`                    | 16                      | px    | Corner margin at scale 1.                                                       |
| `HUD_PLAYER_EXCLUSION_PX`          | 120                     | px    | Half-side of the exclusion box; also the picker dim's spotlight radius.         |
| `PICKER_BAND_GAP_PX`               | 16                      | px    | Gap between the exclusion box's bottom edge and the picker title row (§3.2).    |
| `PICKER_ROW_GAP_PX`                | 12                      | px    | Gap between the picker's title row, timer bar and card row (§3.2).              |
| `ROUND_LENGTH_CHOICES_SECONDS`     | 60, 300, 600, 900, 1800 | s     | Round-length `<select>` options (§2); every value is inside the session bounds. |
| `HINT_DURATION_SECONDS`            | 4                       | s     | Timed onboarding hints (§5).                                                    |
| `TOAST_DURATION_SECONDS`           | 6                       | s     | Toasts (§3.6).                                                                  |
| `STEER_HINT_DISTANCE_WU`           | 200                     | wu    | Distance travelled that dismisses the steer hint.                               |
| `SPRINT_HINT_AT_SECONDS`           | 30                      | s     | Round time at which the sprint hint shows if never sprinted.                    |
| `TRAIT_STRIP_MIN_SLOTS`            | 5                       | slots | Empty dashed slots shown before the cell owns five traits.                      |

`SNAPSHOT_STALE_MS` (2000 ms: no snapshot for this long while connected → `stale`, §3.6) is a networking fact, not
a HUD one: it lives in `packages/shared/src/constants/netcode.ts` beside `SNAPSHOT_BUFFER_SIZE`, and `net/`
computes the `connectionState` signal from it through the injected `Clock` (ARCHITECTURE §5: nothing in `game/`
reads `Date.now`).

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

Every element: source, placement (scale 1, corner-anchored), size, states, text, test id. Text is short and
literal (values, not sentences) except hints and toasts. Numbers are integers; masses round down.

### 3.1 HUD elements (visible while `roundPhase === 'playing'` and `lifeState === 'alive'`)

| Element      | Source                                                                                                                                                                                                                                                                                                       | Placement, size                                                                                                             | States and text                                                                                                                                                                                                                                                                                                                                                                                                                                               | `data-testid`                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Level ring   | `ownProgress.level`, `dnaTowardNextLevel`, `levelUpCost(level, balance.progression)` (shared `simulation/level-costs.ts`, PROGRESSION §2)                                                                                                                                                                    | top-left (16,16), ⌀72, stroke 6, DNA colour on the panel-rim track                                                          | Ring fill = `dnaTowardNextLevel / levelUpCost`; `number` role bold, `LEVEL` in `caption` under it. At `balance.progression.MAX_LEVEL` the ring is full in level gold and the label reads `MAX`. On `level_up` effect: ring flashes gold for 300 ms.                                                                                                                                                                                                           | `hud-level`, `hud-dna-ring`                                                        |
| Mass readout | `ownCell.mass`                                                                                                                                                                                                                                                                                               | right of the ring, baseline aligned; `number` role, `mass` in `label`                                                       | Tweens to the new value over ≤ 200 ms; +N floaters are the renderer's (effects layer), not the HUD's.                                                                                                                                                                                                                                                                                                                                                         | `hud-mass`                                                                         |
| DNA line     | as the ring                                                                                                                                                                                                                                                                                                  | under the mass readout, `body`                                                                                              | `DNA 62 % · 18 to level 5`; at max level `DNA 812` (score-only).                                                                                                                                                                                                                                                                                                                                                                                              | `hud-dna-line`                                                                     |
| Ladder hint  | `ownCell.stage`, `ownProgress.bacteriaEatenByVariant`, `balance.ladder.ENDOSYMBIOSIS_BACTERIA_REQUIRED`, `STAGE_GATE_TRAITS`                                                                                                                                                                                 | under the DNA line, `label` role in label colour, max width 320                                                             | Per stage: `protocell` → `Next: Nucleoid · level up to evolve`; `prokaryote` → two counters `aerobic 2/5 · warm vent` and `photosynthetic 0/5 · shallows`, a counter turns level gold with a check at 5/5 (this is the counter gameplay-qa flagged: without it the vent trip is a hidden requirement); `endosymbiosis` → `Next: Nuclear envelope`; `eukaryote` → `Next: a specialised form`; `specialised` → hidden. Endosymbiont owned → its counter hidden. | `hud-ladder-hint`, `hud-endosymbiosis-aerobic`, `hud-endosymbiosis-photosynthetic` |
| Leaderboard  | `snapshot.leaderboard`, names from `players[id].playerName`, swatches from `mp.avatarAssignments()`                                                                                                                                                                                                          | top-right (16,16), 240 × (26 header + 24 per row), max 5 rows compact                                                       | Columns rank, swatch 10 px, name (ellipsis at 12 chars), level, score in `body`. Own row tinted (VISUAL-STYLE §7) and always present: if outside the top 5 it replaces row 5. Header `LEADERBOARD` in `caption`. **Tab held** (or the header clicked) sets `openOverlay = 'leaderboard'` and expands to the full list: up to 8 rows, 360 wide, adds mass and absorptions columns. Rows re-sort with a 200 ms slide.                                           | `leaderboard`, `leaderboard-row-<playerId>`, `leaderboard-full`                    |
| Minimap      | `snapshot.cells`, `gelPatches`, `DISH_RADIUS`, zone geometry (ECOLOGY §2)                                                                                                                                                                                                                                    | bottom-left (16,16), ⌀120 SVG                                                                                               | Dish rim, shallows ring, vent disc and gel discs as tints; cells as dots (own 4 px in the identity-ring colour, VISUAL-STYLE §2, palette-independent, with a 1 px text-colour ring; others 3 px in their palette base; radius not encoded); no motes. Rendered as inline SVG so tests can count `circle[data-cell]`.                                                                                                                                          | `minimap`, `minimap-cell-<cellId>`                                                 |
| Trait strip  | `ownCell.traits` (`traitId`, `tier`), catalog for glyph and name                                                                                                                                                                                                                                             | bottom-centre; slots 36 px, gap 8; `TRAIT_STRIP_MIN_SLOTS` empty dashed slots, grows to `balance.progression.MAX_LEVEL − 1` | Label above in `caption` = stage name (`PROKARYOTE`). Slot: glyph + 1–3 tier pips under it. Focus/hover shows a `body` tooltip `Cilia Fringe II · +30 % speed` above the slot. New trait: slot pops in over 300 ms. Hidden while the picker is open (§3.2).                                                                                                                                                                                                   | `trait-strip`, `trait-slot-<traitId>`                                              |
| Round timer  | `snapshot.roundTimeLeftMs`, `mp.sessionConfig().roundDurationSeconds`, `balance.session.ROUND_BLOOM_START_FRACTION`                                                                                                                                                                                          | bottom-right (16,16); `clock` role `07:42`, `ROUND` in `caption` under it                                                   | Formatted `m:ss` floor. In bloom the clock turns level gold and the caption reads `BLOOM`. Last 10 s: pulses once per second. `results` phase: hidden (the results overlay shows the countdown).                                                                                                                                                                                                                                                              | `hud-round-clock`, `hud-round-phase`                                               |
| Key hints    | static                                                                                                                                                                                                                                                                                                       | under the timer, `caption` muted: `SPACE sprint · TAB board · ESC menu`                                                     | Always on (touch: `TAP sprint`). Pointer devices only show the line; it is not a hint of §5.                                                                                                                                                                                                                                                                                                                                                                  | `hud-key-hints`                                                                    |
| Sprint meter | `ownCell.sprintCooldownRemainingTicks` (ARCHITECTURE §2; no client estimate), `balance.controls.SPRINT_COOLDOWN_SECONDS`                                                                                                                                                                                     | 80 × 4 bar above the key hints                                                                                              | Ready = `sprintCooldownRemainingTicks === 0`: full and steady. Otherwise fill = `1 − remaining / secondsToTicks(SPRINT_COOLDOWN_SECONDS)` clamped to [0, 1], in level gold (a cooldown shortened by a folded modifier simply starts partly filled); dims while `sprintRemainingTicks > 0`.                                                                                                                                                                    | `hud-sprint-meter`                                                                 |
| Danger chip  | `threats` = `threatsFor(cells, ownCell, cameraExtent, balance)`: cells with `mass ≥ ownCell.mass × balance.absorption.ENGULF_MASS_RATIO` (conservative: the folded `membraneRatioBonus` is server-only) whose position is inside `cameraExtent` (§7); `ownCell.states`, `engulfProgress`, `engulfedByCellId` | top-centre, y 16, pill in `label` bold on danger colour                                                                     | `⚠ AMOEBOID CAN ENGULF YOU` (nearest threat's name) while any on-screen threat exists; the ring around the threat itself is the renderer's (effects layer, sheet 03). While `being_engulfed`: `ENGULFED · SPRINT TO ESCAPE`, pulsing, with a 120 × 4 progress bar under it showing `engulfProgress`. Hidden otherwise.                                                                                                                                        | `hud-danger`, `hud-engulf-progress`                                                |

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
  the bottom edge, which is accepted: the cards never enter the box. The trait strip and hint pill are hidden
  while the offer is open; the timer, minimap, leaderboard and danger chip stay.
- **Dim.** A DOM overlay owned by this doc, not a Pixi quad: a 55 % black `<div>` over the canvas with a
  soft-edged clear disc of radius `HUD_PLAYER_EXCLUSION_PX` × `s` around the centre (`mask-image` radial
  gradient); the HUD never touches Pixi, so VISUAL-STYLE §8's "trait-picker dim" quad is superseded by this
  element (corrected on #34). The dish keeps simulating and the cell keeps steering: pointer input is not captured
  by the overlay (`pointer-events: none` on everything but the cards).
- **Card.** Glyph medallion 56 px, category in `caption`, name in `card name` bold with tier numeral
  (`Cilia Fringe II`), two effect lines in `label` (mixed case), rarity chip in `caption` (`COMMON` / `UNCOMMON` /
  `RARE`, text as well as colour). A card whose trait is in `STAGE_GATE_TRAITS[next stage]` carries a `RUNG`
  ribbon (the rung card of PROGRESSION §3, which reserves the first card for it; the ribbon text and the test id
  share the one word). An upgrade card (trait already owned) shows `I → II` in place of the tier.
- **Highlight = hover = keyboard focus = preview.** Exactly one card is highlighted at a time (lift 8 px, accent
  glow); hovering or focusing it writes `HudStateService.previewTraitId` (§7) and the renderer, which receives that
  signal through `game-setup.ts`, draws the trait's organelle ghost on the own cell. No card is highlighted until
  hovered or focused; arrow keys move focus.
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
snapshot and this one. An open trait offer
stays visible and pickable (PROGRESSION §4, P11). HUD elements that read `ownCell` hide; ring, ladder hint,
leaderboard, timer stay. Test ids: `respawn-overlay`, `respawn-killer`, `respawn-countdown`, `respawn-kept`.

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

Escape closes the topmost open overlay (`openOverlay = 'leaderboard'`, a tooltip) and, with none open, sets
`openOverlay = 'menu'`: a 320-wide centred panel with `Resume` (autofocus) and `Leave to lobby` (`body`), and the
line `The dish keeps running while this is open.` (`body` muted; it does: the sim never pauses). Focus is trapped
inside; Escape or Resume closes it and returns focus to the canvas host. Steering input continues to send the
latched target; sprint is swallowed while the menu is open. **Trait keys stay live:** an open offer keeps its
timer running under the menu, so `1` `2` `3` still pick while the menu is open (the picker stays visible behind
the panel); otherwise a player who opened the menu during an offer would silently get the server's pick. Test ids: `menu-overlay`, `menu-resume`, `menu-leave`.

### 3.6 Notices: toasts and connection states

One toast at a time, top-centre under the danger chip, `body` on the callout backing, `TOAST_DURATION_SECONDS`, newest
replaces oldest, `aria-live="polite"`. Test id `toast` with `data-toast-kind`:

| Kind                    | Trigger                                                                                               | Text                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `late_join`             | first `game_state` with `ownProgress.dnaCatchUpGift > 0`                                              | `Joined late: you start at level 3 with 30 DNA of catch-up. Pick your traits.` |
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
| Trait strip tooltip  | hover                                                   | Tab to a slot                                                      | local                                                                                                 |

- Hotkeys are handled by `input/keyboard-input.ts` on `document` while `mp.inGame()`; they are ignored when focus is
  in a text field, and all but `1` `2` `3` are ignored while the menu is open (§3.5). Tab is `preventDefault`ed only
  while no overlay with focusable controls is open, so the trait picker, menu and results remain fully tab-navigable.
- **Space precedence.** Space is both sprint and "pick the focused card". The handler checks `document.activeElement`:
  inside `trait-offer` it picks (the card's own key handler runs, the sprint path does not); anywhere else it sprints.
  Opening the picker never moves focus by itself, so a player who keeps swimming keeps sprinting with Space until
  they Tab or arrow into a card.
- Every interactive element is a native `<button>` or form control with a visible focus ring (2 px, text colour);
  overlays trap focus and restore it on close; the canvas host has `tabindex="0"` and takes focus on click.
- Touch: pointer events only (GAME-DESIGN §10); no layout changes beyond the key-hint text.

## 5. Onboarding: the first two minutes

Diegetic and text hints, no modal tutorial. Hints show in the hint pill (bottom-centre above the trait strip, `body`
on the callout backing, `hint`, `data-hint-id`); `OnboardingService` keeps seen-flags in memory for the session (a
reload replays them; a rematch does not). One hint at a time, in this order; each is dismissed by its trigger or
after `HINT_DURATION_SECONDS` once its dismissal condition is met.

| Beat         | When                                                      | What the player sees                                                                                                                                         | Dismissed by                       | `data-hint-id`  |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | --------------- |
| Spawn        | first alive snapshot of the session                       | The protocell drifting at centre; a pointer reticle and a dotted line cell → pointer (renderer, world-anchored); pill `Move the pointer · your cell follows` | `STEER_HINT_DISTANCE_WU` travelled | `steer`         |
| First eat    | after `steer`, until the first `eat` effect for `ownCell` | Pill `Swallow motes to grow`; on the first eat the mass readout pops                                                                                         | first eat                          | `eat`           |
| First DNA    | first snapshot with `dnaCumulative > 0`                   | The level ring lights (first fill), pill `DNA fills the ring · fill it to evolve`                                                                            | timer                              | `dna`           |
| Sprint       | round time ≥ `SPRINT_HINT_AT_SECONDS` and never sprinted  | Pill `SPACE · sprint (costs mass, also your escape)`                                                                                                         | first sprint or timer              | `sprint`        |
| First offer  | first `offer` shown                                       | The picker with an extra footer line `1 2 3 or click · you keep swimming`; the `RUNG` ribbon on the nucleoid card                                            | pick / timeout                     | `offer`         |
| Prokaryote   | stage becomes `prokaryote`                                | Ladder hint reveals the two counters; toast `stage`; pill `Orange bacteria at the warm vent and green ones in the shallows carry organelles · eat 5`         | timer                              | `endosymbiosis` |
| First threat | first time `threats` is non-empty                         | Danger chip and the renderer's ring; pill `Bigger cells engulf you · sprint away`                                                                            | timer                              | `threat`        |

## 6. Readability during play

- **Exclusion box** (§1) is absolute while alive and playing; the picker's dim keeps its spotlight; toasts and the
  danger chip stack from the top, never downward past y 96.
- **Backing.** Text over the dish always sits on the callout backing role (VISUAL-STYLE §2, blurred); panels use
  the panel gradient and rim roles. Contrast: `body` text ≥ 4.5:1 against its backing, values and the danger chip
  ≥ 7:1, muted labels ≥ 3:1 and never carry a fact on their own.
- **Type.** Roles only (VISUAL-STYLE §7). The smallest role this doc uses is `caption` (11 px there: key hints,
  ring and clock captions, chips); nothing is set smaller, and no element in this doc uses a size outside the
  role list. Anything a player must read is `label` or larger; changing numbers (mass, DNA %, clock, countdowns)
  use the mono roles (`number`, `clock`, `value`) so tabular digits do not jitter. `label` and `caption` are
  uppercase by role; an element written in mixed case above (ladder hint, card effect lines) keeps the role's
  size, weight and tracking without the uppercase transform.
- **Motion.** HUD values tween ≤ 200 ms; nothing in the HUD moves during play except fills (ring, timer bar, sprint
  meter, engulf bar) and the leaderboard's 200 ms re-sort; flashes ≤ 300 ms, at most one per second.
- **Colour is never the only carrier**: rarity, danger, bloom and stage all have a text label as well.
- **Coverage.** HUD chrome ≤ 15 % of the viewport at scale 1; overlays (picker, respawn) ≤ 40 %; results may cover
  the centre because the dish is frozen.

## 7. Angular component plan

Standalone, `OnPush`, signal inputs, no game logic: components format and lay out; every decision is a pure function
under `hud/format/` with unit tests, and every fact comes from `GameStateService` (the signal facade of `WorldStore`,
ARCHITECTURE §5). Files ≤ 250 lines, one component per file (`packages/client/src/app/game/hud/`). **This table is
the one home of the HUD component and file list**: ARCHITECTURE §6 points here and §10's file plan lists the same
files without naming components.

| Component / file                                                 | Reads (signals)                                                                                                                                                                                             | Writes                                | Owns test ids                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `hud.component.ts` (shell, `hud`)                                | `roundPhase`, `lifeState`, `offer`, `openOverlay`; `ResizeObserver` on the host → `--hud-scale` (§1)                                                                                                        | —                                     | `hud`, layout slots                                                                        |
| `level-mass.component.ts`                                        | `ownProgress`, `ownCell`, `balance`, shared `levelUpCost`                                                                                                                                                   | —                                     | `hud-level`, `hud-dna-ring`, `hud-mass`, `hud-dna-line`                                    |
| `ladder-hint.component.ts`                                       | `ownCell.stage`, `bacteriaEatenByVariant`, `balance.ladder`                                                                                                                                                 | —                                     | `hud-ladder-hint`, `hud-endosymbiosis-*`                                                   |
| `leaderboard-panel.component.ts`                                 | `leaderboard`, `players`, `avatarAssignments`, `openOverlay`                                                                                                                                                | `openOverlay` (`'leaderboard'`)       | `leaderboard*`                                                                             |
| `minimap.component.ts` (inline SVG)                              | `cells`, `gelPatches`, `balance.world`, `balance.ecology`                                                                                                                                                   | —                                     | `minimap*`                                                                                 |
| `trait-strip.component.ts`                                       | `ownCell.traits`, catalog                                                                                                                                                                                   | —                                     | `trait-strip`, `trait-slot-*`                                                              |
| `round-timer.component.ts`, `sprint-meter.component.ts`          | `roundTimeLeftMs`, `sessionConfig`, `balance.session`, `ownCell`, `balance.controls`                                                                                                                        | —                                     | `hud-round-*`, `hud-key-hints`, `hud-sprint-meter`                                         |
| `danger-chip.component.ts`                                       | `threats` (from `cells`, `ownCell`, `cameraExtent`, `balance.absorption`), `ownCell.states`, `engulfProgress`                                                                                               | —                                     | `hud-danger`, `hud-engulf-progress`                                                        |
| `trait-offer-overlay.component.ts`, `trait-card.component.ts`    | `offer`, `serverTickEstimate`, catalog, `describeTierModifiers`                                                                                                                                             | `previewTraitId`, `sendTraitChoice()` | `trait-offer*`, `trait-card-*`                                                             |
| `respawn-overlay.component.ts`                                   | `ownProgress`, `players`, `lastAliveOwnCell`                                                                                                                                                                | —                                     | `respawn-*`                                                                                |
| `results-overlay.component.ts`                                   | `leaderboard`, `players`, `resultsStartedAtTick`, `balance.session`                                                                                                                                         | `leave()`                             | `results-*`                                                                                |
| `menu-overlay.component.ts`                                      | `openOverlay`                                                                                                                                                                                               | `openOverlay`, `leave()`              | `menu-*`                                                                                   |
| `hint.component.ts`, `toast.component.ts`                        | `OnboardingService.current`, `ToastService.current`                                                                                                                                                         | —                                     | `hint`, `toast`                                                                            |
| `connection-banner.component.ts`                                 | `connectionState`                                                                                                                                                                                           | —                                     | `connection-banner`                                                                        |
| `hud/format/*.ts` (pure)                                         | `hudScaleFor`, `formatRoundClock`, `describeTierModifiers` (label table pinned against every `DEFAULT_CELL_MODIFIERS` key), `ladderHintFor`, `dnaLineFor`, `threatsFor`, `sprintMeterFill`, `formatDnaLoss` | —                                     | unit-tested, no DOM                                                                        |
| `hud/hud-state.service.ts`                                       | —                                                                                                                                                                                                           | the writable UI signals (below)       | —                                                                                          |
| `hud/onboarding.service.ts`, `hud/toast.service.ts`              | `GameStateService`, effects                                                                                                                                                                                 | `current`, `reticleVisible`           | —                                                                                          |
| `hud/hud-constants.ts`, `hud/test-ids.ts`, `hud/trait-glyphs.ts` | §1's constants; `HUD_TEST_ID` (`as const`, camelCase keys, the id strings of this doc as values); one inline SVG glyph per `TraitId`, pinned by a test that every catalog id has one                        | —                                     | components and the Playwright loop both import `HUD_TEST_ID`; no id literal is typed twice |

Two services, two kinds of signal:

- `state/game-state.service.ts` (`GameStateService`, the facade of `WorldStore`, never a second model) holds only
  **derived** signals: `me`, `ownCell`, `ownProgress`, `balance` (the snapshot's `game_state.balance`), `threats`,
  `connectionState`, `resultsStartedAtTick`, `serverTickEstimate`, `lastAliveOwnCell` (the own cell of the last
  snapshot with `lifeState === 'alive'`, kept until the next alive snapshot; §3.3) and `cameraExtent` (a
  world-space rectangle written by the render loop each frame through `game-setup.ts`; §3.1 `threatsFor` reads it,
  and it is the only render-side fact the HUD consumes).
- `hud/hud-state.service.ts` (`HudStateService`) holds the **writable** UI signals: `previewTraitId`
  (`TraitId | null`), `openOverlay` (`'none' | 'menu' | 'leaderboard'`; the full leaderboard is an overlay, so
  there is no separate expanded flag) and the onboarding `reticleVisible` flag.

The HUD ↔ Pixi crossings are exactly three, all wired in `game-setup.ts` so that `render/` never imports from
`hud/`: the renderer receives `previewTraitId` and `reticleVisible` as read-only signals, and writes
`cameraExtent`. Nothing else crosses.

## 8. Acceptance (the Playwright loop #100 drives)

| #   | Steps                                                    | Assert (by test id)                                                                                                                                                                             |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | connect, create (seed 42, 60 s), start                   | `game-canvas`, `hud`, `hud-level` = 1, `hud-round-clock` ≈ `1:00`, `hint[data-hint-id=steer]` visible                                                                                           |
| U2  | move the pointer 300 px right for 1 s                    | steer hint gone, `hud-mass` unchanged or larger, `minimap-cell-*` count = 1                                                                                                                     |
| U3  | `debug_grant_dna` 20                                     | `trait-offer` visible with three `trait-card-*`, `trait-card-rung` on the nucleoid card (its `RUNG` ribbon), `trait-strip` hidden                                                               |
| U4  | press `1`                                                | `trait-offer` gone within 2 snapshots, `trait-slot-nucleoid` present, `hud-ladder-hint` shows both `hud-endosymbiosis-*` counters                                                               |
| U5  | `debug_spawn` a 200-mass cell adjacent, wait             | `hud-danger` visible, then `respawn-overlay` with `respawn-countdown` 3 → 1, then `hud-mass` = starting mass, level kept                                                                        |
| U6  | hold Tab; press Escape; wait for the timer to reach zero | `leaderboard-full` while held; `menu-overlay` with focus on `menu-resume`; ids read from `HUD_TEST_ID`; `results-overlay` with `results-row-1`, then `hud` again after `RESULTS_SCREEN_SECONDS` |
