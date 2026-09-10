# Concept art

Code-drawn concept sheets for Evolution. Every sheet is a hand-authored SVG (gradients, blur and
turbulence filters, layered shapes, zero raster content) with a 1920 × 1080 PNG render committed
next to it. The SVG is the source of truth; re-render the PNG with headless Chromium after editing:

```bash
/opt/playwright/chromium-*/chrome-linux64/chrome --headless=new --no-sandbox --disable-gpu \
  --hide-scrollbars --window-size=1920,1080 --screenshot=docs/concept-art/<sheet>.png \
  "file://$PWD/docs/concept-art/<sheet>.svg"
```

Sheets feed `docs/VISUAL-STYLE.md` (#34) and the Pixi renderer (#99). Sizes are in **world units
(wu)**: 1 wu = 1 px at camera zoom 1.0. Each sheet states the px / wu it is drawn at.

## Sheet 01 — the cell (`cell-sheet.svg`, #104)

![cell sheet](./cell-sheet.png)

Fixes the cell language: dark-field microscopy, light from the top-left with rim scatter all
around, a translucent layered membrane, textured cytoplasm, a nucleus and four organelle types.

**Panels**

- **A · Anatomy** — level-5 cell (r = 32 wu) at 4 px / wu, every layer annotated with hex + size.
- **B · Size tiers** — the same cell at level 1 / 5 / 10 (r = 16 / 32 / 64 wu, mass 1× / 4× / 16×;
  radius grows with √mass). Organelle count grows with level: L1 two lipid droplets; L5 adds two
  mitochondria and a vacuole; L10 adds four mitochondria and a vacuole.
- **C · Layer stack** — the eleven draw layers, back to front, for the renderer to mirror.
- **D · Membrane states** — rest, moving fast, squash on eat, stretched while engulfing.
- **E · Player palettes** — six avatar hues, each a base / rim / nucleus ramp.
- **F · Trait variants** — spikes, cilia, flagellum, thick membrane, photosynthetic pigment,
  toxin vacuole, magnetic core, split nucleus, all on the level-5 body.

**Cell proportions (fractions of cell radius r)**

| Element            | Size                                                              |
| ------------------ | ----------------------------------------------------------------- |
| Glow halo          | r × 1.28, blur ≈ 12 % r, rim colour @34 % → 0                     |
| Membrane thickness | 11 % r inner edge band, 5 % r rim-light stroke                    |
| Outline            | `#020509`, max(0.8 px, 1.2 % r) @50 %                             |
| Nucleus            | 30 % r, offset 12 % r toward the light; nucleolus 22 % of nucleus |
| Mitochondrion      | 16 % r long, 8 % r wide                                           |
| Vacuole            | 17 % r                                                            |
| Lipid droplet      | 5–7 % r                                                           |
| Ribosome granules  | 1.2–2.2 % r, about 6 + r / 6 of them                              |
| Specular glint     | ellipse 22 % × 8 % r at top-left, blur 1.5 px, white @50 %        |

**Membrane motion**

| State  | Deformation                                                                                               |
| ------ | --------------------------------------------------------------------------------------------------------- |
| Rest   | breathing ±2 % r at 0.5 Hz, sine ease; nucleus drifts slowly                                              |
| Moving | stretch 1.22× along velocity, rear tapers to 0.72; nucleus lags 20 % r; wake rings and ghost trail behind |
| Eat    | dent 26 % r at the contact point, side bulges 8 %; three ripple rings over 180 ms                         |
| Engulf | lobes reach +50 % r around the prey, waist −34 %; 0.5–1.5 s; prey rim stays visible through the film      |

**Player palettes** (base = membrane body, rim = rim light, nuc = nucleus; darker shades derived
in HSL: edge = 42 % lightness, cyto light = 55 %, cyto dark = 22 % lightness / 55 % saturation)

| Player  | base      | rim       | nuc       | edge      | cyto light | cyto dark | nuc dark  |
| ------- | --------- | --------- | --------- | --------- | ---------- | --------- | --------- |
| Cyan    | `#22c1d6` | `#a6f4ff` | `#6fdcef` | `#124e56` | `#1d636c`  | `#102426` | `#167787` |
| Magenta | `#d43fb0` | `#ffb3ec` | `#f07ad2` | `#5b194b` | `#72255f`  | `#291424` | `#8c176e` |
| Amber   | `#e0a12a` | `#ffe7a3` | `#f5c85c` | `#5d4312` | `#75571d`  | `#292111` | `#88650f` |
| Lime    | `#7ed321` | `#dcffb0` | `#b5ef62` | `#355512` | `#456a1c`  | `#1b2610` | `#568314` |
| Violet  | `#7b5cf0` | `#d2c4ff` | `#a995ff` | `#27127a` | `#381f98`  | `#1b1435` | `#2809ad` |
| Coral   | `#ff6b5c` | `#ffd0c8` | `#ff9a8c` | `#8a1307` | `#ac2113`  | `#3b1511` | `#a91c09` |

**Shared organelle and environment colours**

| Constant                     | Hex                               |
| ---------------------------- | --------------------------------- |
| `BG_DEEP` / `BG_FIELD`       | `#04070d` / `#0b1626`             |
| `MITO_LIGHT / BASE / DARK`   | `#ffd39a` / `#ffb15a` / `#b85c16` |
| `VAC_BASE / VAC_RIM`         | `#a8d8ff` (8–45 %) / `#dff0ff`    |
| `LIPID_LIGHT / LIPID_BASE`   | `#fff8d0` / `#f2c94c`             |
| `CHLORO_LIGHT / BASE / DARK` | `#b8ff9a` / `#63d64a` / `#1f7a2b` |
| `TOXIN_BASE / RIM / GLOW`    | `#a338e0` / `#f0b8ff` / `#d05cff` |
| `MAGNET_LIGHT / BASE / DARK` | `#9fb0c4` / `#4a5866` / `#141a22` |
| `FOOD_MOTE`                  | `#8dff6a`                         |
| Sheet text / muted / accent  | `#cfdbe6` / `#7d8da1` / `#7fe7f5` |

**Design decisions**

- Dark-field means the whole rim scatters light: the rim stroke is a white → rim → base → rim
  gradient so the top-left is brightest but the far side never goes dark.
- The body gradient is translucent (42–85 % alpha) so the dish shows through; volume comes from a
  blurred dark ellipse at the bottom-right and a light pool at the top-left, not from opacity.
- Organelles are warm (mitochondria, lipids) against a cool membrane so the interior reads as
  alive at any palette; only chloroplasts, toxin and the magnetic core recolour the interior.
- Traits change the silhouette first (spikes, cilia, flagellum, peanut split) and the interior
  second, so they stay readable at 10 px on screen.
- Six palettes are spaced around the hue wheel with no two neighbours adjacent, and each keeps
  the same lightness ramp so every player cell has identical contrast against the dark field.

## Sheet 03 — origins, the single-cell ladder (`origins-ladder.svg`, #114)

![origins ladder](./origins-ladder.png)

Defines the **level-1 look**: the player spawns as a bare protocell and evolves inside one cell.
The sheet reads left → right, top row then bottom row: protocell → prokaryote → endosymbiosis →
eukaryote → specialised forms. Every step keeps the sheet-01 layer stack (halo, body, noise,
organelles, inner edge, rim, outline, glint); the size tiers in sheet 01 are revised to start
from the protocell in a follow-up.

Re-render the PNG with `rsvg-convert -w 1920 -h 1080 docs/concept-art/origins-ladder.svg -o docs/concept-art/origins-ladder.png`
(headless Chromium from the block at the top also works and matches).

**The ladder** — what the player has at each step and which DNA unlocks it (DNA is absorbed from
prey; a _tag_ is the DNA family the prey carries)

| Step | Form              | Radius       | Drawn at    | Unlock                                                                | What changes                                                                                        |
| ---- | ----------------- | ------------ | ----------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1    | Protocell         | r ≈ 10 wu    | 10 px / wu  | none — the spawn form                                                 | lipid bilayer, faint cytoplasm, 3–6 granules, no nucleus; drifts and wobbles; eats motes by contact |
| 2    | Prokaryote        | r ≈ 14 wu    | 7.5 px / wu | level 2 · **motile** DNA (eat bacteria)                               | nucleoid loop, ribosome speckle; optional flagellum (motile) and rigid cell wall (armored)          |
| 3    | Endosymbiosis     | host r 18 wu | 3.7 px / wu | level 3 · **metabolic** DNA → mitochondrion, **photic** → chloroplast | engulf a purple bacterium (becomes a mitochondrion) or a cyanobacterium (becomes a chloroplast)     |
| 4    | Eukaryote         | r ≈ 24 wu    | 5 px / wu   | level 4 · **predatory** DNA (absorb a whole cell)                     | nuclear envelope with pores, cytoskeleton (shape control), vacuoles, cilia fringe                   |
| 5    | Specialised forms | 26–70 wu     | 3 px / wu   | level 6+ · a pair of tags per form (below)                            | the silhouette changes first so each form reads at 1 px / wu                                        |

**Specialised forms** (top row of panel 5 is the 1 px / wu silhouette the zoom-1.0 camera sees;
bottom row is the 3 px / wu detail, stentor at 2.7 px / wu because the trumpet is 70 wu tall)

| Form       | Size                     | Unlock (two tags)     | Signature parts                                                                                            |
| ---------- | ------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| Amoeba     | core 26 wu → 1.6 r lobes | predatory + metabolic | pseudopods, ectoplasm rim `#dff0ff` @14 %, food vacuole; engulf reach +60 % r, speed 0.7×                  |
| Paramecium | slipper 60 × 24 wu       | motile + sensory      | 120 cilia 3 wu, oral groove, macro + micronucleus; top speed 1.4×, turn rate 1.6×                          |
| Euglena    | spindle 50 × 16 wu       | photic + motile       | flagellum 40 wu, eyespot `#ff4d3a`, 6 chloroplasts; sees light zones, feeds while moving                   |
| Diatom     | silica valve r 26 wu     | armored + photic      | 36 striae shell `#eef9ff` / `#a9dcef` / `#2f6f8c`, golden plastids `#d7a441`; engulf threshold 1.6×, sinks |
| Stentor    | trumpet 70 wu, mouth 36  | sensory + predatory   | 7-bead macronucleus, 44 membranelles; anchors, pulls motes at 40 wu/s                                      |

**Sheet 03 colour constants** (the cyan player palette, organelle and environment constants are
the sheet-01 values above)

| Constant                            | Hex                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `PROTO_FILM` / `PROTO_FILM_LIGHT`   | `#8fd3e3` / `#d8f6ff` (bilayer, 2 films 2.5 % r apart)                   |
| `PROTO_GRANULE`                     | `#cfefff` (vesicles 4.5–6 % r; lipid droplets use `LIPID_*` 5 % r)       |
| `NUCLEOID_STRAND` / `NUCLEOID_GLOW` | `#e4faff` / `#7fe7f5` (loop r 34 %, no envelope)                         |
| `RIBOSOME`                          | `#a6f4ff` (2 px @35–80 %, ~40 dots)                                      |
| `CELL_WALL` / `CELL_WALL_LIGHT`     | `#4fb1c4` / `#bff2ff` (4.5 % r rigid band, +5 % r)                       |
| `FLAGELLUM`                         | `#a6f4ff` 3 px with a white core, 2 r long, 2 waves                      |
| `PURPLE_LIGHT / BASE / DARK / HALO` | `#ead7ff` / `#b06cf0` / `#4d1f8f` / `#d9b8ff` (purple bacterium, r 8 wu) |
| mitochondrion recolour ramp         | `#b06cf0` → `#ffb15a` over 3 s after engulfing                           |
| chloroplast recolour ramp           | `#63d64a` → `#b8ff9a` over 3 s after engulfing                           |
| `ENVELOPE` / `PORE`                 | `#dff8ff` ×2 lines / `#7fe7f5`, 16 pores, gaps 3 px                      |
| `CYTOSKELETON`                      | `#7fe7f5` 1.1 px @28 %, 11 filaments nucleus → rim                       |
| `CILIA`                             | `#a6f4ff` 1.2 px @75 %, 64 hairs 12 % r, lean 30°                        |
| `SILICA_LIGHT / BASE / DARK`        | `#eef9ff` / `#a9dcef` / `#2f6f8c`                                        |
| `DIATOM_PLASTID_LIGHT / DARK`       | `#d7a441` / `#8a5e14`                                                    |
| `EYESPOT` / `EYESPOT_RIM`           | `#ff4d3a` / `#ffb59e`                                                    |
| `SILHOUETTE`                        | `#22c1d6` (1 px / wu camera silhouettes)                                 |
| Panel / panel stroke                | `#0a1422` @45 % / `#1a2a3b`                                              |

**Motion** (level 1 and 2)

| State           | Rule                                                                                 |
| --------------- | ------------------------------------------------------------------------------------ |
| Protocell drift | random walk at 12 wu/s; mode-2 wobble ±8 % r at 0.7 Hz (rest / wobble + / wobble −)  |
| Protocell eat   | contact with any food mote                                                           |
| Bacterium prey  | drifts in at 20 wu/s; the host engulfs with lobes +50 % r and waist −34 % over 1.2 s |
| Organelle birth | the engulfed bacterium shrinks 44 % → 30 % r and recolours along its ramp in 3 s     |

**Design decisions**

- The protocell is deliberately _emptier_ than sheet 01's level 1: body alpha 16–26 % instead of
  42–55 %, a double film instead of the rim-light stack, granules instead of organelles. The
  player must feel the first nucleus arrive.
- The nucleoid is a loose loop drawn with a glow strand, never a filled disc, so the difference
  between prokaryote (step 2) and eukaryote (step 4) is a silhouette difference, not a colour.
- Endosymbiosis keeps the prey's hue through the engulf (purple / green stays visible under the
  host film) and only recolours once it is inside; the purple → amber ramp is what tells the
  player a mitochondrion was born rather than a meal digested.
- Specialised forms change the silhouette first (pseudopods, slipper, spindle, disc, trumpet) so
  they read at 1 px / wu, then add interior detail; the stentor is the only form drawn at a
  smaller scale on the sheet because its 70 wu height is the tallest thing in the game.
- Unlock tags are DNA families (motile, metabolic, photic, predatory, sensory, armored); every
  step 5 form needs two, so no single prey type unlocks a whole body plan.
