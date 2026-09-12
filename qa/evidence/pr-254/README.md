# PR #254 — renderer slice D bench evidence

`e2e/render-bench.spec.ts` against a private stack (server 4500, `ng serve` 4502) from the `feat/208-bench`
worktree, headless Chromium on SwiftShader, 1920 × 1080, `devicePixelRatio` 1. Box: 4 cores, shared with other
agents' gates; `uptime` load average **6.4–12.5** across the runs (09:37–10:12 UTC, 2026-09-12). Absolute times are
therefore not comparable with the docs/RENDERING.md §7 budgets (an Iris Xe class GPU at 60 fps); the run proves
the harness: the seven stage keys, the draw-call count, the allocation measurement, determinism.

- `render-bench-report.json`: seed 42, tick 120, zoom 1, `window=24` frames after the 30-frame warm-up (a
  SwiftShader frame of the full load takes ~9 s here; the full 240-frame window is ~40 min). Draw calls **12**
  (ceiling 17), 66 of 100 cells inside the extent, 1 400 motes, **~169 KB allocated per frame** after a forced
  collection, `gpuMs` 20 296 (SwiftShader has the timer extension; the software rasteriser dominates).
- `render-bench-seed42-tick120-zoom{1.8,1,0.36}.png`: the three VISUAL-STYLE §9 zoom bands, paused.
- Smoke result: 5 / 5 passed (the determinism test after the `step(0)` fix and the `framesRendered` wait).
