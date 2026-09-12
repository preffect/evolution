# PR #233 evidence: the screen vignette fades from 0 at the centre to 0.55 at the edge (#229)

Seed 42, 1920 × 1080, SwiftShader, the private stack of the worktree (server 4500, client 4502).

| File                                    | Left (before, main `ed27c83`)                                              | Right (after)                                                          |
| --------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `before-after-field-at-rest-seed42.png` | the old `qa/baselines/dish/field-at-rest-seed42.png`, shot through the bug | the field at zoom 1 at rest with the fixed vignette (half scale strip) |
| `before-after-own-cell-crop.png`        | the old `qa/baselines/cells/own-cell-rest-zoom1.8-seed42-crop.png`         | the level-5 own cell at rest, zoom 1.8, 5× point crop                  |

Measured on the full 1920 × 1080 frames (`convert … rgb:-`, exact pixel counts):

| Frame                       | pixels at rgb(11,20,32) (wall glass `#182c46` × 0.45, the bug) | pixels at rgb(24,44,70) (`#182c46` as documented) |
| --------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| before (`ed27c83` baseline) | 26 464                                                         | 0                                                 |
| after (this PR)             | 1                                                              | 32 929                                            |

The viewport corner still darkens (before rgb(5,9,9), after rgb(2,3,6) at (2,2)): the 0.55 black edge of
`VIGNETTE_BAKE` is kept; only the centre is no longer covered.
