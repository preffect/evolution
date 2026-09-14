# Evolution — Visual Style: cell layer stack and organelle vocabulary

§3–§4 of the split [`VISUAL-STYLE.md`](../VISUAL-STYLE.md), which keeps the shared context and the file list.

## 3. The cell: layer stack per stage

Every cell is sheet 01's eleven-layer stack (panel C), back to front: halo, body, cytoplasm texture,
granules, organelles, nucleus, inner edge, soft rim, rim light, outline, glint. Sizes are sheet 01's
proportion table. The ladder ([`game-design/core.md §3`](../game-design/core.md#3-the-evolution-ladder)) decides
which layers exist; [`traits/catalog-organelles.md §3.0`](../traits/catalog-organelles.md#30-what-each-stage-looks-like) says what each rung
must show; sheet 04 draws it. **The starting radius is `ecology/mass-and-movement.md §5.1`'s curve** (17.9 wu at
`CELL_STARTING_MASS`); the sheets' hand-picked radii were drawn before that table and defer to it.

| Stage           | Layers present                                                                                                                                                                                                                                                                                  | Absent                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `protocell`     | halo (rim @22 %, 1.20 r), body @16–26 %, faint texture, `PROTOCELL_GRANULE_COUNT` granules 4.5–6 % r drifting, **double film** (two 1 px lines 2.5 % r apart), outline @40 %, glint                                                                                                             | nucleus, rim-light stack, inner edge |
| `prokaryote`    | the full stack arrives with the nucleoid: body @42–85 %, inner edge 11 % r, soft rim, rim light 5 % r; **nucleoid** loop r 34 % (1 / 2 / 3 loops per tier), no envelope; `ribosomes` stipple along the inside of the membrane; `simple_flagellum` tail 2 r; `cell_wall` band 4.5 % r at +5 % r  | nucleus envelope, organelles         |
| `endosymbiosis` | + mitochondria beans 16 × 8 % r with cristae, 1 / 2 / 3 per tier; + chloroplast lenses 17 % r with six granules on the lit side, 1 / 2 / 3 per tier; membrane tint shifts 20 % toward `CHLORO_BASE` with chloroplasts                                                                           | nucleus envelope                     |
| `eukaryote`     | nucleoid gathers into the **nucleus** 30 % r offset 12 % r toward the light, envelope + 16 pores, nucleolus; `cytoskeleton` 11 filaments @28 %; `food_vacuole` 2 / 3 / 4 bubbling `MITO_BASE` vacuoles; `toxin_vacuole` one 34 % r `TOXIN_*` bladder pulsing; `cilia` 24 / 36 / 48 hairs 12 % r | —                                    |
| `specialised`   | the form's silhouette replaces the circle (sheet 04 specialised-forms table: lobes, slipper, spindle, valve, trumpet); interior keeps the eukaryote stack, plus the form's signature parts                                                                                                      | —                                    |

Organelle placement is seeded from `fork(RANDOM_STREAM.cosmetic + ':' + cellId)`
([`architecture/client.md §6`](../architecture/client.md#6-client-module-plan-pixi-v8--angular)) so a paused frame
reproduces; organelle slot centres never sit inside the nucleus disc, inside `DNA_RING_KEEP_OUT_FRACTION` (0.66 r,
`ui/components-and-constants.md §9`: the own cell's DNA ring band, applied to every cell so a slot is one rule) nor within 8 % r of the
membrane.

**Nucleus shading (#231, sheet 01 panel A).** The nucleus disc is not a tinted bitmap: the cell shader paints it
in the body pass, under the nucleus sprite, as a **three-stop radial ramp** from the palette texture's own
columns, `rim` at the focus → `nucleus` at the middle stop → `nucleusDark` at the edge (Cyan:
`#a6f4ff → #6fdcef → #167787`, panel A's `nuc-*` gradient, per palette with no new colour). The focus sits
`NUCLEUS_RAMP_FOCUS_RADII` 0.40 r_n (r_n = the 0.30 r nucleus radius) from the nucleus centre toward
`LIGHT_DIRECTION_DEG` (panel A's −127° focus rounded to the one light direction, §1), the ramp reaches `NUCLEUS_RAMP_REACH_RADII` 1.4 r_n, the middle stop is
`NUCLEUS_RAMP_MID_STOP` 0.5 and the disc is `NUCLEUS_RAMP_ALPHA` 0.92 over the cytoplasm (panel A's 0.90–0.95).
The sprite keeps what is per cell or white — the 0.40 r glow (cut out inside the disc, so it is an outer glow
only), the 2.3 px rim, the five seeded chromatin spots, the nucleolus with its halo, the highlight — and loses its
disc fill (the bake has no disc constant any more), so the ramp shows through it; the sprite is tinted the palette
**rim**, like the nucleoid, so the nucleolus and the highlight stay lighter than the ramp's lit half; the constants
live in `render/constants/organelles.ts` beside `NUCLEUS_RADIUS`.

Why the tinted bake read flat: a white bake under one multiplicative tint can reach nothing paler than the
tint and darkens toward grey (`#6fdcef` at 0.45 luminance is `#32636c`, saturation 0.37 against `#167787`'s
0.72), so both ends of panel A's ramp were missing and the disc was one mid tone from 44 px up. Per-palette
colour bakes (the other candidate) were rejected: eight more textures in the sprite layer (`PLAYER_PALETTE_COUNT`
8; the nucleus has no tier variants, the envelope's pores do), ≈ 1.5 MB more atlas at DPR 2, a rebake on every
palette change, and a bitmap that is already upsampled at r 140 px at DPR 1. **How it reads:** at 44 px (r_n
13 px, the own cell for most of a round) the turn from pale to dark spans the disc and the rim is a separate
line; at 140 px (r_n 42 px, past panel A's own 128 px scale) the ramp is analytic, so nothing softens it; in the mid band
(r_n 2–6 px) it collapses to the mid tone and the disc stays the stage tell (§6).

## 4. Organelle vocabulary per trait

The trait's own `visual` string ([`traits/catalog-organelles.md §3`](../traits/catalog-organelles.md#3-build-1-catalog-sixteen-traits-fully-specified))
is the requirement; this table fixes the drawing. Colours are §2 constants; sizes are fractions of `r`.
The last column is what survives the mid LOD of §6 (the full-LOD tell is the drawing itself); "drops"
means the trait has no tell below 20 px and is read from the menu's trait list only (`ui/overlays.md §3.5`).

| Trait               | Drawing                                                                                                                       | Tier progression                     | Mid-LOD tell (§6, 8–20 px)                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------- |
| `nucleoid`          | glow strand loop, r 34 %, `NUCLEOID_STRAND` on the palette rim glow, drifting 2 % r                                           | 1 / 2 / 3 interlaced loops           | nucleoid disc (loops collapse to one)     |
| `simple_flagellum`  | `FLAGELLUM` 3 px white core, 2 r long, 2 sine waves opposite velocity                                                         | amplitude ×1 / 1.5 / 2; III: 2 tails | tail polyline                             |
| `cell_wall`         | `CELL_WALL` rigid band 4.5 % r at +5 % r, `CELL_WALL_LIGHT` hairline                                                          | rim thickness ×1.5 / 2 / 2.5         | second rim                                |
| `ribosomes`         | `RIBOSOME` dots 2 px @35–80 % inside the membrane (sheet 04's "~40 dots" is tier II; resolved)                                | ~20 / 40 / 60 dots                   | drops (interior)                          |
| `mitochondrion`     | `MITO_*` bean with 3 cristae stripes, warm glow; pulses 1.15× on sprint                                                       | 1 / 2 / 3 beans                      | drops (interior)                          |
| `chloroplast`       | `CHLORO_*` lens with 6 granules on the lit edge; brighter in `sunlit_shallows` (+40 % glow)                                   | 1 / 2 / 3 lenses                     | `CHLORO_LIGHT` halo at 1.39 r             |
| `nuclear_envelope`  | `ENVELOPE` double line + 16 `PORE` gaps around the nucleus; rim brightness +0 / 10 / 20 %                                     | pores 16 / 20 / 24                   | drops (interior)                          |
| `cytoskeleton`      | `CYTOSKELETON` filaments nucleus → rim @28 %; wobble amplitude halves, dent σ tightens (§5)                                   | 11 / 15 / 19 filaments               | taut outline (wobble amplitude)           |
| `cilia`             | `CILIA` hairs 12 % r leaning 30 °, travelling-wave beat, wave speed ∝ velocity (sheet 04's 64 hairs is superseded; resolved)  | 24 / 36 / 48 hairs                   | fuzzy edge: one `CILIA` @40 % band 12 % r |
| `food_vacuole`      | `MITO_BASE` bubbles 12 % r that rise and pop every 2 s                                                                        | 2 / 3 / 4                            | drops (interior)                          |
| `toxin_vacuole`     | one `TOXIN_BASE` bladder 34 % r, `TOXIN_RIM`, pulsing 1.0 → 1.08 at 1 Hz, leaking 3 wisps                                     | wisp count 3 / 5 / 7                 | `TOXIN_GLOW` halo at 1.39 r               |
| `amoeba_pseudopods` | sheet 04 amoeba: lobes toward velocity and toward engulfed prey, `VAC_RIM` @14 % ectoplasm rim                                | 2 / 3 / 4 lobes                      | lobes (outline)                           |
| `paramecium_cilia`  | sheet 04 paramecium: slipper aspect 1.6 / 1.8 / 2.0, 120 cilia, oral groove, macro + micronucleus                             | aspect per tier                      | slipper (outline)                         |
| `euglena_eyespot`   | sheet 04 euglena: spindle, `EYESPOT` at the front, leading flagellum 40 wu, 6 chloroplasts                                    | eyespot glow +0 / 25 / 50 %          | spindle (outline); eyespot drops          |
| `diatom_shell`      | sheet 04 diatom: `SILICA_*` valve with 36 striae, `DIATOM_PLASTID_*`; **8 / 12 / 16 radial spines with bright tips** (TRAITS) | spine count                          | star (spine polylines)                    |
| `stentor_trumpet`   | sheet 04 stentor: trumpet, 44 membranelles, 7-bead macronucleus, `TOXIN_GLOW` @8 % haze to `toxinAuraRangeInRadii`            | haze radius per tier                 | trumpet (outline)                         |
