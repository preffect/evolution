# Visual baselines

Reference renders graphics-qa compares every visual PR against (`.claude/agents/graphics-qa.md`).
A PR's own evidence under `qa/evidence/<pr>/` shows intent; the baseline shows regressions. When a
change is intended, graphics-qa updates the baseline in the same PR; authors never do.

- `dish/` — the dish field, vent sprite and bake preview at seed 42, 1920 × 1080, zoom 1 (from #221).
- `cells/` — the cell material at seed 42, 1920 × 1080: zoom 1.8 at rest, mid LOD, mass 5000 at zoom 0.36, the protocell (from #228).
