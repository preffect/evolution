# PR #254 — renderer slice D bench evidence

Taken after the review round, on the merged tree (`feat/208-bench` with `origin/main` f6ab93e).
`e2e/render-bench.spec.ts` against a private stack (server 4500, `ng serve` 4502) from the worktree, headless
Chromium on SwiftShader, 1920 × 1080, `devicePixelRatio` 1, seed 42, tick 120, `window=24` frames after the
30-frame warm-up. Box: 4 cores, shared with other agents' gates; `uptime` load average **5.5–8.3** across the
runs (17:35–18:28 UTC, 2026-09-12).

Absolute times here mean nothing against the docs/RENDERING.md §7 budgets (an Iris Xe class GPU at 60 fps) and
nothing below is offered as one. What this run proves is the harness: what it reports, what it refuses to
report, and what it now judges. Every number is read out of the committed JSON beside it.

| Field                       | zoom 1.8               | zoom 1                 | Note                                                                 |
| --------------------------- | ---------------------- | ---------------------- | -------------------------------------------------------------------- |
| `visibleCells`              | 45                     | 66                     | of the 100 in the scene                                              |
| `visibleMotes`              | 1 400                  | 1 400                  |                                                                      |
| `drawCalls`                 | 12                     | 12                     | worst frame of the window; ceiling 17 (§6)                           |
| `gpuMs` / `gpuStatus`       | `null` / `implausible` | `null` / `implausible` | the samples were physically impossible and were dropped              |
| `verdict.sampleCount`       | 24                     | 24                     | ≥ `RENDER_P95_MIN_SAMPLE_FRAMES` 20, so the quantile rows are judged |
| `verdict.residualP95Ms`     | 2.10                   | 1.92                   | measured per frame; **the HUD row fails on it**                      |
| `verdict.derivedResidualMs` | −27.68                 | −14.95                 | the old subtraction, reported signed and never judged                |
| `renderStagesMs.camera`     | 0.185                  | 0.100                  | the dish is no longer charged here (was 10.3 in the old evidence)    |
| `frameTimeP95Ms`            | 63.22                  | 53.71                  | CPU stages only; the box's load decides it                           |
| `heapMb`                    | 23.65                  | 26.95                  |                                                                      |

Files: `render-bench-report-zoom{1,1.8}.json`, and `render-bench-seed42-tick120-zoom{1.8,1,0.36}.png`, the three
VISUAL-STYLE §9 zoom bands, paused.

**`gpuMs` is absent, not wrong.** SwiftShader exposes `EXT_disjoint_timer_query_webgl2` and reports times no
frame could have taken (the previous evidence quoted 20 296 and 35 055 ms against ~100 ms frames). Every sample
is now checked against the wall clock between its own two submits; all of them exceed 2× that frame period, so
they are dropped, the context is not trusted again (`gpuStatus: implausible`) and the verdict lists `gpu` under
`unjudged` rather than calling it a 35-second overrun. A GPU budget for #230 needs hardware with a timer that
reports frame time.

**The HUD row can fail, and here it does.** The residual is measured per frame as
`frame − Σ its top-level brackets`: 2.10 and 1.92 ms p95 against the 1.0 ms budget. The old derived number
(`frameTimeP95Ms − Σ renderStagesMs`) is −27.68 and −14.95 ms in the same two runs — negative, as it was in all
three of the pre-review runs, which is why the clamped row could never fail. It is still reported, signed,
because a sum of seven p95s is not the p95 of their sum.

**The allocation figure is a range, not a number.** `heapGrowthBytesPerFrame` measures heap residency growth
over the window, which a collection inside the window silently erases. Six runs of this identical frozen scene:
53 335 / ~169 000 / 292 391 / 323 800 B (perf-engineer, same box) and 91 966 / 214 090 B (these two) — a
**6× spread at identical settings**, so read it as ≈ 50–330 KB per frame and nothing finer. Measuring allocation
itself, by call site, needs a CDP heap sampler this harness does not drive.

**Draw calls do not vary with zoom, and that is Pixi's batcher.** An independent probe (wrapping `getContext`
before page load and counting the four GL draw entry points outside the app, three separately counted frames per
band) read 12 per frame at zoom 1.8 and at zoom 0.36, matching the app's own counter at 1.8 and 1. §6's table is
a layer inventory, not a list of draw calls: sprites from different containers merge into one draw when the GL
state allows it, so "12 = 9 + organelles + flagella + effects" was never a valid reading of it.

Smoke result: 6 / 6 tests pass (three zoom-band screenshots, fresh-load determinism over two fresh loads, and
the budget report at zoom 1.8 and zoom 1). The zoom-1 report needed its own run after the per-test timeout was
raised: 54 SwiftShader frames at the full bench load take about ten minutes on this box.
