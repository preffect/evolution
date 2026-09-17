# PR #463 — ticket #449: the encyclopedia's hosts and keyboard

All 1280 × 800 (the reference viewport, `layout.md` §1), captured in one process on a private 4510/4512 stack from
this worktree by `.qa/scratch/eng-449-evidence.mjs` — its own Chromium, so no other agent's browser could interleave.
The lobby shots are a light page because the lobby is still the template's un-kitted stub (`layout.md` §2); the panel
over it is the kit.

| Frame                                        | What it shows                                                                                                                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lobby-button`                               | The lobby header's `Encyclopedia` (`lobby-encyclopedia`), and nothing else drawn until it is pressed.                                                                         |
| `lobby-open`                                 | Pressed: the panel over the lobby, its scrim covering completely (`ENCYCLOPEDIA_LOBBY_SCRIM_ALPHA`), no alert strip — the lobby has no round to alert about.                  |
| `lobby-search-slash`                         | `/` focused the field (its ring), `mito` typed: the rail drops its selection, the list shows `RESULTS 3`, and the detail column keeps the page it was on (§11.5).             |
| `lobby-escape-clears-query`                  | The **first** Escape: the field owned it, the query is gone and the panel is still up.                                                                                        |
| `lobby-escape-closes`                        | The **second** Escape: the lobby host closed it, back to the lobby.                                                                                                           |
| `room-h-from-play`                           | `H` in play opens the panel, the chrome standing down under it.                                                                                                               |
| `room-list-roving-follows-focus`             | Two ↓ in the list: selection followed focus to `Cytoskeleton Lattice` and the detail column went with it, with no activation.                                                 |
| `room-menu`                                  | The ESC menu, its `Encyclopedia` row showing the `H` hint.                                                                                                                    |
| `room-from-menu`                             | Opened from that row — and note the reopen: the reading position (`Cytoskeleton Lattice`) survived, the query did not.                                                        |
| `room-returns-to-menu-focus-on-encyclopedia` | Escape from the panel: the menu is back and the focus ring is on `Encyclopedia`, the control that opened it (§11.1).                                                          |
| `room-h-from-menu`                           | `H` pressed **from the menu**: the same panel, with the menu as the return. The script read `document.activeElement` after closing both ways — `menu-encyclopedia` each time. |
