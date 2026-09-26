# PR #729 evidence: chromatin spots at sheet 01 panel A's size, ring and wash (#252)

Seed 42, SwiftShader, the worktree's private stack (4510 / 4512). The own Cyan cell and an idle Coral bot are set to level 5
(`nucleoid`, `ribosomes`, `mitochondrion`, `nuclear_envelope`) and mass 5 000 with `debug_set_player`. The viewport is
1920 × 1208, so the height-driven camera gives r ≈ 148 px. The shot is taken after `debug_pause_room` +
`debug_step_room` 1, with the client loop paused.

| File                                   | What to look at                                                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chromatin-r148-vs-sheet01-panelA.png` | nucleus crops (r_n ≈ 44 px, point-scaled 3×). Rows: Cyan, Coral. Columns: before · panel A (scaled 128 → 148) · after. The after spots are smaller, further out and never touch. Each one drops luminance to 0.65–0.70 of the ramp around it; panel A's drop to 0.64–0.73 |

The own cell's DNA ring and level digit sit over its nucleus; the Coral row shows the nucleus clean.
