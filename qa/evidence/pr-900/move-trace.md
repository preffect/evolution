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
