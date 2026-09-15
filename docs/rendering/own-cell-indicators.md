# Evolution — Rendering: own-cell indicators and world-anchored labels

§10 of the split [`RENDERING.md`](../RENDERING.md), which keeps the shared context and the file list.

## 10. Own-cell indicators and world-anchored labels (#146)

[`ui/hud.md §3.1`](../ui/hud.md#31-in-round-elements-visible-while-roundphase--playing-and-lifestate--alive) owns **what**
the own cell shows: the DNA ring, level numeral, ladder orbit, sprint state of the self ring, escape arc and the
nearest-threat label, with their data, states, wording, the reading-floor constants (`ui/components-and-constants.md §9`) and the
`OwnCellIndicators` record. This section owns **how** they are drawn and restates none of that; a value or a state
named here is a link to UI.md, never a copy. The files are §8's `effects/` indicator files.

- **Where.** The effects layer (§6), above pass B and under the effect sprites, from the `ownCellIndicators` signal
  (§1), the fourth HUD crossing (`RenderInputs.ownCellIndicators`, #187), and nothing else: `own-cell-indicators.ts`
  turns the record plus the own view's centre and `r_px` into arc rows, sprite placements and texts, and
  `own-cell-indicators-layer.ts` applies them (the DNA fill's `INDICATOR_FILL_TWEEN_MS` tween and the `level_up`
  flash are its two clocks); the texts come from a factory (`indicator-text.ts`) so a spec can stand in for
  `BitmapText`. All of it sits in the **undeformed frame** exactly like the self ring (§2.2), so nothing bends with the membrane or lags the
  predicted own position. The rings, tracks and arcs (the DNA track and fill, the ladder backings, the unlock rings,
  the escape track and arc) are rows of the arc primitive (`effects/arc-mesh.ts`). Each row carries its cap: the DNA
  fill and the escape arc are round, the backings (`effects/orbit-backing-arcs.ts`, `orbitLayout`'s padded, merged
  spans) are **butt**, so a backing ends exactly `LADDER_BACKING_END_PAD_PX` past its items and two unmerged backings
  never overlap (a round cap would add half the 16 px stroke to each end). The primitive is
  one instanced quad per row whose fragment stage measures the distance to the stroke, so a fill is exact at any
  share, the stroke keeps its px width at any radius and every arc of the frame is one draw call
  (`draw(arcs, zoom)`, start angles through `screenRadiansOf`, no per-frame `Graphics`). The sprint state of the
  self ring is **not** an arc row: pass B draws it from `selfRingFill` (§2.2, #295). Ghosts and pip blocks are
  entries of the indicator atlas
  (`textures/indicator-atlas.ts`, one packed source) baked at their fixed px size times the device pixel ratio
  (rounded up, capped at `INDICATOR_BAKE_MAX_DPR`), keyed by `OrbitGhost.key` and `pipBlockKey(variant, eaten,
required)`; the pip blocks are one entry per (variant, eaten) from each endosymbiont's `unlockedBy.count` in
  `TRAIT_CATALOG` (ui/hud.md §3.1.2's source), and the key clamps `eaten` again, so a counter is two sprites. The rung
  ghosts bake white for the rim-colour tint, the counters' in their organelle colour. The numeral and the labels are
  `BitmapText` in the `value` / `label` roles over one shared install per texture bundle
  (`textures/bitmap-fonts.ts`, names in `textures.indicators.fonts`), the labels on the label pill, a nine-slice
  sprite that stretches only its middle column (`ui/input-and-onboarding.md §6`). Budget inside the `effects` stage's 0.3 ms (§7), the
  worst case being a prokaryote with both counters unlocked and a threat on screen: two ghosts, two pip blocks and
  the label pill = 5 sprites; the DNA track and fill, two backings and two unlock rings = 6 arc rows
  (`ARC_INSTANCE_CAPACITY` 8) in one call; the numeral and the label = 2 texts (the escape track and arc replace the
  orbit and hide the label, so they never add to this). The self ring's track and arc cost neither a sprite nor an
  arc row: the cell shader draws them (Sprint state, below).
- **Floors.** `dnaRingRadiusPx` and `ladderOrbitRadiusPx` (`effects/own-cell-geometry.ts`) and `orbitLayout` (`effects/orbit-layout.ts`), all pure, apply UI.md
  §9's constants, whose home is `constants.ts` beside `SELF_RING_MIN_PX`; the spec pins ui/hud.md §3.1.3's geometry
  table at the Z1 camera's 24 / 32 / 47.4 / 64 / 94.8 / 128 px (read from the doc), its seat-mark clearance and DNA
  keep-out inequalities (the picker band's is `hud/format/picker-band.spec.ts`) and the ghost-beside-a-counter case. `orbitLayout` centres each counter on its angle, ghost first and
  pips after, clockwise, turns a counter away from a rung ghost it would crowd (ui/hud.md §3.1.3; the gap is measured between the drawn,
  tangent-laid boxes by `effects/oriented-box.ts`, never along the arc), and merges
  backings whose pads meet. The record's angles are degrees clockwise from 12
  o'clock; `screenRadiansOf` is the one turn to screen radians, pinned against the §9 angles. They
  snap with the self ring's LOD (§5): drawn at every LOD the own cell reaches, never faded.
- **Clips.** The ring and numeral flash is the `level_up` clip's `ringFlash` track and the sprint-ready brighten is
  the `sprint_ready` clip (§4), both played by `motion-clip-player.ts` off `renderTick` like every other clip; the
  DNA fill tweens at `INDICATOR_FILL_TWEEN_MS`. No indicator reads `serverTickEstimate`.
- **Sprint state.** The self-ring band (§2.2) is drawn as a track plus an arc of `sprintFill` in the cell shader,
  not as effect sprites: `selfRingFill` and `selfRingBrightness` take the row's eleventh scalar texel (§2.3, #295; the
  row had no spare channel), both at their rest values on every cell but the own one; the track is the same dashed band at
  `SELF_RING_TRACK_ALPHA`. `effects/own-cell-ring.ts` resolves them per frame: a full ring while sprinting, the
  record's fill otherwise, and the `sprint_ready` clip's `selfRingBrightness` track from the frame the fill reaches
  ready (never on a cell's first frame, so a respawn does not flash). The source is the record's `sprintFill`,
  `isSprinting` and `escape` (`ownCellRingSourceOf`), so the ring and the status mirror read one truth.
- **Keep-out.** `cells/organelle-layout.ts` rejects `|q| < DNA_RING_KEEP_OUT_FRACTION` in addition to the nucleus
  disc, for every cell (one rule, no own-cell branch, §3); the fraction is set from the floored ring so the rule
  holds from 31 px up (`ui/hud.md §3.1.3`), and below that the ring's track backs it.
- **Escape arc.** Drawn from `escape.fill` and `escape.phase` as ui/hud.md §3.1.2 says (draining window, then solid);
  the pass-B warning ring of §2.2 is suppressed on the cell whose id is `escape.predatorCellId` while the arc shows,
  and on no other cell. The render state packs that cell's `warningRingPx` as 0 (`cells/self-ring.ts`
  `isWarningRingHidden`), so its quad also drops back to the ringless extent; no instance channel is spent on it.
  The suppression is gated on one switch, `effects/own-cell-ring.ts` `SHOULD_HIDE_PREDATOR_RING_DURING_ESCAPE`, which
  is **on** since #187 draws the arc: the own cell always has exactly one danger tell for its predator, and the ring
  returns on the release frame.
- **Threat label.** `threat-label-placement.ts` (pure): the pill's centre is the warning ring's radius plus
  `THREAT_LABEL_GAP_PX` plus half the pill's height from the threat's centre **toward the own cell's centre**; if
  that pill's box intersects the disc of the own cell's orbit extent (`ui/hud.md §3.1.3`) the centre flips to the far
  side of the ring (the same distance, away from the own cell); text stays upright. The warning rings on every
  eligible cell remain the pass-B band of §2.2; the label is drawn on the nearest one only, as the record says.
- **Legibility cues (decision #324).** `ui/hud.md §3.1.5` owns what they show and where; this bullet owns how. The
  mass chip, rate tags, floaters and zone pill are laid out by `effects/cue-layout.ts` (pure, over `orbitLayout`)
  and drawn in the effects layer beside the indicators: the pills are the label pill's nine-slice at
  `CUE_PILL_HEIGHT_PX` with a rim variant per role, the numbers and causes `BitmapText` from `indicator-text.ts`,
  the trend glyph and trait glyphs atlas entries. Floaters animate on `renderTick` (rise, fade) from a small pool
  (`FLOATER_MAX_VISIBLE`), never a per-frame allocation. Budget: at most 1 chip + `RATE_TAG_ROWS_MAX` tags +
  `FLOATER_MAX_VISIBLE` floaters + 1 zone pill = 9 pills and 18 texts on top of the indicators' worst case; the
  build measures them inside the `effects` stage's 0.3 ms on the bench and raises the line in `rendering/budget.md`
  only with a measurement.
- **Relation rings.** Pass B's ring band, the one the warning ring uses (§2.2). A relation ring adds, per cell
  instance, a ring radius (the inner line's), a **line count** (1 for the edible ring, 2 for the toxic double line,
  whose second line is drawn `TOXIC_RING_LINE_GAP_PX` outside the first), a role colour (`GAIN` or `DANGER`) and that
  role's alpha (`EDIBLE_RING_ALPHA` or `TOXIC_RING_ALPHA`). The lines are solid, still and `RELATION_RING_STROKE_PX`
  wide. All of it is packed like `warningRingPx` (the line count and role share one scalar), so rings on many cells
  cost no draw calls; `RELATIONS_MAX_RINGED` caps the cells that carry one.
  A cell with a warning ring packs no relation ring. The labels are threat-label pills placed by
  `threat-label-placement.ts`'s rule.
- **Tests.** `own-cell-geometry.spec.ts` (the angle turn, the geometry table, the three inequalities),
  `oriented-box.spec.ts`, `own-cell-indicators.spec.ts` (#187: the worst case at 5 sprites, 6 arc rows and 2 texts,
  the DNA fill and its gold, the orbit in world units, the escape window and its two labels, the threat label
  through `threatLabelPlacement`, `threatAnchorFor`), `own-cell-indicators-layer.spec.ts` (the fill tween, the
  level-up flash never on a first frame, hiding and a fresh respawn), `indicator-fill-tween.spec.ts`, `orbit-layout.spec.ts` (the counter layout and the ghost-beside-a-counter clearance) and
  `threat-label-placement.spec.ts` (near side at 200 px above a 30 px predator, far side at 100 px, the
  pill's whole box tested against the orbit extent so a wide pill beside the cell flips, upright at every angle),
  and for the textures (#294) `ghost-bake.spec.ts` (every silhouette inside the `LADDER_GHOST_PX` square, the
  layer order, the rung ghosts white), `pip-block-bake.spec.ts` (the clamped key, the first row nearest the cell
  and lit clockwise under the orbit tangent, exactly `eaten` lit), `label-pill-bake.spec.ts` (caps and stretch
  column make up the bake), `bitmap-fonts.spec.ts` (the roles' faces, sizes, outline and glyphs),
  `indicator-atlas.spec.ts` (a ghost for every `OrbitGhost.key`, a pip block for every clamped lookup) and
  `indicator-textures.spec.ts` (one source, fonts installed once and uninstalled on destroy), unit, no WebGL;
  `?bench&sheet=indicators` draws the baked sheet for review (`bench/indicator-sheet.ts`); the screenshot baselines (§9) gain the own cell at the six sizes with the
  counters showing, the max-level ring, the escape arc before and after the seal and the far-side label, from
  `qa/decisions/hud-layout/diegetic/` as the reference look and its fixed indicator records as the scene fixtures.
