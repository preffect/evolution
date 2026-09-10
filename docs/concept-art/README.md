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
