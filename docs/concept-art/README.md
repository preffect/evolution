# Concept art

Code-drawn concept sheets for Evolution. Every sheet is a hand-authored SVG (gradients, blur and
turbulence filters, masks, layered shapes, zero raster content) with a 1920 × 1080 PNG render
committed next to it. The SVG is the source of truth; re-render the PNG after editing:

```bash
rsvg-convert -w 1920 -h 1080 docs/concept-art/<sheet>.svg -o docs/concept-art/<sheet>.png
```

Sheets feed `docs/VISUAL-STYLE.md` (#34) and the Pixi renderer (#99). Sizes are in **world units
(wu)**: 1 wu = 1 px at camera zoom 1.0. Each sheet states the px / wu it is drawn at.

## Sheet 02 — the dish (`dish-scene.svg`, #105)

![dish scene](./dish-scene.png)

A play-scale scene at **1 px / wu, camera zoom 1.0**: the dish wall, three ecology zones, the
three nutrient mote types, DNA fragments, depth particles and a vignette, with four cells (the
player, a rival mid-engulf, its prey and a larger grazer in the shallows). The inset at the bottom right is the same dish zoomed
out at high mass.

**Draw order (back → front)** — the renderer mirrors this list.

1. Field: radial `#0b1626` → `#04070d`, a condenser light pool (`#7fe7f5` 9 % → 0, ellipse
   980 × 760 wu centred top-left) and three faint caustic arcs at 5 %.
2. Zones: a radial tint per zone plus a fractal-noise cloud (base frequency 0.003–0.004, three
   octaves) masked to the zone disc so the edge is organic, never a hard circle.
3. Zone features: mire filaments, the vent fissure and its rising plume.
4. Far depth particles (sharp), then motes, then DNA fragments.
5. Cells, prey first so the predator's translucent film shows it.
6. Near depth particles (blurred) and bokeh discs.
7. Dish wall and its bubbles, then the vignette (`#000` 0 → 55 %, radius 72 %).
8. Annotations, never inside the play area in-game.

**Dish wall** (circle r = 2860 wu; the view sits against the right-hand wall)

| Layer            | Value                                                          |
| ---------------- | -------------------------------------------------------------- |
| Outside the dish | `#02040a` @92 %, faint stage scratches `#2a3d58` @25–35 %      |
| Inner shadow     | `#000` 26 wu @35 %, blur 10, just inside the wall              |
| Glass band       | 34 wu: `#182c46` body, `#2a4a70` inner 12 wu, `#4a6a90` outer  |
| Rim scatter      | `#7fe7f5` 2.5 wu @55 % + 9 wu blur 6 @28 %                     |
| Hairline         | `#ffffff` 1 wu @70 % on the inner edge                         |
| Specular streak  | `#ffffff` 2.2 wu @90 %, 220 wu long, 7° → 2.6° above the light |
| Bubbles          | r 5–16 wu, cling 14–70 wu inside the wall, rim-lit, one glint  |

**Ecology zones** (radial tint at the centre → 0 at the radius; cloud at 32–40 %)

| Zone            | Tint      | Alpha | Radius | Motes              | Extras                                  |
| --------------- | --------- | ----- | ------ | ------------------ | --------------------------------------- |
| Sunlit shallows | `#8dffb0` | 16 %  | 540 wu | algal ×4 density   | photosynthesis works here               |
| Thermal vent    | `#ff9a4d` | 13 %  | 430 wu | lipid ×3           | fissure (below), plume `#ffb15a`        |
| Viscous mire    | `#b070ff` | 14 %  | 470 wu | mineral ×3, DNA ×4 | strands `#b070ff` @10–26 %, −40 % speed |

Base mote density outside any zone is 5 % of the zone peak, so no part of the dish is empty.

**Vent fissure** (back → front, 190 × 60 wu, rotated −18°)

| Layer        | Value                                                                           |
| ------------ | ------------------------------------------------------------------------------- |
| Heat pool    | `#ff9a4d` @20 % blur 40 (170 × 80 wu) + hot column `#ffb15a` @10 % rising 120   |
| Crust        | two basalt plates `#12080a` @72 % blur 1.5 over a blur-16 shadow @50 %          |
| Crust rim    | `#7a3d12` 1.2 wu @70 % on the seam side, `#ffb15a` 0.8 wu @45 % where it glows  |
| Hairline     | 7 branching cracks `#ffb15a` 0.9–1.1 wu @35–50 %, fading away from the seam     |
| Molten seam  | `#ff9a4d` 9 wu blur 6 @55 % → `#ffd39a` 3.2 wu blur 1.5 → `#ffffff` 1.1 wu core |
| Heat shimmer | 4 refraction arcs `#ffb15a` 1–1.3 wu, 20 % → 5 % climbing 30–120 wu             |
| Vent bubbles | 8 rim-lit bubbles, r 2–4.2 wu, shrinking and fading 100 % → 40 % as they rise   |

The two hottest points on the seam get a 1.3–1.6 wu white glint; in-game they flicker at 6–9 Hz.

**Nutrient motes and DNA** (every glow is core + soft halo + wide halo + glint)

| Item         | Core / edge / rim                                           | Size                      | Glow                                  |
| ------------ | ----------------------------------------------------------- | ------------------------- | ------------------------------------- |
| Algal mote   | `#8dff6a` / `#3f9a2c` / `#dcffb0`                           | r 3–5 wu (circle)         | soft r ×1.6 @30 %, wide r ×3 @22 %    |
| Lipid mote   | `#f2c94c`, centre `#c88a2a`, rim `#ffe7a3`, glint `#fff8d0` | 4–7 × 3.4–6 wu (ellipse)  | soft ×1.4 @30 %, wide ×2.8 @20 %      |
| Mineral mote | `#ffffff` → `#9ad7ff` → `#3d7fc4`, facet `#e6f6ff`          | 3 × 4.5 wu (diamond)      | soft ×1.4 @32 %, wide ×2.5 @22 %      |
| DNA fragment | strands `#f0b8ff` / `#d36bff`, rungs `#b070ff`              | 22 wu long, 9 wu tall     | r 14 @20 % blur 6 + r 12 @30 % blur 3 |
| Depth, far   | `#ffffff` `#c4f0ff` `#9fe8f5` `#7fb8ff`                     | r 0.5–1.3 wu, 260 of them | none, sharp, 8–28 %                   |
| Depth, near  | `#dff4ff`                                                   | r 2.2–4.4 wu, 46 of them  | blur 3, 5–13 %                        |
| Bokeh        | zone colour                                                 | r 6–14 wu, 12 of them     | blur 6, 5–11 % + ring                 |

Motes are rotated and scaled 0.7–1.5× at random (seeded) so a field never tiles. Silhouettes
differ on purpose: circle, oily ellipse, diamond — readable at 3 wu without colour.

**Cells in the scene** (sheet 01 layer stack and palettes)

| Cell   | Palette | r     | Notes                                                                                                                                                                                                                            |
| ------ | ------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player | Cyan    | 30 wu | prokaryote stage: diffuse nucleoid (`#6fdcef` @40–55 %, no envelope) lagging 20 % r, two lipids, a flagellum `#a6f4ff` 1.2 wu, moving right at stretch 1.10 × 0.94 with three wake arcs                                          |
| Rival  | Magenta | 52 wu | eukaryote: nucleus 30 % r, 2 mitochondria, vacuole, 3 lipids; engulf **wrap frame**: lobes +62 % at 180° / 240° (σ 16°), notch −10 % between                                                                                     |
| Prey   | Amber   | 16 wu | drawn under the rival's film; its rim and nucleus glint are redrawn on top at 45 % so it stays visible                                                                                                                           |
| Grazer | Lime    | 44 wu | later form resting in the shallows: nucleus 30 % r, 6 chloroplasts (`#8dff6a` / `#2f7a22`, 12.6 wu) on the lit edge, 2 mito, vacuole; light-harvest bloom `#8dffb0` @6 % at r 2×, algal motes drift in on dashed `#8dff6a` lines |

The cytoplasm texture is the sheet-01 fractal noise at 4× the frequency (0.18 / 0.45) because
this sheet is drawn at 1 px / wu instead of 4.

The player is the smallest thing with a rim in the scene on purpose: everything larger around it is a
later form, which is the progression the game promises.

Membranes are 36-point Catmull-Rom loops: radius = r × (1 + Σ Gaussian bumps of ±2.5–4 %, σ 0.25–0.4
rad) plus ±0.8 % seeded jitter, converted to cubic Béziers (tangent = ⅙ of the chord to the
neighbours). The engulf wrap frame adds two +62 % lobes (σ 16°) and a −10 % notch between them.

**Zoomed-out inset (high mass)**

- Camera zoom eases 1.0 → 0.2 as mass goes 20 → 400; at 0.2 the whole dish (r 2860 wu = 110 px)
  fits on screen. The dashed rectangle is this sheet's view (1920 × 1080 wu → 74 × 42 px).
- Cells collapse to a rim-coloured dot with a 3 px floor and a halo, no interior. The player
  keeps `#22c1d6` with a `#a6f4ff` ring at r 7.5 px.
- Motes are not drawn as sprites: a 1 px turbulence texture at 50 % stands in for the field.
- Zones become blurred colour fields at twice the play-scale alpha; the wall is a 4 px
  `#1f3552` band with the same rim scatter.

**Design decisions**

- Zones are read by mote colour and density first, tint second: the tints stay ≤ 16 % so the
  cells' palettes keep their contrast everywhere in the dish.
- Motes glow at 2.5–3× their radius so a field reads as a luminous cloud at zoom 0.5 and still
  resolves into individual pick-ups at zoom 1.0.
- The dish wall is the only hard edge in the world: it gets the brightest hairline in the scene
  and bubbles cling to it so the boundary is unmistakable at every zoom.
- Depth comes from three particle layers (far sharp, near blurred, bokeh) and the vignette, not
  from darkening the field, so the dark-field background stays uniform for cell contrast.
- Annotation panels use `#0e1f33` → `#060e1a` @88 % with a `#173250` rim, and callouts sit on a
  `#04070d` @62 % blurred backing so text never fights a mote.
