# Evolution — Visual Style

Ticket #34, epic #2. The renderer (#99, #120) and the HUD (#100) are implemented from this document.
It distils the four concept sheets in [`concept-art/README.md`](./concept-art/README.md) and the
design docs; **one fact, one home**: a number that already lives in a sheet README table or a design
doc is linked, not restated. Every value below that is new is a named constant whose home is
`packages/client/src/app/game/render/constants.ts` ([`CODE-STANDARDS.md §2`](./CODE-STANDARDS.md#2-where-every-constant-enum-and-config-value-lives),
"client render-only numbers"); HUD colours and type are the same file, imported by the Angular
overlay. The quality bar every asset is reviewed against is
[`ASSET-GENERATION.md`](./ASSET-GENERATION.md); §9 below extends its checklist, it does not replace it.

Units: **wu** = world units, 1 wu = 1 px at camera zoom 1.0. Sizes on a cell are fractions of its
radius `r` (`ECOLOGY.md §5.1`: `r = CELL_RADIUS_SCALE × √mass`). Time is in ms, easings by their
Penner names (`packages/client/src/app/game/render/easing.ts`, added by #99, holds the curves; no inline
cubic-bezier literals). `UI.md` (#30, in flight on `feat/30-ui-design`) is the HUD companion referenced below.

## 1. Dark-field microscopy: the principles

The dish is a dark-field microscope stage: a black field, and only what scatters light is visible.

- **Light comes from the top-left**, one direction, for everything: the condenser light pool on the
  field, the specular glint on every cell and mote, the light pool / dark pool that gives a body its
  volume (sheet 01, design decisions). Nothing is lit from below or from the right.
- **The condenser pool is anchored to the view, never to the world** (#222, option A). A condenser
  lights whatever sits under the objective, so the pool covers the top-left of the _view_ at every
  zoom and follows the camera; a cell in the shallows is lit from the same corner as one at the vent.
  Sheet 02's ellipse (980 × 760 wu centred (380, 200) in its 1920 × 1080 wu scene) is read as
  fractions of the viewport: centre `LIGHT_POOL_VIEW_CENTRE` (0.20 of the width, 0.185 of the
  height), radii `LIGHT_POOL_VIEW_RADII` (0.51 of the width, 0.70 of the height), `LIGHT_ACCENT` at
  `LIGHT_POOL_ALPHA` 9 % → `LIGHT_POOL_MID` 3 % at half the radius → 0, normal blend, no mask (the
  stage outside the wall is lit too: a condenser lights the stage, not the dish). The three caustic
  sweeps (`CAUSTIC_SWEEPS`, `CAUSTIC_ALPHA` 5 %) are the light, not the water, and ride with it. The
  pool is drawn over the field and under everything that lives in the dish (motes, fragments, cells,
  the vent, the depth particles) so it lights the water and never the bodies; the vignette stays above
  everything (≈ 7 % where the pool is brightest, 55 % at the corner). Where the shallows annulus
  crosses it the zone tint and the pool stack (16 % + 9 % at most) and nothing clamps them: the ≤ 16 %
  rule below is about zone tints alone. A world-anchored pool (PR #221 baked one into the field at a
  fixed spot inside the vent zone, where most players never see it) is the wrong reading and is
  removed by the implementation ticket. [`RENDERING.md §6.1`](./RENDERING.md#61-the-condenser-light-pool-222)
  owns the sprite, its bake and the per-frame transform.
- **Every rim scatters.** A membrane's rim stroke is a white → rim → base → rim gradient: brightest at
  the top-left, never dark on the far side. Glow is always **core + soft halo + wide halo + glint**
  (`ASSET-GENERATION.md §1.5`), never a solid dot and never a blur filter run per frame (§8).
- **Bodies are translucent.** Cell bodies sit at 42–85 % alpha (protocell 16–26 %) so the field, motes
  and an engulfed prey show through. Volume comes from a blurred dark pool at the bottom-right and a
  light pool at the top-left, not from opacity or from a drop shadow: there is no ground to cast on.
- **Depth without darkening.** Depth is three particle layers (far sharp, near blurred, bokeh) and the
  vignette (sheet 02, draw order 4–7). The field itself stays uniform so every palette keeps the same
  contrast everywhere in the dish; zone tints never exceed their sheet-02 alpha (≤ 16 %).
- **One hard edge.** The dish wall is the only crisp line in the world (sheet 02, dish wall table);
  every other boundary is a soft rim, a feathered noise cloud or a halo.
- **Warm inside, cool outside.** Organelles are warm (mitochondria, lipids, plastids) inside a cool
  membrane so an interior reads as alive under any palette; only chloroplasts, toxin and silica
  recolour an interior (sheet 01).

**Never done:** opaque bodies; flat single-colour fills; drop shadows or darkening for depth; light
from any other direction; a condenser pool pinned to a world position (the light follows the view); outlines heavier than the sheet-01 outline layer; a raster texture or
bitmap of any kind; text or UI inside the play area (the debug layer excepted); colour as the only
tell for a stage, trait (§6) or player (the seat mark and self ring of §2); camera shake (a microscope stage does not move); hue-cycling
or rainbow effects; more than one glow colour on one body except the trait halo of §4.

## 2. Palette

All hex values are named constants; draw code never holds a literal. The sheet tables are the home
of the values already drawn; this section names the roles and adds what the sheets did not cover.

**Field and dish.** `BG_DEEP` / `BG_FIELD`, the condenser pool, caustics, wall band, rim scatter,
hairline, vignette: sheet 02, field and dish-wall tables. `LIGHT_ACCENT` `#7fe7f5` is the condenser
colour and doubles as the UI accent (§7).

**Zones** ([`ECOLOGY.md §2`](./ECOLOGY.md#2-zones) owns geometry; sheet 02's zone table owns tint,
alpha, cloud and mote density; the roles map as follows):

| `ZoneId`          | Sheet-02 role   | Tint                      | Feature                                                  |
| ----------------- | --------------- | ------------------------- | -------------------------------------------------------- |
| `sunlit_shallows` | sunlit shallows | `ZONE_SHALLOWS` `#8dffb0` | annulus inside the wall; cloud feathers the inner edge   |
| `warm_vent`       | thermal vent    | `ZONE_VENT` `#ff9a4d`     | disc at the origin with the fissure, plume, heat shimmer |
| `viscous_gel`     | viscous mire    | `ZONE_GEL` `#b070ff`      | `GEL_PATCH_COUNT` discs with mire strands                |
| `open_broth`      | (none)          | none                      | base mote density only                                   |

**Food** ([`ECOLOGY.md §1`](./ECOLOGY.md#1-food-kinds) owns kinds, radii and motion; sheet 02's
mote table owns core / edge / rim / glow for the looks it drew). Sheet 02 predates the food table, so:

| Kind                       | Look                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Algae mote                 | sheet 02 algal mote (`FOOD_MOTE` `#8dff6a` core), circle                                                                                                |
| Detritus mote              | sheet 02 lipid mote (`LIPID_BASE` core, `LIPID_CENTRE` `#c88a2a` centre, `LIPID_LIGHT` rim), oily ellipse; fades out over the last 20 % of its lifetime |
| DNA fragment               | sheet 02 helix (`DNA_STRAND_LIGHT` `#f0b8ff` / `DNA_STRAND` `#d36bff`); rungs and wide halo take the tag colour below                                   |
| Bacterium `plain`          | rod (dimensions below) with rounded ends, body `BACTERIUM_PLAIN` `#cfefff` @55 %, rim `PROTO_FILM` `#8fd3e3`, one glint                                 |
| Bacterium `aerobic`        | rod, body `MITO_BASE`, hot rim `MITO_LIGHT`, halo `MITO_BASE` @30 %                                                                                     |
| Bacterium `photosynthetic` | rod, body `CHLORO_BASE`, three `CHLORO_DARK` bands, rim `CHLORO_LIGHT`, halo `CHLORO_LIGHT` @30 %                                                       |

**Bacterium rod dimensions** (all three variants): length = 2 × the `bacterium` collision radius of
`ECOLOGY.md §1` (16 wu) along the heading, width = 1 × that radius (8 wu), so the rod is inscribed in its
collision circle and the eating circle never misses the silhouette.

Sheet 02's mineral diamond and sheet 04's purple bacterium are retired: the aerobic rod is already
mitochondrion-coloured so "eat the orange rods, get the orange bean" is one lesson, not two.

**DNA tag colours** (`DNA_TAG_COLOR`, keyed by `DnaTag`): fragments show their tag in the helix rungs
and wide halo; the trait picker reuses them for tag chips (`UI.md`, #30).

| Tag         | Hex       | Source                                                          |
| ----------- | --------- | --------------------------------------------------------------- |
| `motile`    | `#66ecff` | the `FLAGELLUM` family, saturated so it clears `armored`        |
| `metabolic` | `#ffb15a` | `MITO_BASE`                                                     |
| `photic`    | `#b8ff9a` | `CHLORO_LIGHT`                                                  |
| `predatory` | `#ff5470` | `DANGER`                                                        |
| `toxic`     | `#d05cff` | `TOXIN_GLOW`                                                    |
| `sensory`   | `#6a9bff` | new, #34: a true blue (the retired mineral tint was cyan again) |
| `armored`   | `#e6ecf2` | new, #34: silver, the silica of a shell                         |

**Acceptance (`TAG_PAIR_MIN_DELTA_E` 15):** every tag pair is CIEDE2000 ≥ 15 under normal vision; measured
minimum 21 (`motile`–`armored`), full table in
[`qa/evidence/34/palette-separability.md`](../qa/evidence/34/palette-separability.md). Fragments are
colour-only on purpose: at 9 wu with 2 px rungs no glyph reads, so there is no shape tell per tag. Under
dichromacy seven tags collapse to four groups (warm / green / blue / light); the tag name on the picker
card (`UI.md`) is the fallback, never a second fragment shape.

**Organelles and stage parts.** Sheet 01's shared organelle table (`MITO_*`, `VAC_*`, `LIPID_*`,
`CHLORO_*`, `TOXIN_*`, `MAGNET_*`) and sheet 04's constants table (`PROTO_*`, `NUCLEOID_*`,
`RIBOSOME`, `CELL_WALL*`, `FLAGELLUM`, `ENVELOPE` / `PORE`, `CYTOSKELETON`, `CILIA`, `SILICA_*`,
`DIATOM_PLASTID_*`, `EYESPOT*`). Two of those are the **cyan instance of a palette rule**, not
constants: the protocell film is the player's rim colour @55 % (film light `WHITE` `#ffffff` @70 %; `WHITE` is the one white constant, shared by glints, the seat-mark cores and the self ring), and the
nucleoid glow is the player's rim colour (strand `NUCLEOID_STRAND` stays near-white). Everything else
in those tables is palette-independent so organelles look the same inside every player.

**Player palettes.** `PLAYER_PALETTE_COUNT` is `MAX_PLAYERS_PER_GAME` (8) by construction, and
`AVATAR_INDEX_MAX` in `constants/lobby.ts` derives from it as `PLAYER_PALETTE_COUNT − 1` (both live in
`constants/lobby.ts`; the renderer's palette table pins its length against `PLAYER_PALETTE_COUNT`). Six ramps are sheet 01's player-palette table; two are new. Derived
shades (edge, cytoplasm light / dark, nucleus dark) follow sheet 01's HSL rule and are computed in
`render/palette.ts`, never listed. A new palette's rim and nucleus follow the six drawn ones: rim = the
base hue at S 100 % / L 85 %, nuc = the base hue at S 85 % / L 70 % (HSL). Palette index is seat order,
arranged so the first _k_ seats are mutually far apart on the hue wheel (a 2-player game sees 0 and 1):

| Index | Name    | base      | rim       | nuc       | Source   |
| ----- | ------- | --------- | --------- | --------- | -------- |
| 0     | Cyan    | sheet 01  |           |           |          |
| 1     | Coral   | sheet 01  |           |           |          |
| 2     | Lime    | sheet 01  |           |           |          |
| 3     | Violet  | sheet 01  |           |           |          |
| 4     | Amber   | sheet 01  |           |           |          |
| 5     | Mint    | `#24db98` | `#b2ffe3` | `#71f4c4` | new, #34 |
| 6     | Magenta | sheet 01  |           |           |          |
| 7     | Rose    | `#bc5768` | `#ffb2bf` | `#f47187` | new, #34 |

Azure (`#2a74f4`, the first draft of slot 5) is retired: blue is boxed in by Cyan, Violet and Magenta and no
blue clears the separability bar below. Rose is the one hue that does.

**Separability acceptance** (CIEDE2000; dichromacy simulated with the Viénot 1999 matrices; the script is
[`qa/evidence/34/tools/colour_separability.py`](../qa/evidence/34/tools/colour_separability.py) and #99
pins these numbers in a test):

- `PALETTE_PAIR_MIN_DELTA_E` 15: every base pair under normal vision. Measured minimum 18 (Coral–Rose).
- `NEW_PALETTE_MIN_DELTA_E` 15: a palette added after sheet 01 (Rose) against every other, under normal,
  deuteranopic **and** protanopic vision. Measured minimum 18.
- The six inherited hues are not separable under dichromacy (Lime–Amber 2, Coral–Amber 8, Cyan–Magenta
  11 under deutan); that is the fact the seat mark below exists for, not something a hue change fixes.

Nearest neighbour per palette (full 28-pair matrix, rims and contrast in
[`qa/evidence/34/palette-separability.md`](../qa/evidence/34/palette-separability.md)):

| Palette | normal       | deutan       | protan       |
| ------- | ------------ | ------------ | ------------ |
| Cyan    | 27 (Mint)    | 11 (Magenta) | 30 (Magenta) |
| Coral   | 18 (Rose)    | 8 (Amber)    | 17 (Amber)   |
| Lime    | 18 (Mint)    | 2 (Amber)    | 10 (Amber)   |
| Violet  | 21 (Magenta) | 16 (Magenta) | 9 (Magenta)  |
| Amber   | 32 (Coral)   | 2 (Lime)     | 10 (Lime)    |
| Mint    | 18 (Lime)    | 13 (Coral)   | 14 (Lime)    |
| Magenta | 18 (Rose)    | 11 (Cyan)    | 9 (Violet)   |
| Rose    | 18 (Coral)   | 18 (Coral)   | 19 (Coral)   |

**Non-colour player tells.** Two marks, both geometry drawn at every LOD of 8 px and above (§6), so hue is
never the only tell between players; the evidence render shows them at 52, 20 and 8 px:

- **Seat mark** — `SEAT_MARK_BEADS[index]` (`packages/shared/src/constants/lobby.ts`, shared with the HUD leaderboard swatch) = index + 1 bright beads (1–8) on the outline at 1.0 r, evenly
  spaced, the first at the light direction (`SEAT_MARK_ANCHOR_DEG` −135°, under the glint), fixed to the
  cell frame (they do not turn with the heading). Bead radius `SEAT_MARK_BEAD_RADIUS_FRACTION` 5 % r with a
  `SEAT_MARK_BEAD_MIN_PX` 2 px floor; core `WHITE` @92 %, halo the palette rim @45 % at 2.2 × the bead
  radius; drawn above the outline, below the self ring. Counts 1–4 stay countable at 8 px; 5–8 merge
  into a beaded rim there and are told apart from 1–4 by texture, which is what a 2–4 player game needs.
  The leaderboard swatch carries the same bead count (`UI.md`, #30) so a player can match dish to board.
- **Self ring** — the own cell only: `SELF_RING` = `WHITE` @70 %, 1.5 px, dashed 6 4 (px), at
  `SELF_RING_RADIUS_FRACTION` 1.12 r with a `SELF_RING_MIN_PX` 7.5 floor, rotating 20 °/s. It replaces
  sheet 02's inset "identity ring at 7.5 px", which only existed at a zoom the camera never reaches: the
  own cell is 32–102 px on screen for the whole round (§6), so the ring is drawn at full LOD.
- **Far LOD (< 8 px)** has no seat mark: the dot is a presence tell, not an identity tell, and identity
  there is hue plus the leaderboard swatch. Stated on purpose (the own cell never reaches that LOD).

Evidence render of all eight on the field, at the three LODs, with the deuteranopic and protanopic
simulations beside it: `qa/evidence/34/player-palettes.png`, `-deutan.png`, `-protan.png`, regenerated
by `qa/evidence/34/tools/render.sh`.

**Effects and UI.** `DANGER` `#ff5470` (engulf warning ring, toxin damage flash), `LEVEL_GOLD`
`#ffe08a` (level ring full, anticipation ring, timer bar), `DNA` `#d36bff` / `DNA_DEEP` `#6b2ea6`
(DNA ring, streams), the panel and text roles: sheet 03's palette table; the overlay panel is
`PANEL_TOP` `#0e1f33` → `PANEL_BOTTOM` `#060e1a` with the `PANEL_RIM` `#173250` rim. `UI_ACCENT` is
`LIGHT_ACCENT`; `WHITE` `#ffffff` is the single white.

## 3. The cell: layer stack per stage

Every cell is sheet 01's eleven-layer stack (panel C), back to front: halo, body, cytoplasm texture,
granules, organelles, nucleus, inner edge, soft rim, rim light, outline, glint. Sizes are sheet 01's
proportion table. The ladder ([`GAME-DESIGN.md §3`](./GAME-DESIGN.md#3-the-evolution-ladder)) decides
which layers exist; [`TRAITS.md §3.0`](./TRAITS.md#30-what-each-stage-looks-like) says what each rung
must show; sheet 04 draws it. **The starting radius is `ECOLOGY.md §5.1`'s curve** (17.9 wu at
`CELL_STARTING_MASS`); the sheets' hand-picked radii were drawn before that table and defer to it.

| Stage           | Layers present                                                                                                                                                                                                                                                                                  | Absent                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `protocell`     | halo (rim @22 %, 1.20 r), body @16–26 %, faint texture, `PROTOCELL_GRANULE_COUNT` granules 4.5–6 % r drifting, **double film** (two 1 px lines 2.5 % r apart), outline @40 %, glint                                                                                                             | nucleus, rim-light stack, inner edge |
| `prokaryote`    | the full stack arrives with the nucleoid: body @42–85 %, inner edge 11 % r, soft rim, rim light 5 % r; **nucleoid** loop r 34 % (1 / 2 / 3 loops per tier), no envelope; `ribosomes` stipple along the inside of the membrane; `simple_flagellum` tail 2 r; `cell_wall` band 4.5 % r at +5 % r  | nucleus envelope, organelles         |
| `endosymbiosis` | + mitochondria beans 16 × 8 % r with cristae, 1 / 2 / 3 per tier; + chloroplast lenses 17 % r with six granules on the lit side, 1 / 2 / 3 per tier; membrane tint shifts 20 % toward `CHLORO_BASE` with chloroplasts                                                                           | nucleus envelope                     |
| `eukaryote`     | nucleoid gathers into the **nucleus** 30 % r offset 12 % r toward the light, envelope + 16 pores, nucleolus; `cytoskeleton` 11 filaments @28 %; `food_vacuole` 2 / 3 / 4 bubbling `MITO_BASE` vacuoles; `toxin_vacuole` one 34 % r `TOXIN_*` bladder pulsing; `cilia` 24 / 36 / 48 hairs 12 % r | —                                    |
| `specialised`   | the form's silhouette replaces the circle (sheet 04 specialised-forms table: lobes, slipper, spindle, valve, trumpet); interior keeps the eukaryote stack, plus the form's signature parts                                                                                                      | —                                    |

Organelle placement is seeded from `fork(RANDOM_STREAM.cosmetic + ':' + cellId)`
([`ARCHITECTURE.md §6`](./ARCHITECTURE.md#6-client-module-plan-pixi-v8--angular)) so a paused frame
reproduces; organelle slot centres never sit inside the nucleus disc, inside `DNA_RING_KEEP_OUT_FRACTION` (0.66 r,
`UI.md §9`: the own cell's DNA ring band, applied to every cell so a slot is one rule) nor within 8 % r of the
membrane.

## 4. Organelle vocabulary per trait

The trait's own `visual` string ([`TRAITS.md §3`](./TRAITS.md#3-build-1-catalog-sixteen-traits-fully-specified))
is the requirement; this table fixes the drawing. Colours are §2 constants; sizes are fractions of `r`.
The last column is what survives the mid LOD of §6 (the full-LOD tell is the drawing itself); "drops"
means the trait has no tell below 20 px and is read from the menu's trait list only (`UI.md §3.5`).

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

## 5. Membrane and motion language

Membranes are 36-point Catmull-Rom loops with Gaussian radial bumps (sheet 02, membranes paragraph);
every deformation below is a bump `(amplitude, centre angle, σ)` on that loop, never a vertex jump.
Scale pulses never exceed 1.14× and return through an overshoot ≤ 3 % (sheet 03, motion rules). Every
effect is a function of `t` and the cosmetic stream, so a replay renders identically.

| Motion                   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Home                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Rest (prokaryote +)      | breathing ±2 % r at 0.5 Hz, sine; nucleus drifts 2 % r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | sheet 01 motion table         |
| Rest (protocell)         | mode-2 wobble ±8 % r at 0.7 Hz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | sheet 04 motion table         |
| Rest (`cytoskeleton`)    | amplitude halves to ±1 % r; forms hold a mode-3 shape ±5 % r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | this doc, `WOBBLE_TAUT_SCALE` |
| Moving                   | stretch up to 1.22× along velocity, rear taper 0.72, both scaled by `speed / maxSpeed`; nucleus lags 20 % r; wake rings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | sheet 01 motion table         |
| Sprint                   | stretch scale ×1.06 on top, rim light +20 % brightness, flagellum amplitude ×2 for `SPRINT_DURATION_SECONDS`, then ease-out-quad 200 ms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | this doc                      |
| Contact dent (cell–cell) | dimple −12 % r (σ 22 °) toward the other cell while `ECOLOGY.md §5.3` separation applies; `cytoskeleton` sharpens to σ 14 °                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | this doc, reuses eat dimple   |
| Eat (mote)               | sheet 03 strip A: 300 ms, interruptible, plays on every mote; mass is added the same tick, the strip is cosmetic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | sheet 03 strips table         |
| Engulf (cell)            | sheet 03 strip B, **driven by `engulfProgress`, not the clock**: cover over 0 → 1/6 (membrane lies over the prey, no arms), wrap over 1/6 → 0.5 (arms and notch are functions of progress, so a progress decay plays backwards), the seal bulge at 0.5 and dissolve over 0.5 → 1.0 (`engulfPhaseOf`, `ECOLOGY.md §6.1`); dissolve → DNA streams → done is a 600 ms effect at payout. Sheet 03's "the escape window closes at the seal frame" now holds for movement: after 0.5 the prey is carried; a `cell_released` (`escaped`, `spat_out`, `ratio`, `aborted`) snaps the arms back over 150 ms, and `spat_out` adds a short outward puff on the predator's rim | sheet 03 deformation values   |
| Absorbed (prey)          | the dissolve keyframe: rim dashes, cytoplasm → 50 %, 200 ms linear, then detritus scatters. The prey entity is removed on the payout tick (`cell_absorbed`, `ECOLOGY.md §6.1`), so this plays on a **client-side ghost** built from the effect, not on the entity; evidence replays it from the effect log, not from a snapshot                                                                                                                                                                                                                                                                                                                                   | sheet 03 strip B              |
| Level-up                 | sheet 03 strip C: 900 ms, not interruptible, then the picker opens; the sim keeps running                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | sheet 03 strips table         |
| Organelle birth          | at the endosymbiont pick: a rod-shaped ghost shrinks 44 % → 30 % r and folds into the bean / lens over 3 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | sheet 04 motion table         |
| Respawn                  | alpha 0 → 1 ease-out-quad 400 ms, scale 0.6 → 1.0 ease-out-back 400 ms, halo bloom at 2 r fading over the same time                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | this doc                      |
| Zone entry               | no membrane change; the zone's cloud brightens 20 % under the cell for 300 ms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | this doc                      |
| Engulf warning           | `DANGER` dashed ring (6 5, px), 2 px, rotating 12 °/s, around every on-screen cell for which `canEngulf(cell, own, balance.absorption)` holds (the shared predicate of `ECOLOGY.md §6.1`, `shared/simulation/engulf-eligibility.ts`; the same call the server's engulf system and the HUD danger chip make, so ring, chip and engulf never disagree; a Cell Wall III player sees fewer rings). Radius = the predator's on-screen radius × `ENGULF_WARNING_RING_RADII` 1.3, floor `ENGULF_WARNING_RING_MIN_PX` 24, so it sits just outside the 1.28 r halo at every size; sheet 03's 64 px was a 0.37-scale mock and is superseded                                 | this doc                      |

Ambient motion is never static: motes breathe ±6 % at 0.3–0.6 Hz (phase per mote from the cosmetic
stream), bacteria tumble ±15 ° as they random-walk, DNA fragments rotate 20 °/s, vent glints flicker
at 6–9 Hz, depth particles drift 2–4 wu/s, wall bubbles rise 1 wu/s and respawn at the bottom.

## 6. Legibility at play scale

Zoom is `GAME-DESIGN.md §7`'s camera: at 1080p it runs from 1.8 px/wu (spawn, view floor) down to
0.36 px/wu (view ceiling), and the player's own cell is 32–45 px in radius for most of a round
(102 px at `CELL_MAX_MASS`). Other cells and food can be far smaller, so:

| Rule                 | Value                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cell LOD             | on-screen radius ≥ `CELL_LOD_FULL_MIN_PX` 20: full stack; `CELL_LOD_FAR_MAX_PX` 8 to 20 px: the mid-LOD set below; < 8 px: sheet 02 far dot                                                                                                                                                                                                                                                                                       |
| Mid LOD (8–20 px)    | **kept:** halo, body as a flat gradient, rim, outline with its silhouette deformation (forms, stretch, dents, taut wobble), nucleus / nucleoid as one disc, flagellum and cilia (as one band) polylines, `cell_wall` second rim, the 1.39 r trait halo, seat mark, self ring, engulf ring. **dropped:** cytoplasm texture, granules, organelles, envelope pores, filaments, ribosome stipple, nucleolus, prey-through-film redraw |
| Far dot              | rim-colour dot, `CELL_FAR_DOT_MIN_PX` 3 floor, halo ×3, no interior, no seat mark (§2); the own cell never reaches this LOD                                                                                                                                                                                                                                                                                                       |
| Mote floor           | core never below `MOTE_CORE_MIN_PX` 2, wide halo never below 6 px; below zoom 0.5 the sprite is the pre-rendered small variant (§8)                                                                                                                                                                                                                                                                                               |
| Silhouette tells     | every rung and form owns one outline change ([`TRAITS.md §3.17`](./TRAITS.md#317-exclusions-and-pairings-at-a-glance)); §4's last column names what each keeps at mid LOD                                                                                                                                                                                                                                                         |
| Interior-only traits | a doubled rim (`cell_wall`) or a trait-colour halo at 1.39 r (`chloroplast`, `toxin_vacuole`) per sheet 01's trait legibility; the other interior traits drop at mid LOD by design                                                                                                                                                                                                                                                |
| Player tells         | seat mark and self ring (§2) at every LOD ≥ 8 px; below that, hue and the leaderboard swatch only                                                                                                                                                                                                                                                                                                                                 |
| Prey through film    | an engulfed prey's rim and nucleus glint are redrawn at 62 % over the predator body (sheet 02, prey row) until the payout                                                                                                                                                                                                                                                                                                         |
| Food silhouettes     | circle (algae), oily ellipse (detritus), rod (bacterium), helix (DNA): readable at the 2 px floor without colour                                                                                                                                                                                                                                                                                                                  |
| HUD exclusion        | no DOM is drawn inside the `HUD_PLAYER_EXCLUSION_PX` box around the player cell (`UI.md` owns the number); the own cell's progress indicators live inside it by design (`UI.md §3.1`, `RENDERING.md §10`)                                                                                                                                                                                                                         |
| Contrast             | every rim is ≥ `RIM_MIN_CONTRAST` 4.5:1 against `BG_FIELD` (measured 10.7–16.4); bases range 4.0 (Violet) to 10.1 (Mint) and are held to ≥ 4.0; UI text uses sheet 03's text roles only                                                                                                                                                                                                                                           |

## 7. UI colours and type

Panels, text, chips and bars use sheet 03's palette table and the HUD / trait-picker layouts. **Ownership
(architect decision on #125): this doc owns every colour (§2) and the type scale and fonts below; `UI.md`
(#30, `feat/30-ui-design`) cites colour and type roles by name and owns placement, per-element sizes
other than type, and `HUD_PLAYER_EXCLUSION_PX`.** Type is a system stack, no web fonts and no font files:
`UI_FONT_SANS` = `Inter, "Segoe UI", system-ui, sans-serif` for labels and body, `UI_FONT_MONO` =
`"JetBrains Mono", ui-monospace, monospace` for numbers that change (mass, timer, DNA %), so digits do
not jitter. The type scale (`UI_TYPE_*`, px at HUD scale 1):

| Role        | px  | Face | Used for                                             |
| ----------- | --- | ---- | ---------------------------------------------------- |
| `number`    | 28  | mono | level number, mass value                             |
| `headline`  | 26  | sans | results winner line                                  |
| `clock`     | 24  | mono | round timer                                          |
| `value`     | 20  | mono | secondary numbers (DNA count, sprint meter, scores)  |
| `title`     | 22  | sans | overlay titles (respawn, menu)                       |
| `card_name` | 16  | sans | trait card name                                      |
| `body`      | 14  | sans | body text, hint pill                                 |
| `label`     | 12  | sans | labels, uppercase tracked 0.08 em; the reading floor |
| `caption`   | 11  | sans | key hints, muted captions; never carries a fact      |

Colour roles: the own row
on the leaderboard is tinted with the player's own rim colour @12 %; a player swatch is the palette base
with a rim-colour ring and the seat-mark bead count of §2; danger, gold and DNA are the only saturated UI
colours; the rest of the overlay is the `PANEL_TOP` → `PANEL_BOTTOM` panel with the `PANEL_RIM` rim so the
dish stays the brightest thing on screen.

## 8. Performance intent: geometry, textures, shaders

> **Superseded in means, not in intent, by [`RENDERING.md`](./RENDERING.md) (#120):** cells are one quad + fragment
> shader each (the layer stack as distance bands, deformations as terms of `r(θ)`), organelles are sprites mapped
> through the deformation, cilia and speckle are shader patterns. The rules below that say _what_ is cached and
> _what_ is never done per frame still hold; the "36-point `Graphics` membrane" and "one shader effect" lines are
> the pre-#120 plan.

The frame budget is `ARCHITECTURE.md §6` (60 fps, ≤ 12 ms p95 at 8 cells + 1 400 motes). To hold it:

- **Built once, blitted per frame (render textures):** the dish field with its zone tints and noise
  clouds, mire strands, the vent crust and the wall (one texture per zoom band, rebuilt only when the
  camera crosses a band); the condenser light pool with its caustics as one view-anchored sprite over
  the field (§1, `RENDERING.md §6.1`); the vignette; every glow halo as a radial-gradient
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
