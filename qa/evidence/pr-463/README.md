# PR #463 — ticket #449: the encyclopedia's hosts and keyboard

Captured on a private 4510/4512 stack from this worktree, each run in one process with its own Chromium so no other
agent's browser could interleave (`.qa/scratch/eng-449-evidence.mjs`, `…-round2.mjs`). Mostly the reference viewport
1280 × 800 (`layout.md` §1); the two `1024x640` frames are that section's floor, where `uiScaleFor` bottoms out at
`UI_SCALE_MIN` 0.8. The lobby frames are a light page because the lobby is still the template's un-kitted stub
(`layout.md` §2, ticket #464); the panel over it is the kit.

## The two hosts

| Frame                                      | What it shows                                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lobby-button`                             | The lobby header's `Encyclopedia` (`lobby-encyclopedia`), and nothing else drawn until it is pressed.                                                               |
| `lobby-open`                               | Pressed: the panel over the lobby, its scrim covering completely (`ENCYCLOPEDIA_LOBBY_SCRIM_ALPHA`), no alert strip — the lobby has no round to alert about.        |
| `room-h-from-play`                         | `H` in play opens the panel, the chrome standing down under it.                                                                                                    |
| `room-menu`                                | The ESC menu, its `Encyclopedia` row showing the `H` hint.                                                                                                          |
| `room-from-menu`                           | Opened from that row — and note the reopen: the reading position survived, the query did not.                                                                       |
| `room-h-from-menu`                         | `H` pressed **from the menu**: the same panel, with the menu as the return.                                                                                        |

## Where focus goes (§11.1's returns, and §11.5's initial focus)

| Frame                                        | What it shows                                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `room-open-focus-on-rail-row`                | **Initial focus is the rail's selected row**, not the header's Back — which is disabled on an open with nothing pushed. The run read back `encyclopedia-category-evolutions`.        |
| `room-returns-to-menu-focus-on-encyclopedia` | Escape from the panel: the menu is back and the ring is on `Encyclopedia`, the control that opened it.                                                                               |
| `room-h-in-play-returns-to-canvas-host`      | §11.1's third return, the one the review found broken. Focus was `BODY` before `H` (the Start button unmounted at round start); after Escape the run read back `game-host`.          |

## Focus and selection are different things

| Frame                              | What it shows                                                                                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `room-list-row-focused-not-selected` | `→` from the rail takes the list's Tab stop **without moving the reader**: `Protocell` has the ring and no fill, no accent bar, no bold, and the detail column still shows the landing. Read back `aria-selected="false"`. |
| `room-list-roving-follows-focus`   | One `↓` from there: selection follows focus, so the same row carries ring **and** fill **and** bar, and the detail column goes with it. Keyboard-only, so no stale pointer hover.           |

## The search field and the Escape order

| Frame                       | What it shows                                                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lobby-search-slash`        | `/` focused the field (its ring), `mito` typed: the rail drops its selection, the list shows `RESULTS 3`, the detail column keeps the page it was on (§11.5).     |
| `lobby-escape-clears-query` | The **first** Escape: the field owned it, the query is gone and the panel is still up.                                                                            |
| `lobby-escape-closes`       | The **second** Escape: the lobby host closed it, back to the lobby.                                                                                               |

## The scale floor (`layout.md` §1, 1024 × 640)

| Frame                             | What it shows                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `room-open-at-scale-floor`        | The panel at `UI_SCALE_MIN`: three columns intact, header controls unclipped, the inset holding.                                                |
| `room-list-focused-at-scale-floor` | A focused **and** selected row down there: the ring is never scaled, so at 0.8 it reads heavier rather than thinner, over the fill and the bar. |
