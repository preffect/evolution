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
Penner names (`render/easing.ts` holds the curves; no inline cubic-bezier literals).

## 1. Dark-field microscopy: the principles

The dish is a dark-field microscope stage: a black field, and only what scatters light is visible.

- **Light comes from the top-left**, one direction, for everything: the condenser light pool on the
  field, the specular glint on every cell and mote, the light pool / dark pool that gives a body its
  volume (sheet 01, design decisions). Nothing is lit from below or from the right.
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
from any other direction; outlines heavier than the sheet-01 outline layer; a raster texture or
bitmap of any kind; text or UI inside the play area (the debug layer excepted); colour as the only
tell for a stage, trait or player (§6); camera shake (a microscope stage does not move); hue-cycling
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
| `viscous_gel`     | viscous mire    | `ZONE_GEL` `#b070ff`      | three discs with mire strands                            |
| `open_broth`      | (none)          | none                      | base mote density only                                   |

**Food** ([`ECOLOGY.md §1`](./ECOLOGY.md#1-food-kinds) owns kinds, radii and motion; sheet 02's
mote table owns core / edge / rim / glow for the looks it drew). Sheet 02 predates the food table, so:

| Kind                       | Look                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Algae mote                 | sheet 02 algal mote (`FOOD_MOTE` `#8dff6a` core), circle                                                                                 |
| Detritus mote              | sheet 02 lipid mote (`LIPID_BASE` core, `#c88a2a` centre, `LIPID_LIGHT` rim), oily ellipse; fades out over the last 20 % of its lifetime |
| DNA fragment               | sheet 02 helix (`DNA_STRAND_LIGHT` `#f0b8ff` / `DNA_STRAND` `#d36bff`); rungs and wide halo take the tag colour below                    |
| Bacterium `plain`          | rod 2:1 with rounded ends, body `BACTERIUM_PLAIN` `#cfefff` @55 %, rim `PROTO_FILM` `#8fd3e3`, one glint                                 |
| Bacterium `aerobic`        | rod, body `MITO_BASE`, hot rim `MITO_LIGHT`, halo `MITO_BASE` @30 %                                                                      |
| Bacterium `photosynthetic` | rod, body `CHLORO_BASE`, three `CHLORO_DARK` bands, rim `CHLORO_LIGHT`, halo `CHLORO_LIGHT` @30 %                                        |

Sheet 02's mineral diamond and sheet 04's purple bacterium are retired: the aerobic rod is already
mitochondrion-coloured so "eat the orange rods, get the orange bean" is one lesson, not two.

**DNA tag colours** (`DNA_TAG_COLOR`, keyed by `DnaTag`): fragments show their tag in the helix rungs
and wide halo; the trait picker reuses them for tag chips (`UI.md`).

| Tag         | Hex       | Borrowed from            |
| ----------- | --------- | ------------------------ |
| `motile`    | `#a6f4ff` | `FLAGELLUM` / `CILIA`    |
| `metabolic` | `#ffb15a` | `MITO_BASE`              |
| `photic`    | `#b8ff9a` | `CHLORO_LIGHT`           |
| `predatory` | `#ff5470` | `DANGER`                 |
| `toxic`     | `#d05cff` | `TOXIN_GLOW`             |
| `sensory`   | `#9ad7ff` | the retired mineral mote |
| `armored`   | `#9fb0c4` | `MAGNET_LIGHT`           |

**Organelles and stage parts.** Sheet 01's shared organelle table (`MITO_*`, `VAC_*`, `LIPID_*`,
`CHLORO_*`, `TOXIN_*`, `MAGNET_*`) and sheet 04's constants table (`PROTO_*`, `NUCLEOID_*`,
`RIBOSOME`, `CELL_WALL*`, `FLAGELLUM`, `ENVELOPE` / `PORE`, `CYTOSKELETON`, `CILIA`, `SILICA_*`,
`DIATOM_PLASTID_*`, `EYESPOT*`). Two of those are the **cyan instance of a palette rule**, not
constants: the protocell film is the player's rim colour @55 % (film light `#ffffff` @70 %), and the
nucleoid glow is the player's rim colour (strand `NUCLEOID_STRAND` stays near-white). Everything else
in those tables is palette-independent so organelles look the same inside every player.

**Player palettes.** `PLAYER_PALETTE_COUNT` is `MAX_PLAYERS_PER_GAME` (8) by construction, and
`AVATAR_INDEX_MAX` in `constants/lobby.ts` derives from it as `PLAYER_PALETTE_COUNT − 1` (today it is
a literal 5 and must follow). Six ramps are sheet 01's player-palette table; two are new. Derived
shades (edge, cytoplasm light / dark, nucleus dark) follow sheet 01's HSL rule and are computed in
`render/palette.ts`, never listed. Palette index is seat order, arranged so every neighbour pair is
far apart on the hue wheel:

| Index | Name    | base      | rim       | nuc       | Source   |
| ----- | ------- | --------- | --------- | --------- | -------- |
| 0     | Cyan    | sheet 01  |           |           |          |
| 1     | Coral   | sheet 01  |           |           |          |
| 2     | Lime    | sheet 01  |           |           |          |
| 3     | Violet  | sheet 01  |           |           |          |
| 4     | Amber   | sheet 01  |           |           |          |
| 5     | Azure   | `#2a74f4` | `#b2cfff` | `#71a1f4` | new, #34 |
| 6     | Magenta | sheet 01  |           |           |          |
| 7     | Mint    | `#24db98` | `#b2ffe3` | `#71f4c4` | new, #34 |

Evidence render of all eight on the field: `qa/evidence/34/player-palettes.png`. The own cell always
carries the identity ring (`#a6f4ff`, sheet 02 inset) at far LOD, so hue is never the only tell.

**Effects and UI.** `DANGER` `#ff5470` (engulf warning ring, toxin damage flash), `LEVEL_GOLD`
`#ffe08a` (level ring full, anticipation ring, timer bar), `DNA` `#d36bff` / `DNA_DEEP` `#6b2ea6`
(DNA ring, streams), the panel and text roles: sheet 03's palette table. `UI_ACCENT` is `LIGHT_ACCENT`.

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
reproduces; organelles never sit inside the nucleus disc nor within 8 % r of the membrane.

## 4. Organelle vocabulary per trait

The trait's own `visual` string ([`TRAITS.md §3`](./TRAITS.md#3-build-1-catalog-sixteen-traits-fully-specified))
is the requirement; this table fixes the drawing. Colours are §2 constants; sizes are fractions of `r`.

| Trait               | Drawing                                                                                                                       | Tier progression                     | Distance tell (§6)               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------- |
| `nucleoid`          | glow strand loop, r 34 %, `NUCLEOID_STRAND` on the palette rim glow, drifting 2 % r                                           | 1 / 2 / 3 interlaced loops           | thread inside a bare blob        |
| `simple_flagellum`  | `FLAGELLUM` 3 px white core, 2 r long, 2 sine waves opposite velocity                                                         | amplitude ×1 / 1.5 / 2; III: 2 tails | teardrop silhouette              |
| `cell_wall`         | `CELL_WALL` rigid band 4.5 % r at +5 % r, `CELL_WALL_LIGHT` hairline                                                          | rim thickness ×1.5 / 2 / 2.5         | double rim                       |
| `ribosomes`         | `RIBOSOME` dots 2 px @35–80 % inside the membrane                                                                             | ~20 / 40 / 60 dots                   | stipple                          |
| `mitochondrion`     | `MITO_*` bean with 3 cristae stripes, warm glow; pulses 1.15× on sprint                                                       | 1 / 2 / 3 beans                      | orange bean                      |
| `chloroplast`       | `CHLORO_*` lens with 6 granules on the lit edge; brighter in `sunlit_shallows` (+40 % glow)                                   | 1 / 2 / 3 lenses                     | green lens, green-shifted rim    |
| `nuclear_envelope`  | `ENVELOPE` double line + 16 `PORE` gaps around the nucleus; rim brightness +0 / 10 / 20 %                                     | pores 16 / 20 / 24                   | bounded nucleus                  |
| `cytoskeleton`      | `CYTOSKELETON` filaments nucleus → rim @28 %; wobble amplitude halves, dent σ tightens (§5)                                   | 11 / 15 / 19 filaments               | taut outline                     |
| `cilia`             | `CILIA` hairs 12 % r leaning 30 °, travelling-wave beat, wave speed ∝ velocity                                                | 24 / 36 / 48 hairs                   | fuzzy edge                       |
| `food_vacuole`      | `MITO_BASE` bubbles 12 % r that rise and pop every 2 s                                                                        | 2 / 3 / 4                            | orange bubbles                   |
| `toxin_vacuole`     | one `TOXIN_BASE` bladder 34 % r, `TOXIN_RIM`, pulsing 1.0 → 1.08 at 1 Hz, leaking 3 wisps                                     | wisp count 3 / 5 / 7                 | violet pulse + `TOXIN_GLOW` halo |
| `amoeba_pseudopods` | sheet 04 amoeba: lobes toward velocity and toward engulfed prey, `#dff0ff` @14 % ectoplasm rim                                | 2 / 3 / 4 lobes                      | lobes                            |
| `paramecium_cilia`  | sheet 04 paramecium: slipper aspect 1.6 / 1.8 / 2.0, 120 cilia, oral groove, macro + micronucleus                             | aspect per tier                      | slipper                          |
| `euglena_eyespot`   | sheet 04 euglena: spindle, `EYESPOT` at the front, leading flagellum 40 wu, 6 chloroplasts                                    | eyespot glow +0 / 25 / 50 %          | spindle + red dot                |
| `diatom_shell`      | sheet 04 diatom: `SILICA_*` valve with 36 striae, `DIATOM_PLASTID_*`; **8 / 12 / 16 radial spines with bright tips** (TRAITS) | spine count                          | star                             |
| `stentor_trumpet`   | sheet 04 stentor: trumpet, 44 membranelles, 7-bead macronucleus, `TOXIN_GLOW` @8 % haze to `toxinAuraRangeInRadii`            | haze radius per tier                 | trumpet                          |

## 5. Membrane and motion language

Membranes are 36-point Catmull-Rom loops with Gaussian radial bumps (sheet 02, membranes paragraph);
every deformation below is a bump `(amplitude, centre angle, σ)` on that loop, never a vertex jump.
Scale pulses never exceed 1.14× and return through an overshoot ≤ 3 % (sheet 03, motion rules). Every
effect is a function of `t` and the cosmetic stream, so a replay renders identically.

| Motion                   | Rule                                                                                                                                                                                                                                                          | Home                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Rest (prokaryote +)      | breathing ±2 % r at 0.5 Hz, sine; nucleus drifts 2 % r                                                                                                                                                                                                        | sheet 01 motion table         |
| Rest (protocell)         | mode-2 wobble ±8 % r at 0.7 Hz                                                                                                                                                                                                                                | sheet 04 motion table         |
| Rest (`cytoskeleton`)    | amplitude halves to ±1 % r; forms hold a mode-3 shape ±5 % r                                                                                                                                                                                                  | this doc, `WOBBLE_TAUT_SCALE` |
| Moving                   | stretch up to 1.22× along velocity, rear taper 0.72, both scaled by `speed / maxSpeed`; nucleus lags 20 % r; wake rings                                                                                                                                       | sheet 01 motion table         |
| Sprint                   | stretch scale ×1.06 on top, rim light +20 % brightness, flagellum amplitude ×2 for `SPRINT_DURATION_SECONDS`, then ease-out-quad 200 ms                                                                                                                       | this doc                      |
| Contact dent (cell–cell) | dimple −12 % r (σ 22 °) toward the other cell while `ECOLOGY.md §5.3` separation applies; `cytoskeleton` sharpens to σ 14 °                                                                                                                                   | this doc, reuses eat dimple   |
| Eat (mote)               | sheet 03 strip A: 300 ms, interruptible, plays on every mote; mass is added the same tick, the strip is cosmetic                                                                                                                                              | sheet 03 strips table         |
| Engulf (cell)            | sheet 03 strip B, **driven by `engulfProgress`, not the clock**: contact → wrap over 0 → 0.5, seal over 0.5 → 1.0 (arms and notch are functions of progress, so a progress decay plays backwards); dissolve → DNA streams → done is a 600 ms effect at payout | sheet 03 deformation values   |
| Absorbed (prey)          | the dissolve keyframe: rim dashes, cytoplasm → 50 %, 200 ms linear, then detritus scatters                                                                                                                                                                    | sheet 03 strip B              |
| Level-up                 | sheet 03 strip C: 900 ms, not interruptible, then the picker opens; the sim keeps running                                                                                                                                                                     | sheet 03 strips table         |
| Organelle birth          | at the endosymbiont pick: a rod-shaped ghost shrinks 44 % → 30 % r and folds into the bean / lens over 3 s                                                                                                                                                    | sheet 04 motion table         |
| Respawn                  | alpha 0 → 1 ease-out-quad 400 ms, scale 0.6 → 1.0 ease-out-back 400 ms, halo bloom at 2 r fading over the same time                                                                                                                                           | this doc                      |
| Zone entry               | no membrane change; the zone's cloud brightens 20 % under the cell for 300 ms                                                                                                                                                                                 | this doc                      |
| Engulf warning           | `DANGER` dashed ring (6 5) at 64 px, rotating 12 °/s, on every cell whose mass ≥ yours × `ENGULF_MASS_RATIO`                                                                                                                                                  | sheet 03 HUD                  |

Ambient motion is never static: motes breathe ±6 % at 0.3–0.6 Hz (phase per mote from the cosmetic
stream), bacteria tumble ±15 ° as they random-walk, DNA fragments rotate 20 °/s, vent glints flicker
at 6–9 Hz, depth particles drift 2–4 wu/s, wall bubbles rise 1 wu/s and respawn at the bottom.

## 6. Legibility at play scale

Zoom is `GAME-DESIGN.md §7`'s camera: at 1080p it runs from 1.8 px/wu (spawn, view floor) down to
0.36 px/wu (view ceiling), and the player's own cell is 32–45 px in radius for most of a round
(102 px at `CELL_MAX_MASS`). Other cells and food can be far smaller, so:

| Rule                 | Value                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cell LOD             | on-screen radius ≥ `CELL_LOD_FULL_MIN_PX` 20: full stack; 8–20 px: halo, body, rim, nucleus / nucleoid only; < `CELL_LOD_FAR_MAX_PX` 8: sheet 02 far dot |
| Far dot              | rim-colour dot, `CELL_FAR_DOT_MIN_PX` 3 floor, halo ×3, no interior; own cell keeps the identity ring at 7.5 px                                          |
| Mote floor           | core never below `MOTE_CORE_MIN_PX` 2, wide halo never below 6 px; below zoom 0.5 the sprite is the pre-rendered small variant (§8)                      |
| Silhouette tells     | every rung and form owns one outline change ([`TRAITS.md §3.17`](./TRAITS.md#317-exclusions-and-pairings-at-a-glance)); it must survive the 8–20 px LOD  |
| Interior-only traits | carry a **distance tell**: a doubled rim (`cell_wall`) or a trait-colour halo at 1.39 r (`chloroplast`, `toxin_vacuole`) per sheet 01's trait legibility |
| Prey through film    | an engulfed prey's rim and nucleus glint are redrawn at 62 % over the predator body (sheet 02, prey row) until the payout                                |
| Food silhouettes     | circle (algae), oily ellipse (detritus), rod (bacterium), helix (DNA): readable at the 2 px floor without colour                                         |
| HUD exclusion        | nothing is drawn within ±120 px of the player cell (sheet 03 HUD)                                                                                        |
| Contrast             | every palette keeps the same lightness ramp (sheet 01), so a cell's rim is always ≥ 4.5:1 against `BG_FIELD`; UI text uses sheet 03's text roles only    |

## 7. UI colours and type

Panels, text, chips and bars use sheet 03's palette table and the HUD / trait-picker layouts; `UI.md`
(#30) owns layout and component specs. Type is a system stack, no web fonts and no font files:
`UI_FONT_SANS` = `Inter, "Segoe UI", system-ui, sans-serif` for labels and body, `UI_FONT_MONO` =
`"JetBrains Mono", ui-monospace, monospace` for numbers that change (mass, timer, DNA %), so digits
do not jitter. Sizes: number 28 px, title 22 px, label 12 px uppercase tracked 0.08 em, body 14 px.
Own-row tint on the leaderboard is the player's own rim colour @12 %; every other player swatch is
the palette base with a rim-colour ring. Danger, gold and DNA are the only saturated UI colours; the
rest of the overlay is the cool `#0e1f33` → `#060e1a` panel with the `#173250` rim so the dish stays
the brightest thing on screen.

## 8. Performance intent: geometry, textures, shaders

The frame budget is `ARCHITECTURE.md §6` (60 fps, ≤ 12 ms p95 at 8 cells + 1 400 motes). To hold it:

- **Built once, blitted per frame (render textures):** the dish field with its light pool, caustics,
  zone tints and noise clouds, mire strands, the vent crust and the wall (one texture per zoom band,
  rebuilt only when the camera crosses a band); the vignette; every glow halo as a radial-gradient
  sprite scaled to size; the cytoplasm noise as one seeded 256 × 256 tile, tinted per palette; every
  mote and bacterium as a pre-rendered sprite at 4 px/wu plus a small variant for zoom < 0.5, in a
  `ParticleContainer`; the eight far-LOD dots.
- **Geometry per frame (Pixi `Graphics` / mesh):** the 36-point membrane of every visible cell, its
  inner edge, rim gradient stroke and outline; organelles, nucleus, envelope and filaments at full LOD;
  cilia and flagella as polylines; the engulf-warning ring; effects rays and rings.
- **Filters (blur, turbulence) run only at texture build time**, never per frame on a cell. The
  wobble, stretch, dents and eat / engulf / level-up deformations are vertex maths on the loop; the
  glow "bloom" of a pulse is a halo sprite scaled up, not a filter.
- **Shader effects are limited to two:** the vent heat shimmer (a displacement over the cached vent
  texture) and the trait-picker dim (a full-screen 55 % black quad). Anything else proposed as a
  shader is a ticket, not a PR.
- Depth particles and bokeh are `ParticleContainer`s with no per-particle state beyond position and
  phase.

## 9. Per-asset checklist (graphics-qa reviews against this, after `ASSET-GENERATION.md §6`)

- [ ] Light from the top-left only: glint top-left, dark pool bottom-right, rim brightest top-left and never dark opposite.
- [ ] Every glow is core + soft halo + wide halo + glint from a cached sprite; no per-frame blur filter.
- [ ] Every colour is a `render/constants.ts` name from §2 or a sheet table; derived shades come from `render/palette.ts`.
- [ ] Dimensions are fractions of `r` (cells) or wu (world) from the sheet tables; nothing hard-coded in px except the LOD floors of §6.
- [ ] The stage shows exactly the layers of §3 (a protocell has no nucleus; a nucleus has an envelope only from `nuclear_envelope`).
- [ ] Each trait draws its §4 vocabulary and its tier progression, and its distance tell survives the 8–20 px LOD.
- [ ] Idle motion per §5 (breathing / wobble / ambient) is driven by `t` and the cosmetic stream; a paused replay frame reproduces.
- [ ] Deformations are Gaussian bumps on the 36-point loop with the sheet-03 amplitudes and easings; pulses ≤ 1.14×, overshoot ≤ 3 %.
- [ ] The silhouette reads alone at 1 px/wu (compare against sheet 04's top row) and the far dot at zoom 0.36.
- [ ] Translucency holds: the field, motes and an engulfed prey show through the body.
- [ ] Evidence: a 1080p screenshot at zoom 1.8, 1.0 and 0.36 plus a motion capture for any new deformation, under `qa/evidence/<ticket>/` and in the PR body.
