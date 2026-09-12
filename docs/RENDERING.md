# Evolution — Rendering

Ticket #120, epic #85. The implementation contract for the Pixi v8 renderer (#99, decided in #33) and the
specialised forms (#121). It decides **how a cell is drawn**; what it looks like is
[`VISUAL-STYLE.md`](./VISUAL-STYLE.md) and the sheets in [`concept-art/README.md`](./concept-art/README.md).
Every number here is traced to a sheet table or a design doc; the few new ones are named constants whose
home is `packages/client/src/app/game/render/constants.ts` (`CODE-STANDARDS.md §2`, "client render-only
numbers") unless a table below says otherwise. Units follow `VISUAL-STYLE.md`: wu, fractions of `r`, ms.

**Decisions that supersede earlier text.** The concept sheets are SVGs built from per-layer blur and
turbulence filters; **SVG is a spec, never a runtime asset**, and nothing in `render/` loads, parses or
rasterises one. `VISUAL-STYLE.md §8`'s "36-point membrane as `Graphics` geometry, one shader effect only"
was the pre-#120 intent; its goals (nothing filtered per frame, glows as cached sprites, deformations as
functions of `t` and the cosmetic stream) stand, its means are replaced by §2 below. `DETERMINISM.md §7`'s
`membrane-mesh.spec.ts` is `cells/radial-profile.spec.ts` (§9). `ARCHITECTURE.md §6, §10` link here.

## 1. Inputs: the snapshot, the tick, the cosmetic stream

The renderer reads **only** what `net/` gives it and never feeds anything back
(`ARCHITECTURE.md §1`, "client-side cosmetic"). The server never knows about wobble.

| Input                                                                                                                                                    | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CellView` (`x`, `y`, `velocityX/Y`, `radius`, `mass`, `stage`, `traits`, `states`, `engulfProgress`, engulf ids, `sprintRemainingTicks`, `avatarIndex`) | `ARCHITECTURE.md §2`, interpolated at `renderTick` (§5) for remote cells, predicted for the own cell                                                                                                                                                                                                                                                                                                                                                                              |
| `FoodMoteView`, `MotePositionView`, `DnaFragmentView`, `GelPatchView`, `effects`                                                                         | `ARCHITECTURE.md §4`; a bacterium's heading is not on the wire and is derived as the direction of its interpolated displacement, held when still                                                                                                                                                                                                                                                                                                                                  |
| `renderTick` (fractional)                                                                                                                                | `net/interpolation.ts` (`ARCHITECTURE.md §5` owns the delay and the lerp; nothing under `render/` computes it); **`timeSeconds = renderTick × TICK_INTERVAL_S`** is the only time the renderer sees. A paused room (`debug_pause_room`) holds `renderTick`, so the frame is identical until it resumes                                                                                                                                                                            |
| Cosmetic randomness                                                                                                                                      | two levels from the root: `createSeededRandom(snapshot.seed).fork(RANDOM_STREAM.cosmetic)` is the round's cosmetic stream (`render-textures.ts`), and every consumer forks a `COSMETIC_SUB_STREAM` label off it: `.fork('cell:' + cellId)` for a cell's phases, strip row and organelle slots (`cells/cell-render-state.ts`), `.fork('field')` / `'strip'` / `'dish'` / `'vent'` / `'organelles'` for the bakes (#206). `ARCHITECTURE.md §6` and `DETERMINISM.md §1.8` point here |
| `balance` (from `game_state`)                                                                                                                            | `speedRatio = ‖velocity‖ / maxSpeed(mass, balance)` through the shared kernel; `canEngulf(cell, own, balance.absorption)` for the warning ring                                                                                                                                                                                                                                                                                                                                    |
| HUD crossings                                                                                                                                            | `previewTraitId`, `reticleVisible`, `ownCellIndicators` in; `cameraExtent` out; wired in `game-setup.ts` (`UI.md §7`). Pointer target for the reticle comes from `input/`, not the HUD; the indicators record is `UI.md §3.1.4`'s and is drawn per §10                                                                                                                                                                                                                            |

`render/` never calls a clock (`CODE-STANDARDS.md §8`): the bench harness (§7) drives `renderTick` from a `ManualClock`.

## 2. The cell: one quad, one fragment shader

Every cell is **one instanced quad** whose half-size is the per-instance `quadExtentRadii × r` (§2.3):
`max(CELL_QUAD_EXTENT_RADII, FAR_DOT_HALO_RADII at far LOD, (warningRingPx + WARNING_RING_STROKE_PX) / r_px)`.
`CELL_QUAD_EXTENT_RADII` 3.0 (new) is the floor: the engulf arm at 1.62 r times the trait halo at 1.39 r, times the
moving-wrap worst case (stretch 1.13 at `ENGULF_PREDATOR_SPEED_FACTOR` 0.6 with an eat pulse 1.09 mid-engulf) is
2.77, 2.99 at k = 1, so 3.0 keeps the halo unclipped at an arm tip or the seal bulge; §9 pins the moving-wrap
case (`shape-terms` reports the per-instance maximum, and the extent uses it when it exceeds the floor). The two pass-B bands that reach past it stay in
this shader and raise the extent instead of moving to effect sprites: the far-dot halo (`FAR_DOT_HALO_RADII` 3.0,
§5) and the warning ring (`ENGULF_WARNING_RING_MIN_PX` exceeds 3.0 r_px below 8.7 px, most of the mid band), both
of which must track the instance's undeformed centre and snap with its LOD (§5). The extra area is discarded
fragments. The quad carries a fragment shader that evaluates a radial profile `r(θ)` and paints
sheet 01's layer stack as bands of two coordinates: the normalised radial coordinate **ρ = |p| / r(θ)** (ρ = 1 is
the membrane) for interior fills, and the **perpendicular membrane distance `d`** (§2.1) for every band measured
from the membrane. No vertex ring, no per-object hairs, no per-frame `Graphics` for bodies.

### 2.1 The profile

```text
r(θ)   = r · pulse · B(θ − h) · stretch(θ − h) · (1 + breathing + wobble(θ) + jitter(θ) + lobes(θ) + Σ bumps(θ))
bump(θ) = amplitude · exp(−(θ − centre)² / (2 σ²))                       (sheet 02, membranes paragraph)
d(p)    = (|p| − r(θ)) / sqrt(1 + (r′(θ) / r(θ))²)                       world units, > 0 outside the membrane
```

`h` is the heading (`atan2(velocityY, velocityX)`, held when ‖velocity‖ ≈ 0). The TypeScript reference
`cells/radial-profile.ts` and the GLSL evaluate the same expression; organelle mapping (§3) uses the TypeScript
one. Every term is data (the tables below), so a new deformation is a row, not a branch.

**Perpendicular distance.** `ρ` is a radial measure, so a band of width `w` in ρ is only `w · r` thick where the
outline runs tangentially: on the flank of a +62 % σ 16° engulf arm the slope `r′/r` of the deformed profile peaks
at ≈ 0.99 (≈ 1.1 σ from the arm centre) and a ρ band thins to ≈ 71 %; on a pseudopod, a spindle tip or the stentor
stalk (sides nearly radial, ±3° at the far end) it vanishes. Sheet 01 panel D and sheet 03 B-02 show a
constant-thickness rim around the arms, so every band measured from the membrane (inner edge, soft rim, rim
light, outline, film, wall, cilia, seat marks) is a band of `d`, and only the interior fills use ρ. `r′(θ)` is evaluated alongside `r(θ)`: every term is a sine, a Gaussian or a strip
read, so the derivative is closed-form (the strip bakes its own derivatives, see `jitter`) and the TypeScript
reference pins it (§9). In §2.2 a membrane band written `0.975 → 1.025` means `d / r` in `[−0.025, +0.025]`.

| Term        | Formula                                                                                                                                                                                                              | Values (home)                                                                                                                                                                                                           | Driven by                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `B`         | 1 for the blob; per-form profile (#121, §2.4)                                                                                                                                                                        | sheet 04 specialised-forms table                                                                                                                                                                                        | `stage`, form trait                           |
| `breathing` | `A · sin(2π f t + φ)`                                                                                                                                                                                                | `BREATH_AMPLITUDE` 0.02, `BREATH_HZ` 0.5 (sheet 01 motion table); `WOBBLE_TAUT_SCALE` 0.5 with `cytoskeleton` (VISUAL-STYLE §5)                                                                                         | `t`, φ from the cosmetic fork                 |
| `wobble`    | `A · sin(m θ + 2π f t + φ)`                                                                                                                                                                                          | protocell m 2, ±0.08, 0.7 Hz (sheet 04); forms m 3, ±0.05 (VISUAL-STYLE §5)                                                                                                                                             | `stage`                                       |
| `jitter`    | `J · strip.R(θ / 2π + φ)`, `strip` = the 256 × 1 seeded RGBA noise strip (R jitter, G lobes, B and A their `d/dθ`)                                                                                                   | `JITTER_AMPLITUDE` 0.008 (sheet 02: ±0.8 %)                                                                                                                                                                             | cosmetic fork                                 |
| `lobes`     | `strip.G(θ / 2π + φ)`: `REST_LOBE_COUNT` 5–7 fixed Gaussians of `REST_LOBE_AMPLITUDE` ±0.025–0.04, `REST_LOBE_SIGMA_RAD` 0.25–0.4, baked into the strip per cell phase (one texture read, no instance slots)         | sheet 02 membranes paragraph, sheet 01 panels A (hero radius 126–131 px = ±2 %), B, D, E, F; × `WOBBLE_TAUT_SCALE` with `cytoskeleton`; 0 for `diatom_shell`                                                            | cosmetic fork, `stage`                        |
| `stretch`   | `1 + k[(S_ALONG − 1) · max(cos Δ, 0)² − (1 − TAPER) · max(−cos Δ, 0)² − (S_ALONG − 1) · ACROSS · sin²Δ]`; C¹ at the sides                                                                                            | `S_ALONG` 1.22, `TAPER` 0.72 (sheet 01 motion); `STRETCH_ACROSS_PER_ALONG` 0.6 (sheet 02's 1.10 × 0.94); sprint × 1.06 (VISUAL-STYLE §5). k = 1: 1.22 / 0.868 / 0.72 at Δ 0° / 90° / 180°; k = 0.45: 1.10 / 0.94 / 0.87 | `k = speedRatio`, sprint                      |
| contact     | bump −0.12, σ 22° toward the neighbour; σ 14° with `cytoskeleton`                                                                                                                                                    | VISUAL-STYLE §5                                                                                                                                                                                                         | `cells/contact-dents.ts` (visible-cell scan)  |
| eat         | dimple −0.12 σ 22°, wrap +0.14 σ 30°, `pulse` 1.09, stretch 1.07 × 0.95, halo 1.5 R                                                                                                                                  | sheet 03, motion clip `eat` (§4)                                                                                                                                                                                        | `eat` effect, angle to the mote               |
| engulf      | arms `arm` at prey angle ± 30° σ 16°, notch `notch` at the prey angle σ `ENGULF_NOTCH_SIGMA_DEG` 12°, seal `seal` at the prey angle σ 42°; amplitudes per keyframe in the §4 engulf table (peak 0.62 / −0.10 / 0.60) | sheet 03, clips `engulf` (domain = progress, VISUAL-STYLE §5) and `absorbed` (the seal relax)                                                                                                                           | `states`, `engulfProgress`, `engulfingCellId` |
| level-up    | `pulse` 0.90 (anticipate) → 1.14 (burst) → 1.0                                                                                                                                                                       | sheet 03, clip `level_up`                                                                                                                                                                                               | `level_up` effect                             |
| respawn     | `pulse` 0.6 → 1.0 `ease_out_back`, alpha 0 → 1                                                                                                                                                                       | VISUAL-STYLE §5, clip `respawn`                                                                                                                                                                                         | `respawn` effect                              |
| pseudopods  | 2 / 3 / 4 bumps toward velocity and toward engulfed prey                                                                                                                                                             | sheet 04 amoeba (#121)                                                                                                                                                                                                  | tier, `engulfingCellId`                       |

Bumps occupy `MAX_SHAPE_BUMPS` (8) instance slots, sized for an amoeba III mid-engulf: two arms, notch, seal and
four pseudopods. Outside an engulf the eat dimple, wrap and one contact dent share the four non-pseudopod slots;
**while engulfing, contact and eat bumps are dropped** (the arm already dents the membrane; an `eat` clip still
runs its `pulse` track), so the peak is exactly eight. Pulses never exceed 1.14 and overshoot ≤ 3 % because the
clip tables say so (pinned, §9).

### 2.2 Distance bands (sheet 01 panel C, back → front)

Light direction is `LIGHT_DIRECTION_DEG` −135° everywhere (VISUAL-STYLE §1). `a(θ)` = angle from the light.
Pass A is drawn under the organelle sprites, pass B over them (§6). Bands are ρ for interior fills and `d / r`
for membrane bands (§2.1: `0.975 → 1.025` reads as `d / r ∈ [−0.025, +0.025]`); "undeformed frame" means the
term is placed from the cell centre in the circle of radius `r · pulse`, unaffected by stretch, bumps or `h`, so
an arm reveals more cytoplasm rather than stretching it. Every ramp, pool and halo edge is a `smoothstep`, never
a hard step.

Halos share one shape, the SVG's radial gradient with its peak stop at `HALO_FLAT_STOP` 0.62 of the outer radius:
`haloAlpha = peak · clamp((outer − ρ) / (outer · (1 − HALO_FLAT_STOP)), 0, 1)`, softened by `HALO_BLUR_RADII` 0.12
at both ends and **evaluated for every ρ under the body fill**, so the halo is flat under the body and still
≈ 19 % at the membrane, which is panel A's "lit from inside" (a 34 % band starting at ρ 1 would draw a bright
ring hugging the outline instead).

| Layer                         | Band (ρ; membrane bands as `d / r`, §2.1)                                                                                                                                                                                                                                                                                                                                             | Colour / alpha (constants, VISUAL-STYLE §2)                                                                                                                                                                                                                                                                                                                                                                                                                | Pass | LOD (§5)                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------- |
| halo                          | flat to 0.79, → 0 at 1.28 (`HALO_OUTER_RADII` 1.28; sheet 01 panel A `halo-cyan`)                                                                                                                                                                                                                                                                                                     | rim @34 % (`HALO_PEAK_ALPHA`); far dot: outer 3.0                                                                                                                                                                                                                                                                                                                                                                                                          | A    | all                        |
| trait halo                    | flat to 0.76 (`TRAIT_HALO_FLAT_STOP` 0.55 of 1.39), → 0 at 1.39, ≈ 26 % at the membrane, replaces the halo                                                                                                                                                                                                                                                                            | `CHLORO_LIGHT` / `TOXIN_GLOW` @42 % (sheet 01 trait legibility; `halo-chloro` / `halo-toxin` peak at a 0.55 stop, not the body halo's 0.62)                                                                                                                                                                                                                                                                                                                | A    | ≥ mid                      |
| protocell halo                | flat to 0.74, → 0 at 1.20 (`halo kind` = protocell)                                                                                                                                                                                                                                                                                                                                   | rim @22 % (VISUAL-STYLE §3, sheet 04: the protocell must feel emptier; its outline is @40 %, see the outline row)                                                                                                                                                                                                                                                                                                                                          | A    | all                        |
| body ramp                     | < 1.00; four-stop radial ramp in the **undeformed frame**, centre `BODY_RAMP_CENTRE_OFFSET_RADII` 0.30 toward `BODY_RAMP_CENTRE_ANGLE_DEG` −126° (the light within 9°), radius 1.36 r; `BODY_RAMP_STOPS` at 0 / 0.55 / 0.86 / 1.0 = 0 / 0.75 / 1.17 / 1.36 r from that centre                                                                                                         | cyto light @42 % → cyto dark @55 % → base @55 % → rim @85 % (sheet 01 panel A `body-cyan`: cx 0.42, cy 0.38, r 0.68 of the body box); the four stops per palette are baked into the palette texture; protocell: the same ramp at 16–26 % (sheet 04 PROTO ramp). This is the layer that gives the 42–85 % range and the dark centre                                                                                                                         | A    | all (flat at mid)          |
| body pools                    | over the ramp, undeformed frame, soft edge `POOL_BLUR_RADII` 0.125 (blur-16 in the SVG)                                                                                                                                                                                                                                                                                               | light pool: rim @14 %, 0.6 × 0.45 r at 0.53 r / −131°; dark pool: cyto dark @50 %, 0.9 × 0.7 r at 0.67 r / +48° (sheet 01 panel A)                                                                                                                                                                                                                                                                                                                         | A    | full                       |
| cytoplasm noise               | < 0.89, **world units**: the two-channel tile sampled at `(p_world − c) / NOISE_TILE_WU` (translates with the cell, never scales or rotates with it; sheet 01 panel B shows the same mottle size on L1 / L5 / L10)                                                                                                                                                                    | a **lightening** overlay on the ramp, tint `WHITE` mixed toward the palette rim, not cyto light / dark: coarse R (`CYTO_NOISE_COARSE`: 3 octaves, 12 cycles per tile ≈ 0.18 c/wu, alpha `clamp(1.6 n − 0.62)` × 22 %); fine G (`CYTO_NOISE_FINE`: 2 octaves, 29 cycles ≈ 0.45 c/wu, white, alpha `clamp(1.8 n − 0.95)` × 18 %); sheet 01 `fractalNoise 0.045` / `0.12` per px at 4 px/wu                                                                   | A    | full                       |
| ribosome speckle              | 0.55 → 0.89, **hashed dot grid** in the undeformed frame: pitch `sqrt(annulusArea / density)` = 0.28 / 0.20 / 0.16 r, one dot per grid cell at `hash(cellId, i, j)` offset, drawn `1 − smoothstep(rad − fw, rad + fw, dist)`                                                                                                                                                          | `RIBOSOME`; radius hashed in `RIBOSOME_RADIUS_RADII` 1.2–2.2 % r with floor `RIBOSOME_MIN_PX` 2, alpha hashed in `RIBOSOME_ALPHA` 0.35–0.80; density 20 / 40 / 60 (VISUAL-STYLE §4; sheet 01 panel A: 28 crisp circles r 1.6–2.8 px @0.26–0.60). Same grid, other band, serves protocell granules if they ever leave sprites                                                                                                                               | A    | full                       |
| cytoskeleton filaments        | from `nucleusOffset` (§2.3) → 0.89, `N` lines; **screen-px mask** `abs(fract(N θ_n / 2π) − 0.5) · 2π ρ_n r_px / N < 0.55 px` with θ_n, ρ_n measured from the nucleus centre (a θ-fraction mask fans out to wedges at the rim)                                                                                                                                                         | `CYTOSKELETON` 1.1 px @28 %; N 11 / 15 / 19                                                                                                                                                                                                                                                                                                                                                                                                                | A    | full                       |
| granules, organelles, nucleus | sprites (§3)                                                                                                                                                                                                                                                                                                                                                                          | sheet 01 / 04 organelle tables                                                                                                                                                                                                                                                                                                                                                                                                                             | —    | full (nucleus disc at mid) |
| inner edge                    | 0.89 → 1.00, a **linear ramp**: edge @55 % at 1.00 → 0 at 0.89, not a flat band (sheet 01: an 11 % r stroke @55 % clipped to the body, of which 5.5 % r is visible; a flat band is the heaviest-rim risk in the stack)                                                                                                                                                                | edge shade (`render/palette.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                           | B    | ≥ mid                      |
| soft rim                      | 0.90 → 1.10, ends blurred 8 % r (a separate band from the rim light)                                                                                                                                                                                                                                                                                                                  | base @35 % (sheet 01 panel A)                                                                                                                                                                                                                                                                                                                                                                                                                              | B    | ≥ mid                      |
| rim light                     | 0.975 → 1.025 (5 % r **centred on the membrane**, sheet 01's 6.4 px stroke) with the outline through its middle: the dark hairline inside the bright band is the "double film" of every sheet-01 rim                                                                                                                                                                                  | four stops at `t = (1 − cos a) / 2` (sheet 01 `rim-cyan`, a −45° → +135° box gradient): `WHITE` @95 % at t 0, rim @95 % at t 0.18 (a ≈ 50°), base @55 % at t 0.55, rim @55 % at t 1, so the far side is "rim, dimmer" (VISUAL-STYLE §1); +20 % on sprint                                                                                                                                                                                                   | B    | ≥ mid                      |
| protocell double film         | two 1 px lines at 1.00 and 0.975                                                                                                                                                                                                                                                                                                                                                      | player rim @55 %, `WHITE` @70 % (sheet 04, VISUAL-STYLE §2)                                                                                                                                                                                                                                                                                                                                                                                                | B    | ≥ mid                      |
| `cell_wall`                   | 1.05 → 1.095, hairline at 1.075, dark line at 1.095                                                                                                                                                                                                                                                                                                                                   | `CELL_WALL`, `CELL_WALL_LIGHT`, `OUTLINE`; thickness × 1.5 / 2 / 2.5                                                                                                                                                                                                                                                                                                                                                                                       | B    | ≥ mid                      |
| outline                       | `abs(d) ≤ max(0.8 px, 1.2 % r) / 2` at 1.00                                                                                                                                                                                                                                                                                                                                           | `OUTLINE` `#020509` @50 % (sheet 01); protocell @40 % (sheet 04)                                                                                                                                                                                                                                                                                                                                                                                           | B    | ≥ mid                      |
| cilia                         | 1.00 → 1.12, **leaning hairs** of constant px width: `lean = d / r · tan(CILIA_LEAN_DEG 30° + wave)`, `wave = CILIA_WAVE_AMPLITUDE_DEG 12° · sin(2π θ · CILIA_WAVE_COUNT − 2π f t)`, `θ_h = θ − lean` (the wave modulates the lean angle, so hairs stay rooted at d = 0), `s = fract(N θ_h / 2π)`, mask `abs(s − 0.5) · 2π ‖p‖ / N < CILIA_WIDTH_PX / 2` (1.2 px, fwidth-antialiased) | `CILIA` @75 % × `(1 − d / 0.12 r)` (fade to the tip); N 24 / 36 / 48; `f` = `CILIA_BEAT_HZ` 2.0 while moving, `CILIA_BEAT_IDLE_HZ` 0.5 at rest; hairs stay rooted, the beat is a travelling wave of the lean (sheet 04 fringe: 1.2 px lines leaning 30°, metachronal wave). `CILIA_WAVE_COUNT` 3, `CILIA_WAVE_AMPLITUDE_DEG` 12, `CILIA_BEAT_HZ` 2.0, `CILIA_BEAT_IDLE_HZ` 0.5 are new (no sheet number; graphics-designer accepted). Mid: flat band @40 % | B    | ≥ mid                      |
| glint                         | ellipse 0.22 × 0.08 r at `GLINT_OFFSET_RADII` 0.74 along `GLINT_ANGLE_DEG` −132°, rotated −40°, edge 1.5 px, undeformed frame like the pools                                                                                                                                                                                                                                          | `WHITE` @50 % (sheet 01 panel A `<ellipse cx=246 cy=245.6 rx=28.2 ry=10.2>`: just inside the membrane, clear of the nucleus disc, which reaches 0.42 r; the nucleus's own highlight at 0.34 r / −136° lives in the baked nucleus sprite, §3)                                                                                                                                                                                                               | B    | ≥ mid                      |
| seat mark                     | beads centred on `d = 0`, `SEAT_MARK_BEADS[avatarIndex]` from `SEAT_MARK_ANCHOR_DEG`; radius `SEAT_MARK_BEAD_RADIUS_FRACTION` with the `SEAT_MARK_BEAD_MIN_PX` floor (a `d`-band, so beads sit on the deformed outline)                                                                                                                                                               | core, halo and alphas: VISUAL-STYLE §2                                                                                                                                                                                                                                                                                                                                                                                                                     | B    | ≥ mid, snaps (§5)          |
| self ring                     | undeformed `‖p‖ = SELF_RING_RADIUS_FRACTION × r` with the `SELF_RING_MIN_PX` floor; width, dash and rotation from the same VISUAL-STYLE §2 constants                                                                                                                                                                                                                                  | `SELF_RING` (VISUAL-STYLE §2); own cell only                                                                                                                                                                                                                                                                                                                                                                                                               | B    | ≥ mid, snaps (§5)          |
| engulf warning ring           | undeformed `‖p‖ = warningRingPx` (the instance value: `ENGULF_WARNING_RING_RADII × r_px` with the `ENGULF_WARNING_RING_MIN_PX` floor, VISUAL-STYLE §5); dash and rotation from the same constants; stroke `WARNING_RING_STROKE_PX` 2 (new)                                                                                                                                            | `DANGER` (VISUAL-STYLE §5, `canEngulf`)                                                                                                                                                                                                                                                                                                                                                                                                                    | B    | ≥ mid, snaps (§5)          |
| prey under film               | pass B alpha × 0.62 while `engulfedByCellId` is set                                                                                                                                                                                                                                                                                                                                   | VISUAL-STYLE §6 "prey through film"                                                                                                                                                                                                                                                                                                                                                                                                                        | B    | ≥ mid                      |

Layer-major order (all bodies, then all organelles, then all membranes) is what makes the prey's rim show
through the predator's film for free; separation (`ECOLOGY.md §5.3`) means unrelated cells never overlap.

### 2.3 Instance layout and passes

`cells/cell-instance.ts` declares one row per cell in an **RGBA32F instance texture** (`textures/pixi-textures.ts`
`floatDataTexture`, re-uploaded once per frame), read by both shader stages with `texelFetch`; `cells/cell-mesh.ts`
draws one unit quad per row with an instance-index attribute. One table (the scalar texels, then the
`MAX_SHAPE_BUMPS` bump slots at three floats each) is the whole contract: the packing writes it and
`cell-shader-source.ts` reads every field through it, so a new field is one entry and never a second attribute
layout (a texture row also has no 16-`vec4` attribute cap to budget against). **WebGL2 is required**: the
program is `#version 300 es`, the instance texture is RGBA32F read with `texelFetch` (nearest; linear on a float
texture would need `OES_texture_float_linear`), and there is no WebGL1 path, so a context that falls back to
WebGL1 fails at program compile and `RenderSession` rejects. The table holds `CELL_INSTANCE_CAPACITY` (512)
rows and is re-uploaded whole once per frame (`capacity × CELL_INSTANCE_TEXELS × 16 B` ≈ 106 KB); past the
capacity the layer drops the **smallest** cells (the sort is radius ascending and it packs from the large end),
a rule the bounds today (8 players + 24 wild cells + ghosts; the bench's 100) never reach. Scalars, in texel
order: centre, `r`, `quadExtentRadii` (§2, read by the vertex stage only), `h`, `k`, palette index, `lodBlend`,
`breathing`, wobble (`amplitude`, `mode`, `phase`), stretch (`axialAlong`, `axialAcross`), `pulse`,
`rimBrightness`, `nucleusOffset` (vec2, cell frame: the mapped `q′` of the nucleus slot, §3, so filaments meet
the nucleus sprite), halo kind (default, trait, protocell), `beadCount`, `isOwn`, `isFarDot`, `isProtocell`,
alpha, the strip row and phase, the strip's `lobesScale` and `jitterAmplitude`. The per-cell deformation
sources feed one record, `cells/cell-deformation.ts` `CellDeformation { bumps, pulse, alpha }`, resolved by
cell id from the frame's map (`REST_DEFORMATION` for every cell without an entry): #216 writes contact dents
into `bumps`, #207 the eat / engulf bumps, the clip `pulse` and the respawn `alpha`. #216 appends the stage /
trait counts (`ciliaCount`, `wallScale`, `speckleDensity`, `filamentCount`, `tintMix` toward `CHLORO_BASE`),
`warningRingPx` and `formId`, #207 the clip-driven pass-B alpha and halo scale. Global uniforms:
`uTimeSeconds`, `uZoom`, `uPass`, the
two-channel noise tile, the RGBA noise strip and the **palette texture** (8 palettes × 8 shades, the four
body-ramp stops among them, baked by `render/palette.ts`, uploaded by `render-textures.ts`). The same
geometry is drawn twice with `uPass` (A, B); instance order is radius ascending (`ARCHITECTURE.md §6`), so two
draw calls cover every visible cell. An absorbed prey keeps drawing as a **ghost instance** built from its last
view (VISUAL-STYLE §5) until the `absorbed` clip ends; the same clip's `seal` track drives the predator's seal
bump (the ghost's `engulfedByCellId`), since the predator's `engulfProgress` is gone on the payout tick (§4).

### 2.4 Forms (#121)

`B(Δ)` per form, `FORM_PROFILES` keyed by the form trait. **Size rule:** `r` comes from mass (`ECOLOGY.md §5.1`)
and a form keeps growing, so every `B` is **normalised to unit area** (`∫ B² dΔ = 2π`, pinned in §9): the drawn
area equals the blob's `π r²` and mass ∝ area holds for forms exactly as for the blob. Sheet 04's wu sizes are
therefore **aspects at the sheet's mass**, never absolute sizes: slipper 60 × 24 wu → aspect 1.6 / 1.8 / 2.0 per
tier (VISUAL-STYLE §4 resolves the 2.5), spindle 50 × 16 wu → 3.1, trumpet 70 wu tall with a 36 wu mouth →
mouth : height 0.51, diatom valve r 26 wu → a circle. Forms: slipper (ellipse, oral-groove dent), spindle (pointed
ends), trumpet (profile from a centre near the mouth; the stalk seen from there is ±3° wide at the far end, where
§2.1's perpendicular distance stops being optional), diatom (rigid: wobble, jitter, lobes **and breathing** zero,
a silica valve does not breathe; 36 striae in pass A, 8 / 12 / 16 spine rays with bright tips in pass B), amoeba
(blob plus pseudopod bumps, §2.1). Values: sheet 04 and VISUAL-STYLE §4. Forms rotate with `h`; the blob and its
organelles do not (seat marks are frame-fixed, VISUAL-STYLE §2).

## 3. Contents: organelles through the deformation

Organelles are **sprites from one code-baked atlas** (`textures/organelle-atlas.ts`: mitochondrion with cristae,
chloroplast with six lit granules, food vacuole, toxin bladder, lipid droplet, protocell granule, nucleus +
nucleolus, nucleoid 1 / 2 / 3 loops, envelope with 16 / 20 / 24 pores, eyespot), baked at
`ORGANELLE_ATLAS_PX_PER_R` 128 px per r (sheet 01 panel A's 4 px/wu at r 32) × `min(ceil(devicePixelRatio), 2)`
at startup, so the 102 px own cell never upsamples at DPR 1 or 2. **Every atlas sprite bakes its own soft halo**
(`ASSET-GENERATION.md §1.5`'s core + soft + wide + glint, for organelles): the nucleus entry is sheet 01 layer 6
in full, a 0.40 r soft glow @35 % under the 0.30 r disc, the 2.3 px rim @75 %, five chromatin spots, the white
nucleolus with its own halo and the nucleus's own highlight (0.34 r / −136°, 0.075 × 0.03 r), so the sprite is
≈ 0.85 r wide and does not read as a flat disc on the body ramp; the mitochondrion's warm glow and the toxin
bladder's `TOXIN_GLOW` are baked the same way.

- **Slots.** `cells/organelle-layout.ts` draws rest positions `q` (normalised, cell frame, heading-independent)
  from the cell's cosmetic fork: nucleus at 0.12 r toward the light (sheet 01), then organelles in
  `ORGANELLE_KIND_ORDER` by rejection sampling inside `DNA_RING_KEEP_OUT_FRACTION ≤ |q| ≤ 1 − 0.08` (VISUAL-STYLE
  §3; the inner bound is `UI.md §9`'s and applies to every cell, so no slot centre sits under the own cell's DNA ring
  from 31 px up, `UI.md §3.1.3`), outside the nucleus disc (0.30 r), with gap `ORGANELLE_MIN_GAP` 0.04 r (new). Slots are appended, never reshuffled, so a tier-up
  adds a bean without moving the others.
- **Lag.** `q' = q − LAG · k · ĥ`, `NUCLEUS_LAG` 0.20 (sheet 01 / 03) for every organelle; nucleus rest drift
  2 % r from the strip (VISUAL-STYLE §5).
- **Mapping.** `p = c + |q'| · r(θ_q') · û(q')`: the same radial profile the shader draws, so cytoplasm flows into
  an engulf arm in proportion to ρ and stretches with the body. Sprites scale (`size × r × pulse`) and pulse
  (mitochondrion 1.15 × on sprint; toxin 1.0 → 1.08 at 1 Hz; vacuoles rise and pop every 2 s: VISUAL-STYLE §4)
  but are never sheared; their outlines are part of the baked sprite.
- **Line geometry, only two:** flagella (`cells/flagellum-lines.ts`: 3 px white core, 2 r, two sine waves
  opposite velocity, amplitude × 1 / 1.5 / 2, tier III two tails, sprint × 2) and the stentor anchor (#121), in one
  `Graphics` per frame. Cilia, filaments and speckle are shader patterns (§2.2).
- **Preview.** `previewTraitId` is folded into the own cell's trait list at the offered tier for rendering only.

## 4. Motion tables (`packages/shared/src/constants/motion.ts`)

Sheet 03's strips become data; the renderer tweens, the HUD opens the picker at the end of `level_up`
(`UI.md §3.2`) and the sound bus (#101) cues on keyframes, which is why the file is shared rather than
render-only (`CODE-STANDARDS.md §2` gains the row). It is cosmetic data: **excluded from `balance.json` and
never imported by `server/`** (the CODE-STANDARDS row says so; `motion.test.ts` pins it, §9). Easing **names**
live here (the `EasingName` strings below are the only spelling, in tables too); the curves are
`render/easing.ts` (VISUAL-STYLE preamble).

```ts
export type EasingName =
  | 'linear'
  | 'ease_out_quad'
  | 'ease_out_back'
  | 'ease_in_out_sine'
  | 'ease_out_cubic'
  | 'ease_in_out_quad'
  | 'ease_in_quad'
  | 'ease_out_expo';
export interface MotionKeyframe {
  readonly at: number;
  readonly value: number;
  readonly easingTo: EasingName;
}
export interface MotionClip {
  readonly id: MotionClipId; // declared below, from MOTION_CLIP
  readonly domain: 'ms' | 'progress'; // engulf is driven by engulfProgress, never the clock
  readonly duration: number;
  readonly isInterruptible: boolean;
  readonly tracks: Readonly<Record<string, readonly MotionKeyframe[]>>; // keys = §2.1 terms and sprite scalars
}
export const MOTION_CLIP = {
  eat: 'eat',
  engulf: 'engulf',
  absorbed: 'absorbed',
  levelUp: 'level_up',
  respawn: 'respawn',
  sprintRelease: 'sprint_release',
  sprintReady: 'sprint_ready',
  organelleBirth: 'organelle_birth',
} as const;
export type MotionClipId = (typeof MOTION_CLIP)[keyof typeof MOTION_CLIP];
export const MOTION_CLIPS: Readonly<Record<MotionClipId, MotionClip>>;
export const sampleTrack: (
  track: readonly MotionKeyframe[],
  at: number,
  ease: (n: EasingName, x: number) => number,
) => number;
```

| Clip              | Domain, length             | Keyframes (sheet 03 strips table; VISUAL-STYLE §5)                                                                                                                                                                      | Tracks                                                                                                                                                                                                              |
| ----------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eat`             | ms, 300, interruptible     | keyframes at 0 approach → 100 wrap → 160 pulse → 220 absorb → 300 settle (sheet 03's "contact 50" is a label inside the first tween, not a keyframe); `ease_out_quad` · `ease_out_back` · `linear` · `ease_in_out_sine` | `dimple`, `wrap`, `pulse`, `stretchAlong`, `stretchAcross`, `haloRadii`                                                                                                                                             |
| `engulf`          | progress, 1.0              | 0 contact → 0.5 wrap → 1.0 seal; `ease_out_cubic` · `ease_in_out_quad`; values in the engulf table below                                                                                                                | `arm`, `notch`, `seal`                                                                                                                                                                                              |
| `absorbed`        | ms, 600                    | 0 seal → 200 dissolve → 400 DNA streams → 600 done; `linear` · `ease_in_quad` · `ease_out_back`                                                                                                                         | `rimDash`, `cytoplasmAlpha` (→ 0.5), `streamProgress` on the ghost; `seal` on the predator (table below)                                                                                                            |
| `level_up`        | ms, 900, not interruptible | 0 → 120 anticipate → 250 burst → 450 nucleus → 700 settle → 900; `ease_in_quad` · `ease_out_expo` · `ease_out_cubic` · `ease_in_out_sine` · `linear`                                                                    | `pulse` (0.90, 1.14), `rayRadii` (1.2 → 1.95), `shockRingRadii` 1.6, `rippleRadii` 1.7 / 2.1 / 2.5, `nucleusFlash`, `ringFlash` (0 → 1 at burst → 0 at settle: the own cell's DNA ring and numeral, `UI.md §3.1.2`) |
| `respawn`         | ms, 400                    | scale 0.6 → 1.0 `ease_out_back`, alpha 0 → 1 `ease_out_quad`, halo 2 r → 0                                                                                                                                              | `pulse`, `alpha`, `haloRadii`                                                                                                                                                                                       |
| `sprint_release`  | ms, 200                    | `ease_out_quad` back to rest                                                                                                                                                                                            | `stretchSprint`, `rimBrightness`                                                                                                                                                                                    |
| `sprint_ready`    | ms, 200                    | 0 → 100 peak → 200 rest; `ease_out_quad` · `ease_in_quad`: the one brighten of the self ring when the cooldown ends (`UI.md §3.1.2`)                                                                                    | `selfRingBrightness` (0.70 → 0.95 → 0.70)                                                                                                                                                                           |
| `organelle_birth` | ms, 3 000                  | ghost 0.44 → 0.30 r, recolour along the ramp                                                                                                                                                                            | `ghostSize`, `rampMix`                                                                                                                                                                                              |

**Engulf bump amplitudes per keyframe** (fractions of `r`; centres and σ are fixed: arms at the prey angle ± 30°
σ 16°, notch and seal at the prey angle, notch σ `ENGULF_NOTCH_SIGMA_DEG` 12°, seal σ 42°; sheet 03 gives the
notch no σ, so 12° is a design choice, graphics-designer to accept: it puts the notch's 2.5 σ at the arm centres,
so the dip reads between the arms and its tail at ±30° is −0.004). The arms fold into the seal over wrap → seal,
so the two never add on the flanks; the `absorbed` row is the sheet's "relaxing 0.60 → 0.42 → 0.22", with a new
0 at done so the predator is round when the ghost leaves.

| Clip, keyframe          | `arm` | `notch` | `seal` |
| ----------------------- | ----- | ------- | ------ |
| `engulf` 0 contact      | 0     | 0       | 0      |
| `engulf` 0.5 wrap       | 0.62  | −0.10   | 0      |
| `engulf` 1.0 seal       | 0     | 0       | 0.60   |
| `absorbed` 0 seal       | —     | —       | 0.60   |
| `absorbed` 200 dissolve | —     | —       | 0.42   |
| `absorbed` 400 streams  | —     | —       | 0.22   |
| `absorbed` 600 done     | —     | —       | 0      |

At the wrap frame (pulse 1, k 0, lobes and jitter zeroed) the profile is therefore
`1 + 0.62 + 0.62 · e^(−60² / 512) − 0.10 · e^(−30² / 288)` = **1.616 at ±30°** and
`1 + 2 · 0.62 · e^(−30² / 512) − 0.10` = **1.114 at 0°** (the §9 pins).

## 5. LOD

Screen radius is `r × zoom` in CSS px (VISUAL-STYLE §6 thresholds; `resolution` does not move them). One
instance field, `lodBlend`, fades the **interior bands** in a `LOD_FADE_BAND_PX` 6 (new) window under the full
threshold so nothing pops; the interior organelle sprites and hairs fade in with zoom the same way, and the
far-dot swap at `CELL_LOD_FAR_MAX_PX` is a snap by design. **The fade never touches the identity, stage and
danger tells:** the seat mark, the self ring, the warning ring and the nucleus / nucleoid sprite (the stage tell,
one disc through the mid band) snap at the far threshold (a bead at 40 % alpha during a fade is a bead that
cannot be counted; VISUAL-STYLE §2 designed 1–4 beads to be countable at 8 px).

| On-screen radius                   | Drawn                                                                                                                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ `CELL_LOD_FULL_MIN_PX` 20        | every band, sprites, lines                                                                                                                                                                                                   |
| `CELL_LOD_FAR_MAX_PX` 8 → 20 (mid) | the VISUAL-STYLE §6 kept set, nothing else; the outline keeps the full profile (§2.1), the nucleus / nucleoid is one sprite, cilia are a flat band (§2.2)                                                                    |
| < 8 (far dot)                      | body band as a rim-colour dot, floor `CELL_FAR_DOT_MIN_PX` 3, halo band to `FAR_DOT_HALO_RADII` 3.0 (VISUAL-STYLE §6 "halo ×3", named here for the quad extent, §2); same shader, no sprites, no seat mark (VISUAL-STYLE §2) |
| Motes                              | core floor `MOTE_CORE_MIN_PX` 2; small sprite variant below zoom 0.5 (VISUAL-STYLE §6, §8)                                                                                                                                   |

## 6. Batching plan

Everything not a cell is a **baked texture**: `textures/glow-atlas.ts` bakes one radial-gradient glow per colour
(core + soft + wide + glint, `ASSET-GENERATION.md §1.5`) for motes, fragments, halos and effect rings; the dish
(field, zone tints and clouds, mire strands, vent crust, wall) is one render texture per zoom band
(VISUAL-STYLE §8); the condenser light pool and its caustics are one view-anchored sprite over the field (§6.1);
the vent shimmer is the one filter, over the vent sprite only. Draw calls at the bench load (§7):

| Layer (`ARCHITECTURE.md §6`) | Container                                                                                                                                        | Calls |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| dish                         | field render texture; light pool (view-anchored sprite, §6.1); vent shimmer; vignette (screen-space)                                             | 4     |
| depth particles              | far / near / bokeh `ParticleContainer`s (position + phase only)                                                                                  | 3     |
| food                         | one `ParticleContainer`, mote atlas (algae, detritus, three rods, small variants)                                                                | 1     |
| DNA fragments                | sprite batch: helix + tag-tinted rungs / halo from the glow atlas, 20 °/s                                                                        | 1     |
| cells                        | pass A; organelle sprite batch; flagella `Graphics`; pass B                                                                                      | 4     |
| effects                      | glow-atlas sprites (rays, rings, halos, streams, reticle); `BitmapText` floaters                                                                 | 2     |
| debug                        | `Graphics` + text, none when off                                                                                                                 | 0–2   |
| HUD                          | DOM (`UI.md`); no DOM inside `HUD_PLAYER_EXCLUSION_PX` is the HUD's rule; the own-cell indicators inside it are ours (§10, counted in `effects`) | 0     |

Total **≤ 17 draw calls** (counted by wrapping the GL draw functions in the bench build). Culling: cells whose
quad misses `cameraExtent` are not uploaded; motes and fragments are all uploaded (the bench load's quads are
free) and only bacteria positions change per snapshot.

### 6.1 The condenser light pool (#222)

`VISUAL-STYLE.md §1` anchors the pool to the view (option A). It is **one sprite in the dish layer's world
container**, between the field sprite and the vent sprite, that the layer re-places every frame with the inverse
camera transform so it stays fixed on screen while everything over it scrolls. It cannot live in the screen root
with the vignette: it must sit under the motes, fragments, cells and the vent, and the field under it is opaque.

- **Bake** (`textures/light-pool-bake.ts`, once per session, no cosmetic stream): a `LIGHT_POOL_TEXTURE_PX` 256
  square filled with the `LIGHT_ACCENT` radial `LIGHT_POOL_ALPHA` 0.09 → `LIGHT_POOL_MID` (stop 0.5, alpha 0.03)
  → 0 at the edge (the ellipse comes from the sprite's non-uniform scale, as the vignette's does), then the three
  `CAUSTIC_SWEEPS` at `CAUSTIC_ALPHA` painted across it: their control points are wu from the pool centre at the
  sheet's 1 px/wu, and the bake maps the sheet's x radius (980 wu) to the half-size of the square. It goes through
  `radial-bake.ts` / `texture-bake.ts` like the vignette and the field; `dish-texture.ts` loses `paintLightPool`
  and its caustics call, and `LIGHT_POOL_SIZE_WU` / `LIGHT_POOL_OFFSET_FRACTION` are deleted.
- **Placement** each frame (`DishLayerFrame` gains the viewport and the zoom; `camera.ts` `screenToWorld` is
  the helper): centre = `screenToWorld(LIGHT_POOL_VIEW_CENTRE × viewport)`, width = 2 × `LIGHT_POOL_VIEW_RADII.x`
  × viewport width / zoom wu, height = 2 × `LIGHT_POOL_VIEW_RADII.y` × viewport height / zoom wu, anchor 0.5. The
  constants are cosmetic and live in `render/constants/world-render.ts`, never in `shared`:
  `LIGHT_POOL_VIEW_CENTRE = { x: 0.2, y: 0.185 }` and `LIGHT_POOL_VIEW_RADII = { x: 0.51, y: 0.7 }` (fractions of
  the viewport's width and height, so every aspect keeps sheet 02's look), `LIGHT_POOL_TEXTURE_PX = 256`.
- **Composition:** normal blend, the alpha lives in the texture; no mask, no filter, no per-frame bake. Dish
  layer order: field, light pool, vent, wall, far particles. The shallows tint is under it in the field texture
  and stacks with it; the vignette (screen root) stays above everything (VISUAL-STYLE §1).
- **Cost:** one draw call (the dish row above; the total is ≤ 17), one sprite transform per frame, no allocation.
- **Tests:** the bake spec reads the centre and the half-radius bytes back (`LIGHT_POOL_ALPHA`,
  `LIGHT_POOL_MID.alpha`); the dish-layer spec pins that `worldToScreen` of the sprite's centre and extent equals
  `LIGHT_POOL_VIEW_CENTRE` / `LIGHT_POOL_VIEW_RADII` × viewport at both zoom ends (1.8 and 0.36 px/wu) and two
  camera positions; the render smoke screenshots a cell in the shallows with the camera far from the vent and the
  pool at the top-left (graphics-qa evidence).

## 7. Frame budget and the harness #99 ships

Target: **60 fps, ≤ 12 ms p95 frame** at 1080p, `devicePixelRatio` 1, on an integrated laptop GPU (Iris Xe
class: a new assumption stated here, not traced to any doc). The load is stated **once**, here; `ARCHITECTURE.md
§6` owns the baseline and this doc owns the bench scene that proves headroom above it:

| Load        | Cells                         | Motes                                             | DNA fragments | Source                                                           |
| ----------- | ----------------------------- | ------------------------------------------------- | ------------- | ---------------------------------------------------------------- |
| baseline    | 8 (one per player)            | 1 400 (`FOOD_CAP_BASE + 8 × FOOD_CAP_PER_PLAYER`) | 110           | `ARCHITECTURE.md §6` populations at 8 players, ECOLOGY §3        |
| bench scene | `RENDER_BENCH_CELL_COUNT` 100 | `RENDER_BENCH_MOTE_COUNT` 1 400                   | 110           | this doc: the superset, same motes and fragments as the baseline |

Budget per stage (ms, p95) at the bench load. The seven `renderStagesMs` keys are the CPU stages
`render/bench/render-stage-timer.ts` brackets; the three rows below them are not keys:

| `renderStagesMs` key                                | Budget | `renderStagesMs` key                        | Budget |
| --------------------------------------------------- | ------ | ------------------------------------------- | ------ |
| `net` snapshot apply + interpolation                | 1.0    | `effects` clips and effect sprites          | 0.3    |
| `cells` registry diff, shape terms, instance buffer | 1.2    | `camera` follow, zoom, cull, `cameraExtent` | 0.1    |
| `organelles` slots, lag, mapping (≤ 1 200 sprites)  | 1.0    | `submit` Pixi render (≤ 17 calls)           | 1.0    |
| `food` mote and fragment updates                    | 0.6    |                                             |        |

| Not a key                                          | Budget | What it is                                                                                               |
| -------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `gpuMs` (its own field)                            | 4.0    | GPU timer query, `null` when unsupported; budgeted as if serial with the CPU stages (conservative)       |
| HUD (Angular, outside `render/`, inside the frame) | 1.0    | not measured by the timer: the bench derives it as `frameTimeP95Ms − Σ renderStagesMs` and asserts ≤ 1.0 |
| headroom                                           | 1.8    | 12 − Σ keys (5.2) − `gpuMs` − HUD; a number in this table, never a field                                 |

**Measurement.** `ClientPerformanceReport` (`shared/types/messages.ts`) gains the fields below; the heartbeat
already carries the report and `debug_get_room_performance` already merges it per room, so the server stays
game-agnostic. The key list lives beside the type, the way `CLIENT_MESSAGE_TYPE` does, because the server's
merge and the client's timer must agree on it:

```ts
export const RENDER_STAGE = {
  net: 'net',
  cells: 'cells',
  organelles: 'organelles',
  food: 'food',
  effects: 'effects',
  camera: 'camera',
  submit: 'submit',
} as const;
export type RenderStageName = (typeof RENDER_STAGE)[keyof typeof RENDER_STAGE];
export interface ClientPerformanceReport {
  // existing: fps, frameTimeAvgMs, frameTimeP95Ms, frameTimePeakMs, heapMb
  renderStagesMs: Readonly<Record<RenderStageName, number>>; // p95 per stage, ms; every key present
  gpuMs: number | null;
  drawCalls: number;
  visibleCells: number;
  visibleMotes: number;
}
```

**Fixed-seed scene:** `render/bench/bench-scene.ts` builds a synthetic `GameSnapshot` from `RENDER_BENCH_SEED` (42) with
the bench-load cells (table above) across every stage and palette on scripted circular paths, the bench-load
motes and fragments, fed through the real `WorldStore` by a `ManualClock`; the dev-only route
`/?bench=<seed>&tick=<n>&zoom=<z>` renders it, paused at tick `n`, with the report in
`data-testid="render-bench-report"`. The container's SwiftShader proves the harness and the baselines; the
numbers in #99's PR body come from a hardware run of the same route.

## 8. File plan (`packages/client/src/app/game/render/`, ≤ 250 lines each, 300 is the lint cap)

```text
pixi-app.ts  layers.ts  camera.ts  view-registry.ts  constants.ts  palette.ts  colour.ts  geometry.ts  easing.ts   (renderTick: net/interpolation.ts, §1)
constants/{colours,cell-shape,organelles,world-render,vent}.ts   the pages of constants.ts (a barrel), each under the 300-line cap; the lint exemption covers the directory
noise/{noise-tile,noise-strip}.ts                 256² two-channel cytoplasm tile (64 wu period), 256×16 RGBA jitter / lobes strip (16-bit pairs, derivatives from the lerp), from the cosmetic fork (#206)
textures/{texture-bake,soft-paint,pixi-textures}.ts   the Canvas-2D bake seam (`BakeContext2D`, the DOM factory, the fill / stroke / halo / glint primitives), the feathered ellipse and soft stroke that stand in for the sheets' blurs, and the one place a bake or a byte table becomes a Pixi texture (#206)
textures/radial-bake.ts                              the per-pixel radial sampler behind the soft disc and the vignette: premultiplied bytes a spec can read back (#229)
textures/{glow-atlas,organelle-atlas,mote-atlas,dish-texture}.ts   the atlases and the field, each a pure bake over the seam (#206)
textures/{nucleus-bake,bacterium-bake,fragment-bake,dish-field-details}.ts  the multi-layer bakes the atlases and the field compose (#206)
textures/{vent-bake,vent-risers-bake}.ts          the vent sprite at ≥ 1 px/wu, drawn by the dish layer over the field (§6); the field stays 0.33 px/wu for the tints (#206)
textures/light-pool-bake.ts                       the condenser pool and its caustics, one bake the dish layer keeps fixed to the view over the field (§6.1, #222)
cells/{cell-layer,cell-layer-frame,cell-render-state,cell-traits,cell-lod}.ts   the composer, its frame contract, one state per cell, the stage / trait summary, the LOD rule (#215)
cells/{cell-instance,cell-instance-builder,cell-mesh}.ts       the instance-texture layout and packing, the per-frame record, the GPU objects (#215)
cells/{cell-shader,cell-shader-source,cell-shader-patterns,cell-shader-bands,cell-shader-membrane}.ts   GLSL as template strings: the two stages, the shared helpers, the profile, pass A, pass B (#215)
cells/{radial-profile,shape-terms,contact-dents}.ts            r(θ) in TypeScript; terms from views + clips + t (dents: #216)
cells/{organelle-kinds,organelle-layout,organelle-mapper,organelle-motion,organelle-sprites,flagellum-lines}.ts   counts, seeded slots, the mapping through the profile, sprite motion, the pooled sprites (#215); flagella #216
cells/forms/{form-profiles,diatom-pattern,stentor-anchor}.ts   (#121)
food/{food-layer,mote-sprites,dna-fragment-sprites,bacterium-heading}.ts
dish/{dish-layer,depth-particles,vent-shimmer}.ts
effects/{effects-layer,motion-clip-player,effect-sprites,ghost-cells,reticle}.ts
effects/{own-cell-indicators,threat-label-placement}.ts        the own cell's indicators from the HUD record (§10); pure placement
bench/{bench-scene,render-benchmark,render-stage-timer}.ts
game-renderer.ts  render-session.ts  render-textures.ts  render-target.ts   the orchestrator (the seven stages), one room's session, the texture bundle, whom the camera follows
pixi-texture-baker.ts                                  the `TextureBaker` (the per-pixel radial bakes of `textures/radial-bake.ts` for the soft disc and the vignette, the Canvas-2D factory and `textureFromBake` for the atlases and the field)
```

`cell-layer.ts` composes; every other module is a pure function or a dumb view (`CODE-STANDARDS.md §4`). This
list is the one home of the `render/` file plan; `ARCHITECTURE.md §10` points here.

## 9. Test plan (`TESTING.md` tiers)

- **Unit (vitest, no WebGL):** `radial-profile.spec.ts` pins `r(θ)` at 36 angles per state against literal
  tables (rest with lobes and jitter zeroed = the circle, moving k = 1 gives 1.22 / 0.868 / 0.72 at Δ 0° / 90° /
  180° and k = 0.45 gives 1.10 / 0.94 / 0.87, eat wrap frame, engulf wrap frame gives 1.616 at ±30° and 1.114 at 0° (§4), contact
  dent, each form), pins `r′(θ)` against a central difference of `r(θ)` (≤ 1e-4 r per rad) and `d(p)` on an arm
  flank (a probe at `|p| = r(θ) + w` reads `d < w` where `r′ ≠ 0`), a seeded rest profile has 5–7 lobes within
  ±2.5–4 % and stays inside ±5 % of `r`, and same seed + same tick ⇒ same profile (`DETERMINISM.md §7`);
  `shape-terms.spec.ts` (view → terms, bump slot assignment including the eight-slot amoeba III mid-engulf and
  contact / eat dropped while engulfing, sprint scaling, and the moving-wrap extent: k = 1 stretch with the wrap frame and an eat pulse reports a maximum of 2.99 r, below `CELL_QUAD_EXTENT_RADII` 3.0); `form-profiles.spec.ts` (every `B` has unit area within
  0.5 %, the sheet-04 aspects, diatom terms all zero); `organelle-layout.spec.ts` (slot centres inside 0.92 and outside `DNA_RING_KEEP_OUT_FRACTION`, outside the nucleus disc, gap held,
  append-only across tiers, seeded); `organelle-mapper.spec.ts` (lag 0.20 r at k = 1; mapping equals the profile
  on the rim); `cell-lod.spec.ts` (thresholds and the fade window); `palette.spec.ts` (HSL derivations, the
  separability numbers of VISUAL-STYLE §2); `bench-scene.spec.ts` (counts, seed-stable); `motion.test.ts` in
  `shared` (one snapshot per clip; durations and keyframe times equal sheet 03's; every `pulse` ≤ 1.14; overshoot
  ≤ 3 %; tracks are monotonic in `at`; every `easingTo` is an `EasingName`; no file under `packages/server/src`
  imports it and `balance.json` has no key from it); `constants.spec.ts` (every VISUAL-STYLE §2 hex is present
  once).
- **Integration (`*.integration.spec.ts`, WebGL):** shader ↔ TypeScript parity: render one cell per state to a
  render texture, walk 36 rays, boundary within 1 px of `radial-profile`; on the engulf wrap frame the rim-light
  band measured along the outline normal is 5 % r ± 1 px at every one of the 36 rays, arm flanks included
  (the perpendicular-distance check); draw-call count ≤ 17 on the bench scene; `renderStagesMs` populated; the
  ghost instance appears on `cell_absorbed` and leaves at 600 ms. The client's vitest tier runs under jsdom with
  no WebGL, so the WebGL checks ride the Playwright smoke (`packages/client/e2e/render-smoke.spec.ts`, run with
  `pnpm --filter @evolution/client smoke` against the dev servers): slice A (#205) opens a live room with a fixed
  seed, asserts no page or shader errors, that the canvas fills the viewport with no page scroll and no lobby
  panel left (UI §1, #217), that the debug hook's pause holds the rendered tick and the canvas and a step
  advances both, and screenshots the dish; the bench route, the report in the DOM and the shader parity walk
  join with their slices (#206, #208).
- **Screenshot baselines (`qa/baselines/`, graphics-qa on every renderer PR, not part of `validate.sh all`):**
  `qa/baselines/scenes.json` lists bench scenes × zoom 1.8 / 1.0 / 0.36 (VISUAL-STYLE §9) × ticks, each scene carrying a
  fixed `ownCellIndicators` record (plain data, §10; `null` for scenes without an own cell), so a baseline never
  depends on HUD timing or a live threat search; `check.sh`
  renders each through headless Chromium (the concept-art recipe) and compares with ImageMagick
  `compare -metric AE -fuzz 2%`; a baseline moves only in a PR that shows before / after under `qa/evidence/<pr>/`.

## 10. Own-cell indicators and world-anchored labels (#146)

[`UI.md §3.1`](./UI.md#31-in-round-elements-visible-while-roundphase--playing-and-lifestate--alive) owns **what**
the own cell shows: the DNA ring, level numeral, ladder orbit, sprint state of the self ring, escape arc and the
nearest-threat label, with their data, states, wording, the reading-floor constants (`UI.md §9`) and the
`OwnCellIndicators` record. This section owns **how** they are drawn and restates none of that; a value or a state
named here is a link to UI.md, never a copy. The files are §8's `effects/own-cell-indicators.ts` and
`effects/threat-label-placement.ts`.

- **Where.** The effects layer (§6), above pass B, from the `ownCellIndicators` signal (§1) and nothing else:
  `own-cell-indicators.ts` turns the record plus the own instance's `r_px` and centre into sprite placements, all
  in the **undeformed frame** exactly like the self ring (§2.2), so nothing bends with the membrane or lags the
  predicted own position. Rings, tracks and arcs are tinted glow-atlas arc sprites (one `arc` entry with a `fill`
  uniform, no per-frame `Graphics`); ghosts and pip blocks are entries of the organelle atlas (§3) at their fixed
  px size, the pip blocks baked at startup as one entry per (variant, eaten) from
  `balance.ladder.ENDOSYMBIOSIS_BACTERIA_REQUIRED`, so a counter is two sprites; the numeral and the labels are
  `BitmapText` in the `value` / `label` roles, the labels on a label-pill sprite (`UI.md §6`). Budget: ≤ 14 sprites
  and 2 texts inside the `effects` stage's 0.3 ms (§7); the worst case is a prokaryote with both counters, one
  unlocked, and a threat on screen: DNA track + fill (2), self-ring track + arc (2), two backings, two ghosts, two
  pip blocks, one unlock ring, the label pill = 13 sprites, the numeral and the label = 2 texts (the escape arc
  replaces the orbit and hides the label, so it never adds to this).
- **Floors.** `dnaRingRadiusPx`, `ladderOrbitRadiusPx` and `orbitLayout` (pure, in the same file) apply UI.md
  §9's constants, whose home is `constants.ts` beside `SELF_RING_MIN_PX`; the spec pins UI.md §3.1.3's geometry
  table at 24 / 32 / 45 / 102 px and its three inequalities (picker band, seat-mark clearance, DNA keep-out). They
  snap with the self ring's LOD (§5): drawn at every LOD the own cell reaches, never faded.
- **Clips.** The ring and numeral flash is the `level_up` clip's `ringFlash` track and the sprint-ready brighten is
  the `sprint_ready` clip (§4), both played by `motion-clip-player.ts` off `renderTick` like every other clip; the
  DNA fill tweens at `INDICATOR_FILL_TWEEN_MS`. No indicator reads `serverTickEstimate`.
- **Sprint state.** The self-ring band (§2.2) is drawn as a track plus an arc of `sprintFill`: the instance's spare
  float (§2.3) becomes `selfRingFill`, 1 for every cell but the own one; the track is the same band at
  `SELF_RING_TRACK_ALPHA`.
- **Keep-out.** `cells/organelle-layout.ts` rejects `|q| < DNA_RING_KEEP_OUT_FRACTION` in addition to the nucleus
  disc, for every cell (one rule, no own-cell branch, §3); the fraction is set from the floored ring so the rule
  holds from 31 px up (`UI.md §3.1.3`), and below that the ring's track backs it.
- **Escape arc.** Drawn from `escape.fill` and `escape.phase` as UI.md §3.1.2 says (draining window, then solid);
  the pass-B warning ring of §2.2 is suppressed on the cell whose id is `escape.predatorCellId` while the record
  carries an escape, and on no other cell.
- **Threat label.** `threat-label-placement.ts` (pure): the pill's centre is the warning ring's radius plus
  `THREAT_LABEL_GAP_PX` plus half the pill's height from the threat's centre **toward the own cell's centre**; if
  that pill's box intersects the disc of the own cell's orbit extent (`UI.md §3.1.3`) the centre flips to the far
  side of the ring (the same distance, away from the own cell); text stays upright. The warning rings on every
  eligible cell remain the pass-B band of §2.2; the label is drawn on the nearest one only, as the record says.
- **Tests.** `own-cell-indicators.spec.ts` (the geometry table, the three inequalities, the sprite count of the worst
  case) and `threat-label-placement.spec.ts` (near side at 200 px for a 30 px predator, far side at 100 px, upright
  at every angle), unit, no WebGL; the screenshot baselines (§9) gain the own cell at the four sizes with the
  counters showing, the max-level ring, the escape arc before and after the seal and the far-side label, from
  `qa/decisions/hud-layout/diegetic/` as the reference look and its fixed indicator records as the scene fixtures.
