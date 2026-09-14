# Evolution — UI: HUD, overlays and onboarding: input, onboarding and readability

§4–§6 of the split [`UI.md`](../UI.md), which keeps the shared context and the file list.

## 4. Input mapping and keyboard reachability

| Input                | Pointer / touch                                         | Keyboard                                                                 | Sent as (architecture/wire-contract.md §4)                                                            |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Steer                | pointer position over the canvas → world via the camera | WASD / arrows synthesise a target (game-design/controls-and-scope.md §6) | `targetX/targetY` every client tick; the pointer's last position is latched when it leaves the canvas |
| Sprint               | left click / tap on the canvas                          | Space (edge-triggered, no repeat) with focus outside `trait-offer`       | `shouldSprint: true` once per press                                                                   |
| Pick trait           | click a card                                            | `1` `2` `3`; Enter/Space with focus on a card                            | `traitChoice`                                                                                         |
| Full leaderboard     | click the leaderboard header (toggles)                  | Tab held                                                                 | local                                                                                                 |
| Menu / close overlay | —                                                       | Escape                                                                   | local                                                                                                 |
| Owned traits         | Escape → `Your traits` (§3.5)                           | Escape, then Tab through the list                                        | local                                                                                                 |

- Hotkeys are handled by `input/keyboard-input.ts` on `document` while the client is in a room; they are ignored when
  focus is in a text field, and all but `1` `2` `3` and Escape itself are ignored while the menu is open (§3.5:
  Escape is what closes it). A **release** never consults focus, so a key pressed over the canvas and released after
  focus moved still releases, and a window `blur` releases everything. Tab is `preventDefault`ed only
  while no overlay with focusable controls is open, so the trait picker, menu and results remain fully tab-navigable;
  which overlays those are is the `FOCUSABLE_OVERLAY_TEST_IDS` list in `input/input-constants.ts`, the one home of the
  key codes and the selectors (`CODE-STANDARDS.md §2`).
- **The module list** (the one home; `architecture/constants-files-tests.md §10`'s file plan repeats it without roles). Pure and
  unit-tested: `input-constants.ts` (key codes, direction vectors, selectors), `keyboard-action.ts` (the rules of
  this section, press and release → one action), `input-state.ts` (the latched pointer, the held keys, the two
  one-shots, the Tab hold), `game-input-builder.ts` (state + world → `GameInput`). Thin adapters:
  `dom-input-context.ts` (the focus facts), `keyboard-input.ts`, `pointer-input.ts`,
  `input-world-context.ts` (`WorldStore` → the own cell, the open offer, the live `balance.controls`).
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
  Held steer keys keep their latch, because the key is still physically down.
- **Opposing steer keys hand control back to the pointer.** `A` + `D` (or `W` + `S`) cancel to no direction, and
  the target falls through to the latched pointer rather than stopping. This is the decision for a
  pointer-primary game; "both keys to stop" would be a design change, not a bug fix.
- Three of the focus rules above — the Space-precedence branch, the menu gate and the Tab-vs-overlay rule — are
  **dormant until the overlays exist** (#188, #189): nothing renders `trait-offer`, `menu-overlay` or
  `results-overlay` yet, so today Space always sprints and Tab is always `preventDefault`ed. The rules are
  unit-tested, and are to be re-tested by hand when those tickets land.
- **Space precedence.** Space is both sprint and "pick the focused card". The handler checks `document.activeElement`:
  inside `trait-offer` it picks (the card's own key handler runs, the sprint path does not); anywhere else it sprints.
  Opening the picker never moves focus by itself, so a player who keeps swimming keeps sprinting with Space until
  they Tab or arrow into a card.
- Every interactive element is a native `<button>` or form control with a visible focus ring (2 px, text colour);
  overlays trap focus and restore it on close; the canvas host has `tabindex="0"` and takes focus on click. The
  own-cell indicators are not interactive; their facts reach keyboard and screen-reader users through the status
  mirror (§3.1.4) and the menu (§3.5).
- Touch: pointer events only (game-design/controls-and-scope.md §10); no layout changes beyond the sprint hint's text.

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
| Prokaryote   | stage becomes `prokaryote`                                | The two counters appear on the orbit; toast `stage`; pill `Eat 10 orange rods at the warm vent or 10 green in the shallows · the pips count them`                                                                | timer                              | `endosymbiosis` |
| First threat | first time `nearestThreat` is non-null                    | The renderer's ring and the label on the threat; pill `Bigger cells engulf you · sprint away`                                                                                                                    | timer                              | `threat`        |

## 6. Readability during play

- **Exclusion box** (§1) is absolute for DOM while alive and playing; the picker's dim keeps its spotlight; toasts
  and the connection banner stack from the top, never downward past y 96. Inside the box the own cell and its
  indicators are the only drawn things besides the dish (§3.1.2).
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
  position (rendering/cells.md §1) and never lag it.
- **Colour is never the only carrier**: rarity, danger, bloom and stage all have a text label as well; the two
  counters differ by silhouette (bean vs lens) and angle, not only by orange vs green; a full counter is a gold ring
  plus ten lit pips.
- **Coverage.** HUD chrome ≤ 8 % of the viewport at scale 1 (leaderboard and clock, 5 % at the reference size);
  overlays (picker, respawn) ≤ 40 %; results may cover the centre because the dish is frozen.
