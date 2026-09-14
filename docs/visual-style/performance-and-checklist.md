# Evolution — Visual Style: performance intent and the per-asset checklist

§8–§9 of the split [`VISUAL-STYLE.md`](../VISUAL-STYLE.md), which keeps the shared context and the file list.

## 8. Performance intent: geometry, textures, shaders

> **Superseded in means, not in intent, by [`RENDERING.md`](../RENDERING.md) (#120):** cells are one quad + fragment
> shader each (the layer stack as distance bands, deformations as terms of `r(θ)`), organelles are sprites mapped
> through the deformation, cilia and speckle are shader patterns. The rules below that say _what_ is cached and
> _what_ is never done per frame still hold; the "36-point `Graphics` membrane" and "one shader effect" lines are
> the pre-#120 plan.

The frame budget is `architecture/client.md §6` (60 fps, ≤ 12 ms p95 at 8 cells + 1 400 motes). To hold it:

- **Built once, blitted per frame (render textures):** the dish field with its zone tints and noise
  clouds, mire strands, the vent crust and the wall (one texture per zoom band, rebuilt only when the
  camera crosses a band); the condenser light pool with its caustics as one view-anchored sprite over
  the field (§1, `rendering/budget.md §6.1`); the vignette; every glow halo as a radial-gradient
  sprite scaled to size; the cytoplasm noise as one seeded 256 × 256 tile, tinted per palette; every
  mote and bacterium as a pre-rendered sprite at 4 px/wu plus a small variant for zoom < 0.5, in a
  `ParticleContainer`; the eight far-LOD dots.
- **Geometry per frame (Pixi `Graphics` / mesh):** the 36-point membrane of every visible cell, its
  inner edge, rim gradient stroke and outline; organelles, nucleus, envelope and filaments at full LOD;
  cilia and flagella as polylines; the seat-mark beads and the self ring; the engulf-warning ring; effects
  rays and rings.
- **Filters (blur, turbulence) run only at texture build time**, never per frame on a cell. The
  wobble, stretch, dents and eat / engulf / level-up deformations are vertex maths on the loop; the
  glow "bloom" of a pulse is a halo sprite scaled up, not a filter.
- **One shader effect:** the vent heat shimmer (a displacement over the cached vent texture). The
  trait-picker dim is a DOM overlay owned by `UI.md`, not a render effect. Anything else proposed as a
  shader is a ticket, not a PR.
- Depth particles and bokeh are `ParticleContainer`s with no per-particle state beyond position and
  phase.

## 9. Per-asset checklist (graphics-qa reviews against this, after `ASSET-GENERATION.md §6`)

- [ ] Light from the top-left only: glint top-left, dark pool bottom-right, rim brightest top-left and never dark opposite.
- [ ] Every glow is core + soft halo + wide halo + glint from a cached sprite; no per-frame blur filter.
- [ ] Every colour is a `render/constants.ts` name from §2 or a sheet table; derived shades come from `render/palette.ts`.
- [ ] Dimensions are fractions of `r` (cells) or wu (world) from the sheet tables; nothing hard-coded in px except the px floors of §2, §5 and §6.
- [ ] The stage shows exactly the layers of §3 (a protocell has no nucleus; a nucleus has an envelope only from `nuclear_envelope`).
- [ ] Each trait draws its §4 vocabulary and its tier progression, and its mid-LOD tell (§4, last column) survives the 8–20 px LOD.
- [ ] Every cell carries its seat mark and the own cell its self ring (§2) at every LOD ≥ 8 px; a deuteranopic simulation of the screenshot still tells the players apart.
- [ ] Idle motion per §5 (breathing / wobble / ambient) is driven by `t` and the cosmetic stream; a paused replay frame reproduces.
- [ ] Deformations are Gaussian bumps on the 36-point loop with the sheet-03 amplitudes and easings; pulses ≤ 1.14×, overshoot ≤ 3 %.
- [ ] The silhouette reads alone at 1 px/wu (compare against sheet 04's top row) and the far dot at zoom 0.36.
- [ ] Translucency holds: the field, motes and an engulfed prey show through the body.
- [ ] Evidence: a 1080p screenshot at zoom 1.8, 1.0 and 0.36 plus a motion capture for any new deformation, under `qa/evidence/<ticket>/` and in the PR body.
