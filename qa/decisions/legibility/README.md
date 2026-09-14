# Decision: legibility (#321, revisits #143)

`audit.md` lists each mechanic that decides a round and what shows it today. Three 1280 × 800 in-round frames
show the same moment: you are Moss (cyan, level 5, mass 312) in the warm vent, touching a toxic cell, with a
bigger Amoeboid nearby and 1:48 of bloom left.

- `legibility-a-diegetic.png`: A, cues on the cell and in the world.
- `legibility-b-strip.png`: B, a minimal stats strip and effect icons.
- `legibility-c-coach-tab.png`: C, A plus a hold-Tab panel and a first-round coach pill.
- `legibility-camera-lever.png`: the camera lever (1280 × 660), which works with any option. It compares
  today's size lock with Z1, partial zoom, and Z2, slow zoom.

The frames are code-drawn SVG, seeded, and reuse the #143 kit in `../hud-layout/tools/render.py`. To re-render,
run from the repo root:

```bash
python3 qa/decisions/legibility/tools/render_legibility.py qa/decisions/legibility
for f in legibility-a-diegetic legibility-b-strip legibility-c-coach-tab; do
  rsvg-convert -w 1280 -h 800 qa/decisions/legibility/$f.svg -o qa/decisions/legibility/$f.png
done
rsvg-convert -w 1280 -h 660 qa/decisions/legibility/legibility-camera-lever.svg -o qa/decisions/legibility/legibility-camera-lever.png
```
