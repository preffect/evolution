# Evolution — Visual Style: dark-field principles and palette

§1–§2 of the split [`VISUAL-STYLE.md`](../VISUAL-STYLE.md), which keeps the shared context and the file list.

## 1. Dark-field microscopy: the principles

The dish is a dark-field microscope stage: a black field, and only what scatters light is visible.

- **Light comes from the top-left**, one direction, for everything: the condenser light pool on the
  field, the specular glint on every cell and mote, the light pool / dark pool that gives a body its
  volume (sheet 01, design decisions). Nothing is lit from below or from the right.
- **The condenser pool is anchored to the view, never to the world** (#222, option A; built by #242). A condenser
  lights whatever sits under the objective, so the pool covers the top-left of the _view_ at every
  zoom and follows the camera; a cell in the shallows is lit from the same corner as one at the vent.
  Sheet 02's ellipse (radii 980 × 760 wu, centred (380, 200) in its 1920 × 1080 wu scene) is read as
  fractions of the viewport: centre `LIGHT_POOL_VIEW_CENTRE` (0.20 of the width, 0.185 of the
  height), radii `LIGHT_POOL_VIEW_RADII` (0.51 of the width, 0.70 of the height), `LIGHT_ACCENT` at
  `LIGHT_POOL_ALPHA` 9 % → `LIGHT_POOL_MID` 3 % at half the radius → 0, normal blend, no mask (the
  stage outside the wall is lit too: a condenser lights the stage, not the dish). The three caustic
  sweeps (`CAUSTIC_SWEEPS`, `CAUSTIC_ALPHA` 5 %) are the light, not the water, and ride with it; the
  sheet's `#beam` wedge across the top-left corner is sheet dressing, not part of the pool. The
  pool is drawn over the field and under everything that lives in the dish (motes, fragments, cells,
  the vent, the depth particles) so it lights the water and never the bodies; the vignette stays above
  everything and is **0 % at the pool's brightest point** (the centre sits at 0.62 of the half-diagonal and
  `VIGNETTE_BAKE` is clear to 0.72): it dims only the pool's outer top-left quadrant, rising to 55 % at the
  corner. Where the shallows annulus
  crosses it the zone tint and the pool stack (16 % + 9 % at most) and nothing clamps them: the ≤ 16 %
  rule below is about zone tints alone. A world-anchored pool (PR #221 baked one into the field at a
  fixed spot inside the vent zone, where most players never see it) is the wrong reading and is
  removed by #242. [`rendering/budget.md §6.1`](../rendering/budget.md#61-the-condenser-light-pool-222)
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

**Zones** ([`ecology/food-and-spawn.md §2`](../ecology/food-and-spawn.md#2-zones) owns geometry; sheet 02's zone table owns tint,
alpha, cloud and mote density; the roles map as follows):

| `ZoneId`          | Sheet-02 role   | Tint                      | Feature                                                  |
| ----------------- | --------------- | ------------------------- | -------------------------------------------------------- |
| `sunlit_shallows` | sunlit shallows | `ZONE_SHALLOWS` `#8dffb0` | annulus inside the wall; cloud feathers the inner edge   |
| `warm_vent`       | thermal vent    | `ZONE_VENT` `#ff9a4d`     | disc at the origin with the fissure, plume, heat shimmer |
| `viscous_gel`     | viscous mire    | `ZONE_GEL` `#b070ff`      | `GEL_PATCH_COUNT` discs with mire strands                |
| `open_broth`      | (none)          | none                      | base mote density only                                   |

**Food** ([`ecology/food-and-spawn.md §1`](../ecology/food-and-spawn.md#1-food-kinds) owns kinds, radii and motion; sheet 02's
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
`ecology/food-and-spawn.md §1` (16 wu) along the heading, width = 1 × that radius (8 wu), so the rod is inscribed in its
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
[`qa/evidence/34/palette-separability.md`](../../qa/evidence/34/palette-separability.md). Fragments are
colour-only on purpose: at 9 wu with 2 px rungs no glyph reads, so there is no shape tell per tag. Under
dichromacy seven tags collapse to four groups (warm / green / blue / light); the tag name on the picker
card (`UI.md`) is the fallback, never a second fragment shape.

**Organelles and stage parts.** Sheet 01's shared organelle table (`MITO_*`, `VAC_*`, `LIPID_*`,
`CHLORO_*`, `TOXIN_*`, `MAGNET_*`) and sheet 04's constants table (`PROTO_*`, `NUCLEOID_*`,
`RIBOSOME`, `CELL_WALL*`, `FLAGELLUM`, `ENVELOPE` / `PORE`, `CYTOSKELETON`, `CILIA`, `SILICA_*`,
`DIATOM_PLASTID_*`, `EYESPOT*`). Two of those are the **cyan instance of a palette rule**, not
constants: the protocell film is the player's rim colour @55 % (film light `WHITE` `#ffffff` @70 %; `WHITE` is the one white constant, shared by glints, the seat-mark cores and the self ring), and the
nucleoid glow and the nucleus sprite (rim, chromatin, nucleolus, highlight; its disc is the shader ramp, §3) are the
player's rim colour (strand `NUCLEOID_STRAND` stays near-white). Everything else
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
[`qa/evidence/34/tools/colour_separability.py`](../../qa/evidence/34/tools/colour_separability.py) and #99
pins these numbers in a test):

- `PALETTE_PAIR_MIN_DELTA_E` 15: every base pair under normal vision. Measured minimum 18 (Coral–Rose).
- `NEW_PALETTE_MIN_DELTA_E` 15: a palette added after sheet 01 (Rose) against every other, under normal,
  deuteranopic **and** protanopic vision. Measured minimum 18.
- The six inherited hues are not separable under dichromacy (Lime–Amber 2, Coral–Amber 8, Cyan–Magenta
  11 under deutan); that is the fact the seat mark below exists for, not something a hue change fixes.

Nearest neighbour per palette (full 28-pair matrix, rims and contrast in
[`qa/evidence/34/palette-separability.md`](../../qa/evidence/34/palette-separability.md)):

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
`LIGHT_ACCENT`; `CALLOUT_BACKING` (the callout backing role, sheet 02's callout `#04070d`) is `BG_DEEP`;
`WHITE` `#ffffff` is the single white.

**Legibility cue roles (decision #324, `ui/hud.md` §3.1.5).** Three roles join danger, gold and DNA as the colours a
cue may carry. None is a new hex: each names a world colour the player already reads in the dish, so the cue and
the thing it is about match. They colour rims, dots, rings and glyphs only; cue text is always `WHITE` (the label
pill rule of `ui/input-and-onboarding.md` §6), so no role is ever the only carrier of a fact.

| Role        | Value                                                                                         | Used for                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GAIN`      | `FOOD_MOTE` `#8dff6a`                                                                         | mass-gain floater rims, the edible ring on a cell the own cell can engulf, the Tab panel's gain dots             |
| `ZONE_CUE`  | the zone's own tint from the zone table above (`ZONE_VENT`, `ZONE_SHALLOWS`, `ZONE_GEL`)      | the zone pill's dot, a zone-caused floater's rim, the Tab panel's zone dot; `open_broth` has none                |
| `TRAIT_CUE` | the trait's organelle base colour (sheet 01, `MITO_BASE`, `CHLORO_BASE`, …), else `UI_ACCENT` | trait glyphs in the Tab panel and on a trait-caused floater, as on the picker's medallions (`TRAIT_GLYPH_COLOR`) |

**Relation rings.** A cell's relation to the own cell is geometry first and colour second: each of the three rings
has its own shape, so none is told from another by colour alone (under deuteranopia `GAIN` and `DANGER` are two
yellows 2.0:1 apart, and taking a toxic cell for prey is the costly misread).

- The **threat ring** is the engulf warning ring as it ships: dashed `WARNING_RING_DASH_PX` 6 5,
  `WARNING_RING_STROKE_PX` 2 px, rotating (`cell-shader-tells.ts`, visual-style/motion-and-legibility.md §5), at
  `ENGULF_WARNING_RING_RADII`, in `DANGER`.
- The **toxic ring** is a **double line**, still: two solid `RELATION_RING_STROKE_PX` lines in `DANGER`. The
  **inner** line sits at the ring radius (`RELATION_RING_RADII`, or `r + RELATION_RING_MIN_GAP_PX` on a small cell),
  and the outer line sits `TOXIC_RING_LINE_GAP_PX` outside it. The inner line is therefore never closer to the
  membrane than the edible line is, and on the smallest cells the pair still reads as two lines, not one thick ring.
- The **edible ring** is a **single line**, still: one solid `RELATION_RING_STROKE_PX` line at the same ring radius,
  in `GAIN`.

Each role has its own alpha, because `DANGER` is darker than `GAIN` and one shared value would drop it under the
rim contrast floor:

- `EDIBLE_RING_ALPHA` 0.6: `GAIN` blends to 5.78:1 on `BG_FIELD`, so a dish full of prey rings stays dimmer than the
  dish (ui-type.md §7).
- `TOXIC_RING_ALPHA` 0.9: `DANGER` blends to 4.90:1; at 0.6 it would be 2.76. Toxin violet (`TOXIN_GLOW`) stays world art: it is the aura, never a cue. A cell that is both a
  threat and toxic shows the threat ring only (the danger that ends a life wins); a cell that is edible and toxic
  shows the double line. What each ring's label says is `ui/hud.md` §3.1.5.

**Knowingly close pairs.** `GAIN` against `ZONE_SHALLOWS` (the `+3 FOOD` and `+0.3/s LIGHT` rims) and `ZONE_GEL`
against `DNA` are close hues on purpose: each role is its world colour. They are never the only tell, because every
cue carrying them has its cause in text (`FOOD`, `LIGHT`, `DNA`, the zone's name), so no hex is to be changed to
separate them.
