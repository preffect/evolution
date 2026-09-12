# PR #255 evidence (#243 cell tells polish)

Private 4510/4512 stack from the worktree, room seed 243, five mass-150 cells placed by the debug MCP
(`debug_set_player`, room paused, one `debug_step_room`), client caught up at 640×400 then resized to 1920×1080.

`measure.py` (ImageMagick `txt:` dumps, run from this directory against `full-1920.png`, no arguments) prints the
three readings the PR body quotes. Run it and you get, verbatim:

```
WALL BAND (protocell + cell_wall tier I). Band edges and hairline in px, then against the radius
  anchored on the spec inner edge 1.05 r; spec: band -> 1.1175 r, hairline 1.0875 r
  ray   0: band 76.20..80.66 px (4.46 px thick), hairline 78.98 px  |  R=72.6 px -> band 1.050..1.111 R, hairline 1.088 R  |  R_edge=71.9 px (-1.0%)
  ray  90: band 70.25..74.69 px (4.44 px thick), hairline 73.00 px  |  R=66.9 px -> band 1.050..1.116 R, hairline 1.091 R  |  R_edge=65.8 px (-1.7%)
  ray 180: band 80.43..84.83 px (4.40 px thick), hairline 83.08 px  |  R=76.6 px -> band 1.050..1.108 R, hairline 1.085 R  |  R_edge=75.6 px (-1.3%)
  ray 270: band 74.15..78.57 px (4.42 px thick), hairline 76.93 px  |  R=70.6 px -> band 1.050..1.113 R, hairline 1.089 R  |  R_edge=69.8 px (-1.1%)
FILAMENTS (cytoskeleton tier I): FWHM of each spoke on a circle 48 px from the nucleus centre (arc px)
  spokes found: 9  widths px: [1.05, 1.47, 1.05, 1.05, 1.05, 1.05, 1.05, 1.26, 1.05]  mean 1.12 px  (baseline 13, peak 42)
SPECKLE: avatar-0 cell A dots=34, avatar-0 own cell C dots=36, A dots within 2.5 px of a C dot (same cell-frame offset) = 6
```

## How the wall radius is obtained, and what it does and does not prove

The band itself is measured with no radius at all: it is the only cyan feature outside the body, so the script
takes the sub-pixel half-max edges around the cyan peak and the light hairline as the luma peak inside them. Those
are the `px` columns, and they stand on their own — 4.4 px thick with the hairline 2.8 px in from the inner edge.

The radius is then **anchored on the spec**, not measured: the band's inner edge is `CELL_WALL_INNER_RADII` 1.05 r
(`constants/cell-shape.ts`), so `R = inner / 1.05`. The `/R` columns therefore test the band's **thickness** and the
hairline's **place inside it** against the tier-I spec (1.05 → 1.1175, hairline 1.0875); they cannot test the 1.05,
which is assumed. Read that way the shot agrees: hairline 1.085–1.091 R against 1.0875, and the outer edge
1.108–1.116 R against 1.1175 — half-max sits a little inside the nominal edge because the outer line is feathered.

`R_edge` is the independent cross-check: the cell body's own outer edge, the half-max of the rim-light fall-off
against the floor of the gap between the body and the band. It lands 1.0–1.7 % inside the anchored radius, which is
the outline's antialiased skirt being counted as body. The two agreeing to about a pixel is what says the anchor is
not carrying the result.

An earlier version of this script took the outline as the darkest pixel in a fixed 55–95 px window. The dish
background beyond the cell is darker than the outline, so that minimum landed on background and every ratio after
it was wrong (it printed a 1.012–1.310 R band). graphics-qa caught it on PR #255; the block above replaces it.
