# Ticket #861: the popup's move between slots, sampled

1024 × 640, own cell at mass 1,250, the Paramecium Cilia form popup raised with `debug_set_player`, then one level of
DNA granted (`debug_grant_dna`) so the picker opens during the popup's life, then card 1 picked so it closes again.
Sampled every animation frame on the host (`app-upgrade-popup`): `data-placement`, the `moving` class and the host's
computed opacity; rows kept where one of them changed (opacity by 0.15 or more). `t` is ms from the popup's first frame.

| t ms | placement  | moving | host opacity | what                                                              |
| ---- | ---------- | ------ | ------------ | ----------------------------------------------------------------- |
| 0    | above-cell | no     | 1            | first frame, host not yet measured (inside the entrance: no fade) |
| 18   | below-cell | no     | 1            | measured: below the cell, taken at once                           |
| 1062 | below-cell | yes    | 1            | picker opens: held below, fading out                              |
| 1166 | below-cell | yes    | 0.23         |                                                                   |
| 1216 | pinned     | no     | 0.05         | 150 ms on: takes the pinned slot, fades in                        |
| 1300 | pinned     | no     | 0.8          |                                                                   |
| 2253 | pinned     | yes    | 1            | card picked, picker closes: held pinned, fading out               |
| 2366 | pinned     | yes    | 0.23         |                                                                   |
| 2419 | below-cell | no     | 0.05         | back below the cell, fades in                                     |
| 2500 | below-cell | no     | 0.8          |                                                                   |

Frame 2 was captured with the host's opacity transition paused at 75 ms (opacity 0.5) for the still; the trace above
is a separate, unpaused run.

## Round 2: a 90 ms `ease-out` fade out, a 140 ms hold, and a 150 ms fade in

The same scenario on head after the review changes, every frame sampled (host computed opacity; `M` = `moving`). The
transition shows up about two frames after the class does, and the 50 ms lag allowance covers that, so the last frame in
the old slot is at 0. The new slot starts at 0 too.

| t ms | placement  | moving | host opacity |
| ---- | ---------- | ------ | ------------ |
| 1099 | below-cell | yes    | 1            |
| 1115 | below-cell | yes    | 1            |
| 1132 | below-cell | yes    | 0.712        |
| 1148 | below-cell | yes    | 0.465        |
| 1165 | below-cell | yes    | 0.258        |
| 1181 | below-cell | yes    | 0.1          |
| 1199 | below-cell | yes    | 0.009        |
| 1214 | below-cell | yes    | 0            |
| 1235 | pinned     | no     | 0            |
| 1265 | pinned     | no     | 0.025        |
| 1315 | pinned     | no     | 0.405        |
| 1364 | pinned     | no     | 0.899        |
| 1398 | pinned     | no     | 1            |
| 2287 | pinned     | yes    | 1            |
| 2381 | pinned     | yes    | 0.01         |
| 2399 | pinned     | yes    | 0            |
| 2431 | below-cell | no     | 0            |
| 2598 | below-cell | no     | 1            |
