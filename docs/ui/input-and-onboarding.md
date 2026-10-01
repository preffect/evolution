# Evolution — UI: HUD, overlays and onboarding: input, onboarding and readability

§4–§6 of the split [`UI.md`](../UI.md), which keeps the shared context and the file list.

## 4. Input mapping and keyboard reachability

| Input                | Pointer / touch                                                           | Keyboard                                                                                                                                                    | Sent as (architecture/wire-contract.md §4)                                                            |
| -------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Steer                | pointer position over the canvas → world via the camera (locked: §4.1)    | WASD / arrows synthesise a target (game-design/controls-and-scope.md §6)                                                                                    | `targetX/targetY` every client tick; the pointer's last position is latched when it leaves the canvas |
| Sprint               | left click / tap on the canvas (not the click that locks, §4.1)           | Space (edge-triggered, no repeat) with focus outside `trait-offer`                                                                                          | `shouldSprint: true` once per press                                                                   |
| Pick trait           | click a card                                                              | `1` `2` `3`; Enter/Space with focus on a card                                                                                                               | `traitChoice`                                                                                         |
| Full leaderboard     | click the leaderboard header (toggles)                                    | Tab held                                                                                                                                                    | local                                                                                                 |
| Menu / close overlay | —                                                                         | Escape (§3.5; inside the encyclopedia, encyclopedia.md §11.5)                                                                                               | local                                                                                                 |
| Owned traits         | Escape → `Your traits` (§3.5); a row opens the trait's encyclopedia entry | Escape, then Tab and ↑ ↓ through the list                                                                                                                   | local                                                                                                 |
| Encyclopedia         | ESC menu → `Encyclopedia`; the lobby's `Encyclopedia` button (§2)         | `H` in play and in the menu; inside it `/` search, ↑ ↓ Home End in the rail and list, ← → between them, `Alt+←` back, Escape closes (encyclopedia.md §11.5) | local                                                                                                 |

- Hotkeys are handled by `input/keyboard-input.ts` on `document` while the client is in a room. Focus in a text field
  swallows every press but Escape. While a **modal overlay** is open (`openOverlay` is `menu` or `encyclopedia`;
  `FocusContext.isModalOverlayOpen`) all but `1` `2` `3`, Escape and, with the menu open,
  `H` are ignored, which leaves the arrow keys to the kit's rails and lists. **Two of `FocusContext`'s five facts are
  about overlays and they are not the same fact**: `isModalOverlayOpen` says a modal overlay is up, `isMenuOpen` says
  it is the **menu** — and `H` acts on `!isModalOverlayOpen || isMenuOpen`, which is why telling them apart is the
  whole of that rule (#449; before it there was one flag, and the rename it carried is no longer a useful way to read
  either name). `H` (`ENCYCLOPEDIA_KEY_CODE`, in
  `input-constants.ts` beside the panel id it imports from the leaf `game/encyclopedia/test-ids.ts`) opens the
  encyclopedia, edge-triggered, while no modal overlay is open (returning to the game) or while the menu is open
  (returning to the menu, as the `Encyclopedia` button does). The encyclopedia's own keys (`/`, Back) are
  `encyclopedia-constants.ts`'s, since the lobby reads them too.
- **Escape has one owner per press.** A component that consumes an Escape (the search field clearing its query, the
  menu's exit confirm restoring its row) calls `preventDefault()`. `keyboard-input.ts` passes `event.defaultPrevented`
  into the press and `keyDownAction` returns `NO_ACTION` for a consumed Escape, before the text-field rule; an
  Escape nothing consumed acts even from a text field. In a room the one close path is the HUD's topmost order
  (§3.5); in the lobby, where no document listener exists, the encyclopedia's host closes it on its own Escape.
  `keyboard-action.spec.ts` covers a consumed Escape doing nothing, an unconsumed one in the field closing, the
  confirm row's Escape leaving the menu open, and `H` acting from the menu but not from the encyclopedia. A **release** never consults focus, so a key pressed over the canvas and released after
  focus moved still releases, and a window `blur` releases everything. Tab is `preventDefault`ed only
  while no overlay with focusable controls is open, so the trait picker, menu, encyclopedia and results remain fully tab-navigable;
  which overlays those are is the `FOCUSABLE_OVERLAY_TEST_IDS` list in `input/input-constants.ts`, the one home of the
  key codes and the selectors (`CODE-STANDARDS.md §2`).
- **The module list** (the one home; `architecture/constants-files-tests.md §10`'s file plan repeats it without roles). Pure and
  unit-tested: `input-constants.ts` (key codes, direction vectors, selectors), `keyboard-action.ts` (the rules of
  this section, press and release → one action), `input-state.ts` (the latched pointer, the held keys, the two
  one-shots, the Tab hold), `game-input-builder.ts` (state + world → `GameInput`), `pointer-lock-policy.ts` and
  `virtual-pointer.ts` (the mouse lock's rules and its pointer, §4.1). Thin adapters:
  `dom-input-context.ts` (the focus facts), `keyboard-input.ts`, `pointer-input.ts`, `pointer-lock-input.ts` and
  `virtual-hover.ts` (§4.1), `input-world-context.ts` (`WorldStore` → the own cell, the open offer, the live
  `balance.controls`).
  `input-controller.ts` owns the client tick counter and the one send per tick; `attach-input.ts` composes them
  and `game-setup.ts` wires the seam. In dev builds `window.__evolutionDebug.input()` reports what was last sent
  and what is held, so a Playwright run can assert that a key reached its handler.
- The **reticle**'s position is the latched pointer in world units, handed to the renderer by `game-setup.ts`;
  whether it shows is the HUD's `reticleVisible` (the `steer` onboarding beat, §5), which is `false` until #190.
- **The steer target is an offset, not a projection.** The pointer is sent as its offset from the middle of the
  view applied to the **newest snapshot's own cell**, never as the absolute world point the camera projects it
  to. The camera centres on the _interpolated_ cell and then smooths, so it trails the authoritative one by
  `INTERPOLATION_DELAY_TICKS` + `CAMERA_FOLLOW_SECONDS` ≈ 0.113 s, and an absolute target has that lag distance
  subtracted from the offset the player aimed for — about 93 % of the throttle ramp of `ecology/mass-and-movement.md §5.2` at
  `CELL_STARTING_MASS`, so a new cell would be full speed or stopped with nothing in between. The reticle keeps
  the camera projection, because it is drawn on the camera's frame. Prediction of the own cell is #265.
- **The pick policy** (`input/trait-pick.ts`, the one home of all three cases). A press answers **only the offer
  it was made against**: it is stamped with that `offerId` on the way in. A press no open offer can answer — none
  open, or a card index past the cards this offer has, since a late draft carries fewer than `TRAIT_DRAFT_SIZE`
  (`PROGRESSION.md §4`) — is **discarded where it was pressed**, never carried to a later offer. A press the
  server rejects as stale is **retried**: the pick stays queued until the world says what became of it, and is
  sent again once the server has answered a tick at or past the one it was sent with while that offer is still
  open. Once the offer is gone from the client's model the pick is dropped, so the good case sends exactly once
  and nothing is ever applied twice.
- **Presses do not survive a gap with nothing to steer.** While there is no world — before the first snapshot,
  and through `results` — a queued sprint and a queued pick are dropped rather than carried into the next round,
  and the client tick accumulator is resynced so the frame the world returns on sends one input, not a burst.
  Held steer keys keep their latch, because the key is still physically down. With a world but no own cell
  (spectating after a death) the input carries no target and no sprint, so a sprint pressed while spectating is
  dropped rather than started on the respawned cell, while a queued pick is still sent: the offer outlives the
  cell (#346).
- **Opposing steer keys hand control back to the pointer.** `A` + `D` (or `W` + `S`) cancel to no direction, and
  the target falls through to the latched pointer rather than stopping. This is the decision for a
  pointer-primary game; "both keys to stop" would be a design change, not a bug fix.
- The trait picker (#188), the menu (#371) and the encyclopedia (#449) are live, so the Space-precedence branch, the
  modal gate, `H` and Escape's one owner act in play; `hud/menu.integration.spec.ts` pins the gate and the confirm
  row's Escape end to end, and `hud/encyclopedia-keyboard.integration.spec.ts` the encyclopedia's half of both. The
  results panel (#637) renders `results-overlay`, so Tab stays native over it and reaches `Leave to lobby`; it takes
  no focus on its own, so a held Space never lands on that button.
- **Space precedence.** Space is both sprint and "pick the focused card". The handler checks `document.activeElement`:
  inside `trait-offer` it picks (the card's own key handler runs, the sprint path does not); anywhere else it sprints.
  Opening the picker never moves focus by itself, so a player who keeps swimming keeps sprinting with Space until
  they Tab into a card (the arrow keys steer, so they never move focus).
- Every interactive element is a native `<button>` or form control with a visible focus ring (`UI_FOCUS_RING_PX`
  2 px, text colour); the menu, encyclopedia and results overlays trap focus with the kit's focus trap (components-and-constants.md §10) and restore it on close, and the trait picker is
  non-modal (overlays.md §3.2): it traps nothing, because the cell keeps steering, and gives focus back to the
  element it came from when it closes; the canvas host has `tabindex="0"` and takes focus on click. The
  own-cell indicators are not interactive; their facts reach keyboard and screen-reader users through the status
  mirror (§3.1.4) and the menu (§3.5).
- Touch: pointer events only (game-design/controls-and-scope.md §10); no layout changes beyond the sprint hint's text.

### 4.1 Mouse lock (#794)

A click that lands outside the window takes focus away, the window `blur` releases every input, and in a fight the
cell is lost. So while a room is up the pointer is locked to the canvas with the Pointer Lock API, on by default.

- **Locking.** The first primary **mouse** click on the canvas asks for the lock (`requestPointerLock` with
  `unadjustedMovement`, asked again without it where the platform refuses the option) and **does not sprint**. A
  touch or a pen is never locked and sprints as before. The click the lock is asked from is where the virtual pointer
  starts, so nothing jumps.
- **The virtual pointer.** While locked the browser reports only `movementX/Y`; `virtual-pointer.ts` moves its own
  canvas point by that times `POINTER_LOCK_MOVEMENT_SCALE` (1) and clamps it to the canvas host's box, and that point
  is what the controller latches, so the steer offset, the dead zone and full throttle are computed exactly as for a
  real pointer. The play area it clamps to is the whole canvas, not the drawn band of a canvas wider than
  `INTEREST_VIEW_ASPECT_RATIO` (game-design/controls-and-scope.md §7): the steer target is an offset whose length
  stops mattering at full throttle, so the band would only take reach away from the sides of an ultrawide screen.
- **The in-game cursor** (`hud/virtual-cursor.component.ts`, `virtual-cursor`): the system cursor is hidden while
  locked, so the HUD draws one at the virtual pointer, above every layer. A ring of radius
  `VIRTUAL_CURSOR_RING_RADIUS_PX` stroked `VIRTUAL_CURSOR_RING_STROKE_PX` in the text colour over a
  callout-backing halo `VIRTUAL_CURSOR_HALO_STROKE_PX` wider, with a text-colour dot of `VIRTUAL_CURSOR_DOT_RADIUS_PX`
  on its own dark disc at the exact steering point. Real px, not `--ui-scale`d, since it stands in for the system
  cursor; still, so reduced motion changes nothing; it takes no events and is `aria-hidden`. It is the one DOM element
  allowed in the exclusion box (layout.md §1), where the system cursor always was.
- **Controls under a locked pointer.** Every mouse event goes to the canvas host while locked, so
  `pointer-lock-input.ts` hit-tests the virtual pointer (`elementFromPoint`, which the HUD layer's
  `pointer-events: none` passes through): over a control that takes the pointer (a trait card, the leaderboard
  header) a primary press clicks it instead of sprinting, as the real cursor would, and `virtual-hover.ts` dispatches
  the `mouseenter` / `mouseleave` the browser would have, so a card highlights and previews its trait.
- **Escape.** While locked the browser keeps Escape for itself and leaves the lock; the page may never see the key.
  A lock lost while the document still has focus is that Escape, and **opens the menu** (`MouseLockService.exitedByUser`,
  which leaves an open menu open, so a browser that also delivers the key cannot open and close it in one press).
  Closing the menu leaves the pointer free until the next canvas click locks again. Chrome refuses a re-lock for about
  a second after an Escape exit, so none is asked for `POINTER_LOCK_RETRY_COOLDOWN_MS` (1250 ms) after one: a click in
  that window neither locks nor sprints, and logs nothing.
- **Overlays.** The lock is handed back (`exitPointerLock`, which is no Escape and opens nothing) while an overlay with
  buttons is up: the menu, the encyclopedia, and the results phase (`MouseLockService.isCursorNeeded`, checked once a
  frame). **The trait picker keeps the lock:** it is non-modal (overlays.md §3.2), the cell keeps steering under it,
  and offers come mid-fight; releasing would put the system cursor at an arbitrary spot and make the next click a
  re-lock instead of a sprint, the very loss of control #794 removes. `1` `2` `3` pick as always and a locked click on
  a card picks it. The death overlay has nothing to click, so the lock stays through death and respawn.
- **Losing focus.** A lock lost while the document has no focus (alt-tab, a click on another window) opens nothing:
  the window `blur` has already released every key (§4), the latched pointer stays where it was, as it does when the
  pointer leaves the window unlocked, and the next canvas click re-locks with no cooldown.
- **Failures.** A refused request (`pointerlockerror`) or one unanswered after `POINTER_LOCK_REQUEST_TIMEOUT_MS`
  (1000 ms) also waits out the cooldown; after `POINTER_LOCK_MAX_FAILED_REQUESTS` (3) in a row the lock gives up for
  the room and a click sprints as it does unlocked, so a browser that never grants the lock (a sandboxed frame) still
  plays.
- **The toggle.** `Mouse lock: On` / `Off` in the menu (overlays.md §3.5), on by default, remembered per browser in
  localStorage (`MOUSE_LOCK_STORAGE_KEY` holds `MOUSE_LOCK_OFF_FLAG` while off; a browser that refuses storage starts
  on and keeps the choice for the session). Off is the behaviour before #794.
- **Where it lives.** The rules are `input/pointer-lock-policy.ts` (pure, unit-tested), the browser calls
  `input/pointer-lock-input.ts`, the HUD's half `hud/mouse-lock.service.ts`, wired by `game-host.component.ts` through
  `setupGame`'s `pointerLock` seam. `hud/mouse-lock.integration.spec.ts` pins the locking click, steering from the
  virtual pointer, Escape → menu → re-lock after the cooldown, a card click under the lock and the encyclopedia's
  release, against `testing/fake-pointer-lock.ts`, since jsdom has no Pointer Lock API.

| Constant                             | Value                       | Unit | Meaning                                                          |
| ------------------------------------ | --------------------------- | ---- | ---------------------------------------------------------------- |
| `POINTER_LOCK_MOVEMENT_SCALE`        | 1                           | ×    | Virtual-pointer px per px of `movementX/Y`.                      |
| `SHOULD_REQUEST_UNADJUSTED_MOVEMENT` | true                        | —    | Ask for raw mouse movement (no OS acceleration) where supported. |
| `POINTER_LOCK_RETRY_COOLDOWN_MS`     | 1250                        | ms   | No request this long after an Escape exit or a failure.          |
| `POINTER_LOCK_REQUEST_TIMEOUT_MS`    | 1000                        | ms   | An unanswered request counts as failed.                          |
| `POINTER_LOCK_MAX_FAILED_REQUESTS`   | 3                           | —    | Failures in a row before the lock gives up for the room.         |
| `VIRTUAL_CURSOR_RING_RADIUS_PX`      | 7                           | px   | The cursor's ring.                                               |
| `VIRTUAL_CURSOR_RING_STROKE_PX`      | 2                           | px   | Its text-colour stroke.                                          |
| `VIRTUAL_CURSOR_HALO_STROKE_PX`      | 4                           | px   | The dark halo's extra width under the ring.                      |
| `VIRTUAL_CURSOR_DOT_RADIUS_PX`       | 1.5                         | px   | The steering point.                                              |
| `MOUSE_LOCK_STORAGE_KEY`             | `'evolution.mouseLock.off'` | —    | Where a browser remembers the toggle is off.                     |

Homes: the `POINTER_LOCK_…` and `SHOULD_…` rows `input/input-constants.ts`; the cursor and storage rows
`hud/hud-constants.ts`.

## 5. Onboarding: the first two minutes

Diegetic and text hints, no modal tutorial. Hints show in the hint pill (bottom-centre, `HUD_MARGIN_PX` from the
bottom edge, `body` on the callout backing, `hint`, `data-hint-id`); `OnboardingService` keeps seen-flags in memory
for the session (a reload replays them; a rematch does not). One hint at a time; each is dismissed by its trigger
or after `HINT_DURATION_SECONDS` once its dismissal condition is met. Every beat points at something on the cell or
in the dish, never at a corner. The pill is the notice row's height (`NOTICE_ROW_HEIGHT_PX`) and inline
padding, fully rounded; it takes no pointer or focus and speaks through a polite live region. It stands down while
the player is dead or spectating, outside the playing phase and while the picker is open (overlays.md §3.2), so the
`offer` beat's words are the picker's instead: a second footer line under `At 0 s the dish picks for you`, left of
the timer bar (`trait-offer-onboarding`), since a row under the cards would leave the reference viewport. The queue
steps only on alive snapshots in play; the time a beat waited while the player was dead still counts toward its timer. While the picker is open only the `offer` beat is up: other beats wait, danger beats
included, a hidden beat's timer holds, and the beat the `offer` beat replaced resumes after the pick.

**Two kinds of beat.** The first seven rows are the **opening beats**: they show in table order. The last five are
**coach beats** (decision #324, option C): each teaches one cue of `hud.md` §3.1.5 the first time the mechanic it
explains touches the player, so they fire on a game event, not in order. The queue that `OnboardingService` keeps:

- A beat whose trigger fires while another pill is up **waits**, first in first out, at most `COACH_QUEUE_MAX`
  waiting; a newer beat past that drops the oldest waiting one, which stays unseen and can fire again later.
- A waiting beat whose condition no longer holds when its turn comes (the player left the zone, the prey is gone)
  is dropped the same way, unseen.
- **Danger beats pre-empt:** `threat` and `toxin` replace the pill that is up at once. The replaced beat counts as
  seen, because its cue stays on the cell and its lesson is the lesser one. A danger beat that fires while the other is up
  waits, and goes next when the pill comes down, ahead of beats that waited longer.
- The pill of a coach beat carries a `HINT_RIM_PX` rim in the role colour of the cue it explains (`ZONE_CUE`,
  `GAIN` or `DANGER`, visual-style/principles-and-palette.md §2); an opening beat has none. Text stays `body` in the
  text colour.
- Every number in a pill comes from the constant or balance value named in its row, formatted by `hud/format/`,
  never typed.

| Beat         | When                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | What the player sees                                                                                                                                                                                                                                                                       | Dismissed by                                                                               | `data-hint-id`                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Spawn        | first alive snapshot of the session                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | The protocell at centre with its empty ring, the `1` and the nucleoid ghost below it; a pointer reticle and a dotted line cell → pointer (renderer, world-anchored); pill `Move the pointer · your cell follows`                                                                           | `STEER_HINT_DISTANCE_WU` travelled                                                         | `steer`                                                      |
| First eat    | after `steer`, until the first `eat` effect for `ownCell`                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Pill `Swallow motes to grow`; on the first eat the cell's eat pulse (renderer)                                                                                                                                                                                                             | first eat                                                                                  | `eat`                                                        |
| First DNA    | first snapshot with `dnaCumulative > 0`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | The ring's first fill lights; pill `DNA fills the ring around your nucleus · fill it to evolve`                                                                                                                                                                                            | timer                                                                                      | `dna`                                                        |
| Sprint       | round time ≥ `SPRINT_HINT_AT_SECONDS` and never sprinted                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Pill `SPACE sprint · costs mass · your white ring recharges` (`TAP sprint …` on touch)                                                                                                                                                                                                     | first sprint or timer                                                                      | `sprint`                                                     |
| First offer  | first `offer` shown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | The picker with an extra footer line `1 2 3 or click · you keep swimming`; the `RUNG` ribbon on the nucleoid card, whose silhouette the orbit ghost has been showing                                                                                                                       | pick / timeout                                                                             | `offer`                                                      |
| Prokaryote   | stage becomes `prokaryote`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | The two counters appear on the orbit; toast `stage`; pill `Eat 10 orange rods at the warm vent or 10 green in the shallows · the pips count them`                                                                                                                                          | timer                                                                                      | `endosymbiosis`                                              |
| First threat | first time `nearestThreat` is non-null                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | The renderer's ring and the label on the threat; pill `Bigger cells engulf you · sprint away`                                                                                                                                                                                              | timer                                                                                      | `threat`                                                     |
| First shrink | the mass chip's `trend` (hud.md §3.1.5) reads `down` for `COACH_SHRINK_HOLD_SECONDS` in a row **and**, on every snapshot of that hold, decay + vent is the largest loss in `massFlow.ratesPerSecond` with no `toxin` or `swallowed` rate present; first time, never in the `COACH_SHRINK_HOLD_SECONDS` after a (re)spawn (the trend history resets on a new own cell id)                                                                                                                                                       | The mass chip with its down arrow and the rate tags above it; pill `You burn mass when you stop eating · hold TAB for why`                                                                                                                                                                 | timer                                                                                      | `shrink`                                                     |
| First zone   | first entry into each of `warm_vent`, `sunlit_shallows`, `viscous_gel` (one beat per zone; `ownCellIndicators.zone`, the server's `massFlow.zone`, changes to it; the first alive snapshot of a (re)spawn inside a zone counts as an entry, as the zone pill's, hud.md §3.1.5)                                                                                                                                                                                                                                                 | The zone pill under the cell; pill (rim `ZONE_CUE`) per zone: `The vent burns mass ×1.5 · orange rods live here` (`VENT_DECAY_MULTIPLIER`), `Sunlight feeds a Chloroplast · green rods live here`, `Gel slows you to ×0.6 · smaller cells slip through` (`gelSpeedFactor` at the own mass) | leaving the zone or timer                                                                  | `zone-warm_vent`, `zone-sunlit_shallows`, `zone-viscous_gel` |
| Bloom        | the round clock enters bloom (`roundClockStateFor`), first time in the session                                                                                                                                                                                                                                                                                                                                                                                                                                                 | The clock caption `BLOOM · FOOD ×1.5 · DNA DROPS ×2` (hud.md §3.1.1); pill `Bloom · more food and DNA until the end`                                                                                                                                                                       | timer                                                                                      | `bloom`                                                      |
| First prey   | first time an edible cell (hud.md §3.1.5 relation `edible`, which already excludes a prey held by another cell and holds nothing while the own cell is engulfing) is within `COACH_PREY_REACH_RADII` own radii, edge to edge; only a green-ringed cell counts, read off the rings themselves (`relationsFor`), so an edible toxic cell, which wears the red double ring, never fires it                                                                                                                                        | The `GAIN` ring and the `EDIBLE` label on it; pill (rim `GAIN`) `Green ring: you can engulf it · swim over it`                                                                                                                                                                             | the first engulf the player starts, once the pill has been up `HINT_MIN_SECONDS`, or timer | `prey`                                                       |
| First toxin  | first snapshot with `ownProgress.massFlow.ratesPerSecond.toxin < 0` (losses are negative, hud.md §3.1.5): contact **or** an aura reaching the own cell. A swallowed dose is its own cause (`swallowed`) and never fires this beat; it has no beat (its `SWALLOWED` tag says the meal is costing mass). While the own cell engulfs, the prey's contact dose during cover does not count; another toxic cell reaching the own cell (by the server's reach rule, `isReachedByToxin`) does, and the beat is dismissed the same way | The `TOXIN` rate tag on the cell and the toxic ring on its source; pill (rim `DANGER`) `Toxic cells drain you when you are close · back off`                                                                                                                                               | the toxin rate is absent again (no toxic cell reaches the own cell), or timer              | `toxin`                                                      |

## 6. Readability during play

- **Exclusion box** (§1) is absolute for DOM while alive and playing; the picker's dim keeps its spotlight; toasts
  and the connection banner stack from the top, never downward past `NOTICE_STACK_MAX_Y_PX` (y 96). Inside the
  box the own cell, its indicators and its legibility cues (the mass chip, rate tags, floaters, zone pill and
  relation labels, hud.md §3.1.5, decision #324) are the only drawn things besides the dish; every one of them is
  renderer-drawn and world-anchored, never DOM, and meets §3.1.3's reading floor (numbers `value`, causes `label`).
- **Floors.** Every on-cell indicator meets §3.1.3's floors at every camera zoom; the fact carriers are the DNA
  fill (≥ 4 px), the numeral (`value`), the pips (countable) and the threat label (`label`); a ghost is a hint and
  may be the only thing that shrinks toward its 14 px floor.
- **Backing.** Text over the dish always sits on the callout backing role (visual-style/principles-and-palette.md §2, blurred for DOM); the
  renderer's labels sit on the **label pill**: the callout backing at `LABEL_PILL_ALPHA`, `LABEL_PILL_HEIGHT_PX`
  tall with `LABEL_PILL_PAD_PX` at each end, and, for the threat and escape labels, a `DANGER_LABEL_RIM_PX` rim in
  the danger colour around `WHITE` text (danger text on the backing is 6.3:1 and fails the floor below; the rim
  keeps danger a colour + text tell). Panels use the panel gradient and rim roles. Contrast: `body` text ≥ 4.5:1
  against its backing, values, the numeral and the threat and escape labels ≥ 7:1 (measured 19.4:1 on the rendered
  pill of the size sheet), muted labels ≥ 3:1 and never carry a fact on their own.
- **Type.** Roles only (visual-style/ui-type.md §7), in the DOM and in the renderer's text alike. The smallest role this doc
  uses is `caption` (clock caption, leaderboard header, chips); nothing is set smaller, and no
  element in this doc uses a size outside the role list. Anything a player must read is `label` or larger; changing
  numbers (clock, countdowns, the level numeral, picker timer) use the mono roles (`number`, `clock`, `value`) so
  tabular digits do not jitter. `label` and `caption` are uppercase by role; an element written in mixed case above
  (card effect lines, menu trait lines) keeps the role's size, weight and tracking without the uppercase transform.
- **Motion.** HUD values tween ≤ 200 ms; nothing in the HUD moves during play except fills (DNA ring, sprint ring,
  escape arc, timer bar) and the leaderboard's 200 ms re-sort; flashes ≤ 300 ms, at most one per second. The
  indicators' fills tween over `INDICATOR_FILL_TWEEN_MS`, their flashes are rendering/contents-and-motion.md §4 clips (`level_up`'s
  `ringFlash`, `sprint_ready`), and their labels neither pulse nor fade. The indicators ride the cell's predicted
  position (rendering/cells.md §1) and never lag it. **One exception:** a floater (hud.md §3.1.5) rises
  `FLOATER_RISE_PX` and fades over the last `FLOATER_FADE_FRACTION` of `FLOATER_LIFETIME_MS`, because a one-off
  change has to read as one; rate tags, the mass chip and the zone pill appear and leave without a fade.
- **Cue colour.** Besides danger, gold and DNA, a cue may carry the three roles of
  visual-style/principles-and-palette.md §2 (`GAIN`, `ZONE_CUE`, `TRAIT_CUE`, decision #324), on rims, dots, rings
  and glyphs only; the text on a cue is always `WHITE`. The toxic ring and the threat ring share `DANGER` and are
  told apart by geometry (a still double line against the shipped warning ring's dashed, 2 px, rotating band) and by
  their labels; the edible ring is a still single line, so edible and toxic differ by shape as well as colour.
- **Colour is never the only carrier**: rarity, danger, bloom and stage all have a text label as well; the two
  counters differ by silhouette (bean vs lens) and angle, not only by orange vs green; a full counter is a gold ring
  plus ten lit pips.
- **Coverage.** HUD chrome ≤ 8 % of the viewport at scale 1 (leaderboard with its label strip and the clock with
  the bloom caption, about 6 % at the reference size); overlays (picker, respawn, and the hold-Tab panel with the
  full board, about 27 % while Tab is held, overlays.md §3.7) ≤ 40 %; results may cover the centre because the dish
  is frozen. The renderer's cues (hud.md §3.1.5) are not chrome and do not count.
