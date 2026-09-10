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

| Input                                                                                                                                                    | Source                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CellView` (`x`, `y`, `velocityX/Y`, `radius`, `mass`, `stage`, `traits`, `states`, `engulfProgress`, engulf ids, `sprintRemainingTicks`, `avatarIndex`) | `ARCHITECTURE.md §2`, interpolated at `renderTick` (§5) for remote cells, predicted for the own cell                                                                                                                                             |
| `FoodMoteView`, `MotePositionView`, `DnaFragmentView`, `GelPatchView`, `effects`                                                                         | `ARCHITECTURE.md §4`; a bacterium's heading is not on the wire and is derived as the direction of its interpolated displacement, held when still                                                                                                 |
| `renderTick` (fractional)                                                                                                                                | `net/interpolation`; **`timeSeconds = renderTick × TICK_INTERVAL_S`** is the only time the renderer sees. A paused room (`debug_pause_room`) holds `renderTick`, so the frame is identical until it resumes                                      |
| Cosmetic randomness                                                                                                                                      | `fork(RANDOM_STREAM.cosmetic + ':' + cellId)` of `createSeededRandom(snapshot.seed)` (`ARCHITECTURE.md §6`, `DETERMINISM.md §1.8`): per-cell phases and organelle slots; the field noise textures from `fork(RANDOM_STREAM.cosmetic + ':field')` |
| `balance` (from `game_state`)                                                                                                                            | `speedRatio = ‖velocity‖ / maxSpeed(mass, balance)` through the shared kernel; `canEngulf(cell, own, balance.absorption)` for the warning ring                                                                                                   |
| HUD crossings                                                                                                                                            | `previewTraitId`, `reticleVisible` in; `cameraExtent` out; wired in `game-setup.ts` (`UI.md §7`). Pointer target for the reticle comes from `input/`, not the HUD                                                                                |

`render/` never calls a clock (`CODE-STANDARDS.md §8`): the bench harness (§7) drives `renderTick` from a `ManualClock`.

## 2. The cell: one quad, one fragment shader

Every cell is **one instanced quad** of half-size `CELL_QUAD_EXTENT_RADII` (2.0, new: the engulf arm at 1.62 r
plus the halo band) × `r` and a fragment shader that evaluates a radial profile `r(θ)` and paints
sheet 01's layer stack as bands of the normalised radial coordinate **ρ = |p| / r(θ)** (ρ = 1 is the membrane).
No vertex ring, no per-object hairs, no per-frame `Graphics` for bodies.

### 2.1 The profile

```text
r(θ) = r · pulse · B(θ − h) · stretch(θ − h) · (1 + breathing + wobble(θ) + jitter(θ) + Σ bumps(θ))
bump(θ) = amplitude · exp(−(θ − centre)² / (2 σ²))                       (sheet 02, membranes paragraph)
```

`h` is the heading (`atan2(velocityY, velocityX)`, held when ‖velocity‖ ≈ 0). The TypeScript reference
`cells/radial-profile.ts` and the GLSL evaluate the same expression; organelle mapping (§3) uses the TypeScript
one. Every term is data (the tables below), so a new deformation is a row, not a branch.

| Term        | Formula                                                                                                     | Values (home)                                                                                                                            | Driven by                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `B`         | 1 for the blob; per-form profile (#121, §2.4)                                                               | sheet 04 specialised-forms table                                                                                                         | `stage`, form trait                           |
| `breathing` | `A · sin(2π f t + φ)`                                                                                       | `BREATH_AMPLITUDE` 0.02, `BREATH_HZ` 0.5 (sheet 01 motion table); `WOBBLE_TAUT_SCALE` 0.5 with `cytoskeleton` (VISUAL-STYLE §5)          | `t`, φ from the cosmetic fork                 |
| `wobble`    | `A · sin(m θ + 2π f t + φ)`                                                                                 | protocell m 2, ±0.08, 0.7 Hz (sheet 04); forms m 3, ±0.05 (VISUAL-STYLE §5)                                                              | `stage`                                       |
| `jitter`    | `J · strip(θ / 2π + φ)`, `strip` = the 256 × 1 seeded noise strip                                           | `JITTER_AMPLITUDE` 0.008 (sheet 02: ±0.8 %)                                                                                              | cosmetic fork                                 |
| `stretch`   | `1 + k[(S_ALONG − 1) cos²Δ − (1 − S_ALONG) · ACROSS · sin²Δ] − k (1 − TAPER) · max(0, −cos Δ) · abs(sin Δ)` | `S_ALONG` 1.22, `TAPER` 0.72 (sheet 01 motion); `STRETCH_ACROSS_PER_ALONG` 0.6 (sheet 02's 1.10 × 0.94); sprint × 1.06 (VISUAL-STYLE §5) | `k = speedRatio`, sprint                      |
| contact     | bump −0.12, σ 22° toward the neighbour; σ 14° with `cytoskeleton`                                           | VISUAL-STYLE §5                                                                                                                          | `cells/contact-dents.ts` (visible-cell scan)  |
| eat         | dimple −0.12 σ 22°, wrap +0.14 σ 30°, `pulse` 1.09, stretch 1.07 × 0.95, halo 1.5 R                         | sheet 03, motion clip `eat` (§4)                                                                                                         | `eat` effect, angle to the mote               |
| engulf      | arms +0.62 at prey angle ± 30° σ 16°, notch −0.10, seal +0.60 σ 42° relaxing 0.60 → 0.42 → 0.22             | sheet 03, clip `engulf` (domain = progress, VISUAL-STYLE §5)                                                                             | `states`, `engulfProgress`, `engulfingCellId` |
| level-up    | `pulse` 0.90 (anticipate) → 1.14 (burst) → 1.0                                                              | sheet 03, clip `level_up`                                                                                                                | `level_up` effect                             |
| respawn     | `pulse` 0.6 → 1.0 ease-out-back, alpha 0 → 1                                                                | VISUAL-STYLE §5, clip `respawn`                                                                                                          | `respawn` effect                              |
| pseudopods  | 2 / 3 / 4 bumps toward velocity and toward engulfed prey                                                    | sheet 04 amoeba (#121)                                                                                                                   | tier, `engulfingCellId`                       |

Bumps occupy `MAX_SHAPE_BUMPS` (6) instance slots: two arms, notch, seal, dimple or contact, wrap. Pulses never
exceed 1.14 and overshoot ≤ 3 % because the clip tables say so (pinned, §9).

### 2.2 Distance bands (sheet 01 panel C, back → front)

Light direction is `LIGHT_DIRECTION_DEG` −135° everywhere (VISUAL-STYLE §1). `a(θ)` = angle from the light.
Pass A is drawn under the organelle sprites, pass B over them (§6).

| Layer                         | Band (ρ unless px)                                                      | Colour / alpha (constants, VISUAL-STYLE §2)                                                                                                                                                     | Pass | LOD (§5)                   |
| ----------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------- |
| halo                          | 1.00 → 1.28, falloff width 0.12                                         | rim @34 % → 0 (sheet 01 proportions); far dot: 1.0 → 3.0                                                                                                                                        | A    | all                        |
| trait halo                    | 1.00 → 1.39, replaces the halo                                          | `CHLORO_LIGHT` / `TOXIN_GLOW` @42 % → 0 (sheet 01 trait legibility)                                                                                                                             | A    | ≥ mid                      |
| body                          | < 1.00                                                                  | base; alpha 42–85 % (protocell 16–26 %) as a light pool (0.53 r at −131°, 0.6 × 0.45 r, rim @14 %) and dark pool (0.67 r at +48°, 0.9 × 0.7 r, cyto dark @50 %), measured from sheet 01 panel A | A    | all (flat at mid)          |
| cytoplasm noise               | < 0.89, tile sampled in the **undeformed** cell frame                   | cyto light / dark from `render/palette.ts`; the 256² seeded tile (VISUAL-STYLE §8)                                                                                                              | A    | full                       |
| ribosome speckle              | 0.55 → 0.89, threshold of the same tile                                 | `RIBOSOME` 2 px @35–80 %; density 20 / 40 / 60 (VISUAL-STYLE §4)                                                                                                                                | A    | full                       |
| cytoskeleton filaments        | nucleus centre → 0.89, `N` angular lines                                | `CYTOSKELETON` 1.1 px @28 %; N 11 / 15 / 19                                                                                                                                                     | A    | full                       |
| granules, organelles, nucleus | sprites (§3)                                                            | sheet 01 / 04 organelle tables                                                                                                                                                                  | —    | full (nucleus disc at mid) |
| inner edge                    | 0.89 → 1.00                                                             | edge shade → base (sheet 01: 11 % r)                                                                                                                                                            | B    | ≥ mid                      |
| soft rim + rim light          | 0.95 → 1.05; stroke 0.95 → 1.00                                         | white → rim → base → rim by `a(θ)` (VISUAL-STYLE §1); +20 % on sprint                                                                                                                           | B    | ≥ mid                      |
| protocell double film         | two 1 px lines at 1.00 and 0.975                                        | player rim @55 %, `WHITE` @70 % (sheet 04, VISUAL-STYLE §2)                                                                                                                                     | B    | ≥ mid                      |
| `cell_wall`                   | 1.05 → 1.095, hairline at 1.075, dark line at 1.095                     | `CELL_WALL`, `CELL_WALL_LIGHT`, `OUTLINE`; thickness × 1.5 / 2 / 2.5                                                                                                                            | B    | ≥ mid                      |
| outline                       | `abs(‖p‖ − r(θ)) ≤ max(0.8 px, 1.2 % r) / 2`                            | `OUTLINE` `#020509` @50 % (sheet 01)                                                                                                                                                            | B    | ≥ mid                      |
| cilia                         | 1.00 → 1.12, hair mask `step(0.5, fract(N θ / 2π + wave(t)))`, lean 30° | `CILIA` @75 %, N 24 / 36 / 48, wave speed ∝ velocity; mid: flat band @40 %                                                                                                                      | B    | ≥ mid                      |
| glint                         | ellipse 0.22 × 0.08 r at 0.34 r along −136°, rotated −40°, edge 1.5 px  | `WHITE` @50 % (sheet 01; centre measured from panel A)                                                                                                                                          | B    | ≥ mid                      |
| seat mark                     | beads at ρ 1.0, `SEAT_MARK_BEADS[avatarIndex]` from −135°               | VISUAL-STYLE §2 (bead 5 % r, floor 2 px; core `WHITE` @92 %, halo rim @45 % at 2.2 ×)                                                                                                           | B    | ≥ mid                      |
| self ring                     | ρ 1.12 (floor 7.5 px), 1.5 px, dash 6 4, 20 °/s                         | `SELF_RING` (VISUAL-STYLE §2); own cell only                                                                                                                                                    | B    | ≥ mid                      |
| engulf warning ring           | undeformed `‖p‖ = 1.3 × r_px`, floor 24 px, 2 px, dash 6 5, 12 °/s      | `DANGER` (VISUAL-STYLE §5, `canEngulf`)                                                                                                                                                         | B    | ≥ mid                      |
| prey under film               | pass B alpha × 0.62 while `engulfedByCellId` is set                     | VISUAL-STYLE §6 "prey through film"                                                                                                                                                             | B    | ≥ mid                      |

Layer-major order (all bodies, then all organelles, then all membranes) is what makes the prey's rim show
through the predator's film for free; separation (`ECOLOGY.md §5.3`) means unrelated cells never overlap.

### 2.3 Instance layout and passes

`cells/cell-geometry.ts` declares one quad with per-instance attributes (≤ 12 `vec4`, WebGL guarantees 16):
centre, `r`, `h`, `k`, palette index, `lodBlend`, alpha, stage / trait counts (`ciliaCount`, `wallScale`,
`speckleDensity`, `filamentCount`, `tintMix` toward `CHLORO_BASE`), wobble (`amplitude`, `mode`, `phase`),
stretch (`kAlong`, `kSprint`), `pulse`, six bumps × (`amplitude`, `centre`, `sigma`), halo kind, `beadCount`,
`isOwn`, `warningRingPx`, `formId`. Global uniforms: `uTimeSeconds`, `uZoom`, `uResolution`, the noise tile,
the noise strip and the **palette texture** (8 palettes × 8 shades baked by `render/palette.ts`). The same
mesh is drawn twice with `uPass` (A, B); instance order is radius ascending (`ARCHITECTURE.md §6`), so two
draw calls cover every visible cell. An absorbed prey keeps drawing as a **ghost instance** built from its last
view (VISUAL-STYLE §5) until the `absorbed` clip ends.

### 2.4 Forms (#121)

`B(Δ)` per form, `FORM_PROFILES` keyed by the form trait: slipper (ellipse, aspect 1.6 / 1.8 / 2.0, oral-groove
dent), spindle (50 × 16 wu, pointed ends), trumpet (70 wu, mouth 36, profile from a centre near the mouth),
diatom (rigid: wobble and jitter zero; 36 striae in pass A, 8 / 12 / 16 spine rays with bright tips in pass B),
amoeba (blob plus pseudopod bumps). Values: sheet 04 and VISUAL-STYLE §4. Forms rotate with `h`; the blob and
its organelles do not (seat marks are frame-fixed, VISUAL-STYLE §2).

## 3. Contents: organelles through the deformation

Organelles are **sprites from one code-baked atlas** (`textures/organelle-atlas.ts`: mitochondrion with cristae,
chloroplast with six lit granules, food vacuole, toxin bladder, lipid droplet, protocell granule, nucleus +
nucleolus, nucleoid 1 / 2 / 3 loops, envelope with 16 / 20 / 24 pores, eyespot), baked at
`ORGANELLE_ATLAS_PX_PER_R` 128 px per r (sheet 01 panel A's 4 px/wu at r 32) so the 102 px own cell never upsamples.

- **Slots.** `cells/organelle-layout.ts` draws rest positions `q` (normalised, cell frame, heading-independent)
  from the cell's cosmetic fork: nucleus at 0.12 r toward the light (sheet 01), then organelles in
  `ORGANELLE_KIND_ORDER` by rejection sampling inside `|q| ≤ 1 − 0.08` (VISUAL-STYLE §3), outside the nucleus
  disc (0.30 r), with gap `ORGANELLE_MIN_GAP` 0.04 r (new). Slots are appended, never reshuffled, so a tier-up
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
render-only (`CODE-STANDARDS.md §2` gains the row). Easing **names** live here; the curves are
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
  readonly id: MotionClipId;
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
  organelleBirth: 'organelle_birth',
} as const;
export const MOTION_CLIPS: Readonly<Record<MotionClipId, MotionClip>>;
export const sampleTrack: (
  track: readonly MotionKeyframe[],
  at: number,
  ease: (n: EasingName, x: number) => number,
) => number;
```

| Clip              | Domain, length             | Keyframes (sheet 03 strips table; VISUAL-STYLE §5)                                                                                         | Tracks                                                                                                             |
| ----------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `eat`             | ms, 300, interruptible     | 0 → 50 contact → 100 wrap → 160 pulse → 220 absorb → 300; ease-out-quad · ease-out-back · linear · ease-in-out-sine                        | `dimple`, `wrap`, `pulse`, `stretchAlong`, `stretchAcross`, `haloRadii`                                            |
| `engulf`          | progress, 1.0              | 0 contact → 0.5 wrap → 1.0 seal; ease-out-cubic · ease-in-out-quad                                                                         | `arm`, `notch`, `seal`                                                                                             |
| `absorbed`        | ms, 600                    | 0 seal → 200 dissolve → 400 DNA streams → 600 done; linear · ease-in-quad · ease-out-back                                                  | `rimDash`, `cytoplasmAlpha` (→ 0.5), `streamProgress`                                                              |
| `level_up`        | ms, 900, not interruptible | 0 → 120 anticipate → 250 burst → 450 nucleus → 700 settle → 900; ease-in-quad · ease-out-expo · ease-out-cubic · ease-in-out-sine · linear | `pulse` (0.90, 1.14), `rayRadii` (1.2 → 1.95), `shockRingRadii` 1.6, `rippleRadii` 1.7 / 2.1 / 2.5, `nucleusFlash` |
| `respawn`         | ms, 400                    | scale 0.6 → 1.0 ease-out-back, alpha 0 → 1 ease-out-quad, halo 2 r → 0                                                                     | `pulse`, `alpha`, `haloRadii`                                                                                      |
| `sprint_release`  | ms, 200                    | ease-out-quad back to rest                                                                                                                 | `stretchSprint`, `rimBrightness`                                                                                   |
| `organelle_birth` | ms, 3 000                  | ghost 0.44 → 0.30 r, recolour along the ramp                                                                                               | `ghostSize`, `rampMix`                                                                                             |

## 5. LOD

Screen radius is `r × zoom` in CSS px (VISUAL-STYLE §6 thresholds; `resolution` does not move them). One
instance attribute, `lodBlend`, fades bands in a `LOD_FADE_BAND_PX` 6 (new) window under each threshold so
nothing pops; organelle sprites and hairs fade in with zoom the same way.

| On-screen radius                   | Drawn                                                                                                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ `CELL_LOD_FULL_MIN_PX` 20        | every band, sprites, lines                                                                                                                                                          |
| `CELL_LOD_FAR_MAX_PX` 8 → 20 (mid) | halo, flat body, rim, outline with the full profile, nucleus / nucleoid as one sprite, flagellum line, cilia as a band, `cell_wall`, trait halo, seat mark, self ring, warning ring |
| < 8 (far dot)                      | body band as a rim-colour dot, floor `CELL_FAR_DOT_MIN_PX` 3, halo band to 3.0; same shader, no sprites, no seat mark (VISUAL-STYLE §2)                                             |
| Motes                              | core floor `MOTE_CORE_MIN_PX` 2; small sprite variant below zoom 0.5 (VISUAL-STYLE §6, §8)                                                                                          |

## 6. Batching plan

Everything not a cell is a **baked texture**: `textures/glow-atlas.ts` bakes one radial-gradient glow per colour
(core + soft + wide + glint, `ASSET-GENERATION.md §1.5`) for motes, fragments, halos and effect rings; the dish
(field, light pool, caustics, zone tints and clouds, mire strands, vent crust, wall) is one render texture per
zoom band (VISUAL-STYLE §8); the vent shimmer is the one filter, over the vent sprite only. Draw calls at
100 cells + 1 000 motes:

| Layer (`ARCHITECTURE.md §6`) | Container                                                                           | Calls |
| ---------------------------- | ----------------------------------------------------------------------------------- | ----- |
| dish                         | field render texture; vent shimmer; vignette (screen-space)                         | 3     |
| depth particles              | far / near / bokeh `ParticleContainer`s (position + phase only)                     | 3     |
| food                         | one `ParticleContainer`, mote atlas (algae, detritus, three rods, small variants)   | 1     |
| DNA fragments                | sprite batch: helix + tag-tinted rungs / halo from the glow atlas, 20 °/s           | 1     |
| cells                        | pass A; organelle sprite batch; flagella `Graphics`; pass B                         | 4     |
| effects                      | glow-atlas sprites (rays, rings, halos, streams, reticle); `BitmapText` floaters    | 2     |
| debug                        | `Graphics` + text, none when off                                                    | 0–2   |
| HUD                          | DOM (`UI.md`), nothing inside `HUD_PLAYER_EXCLUSION_PX` is the HUD's rule, not ours | 0     |

Total **≤ 16 draw calls** (counted by wrapping the GL draw functions in the bench build). Culling: cells whose
quad misses `cameraExtent` are not uploaded; motes are all uploaded (1 400 quads are free) and only bacteria
positions change per snapshot.

## 7. Frame budget and the harness #99 ships

Target: `ARCHITECTURE.md §6` (60 fps, **≤ 12 ms p95 frame**) at #99's load, 100 cells + 1 000 motes, 1080p,
`devicePixelRatio` 1, an integrated laptop GPU (Iris Xe class). Budget per stage (ms, p95):

| Stage (`renderStagesMs` field)                      | Budget | Stage                                        | Budget |
| --------------------------------------------------- | ------ | -------------------------------------------- | ------ |
| `net` snapshot apply + interpolation                | 1.0    | `effects` clips and effect sprites           | 0.3    |
| `cells` registry diff, shape terms, instance buffer | 1.2    | `camera` follow, zoom, cull, `cameraExtent`  | 0.1    |
| `organelles` slots, lag, mapping (≤ 1 200 sprites)  | 1.0    | `submit` Pixi render (≤ 16 calls)            | 1.0    |
| `food` mote and fragment updates                    | 0.6    | `gpuMs` (timer query; `null` if unsupported) | 4.0    |
| HUD (Angular, outside `render/`, inside the frame)  | 1.0    | headroom                                     | 1.8    |

**Measurement.** `ClientPerformanceReport` (`shared/types/messages.ts`) gains `renderStagesMs` (p95 per stage
above), `gpuMs`, `drawCalls`, `visibleCells`, `visibleMotes`; the heartbeat already carries the report and
`debug_get_room_performance` already merges it per room, so the server stays game-agnostic. **Fixed-seed
scene:** `render/bench/bench-scene.ts` builds a synthetic `GameSnapshot` from `RENDER_BENCH_SEED` (42) with
`RENDER_BENCH_CELL_COUNT` 100 cells across every stage and palette on scripted circular paths and
`RENDER_BENCH_MOTE_COUNT` 1 000 motes, fed through the real `WorldStore` by a `ManualClock`; the dev-only route
`/?bench=<seed>&tick=<n>&zoom=<z>` renders it, paused at tick `n`, with the report in
`data-testid="render-bench-report"`. The container's SwiftShader proves the harness and the baselines; the
numbers in #99's PR body come from a hardware run of the same route.

## 8. File plan (`packages/client/src/app/game/render/`, ≤ 250 lines each, 300 is the lint cap)

```text
pixi-app.ts  layers.ts  camera.ts  view-registry.ts  constants.ts  palette.ts  easing.ts  interpolation.ts
noise/{noise-tile,noise-strip}.ts                 256² cytoplasm tile, 256×1 wobble strip, from the cosmetic fork
textures/{texture-bake,glow-atlas,organelle-atlas,mote-atlas,dish-texture}.ts
cells/{cell-layer,cell-view,cell-geometry,cell-instance-buffer,cell-lod}.ts
cells/{cell-shader,cell-shader-bands,cell-shader-patterns}.ts   GLSL as template strings, one file per pass concern
cells/{radial-profile,shape-terms,contact-dents}.ts            r(θ) in TypeScript; terms from views + clips + t
cells/{organelle-layout,organelle-mapper,organelle-sprites,flagellum-lines}.ts
cells/forms/{form-profiles,diatom-pattern,stentor-anchor}.ts   (#121)
food/{food-layer,mote-sprites,dna-fragment-sprites,bacterium-heading}.ts
dish/{dish-layer,depth-particles,vent-shimmer}.ts
effects/{effects-layer,motion-clip-player,effect-sprites,ghost-cells,reticle}.ts
bench/{bench-scene,render-benchmark,render-stage-timer}.ts
```

`cell-layer.ts` composes; every other module is a pure function or a dumb view (`CODE-STANDARDS.md §4`).

## 9. Test plan (`TESTING.md` tiers)

- **Unit (vitest, no WebGL):** `radial-profile.spec.ts` pins `r(θ)` at 36 angles per state against literal
  tables (rest, moving k = 1, eat wrap frame, engulf wrap frame gives 1.62 at ± 30°, contact dent, each form) and
  same seed + same tick ⇒ same profile (`DETERMINISM.md §7`); `shape-terms.spec.ts` (view → terms, bump slot
  assignment, sprint scaling); `organelle-layout.spec.ts` (slots inside 0.92, outside the nucleus disc, gap held,
  append-only across tiers, seeded); `organelle-mapper.spec.ts` (lag 0.20 r at k = 1; mapping equals the profile
  on the rim); `cell-lod.spec.ts` (thresholds and the fade window); `palette.spec.ts` (HSL derivations, the
  separability numbers of VISUAL-STYLE §2); `bench-scene.spec.ts` (counts, seed-stable); `motion.test.ts` in
  `shared` (one snapshot per clip; durations and keyframe times equal sheet 03's; every `pulse` ≤ 1.14; overshoot
  ≤ 3 %; tracks are monotonic in `at`); `constants.spec.ts` (every VISUAL-STYLE §2 hex is present once).
- **Integration (`*.integration.spec.ts`, WebGL):** shader ↔ TypeScript parity: render one cell per state to a
  render texture, walk 36 rays, boundary within 1 px of `radial-profile`; draw-call count ≤ 16 on the bench scene;
  `renderStagesMs` populated; the ghost instance appears on `cell_absorbed` and leaves at 600 ms.
- **Screenshot baselines (`qa/baselines/`, graphics-qa on every renderer PR, not part of `validate.sh all`):**
  `qa/baselines/scenes.json` lists bench scenes × zoom 1.8 / 1.0 / 0.36 (VISUAL-STYLE §9) × ticks; `check.sh`
  renders each through headless Chromium (the concept-art recipe) and compares with ImageMagick
  `compare -metric AE -fuzz 2%`; a baseline moves only in a PR that shows before / after under `qa/evidence/<pr>/`.
