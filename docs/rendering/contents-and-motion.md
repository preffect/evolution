# Evolution — Rendering: contents, motion tables and LOD

§3–§5 of the split [`RENDERING.md`](../RENDERING.md), which keeps the shared context and the file list.

## 3. Contents: organelles through the deformation

Organelles are **sprites from one code-baked atlas** (`textures/organelle-atlas.ts`: mitochondrion with cristae,
chloroplast with six lit granules, food vacuole, toxin bladder, lipid droplet, protocell granule, nucleus +
nucleolus, nucleoid 1 / 2 / 3 loops, envelope with 16 / 20 / 24 pores, eyespot), baked at
`ORGANELLE_ATLAS_PX_PER_R` 128 px per r (sheet 01 panel A's 4 px/wu at r 32) × `min(ceil(devicePixelRatio), 2)`
at startup, so the own cell at its 1080p cap (128 px under Z1) never upsamples at DPR 1 or 2. **Every atlas sprite bakes its own soft halo**
(`ASSET-GENERATION.md §1.5`'s core + soft + wide + glint, for organelles): the nucleus entry is sheet 01 layer 6
minus its disc fill, a 0.40 r soft glow @35 % **cut out inside the 0.30 r disc** (`cutDisc`, `destination-out`,
so it is an outer glow and never flattens the ramp under it), the 2.3 px rim @75 %, five chromatin spots,
the white nucleolus with its own halo and the nucleus's own highlight (0.34 r / −136°, 0.075 × 0.03 r), so the
sprite is ≈ 0.85 r wide; the disc itself is the shader's ramp below (#231). The nucleus and nucleoid bakes are
white and the sprite layer tints both with the palette **rim** (`organelle-sprites.ts`; the nucleus colour would
land the nucleolus and highlight at the ramp's mid stop, darker than its lit half), and the mitochondrion's warm
glow and the toxin bladder's `TOXIN_GLOW` are baked the same way.

- **Slots.** `cells/organelle-layout.ts` draws rest positions `q` (normalised, cell frame, heading-independent)
  from the cell's cosmetic fork: nucleus at 0.12 r toward the light (sheet 01), then organelles in
  `ORGANELLE_KIND_ORDER` by rejection sampling inside `DNA_RING_KEEP_OUT_FRACTION ≤ |q| ≤ 1 − max(0.08, sprite radius)`
  (`membraneKeepOutRadius`, clamped so the sprite radius never drives the outer bound inside the DNA ring. What it
  promises is that the sprite **body** never crosses the membrane, not that the 0.08 r margin survives: the 0.34 r
  toxin bladder's own radius reaches the ring exactly, so its annulus is degenerate — every bladder sits at
  `DNA_RING_KEEP_OUT_FRACTION` with only its angle varying, and its body touches the membrane from within with zero
  clearance, #243; visual-style/cells-and-organelles.md
  §3; the inner bound is `ui/components-and-constants.md §9`'s and applies to every cell, so no slot centre sits under the own cell's DNA ring
  from 31 px up, `ui/hud.md §3.1.3`), outside the nucleus disc (0.30 r), with gap `ORGANELLE_MIN_GAP` 0.04 r (new). Slots are appended, never reshuffled, so a tier-up
  adds a bean without moving the others.
- **Lag.** `q' = q − LAG · k · ĥ`, `NUCLEUS_LAG` 0.20 (sheet 01 / 03) for every organelle; nucleus rest drift
  2 % r from the strip (visual-style/motion-and-legibility.md §5).
- **Mapping.** `p = c + |q'| · r(θ_q') · û(q')`: the same radial profile the shader draws, so cytoplasm flows into
  an engulf arm in proportion to ρ and stretches with the body. Sprites scale (`size × r × pulse`) and pulse
  (mitochondrion 1.15 × on sprint; toxin 1.0 → 1.08 at 1 Hz; vacuoles rise and pop every 2 s: visual-style/cells-and-organelles.md §4)
  but are never sheared; their outlines are part of the baked sprite.
- **Line geometry, only two:** flagella (`cells/flagellum-lines.ts`: 3 px white core over a 5 px `FLAGELLUM`
  glow, `FLAGELLUM_SEGMENTS` 32 round-joined segments rooted on the deformed rear membrane (`r(θ)` at `h + π`, so a tapered rear still carries its tail), 2 r long, two sine waves opposite velocity at `FLAGELLUM_WAVE_HZ`, amplitude × 1 / 1.5 / 2, tier III two
  tails spread `FLAGELLUM_TAIL_SPREAD_DEG`, sprint × 2, phase from the cosmetic fork) and the stentor anchor
  (#121), in one `Graphics` per frame drawn **under pass A** so the root is buried in the membrane. Cilia,
  filaments and speckle are shader patterns (§2.2).
- **Nucleus ramp (#231, visual-style/cells-and-organelles.md §3).** The nucleus disc is the last band of pass A (`cell-shader-bands.ts`
  `nucleusRamp`, after the filaments so their inner ends are buried): a disc of radius `nucleusDiscRadii` × r ×
  pulse at `inst.nucleus` (the same mapped point the sprite sits on, so the sprite's rim stays concentric
  through drift, lag and the level-up pulse), its edge a `smoothstep` over `frame.aa` like the body fill, returning
  `acc` unchanged when `nucleusDiscRadii` is 0, filled with a three-stop radial ramp read from the palette texture
  — `SHADE_RIM` at the focus, `SHADE_NUCLEUS` at `NUCLEUS_RAMP_MID_STOP`, `SHADE_NUCLEUS_DARK` at the edge — whose
  focus is `NUCLEUS_RAMP_FOCUS_RADII` toward `LIGHT_DIRECTION_DEG` and whose reach is `NUCLEUS_RAMP_REACH_RADII`,
  at `NUCLEUS_RAMP_ALPHA` (the instance alpha is `main`'s one multiply over the whole pass, so no band
  applies it twice); it takes no `lodBlend` (it is the §5 stage tell's disc through the mid band) and the far dot has
  already returned. The sprite draws over it with its disc fill removed. **Cost:** one
  instance float in what was then a free channel (§2.3; the row stayed 16 texels until the sprint ring, #295), two `SHADE_*` defines the shader already has the
  columns for (`PALETTE_SHADE.nucleus`, `.nucleusDark`), one distance, two `mix`es and one `smoothstep` per
  fragment inside the quad, and no new texture; the sprite layer stays at eight textures. **How it reads:**
  visual-style/cells-and-organelles.md §3 (44 px: the pale-to-dark turn spans the 13 px disc; 140 px: an analytic gradient past panel A's
  128 px scale, never upsampled; mid band: the mid tone as one disc).
- **Preview.** `previewTraitId` is folded into the own cell's trait list at the offered tier for rendering only.

## 4. Motion tables (`packages/shared/src/constants/motion.ts`)

Sheet 03's strips become data; the renderer tweens, the HUD opens the picker at the end of `level_up`
(`ui/overlays.md §3.2`) and the sound bus (#101) cues on keyframes, which is why the file is shared rather than
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

| Clip              | Domain, length             | Keyframes (sheet 03 strips table; visual-style/motion-and-legibility.md §5)                                                                                                                                             | Tracks                                                                                                                                                                                                                  |
| ----------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eat`             | ms, 300, interruptible     | keyframes at 0 approach → 100 wrap → 160 pulse → 220 absorb → 300 settle (sheet 03's "contact 50" is a label inside the first tween, not a keyframe); `ease_out_quad` · `ease_out_back` · `linear` · `ease_in_out_sine` | `dimple`, `wrap`, `pulse`, `stretchAlong`, `stretchAcross`, `haloRadii`                                                                                                                                                 |
| `engulf`          | progress, 1.0              | 0 contact → 0.5 wrap → 1.0 seal; `ease_out_cubic` · `ease_in_out_quad`; values in the engulf table below                                                                                                                | `arm`, `notch`, `seal`                                                                                                                                                                                                  |
| `absorbed`        | ms, 600                    | 0 seal → 200 dissolve → 400 DNA streams → 600 done; `linear` · `ease_in_quad` · `ease_out_back`                                                                                                                         | `rimDash`, `cytoplasmAlpha` (→ 0.5), `streamProgress` on the ghost; `seal` on the predator (table below)                                                                                                                |
| `level_up`        | ms, 900, not interruptible | 0 → 120 anticipate → 250 burst → 450 nucleus → 700 settle → 900; `ease_in_quad` · `ease_out_expo` · `ease_out_cubic` · `ease_in_out_sine` · `linear`                                                                    | `pulse` (0.90, 1.14), `rayRadii` (1.2 → 1.95), `shockRingRadii` 1.6, `rippleRadii` 1.7 / 2.1 / 2.5, `nucleusFlash`, `ringFlash` (0 → 1 at burst → 0 at settle: the own cell's DNA ring and numeral, `ui/hud.md §3.1.2`) |
| `respawn`         | ms, 400                    | scale 0.6 → 1.0 `ease_out_back`, alpha 0 → 1 `ease_out_quad`, halo 2 r → 0                                                                                                                                              | `pulse`, `alpha`, `haloRadii`                                                                                                                                                                                           |
| `sprint_release`  | ms, 200                    | `ease_out_quad` back to rest                                                                                                                                                                                            | `stretchSprint`, `rimBrightness`                                                                                                                                                                                        |
| `sprint_ready`    | ms, 200                    | 0 → 100 peak → 200 rest; `ease_out_quad` · `ease_in_quad`: the one brighten of the self ring when the cooldown ends (`ui/hud.md §3.1.2`)                                                                                | `selfRingBrightness` (0.70 → 0.95 → 0.70)                                                                                                                                                                               |
| `organelle_birth` | ms, 3 000                  | ghost 0.44 → 0.30 r, recolour along the ramp                                                                                                                                                                            | `ghostSize`, `rampMix`                                                                                                                                                                                                  |

**Engulf bump amplitudes per keyframe** (fractions of `r`; centres and σ are fixed: arms at the prey angle ± 30°
σ 16°, notch and seal at the prey angle, notch σ `ENGULF_NOTCH_SIGMA_DEG` 12°, seal σ 42°; sheet 03 gives the
notch no σ, so 12° is a design choice, graphics-designer to accept: it puts the notch's 2.5 σ at the arm centres,
so the dip reads between the arms and its tail at ±30° is −0.004). The arms fold into the seal over wrap → seal,
so the two never add on the flanks; the `absorbed` row is the sheet's "relaxing 0.60 → 0.42 → 0.22", with a new
0 at done so the predator is round when the ghost leaves.

**The engulf clip is sampled on the remapped progress** (ticket #703): the renderer samples it at
`engulfClipPosition(engulfProgress, engulfSealProgress(balance.absorption))` (`render/cells/cell-clips.ts`), a
piecewise-linear remap that sends the room's seal to the clip's 0.5 keyframe (`ENGULF_CLIP_SEAL_AT`) and the payout
to 1.0. So a patched phase second (`ENGULF_WRAP_SECONDS` 1.0 seals at 2/3) moves the arm peak and the seal onset
with the HUD's escape arc (`ui/hud.md §3.1`), and at the default seal of exactly 0.5 the remap is the identity, bit
for bit, so the default look is unchanged.

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

Screen radius is `r × zoom` in CSS px (visual-style/motion-and-legibility.md §6 thresholds; `resolution` does not move them). One
instance field, `lodBlend`, fades the **interior bands** in a `LOD_FADE_BAND_PX` 6 (new) window under the full
threshold so nothing pops; the interior organelle sprites and hairs fade in with zoom the same way, and the
far-dot swap at `CELL_LOD_FAR_MAX_PX` is a snap by design. **The fade never touches the identity, stage and
danger tells:** the seat mark, the self ring, the warning ring and the nucleus / nucleoid sprite (the stage tell,
one disc through the mid band) snap at the far threshold (a bead at 40 % alpha during a fade is a bead that
cannot be counted; visual-style/principles-and-palette.md §2 designed 1–4 beads to be countable at 8 px).

| On-screen radius                   | Drawn                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ `CELL_LOD_FULL_MIN_PX` 20        | every band, sprites, lines                                                                                                                                                                                                                                                      |
| `CELL_LOD_FAR_MAX_PX` 8 → 20 (mid) | the visual-style/motion-and-legibility.md §6 kept set, nothing else; the outline keeps the full profile (§2.1), the nucleus / nucleoid is one sprite, cilia are a flat band (§2.2)                                                                                              |
| < 8 (far dot)                      | body band as a rim-colour dot, floor `CELL_FAR_DOT_MIN_PX` 3, halo band to `FAR_DOT_HALO_RADII` 3.0 (visual-style/motion-and-legibility.md §6 "halo ×3", named here for the quad extent, §2); same shader, no sprites, no seat mark (visual-style/principles-and-palette.md §2) |
| Motes                              | core floor `MOTE_CORE_MIN_PX` 2; small sprite variant below zoom 0.5 (visual-style/motion-and-legibility.md §6, visual-style/performance-and-checklist.md §8)                                                                                                                   |
