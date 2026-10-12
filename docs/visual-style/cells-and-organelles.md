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

**Chromatin spots (#252, sheet 01 panel A).** `NUCLEUS_CHROMATIN_SPOTS` 5 spots, one per fifth of a turn, each
jittered by up to ±`angleJitterTurns`/2 (0.06 turn), placed `ringShareMin`–`ringShareMax` 0.54–0.71 r_n from the
nucleus centre with radius `radiusShareMin`–`radiusShareMax` 0.07–0.13 r_n (panel A's five spots: radii 5.0 / 3.8 /
3.5 / 3.1 / 2.7 px on its 38.4 px nucleus, 0.54–0.71 r_n out), `CHROMATIN_WASH` black @`alpha` 30 % over the ramp.
The shares are the same at every tier (sheet 01's tier panels scale panel A's spots with the nucleus), so there is
no per-tier bake. At these extremes two neighbours can never overlap (the closest pair, 0.08 turn apart on the
inner edge, sits 0.27 r_n apart against 0.26 r_n of summed radii): the old 0.10–0.17 r_n spots on a 0.42–0.64 ring
could, and an overlapping pair doubled the wash into the darkest blob on the disc. A black wash multiplies the ramp,
so a spot keeps the ramp's hue; @30 % it drops luminance to 0.65–0.70 of the ramp around it at r ≈ 148 px, panel A's
`#167787` @55 % measures 0.64–0.73 — the spots read darker in the old bake by their area (≈ 2× panel A's) and the
overlaps, not by their alpha. Panel A's single chromatin thread is not baked.

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

| Trait               | Drawing                                                                                                                                                                                                                                                                                                                 | Tier progression                     | Mid-LOD tell (§6, 8–20 px)                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------- |
| `nucleoid`          | glow strand loop, r 34 %, `NUCLEOID_STRAND` on the palette rim glow, drifting 2 % r                                                                                                                                                                                                                                     | 1 / 2 / 3 interlaced loops           | nucleoid disc (loops collapse to one)     |
| `simple_flagellum`  | `FLAGELLUM` 3 px white core, 2 r long, 2 sine waves opposite velocity                                                                                                                                                                                                                                                   | amplitude ×1 / 1.5 / 2; III: 2 tails | tail polyline                             |
| `cell_wall`         | `CELL_WALL` rigid band 4.5 % r at +5 % r, `CELL_WALL_LIGHT` hairline                                                                                                                                                                                                                                                    | rim thickness ×1.5 / 2 / 2.5         | second rim                                |
| `ribosomes`         | `RIBOSOME` dots 2 px @35–80 % inside the membrane (sheet 04's "~40 dots" is tier II; resolved)                                                                                                                                                                                                                          | ~20 / 40 / 60 dots                   | drops (interior)                          |
| `mitochondrion`     | `MITO_*` bean with 3 cristae stripes, warm glow; pulses 1.15× on sprint                                                                                                                                                                                                                                                 | 1 / 2 / 3 beans                      | drops (interior)                          |
| `chloroplast`       | `CHLORO_*` lens with 6 granules on the lit edge; brighter in `sunlit_shallows` (+40 % glow)                                                                                                                                                                                                                             | 1 / 2 / 3 lenses                     | `CHLORO_LIGHT` halo at 1.39 r             |
| `nuclear_envelope`  | `ENVELOPE` double line + 16 `PORE` gaps around the nucleus; rim brightness +0 / 10 / 20 %                                                                                                                                                                                                                               | pores 16 / 20 / 24                   | drops (interior)                          |
| `cytoskeleton`      | `CYTOSKELETON` filaments nucleus → rim @28 %; wobble amplitude halves, dent σ tightens (§5)                                                                                                                                                                                                                             | 11 / 15 / 19 filaments               | taut outline (wobble amplitude)           |
| `cilia`             | `CILIA` hairs 12 % r leaning 30 °, travelling-wave beat, wave speed ∝ velocity (sheet 04's 64 hairs is superseded; resolved)                                                                                                                                                                                            | 24 / 36 / 48 hairs                   | fuzzy edge: one `CILIA` @40 % band 12 % r |
| `food_vacuole`      | `MITO_BASE` bubbles 12 % r that rise and pop every 2 s                                                                                                                                                                                                                                                                  | 2 / 3 / 4                            | drops (interior)                          |
| `toxin_vacuole`     | one `TOXIN_BASE` bladder 34 % r, `TOXIN_RIM`, pulsing 1.0 → 1.08 at 1 Hz, leaking 3 wisps                                                                                                                                                                                                                               | wisp count 3 / 5 / 7                 | `TOXIN_GLOW` halo at 1.39 r               |
| `amoeba_pseudopods` | sheet 04 amoeba: lobes toward velocity and toward engulfed prey, `VAC_RIM` @14 % ectoplasm rim                                                                                                                                                                                                                          | 2 / 3 / 4 lobes                      | lobes (outline)                           |
| `paramecium_cilia`  | sheet 04 paramecium: slipper aspect 1.6 / 1.8 / 2.0, oral groove, macro + micronucleus; 16 tufts in the player's rim colour past the rings (motion-and-legibility.md §5.1, #193, #745)                                                                                                                                  | aspect per tier                      | slipper (outline)                         |
| `euglena_eyespot`   | sheet 04 euglena: spindle (round nose, pointed rear), `EYESPOT` dot 0.15 r at the front, a leading whip in the player's rim colour 2.2 r past the nose (motion-and-legibility.md §5.1, #194), 6 chloroplasts                                                                                                            | eyespot glow +0 / 25 / 50 %          | spindle (outline) + red dot + whip        |
| `diatom_shell`      | sheet 04 diatom: a rigid round `SILICA_*` valve with 36 striae and pores, the girdle; `DIATOM_PLASTID_*` plastids drawn on the giant diatom only (§4.1; a player's: ticket #779); **8 / 12 / 16 radial spines with bright tips** in the player's rim colour 1 r past the membrane (motion-and-legibility.md §5.1, #195) | spine count                          | star (spine polylines)                    |
| `stentor_trumpet`   | sheet 04 stentor: trumpet, 44 membranelles, 7-bead macronucleus, `TOXIN_GLOW` @8 % haze to `toxinAuraRangeInRadii`                                                                                                                                                                                                      | haze radius per tier                 | trumpet (outline)                         |

### 4.1 Giant cells (#828)

The three giants ([`ecology/giants.md §3.5.11`](../ecology/giants.md#3511-how-they-look)) are drawn by the forms
above from their fixed builds; `CellView.giantSpecies` changes three things, all in
`packages/client/src/app/game/render/constants/giants.ts`. Nothing else about a form changes, so a player who has seen
the paramecium form reads the giant one.

**1. A palette per species, never a seat's.** A giant has no seat: it wears its species' row of the palette texture
(rows 8–10, after the eight seats, in `GIANT_SPECIES_ORDER`) and **no seat-mark beads**. Player palettes are saturated;
the giants' are natural, low-saturation ramps, authored in full from the mockup's three stops (a player's cytoplasm
derives from its base by sheet 01's rule; a giant's edge and nucleus dark still do):

| Species      | `base`    | `cytoLight` (centre) | `cytoDark` (mid, dark pool) | `rim`     | `nucleus` | `chloroBase` (membrane tint)    |
| ------------ | --------- | -------------------- | --------------------------- | --------- | --------- | ------------------------------- |
| Giant amoeba | `#77729a` | `#3d3b5a`            | `#25263d`                   | `#d4d2e5` | `#958dd4` | `CHLORO_BASE` (no chloroplast)  |
| Paramecium   | `#5f9a86` | `#2b5048`            | `#1a3330`                   | `#cfe9e0` | `#a8dcc4` | `CHLORO_BASE` (no chloroplast)  |
| Giant diatom | `#c9d4de` | `#6f7f8e`            | `#3c4856`                   | `#e6ecf2` | `#aebccb` | `DIATOM_PLASTID_BASE` `#c88a2a` |

- **Rims.** The mockup's amoeba and paramecium rims (`#cfc8ff`, `#b8f6e0`) sat CIEDE2000 1.9 and 3.0 from the Violet and
  Mint player rims, and a rim also colours the arms, the cilia fringe and the spines (§2: appendages take the cell's
  colour), so a giant would have worn a player's arms. Their hue at about a third of the saturation sits 11.8 (amoeba,
  Violet) and 11.9 (paramecium, Mint) from every player rim: `GIANT_RIM_MIN_DELTA_E` 11, the player rims' own nearest
  pair (Coral–Rose). The diatom's `#e6ecf2` (the silver of the `armored` tag) is 17.2 from Cyan.
- **Contrast** against `BG_FIELD`: rims 12.2 / 14.2 / 15.3 : 1, bases 4.03 / 5.58 / 12.1 : 1, inside the player bars
  (`RIM_MIN_CONTRAST` 4.5, `BASE_MIN_CONTRAST` 4.0). The relation rings stay readable on all three: the amoeba's
  `DANGER` threat ring is ΔE 36 from its rim, the edible `GAIN` line 49 / 22 / 33 from the three rims.
- **One glow.** A giant's halo is its own rim colour (`HALO_KIND.default`), even with a chloroplast: its palette is its
  species, not a trait. The diatom's chloroplast still tints its membrane 20 % toward `chloroBase`, golden there.
- **Trait tells keep their colours.** The amoeba's `CYTOSKELETON` filaments and the diatom's `CELL_WALL` band stay
  cyan, as on any cell: they are how a player reads "taut" and "armoured", and the diatom is the hardest to swallow.

**2. The giant diatom's plastids.** Its chloroplasts are drawn as `GIANT_DIATOM_PLASTID_COUNT` (5) golden-brown
plastids (`ORGANELLE_KIND.diatomPlastid`: the chloroplast's lens, radius `GIANT_DIATOM_PLASTID_RADIUS` 0.1 r, in
`DIATOM_PLASTID_LIGHT` / `DIATOM_PLASTID_BASE` / `DIATOM_PLASTID_DARK`), real diatoms' fucoxanthin colour; one 0.17 r
green lens was lost in a shell 300 wu across. A player diatom keeps its green chloroplasts.

**3. Detail each form lacks at giant size** (checked at radius 120–155 wu: 110–200 px on screen beside a mass 100–400
player). Pass A, under the organelle sprites, faded with the interior below full LOD (`cells/cell-shader-giants.ts`,
reference `cells/forms/giant-detail.ts`); points are in the heading frame in **membrane radii**, so a mark rides the
outline's lobes as the organelle slots do.

| Species    | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paramecium | **Oral groove**: a circular arc from the outline's notch (`GIANT_ORAL_GROOVE_START_RADII` 0.86 along `SLIPPER_ORAL_GROOVE_DEG` 43°) to the mouth at (0.02, 0.30), bowing `GIANT_ORAL_GROOVE_BOW_RADII` 0.08 toward the notch's side; an `OUTLINE` crease 0.04 membrane radii wide (2 px floor) @45 %, fading in over the first 20 % from the notch, its far wall (away from the light) a 2.5 px rim-colour line @75 %; the mouth a 0.06 pit @75 % ringed in the rim colour. **Two contractile vacuoles** at (±0.58, −0.24), the dorsal side. |
| Amoeba     | **One contractile vacuole** at (−0.5, 0.22), toward the rear. Its lobes, arms, ectoplasm and filaments already read at giant size.                                                                                                                                                                                                                                                                                                                                                                                                           |
| Diatom     | **Rings of pores**: on each of the valve's five pore rows (0.36–0.84 r), a `SILICA_LIGHT` pore of `GIANT_DIATOM_RING_PORE_RADIUS_RADII` 0.014 r (1 px floor) @42 % every `GIANT_DIATOM_RING_PORE_SPACING_RADII` 0.055 r (41–95 a ring), so the rows read as concentric rings between the 18 ribs; the ribs, fine striae and girdle are the form's own.                                                                                                                                                                                       |

**Contractile vacuole** (a giant's water pump; `VAC_BASE` fill, `VAC_RIM` rim): radius `GIANT_VACUOLE_RADIUS_RADII`
0.1 r, sited through the deformed outline (`profileAt` at its angle). It swells linearly from 0.3 to 1 of its radius
over the first 85 % of a `GIANT_VACUOLE_CYCLE_SECONDS` 4 s cycle on the room clock and empties over the last 0.6 s;
the cycle's phase is the cell's `speckleSeed`, so two giants never pump together. Fill @40 % (half at the centre), a
2 px rim @85 %. The paramecium's two pumps run half a cycle apart and have **six collecting canals**: spokes to 2.4 ×
the radius, 0.35 of the radius wide at the root tapering to nothing, @55 % while the pump is emptied and drained as it
swells, so the pump reads as a star when empty and a bubble when full.

**The paramecium's fringe at any size.** A tuft carries one strand per `CILIA_TUFT_STRAND_PITCH_PX` 5 px of its root
width, never fewer than `CILIA_TUFT_STRANDS` 3 (`tuftStrandCount`): unchanged on a cell under 37.5 px in radius, 16
strands on a 200 px giant, where three strands in a 80 px tuft read as a hollow tube rather than a brush of hairs.

**Cost.** One branch per fragment for every cell that is not a giant; the vacuoles cost one profile walk each. On the
1080 Ti box, three giants on screen beside the own cell measured the same GPU time with the detail on and off
(PR evidence, `qa/evidence/pr-<N>/`).
