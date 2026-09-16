# `?bench&cues=1` — the legibility cues' cost on the effects stage (#385, PR A)

The bench scene (seed 42, tick 120, zoom 1, 1920 × 1080 canvas) with and without `cues=1`, which draws the own
cell's worst case: a shrinking mass chip with its trend glyph, three rate tags (the DECAY one with its trait glyph
and share), the zone pill and four floaters kept alive by an eat, an engulf payout and a sprint in turn.

**Machine and load.** The shared devcontainer box (4 cores), with other agents' validate runs and a dev-mode Angular
stack in flight; Playwright MCP Chromium. Every stage is over its budget line in every run, the baseline included, so
these numbers compare **with against without**; they are not a verdict against `rendering/budget.md §7` (that needs a
hardware run, as §7 says).

**Short windows are noise.** Two 24-frame baselines measured the effects stage at 0.78 and 5.69 ms p95: a load spike
swamps the difference. The comparison below uses the full 240-frame window, each pair run back to back.

| Run (240 frames, p95 ms) | effects | cells | net  | frame | draw calls |
| ------------------------ | ------- | ----- | ---- | ----- | ---------- |
| baseline, before the fix | 0.70    | 7.30  | 4.81 | 17.3  | 12         |
| `cues=1`, before the fix | 2.50    | 7.41  | 4.41 | 19.8  | 13         |
| `cues=1`, after the fix  | 1.10    | 6.50  | 3.30 | 15.3  | 13         |
| baseline, after the fix  | 0.62    | 8.00  | 4.60 | 20.9  | 12         |

**What it shows.**

- Before: the cue layer measured every part of every pill twice a frame through one shared `BitmapText`, whose text
  changed on every call, so each measure re-laid out its glyphs: about +1.8 ms p95 on the effects stage.
- After (commit `perf(cues)`: widths kept by role and string, rows reuse the widths they were sized with): about
  **+0.5 ms p95** with every cue drawn at once, and **one extra draw call** (12 → 13: the cue pills are textures of
  their own, so they do not batch with the indicator atlas).
- The cue share alone is still above the effects stage's 0.3 ms line, and `rendering/budget.md §6` counts the effects
  row at 3 calls with one call of headroom. Neither the line nor the table is raised by this PR: that is the reviewers'
  and a hardware run's call, flagged in the PR body.

Raw 24-frame reports: `bench-cues-run1.json`, `bench-cues-run2.json`, `bench-baseline-run1.json`, `bench-baseline-run2.json`.
