# Decision: in-round HUD layout

Four 1280 × 800 frames over one dish view for the HUD-layout decision ticket: A as specified
(`docs/UI.md`), B lean, C diegetic, and B's trait-pick overlay. Code-drawn SVG, seeded, rendered
with `rsvg-convert`; re-run from the repo root:

```bash
python3 qa/decisions/hud-layout/tools/render.py qa/decisions/hud-layout
for f in hud-a-as-specified hud-b-lean hud-c-diegetic hud-b-trait-pick; do
  rsvg-convert -w 1280 -h 800 qa/decisions/hud-layout/$f.svg -o qa/decisions/hud-layout/$f.png
done
```
