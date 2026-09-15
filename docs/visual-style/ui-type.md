# Evolution — Visual Style: UI colours and type

§7 of the split [`VISUAL-STYLE.md`](../VISUAL-STYLE.md), which keeps the shared context and the file list.

## 7. UI colours and type

Panels, text, chips and bars use sheet 03's palette table and the HUD / trait-picker layouts. **Ownership
(architect decision on #125): this doc owns every colour (§2) and the type scale and fonts below; `UI.md`
(#30, `feat/30-ui-design`) cites colour and type roles by name and owns placement, per-element sizes
other than type, and `HUD_PLAYER_EXCLUSION_PX`.** Type is a system stack, no web fonts and no font files:
`UI_FONT_SANS` = `Inter, "Segoe UI", system-ui, sans-serif` for labels and body, `UI_FONT_MONO` =
`"JetBrains Mono", ui-monospace, monospace` for numbers that change (mass, timer, DNA %), so digits do
not jitter. The type scale (`UI_TYPE_*`, px at HUD scale 1):

| Role        | px  | Face | Used for                                                                                                                                                                                                                                                   |
| ----------- | --- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `number`    | 28  | mono | level number, mass value                                                                                                                                                                                                                                   |
| `headline`  | 26  | sans | results winner line                                                                                                                                                                                                                                        |
| `clock`     | 24  | mono | round timer                                                                                                                                                                                                                                                |
| `value`     | 20  | mono | secondary numbers (DNA count, sprint meter, scores)                                                                                                                                                                                                        |
| `title`     | 22  | sans | overlay titles (respawn, menu)                                                                                                                                                                                                                             |
| `card_name` | 16  | sans | trait card name                                                                                                                                                                                                                                            |
| `body`      | 14  | sans | body text, hint pill                                                                                                                                                                                                                                       |
| `figure`    | 14  | mono | `body`'s size in the mono face: a changing number inside a dense row — the leaderboard's score, mass and absorptions columns (`ui/hud.md` §3.1.1), which need `body`'s weight and tabular digits at a 24 px row height, where `value`'s 28 px does not fit |
| `label`     | 12  | sans | labels, uppercase tracked 0.08 em; the reading floor                                                                                                                                                                                                       |
| `caption`   | 11  | sans | key hints, muted captions; never carries a fact                                                                                                                                                                                                            |

Colour roles: the own row
on the leaderboard is tinted with the player's own rim colour @12 %; a player swatch is the palette base
with a rim-colour ring and the seat-mark bead count of §2; danger, gold and DNA are the only saturated UI
colours; the rest of the overlay is the `PANEL_TOP` → `PANEL_BOTTOM` panel with the `PANEL_RIM` rim so the
dish stays the brightest thing on screen.

### 7.1 Trait glyphs (#312)

One code-drawn SVG glyph per `TraitId` names a trait wherever the HUD lists one: the picker card's medallion
(`ui/overlays.md` §3.2) and the menu's `Your traits` list (§3.5). It is the trait, not the tier: the tier stays in
text (`Cilia Fringe II`, `I → II`). The glyph is decorative (`aria-hidden`); the text beside it names the trait.

**Colour (decision #324, "All"):** each glyph draws in its own organelle colours from §2 (`MITO_*`, `CHLORO_*`,
`TOXIN_*`, `SILICA_*`, `CILIA`, `EYESPOT` …), never a player palette, so a glyph looks the same to every player,
as organelles do inside every cell. The body ramps are `GLYPH_RAMP` (`render/constants/trait-glyph-layers.ts`).
The glyph never uses gold, danger or DNA, the saturated UI roles above.

**Frame.** Every glyph sits on its own medallion (`GLYPH_FRAME`, `render/constants/trait-glyph-frame.ts`): a
disc r 47 of the 100-unit box, a `PANEL_TOP` → `BG_FIELD` → `BG_DEEP` ramp lit from the top-left, a `LIGHT_ACCENT`
condenser pool @16 % at (34, 30), and a `PANEL_RIM` rim 1.5 wide with a `LIGHT_ACCENT` @60 % scatter on its
top-left arc. Because it brings its own dark field, a glyph reads the same on any HUD panel.

**Layer stack** (`ASSET-GENERATION.md` §6, pinned per trait by `trait-glyphs.spec.ts`): halo (core, soft halo @40 %
at 0.45 of the radius, wide halo to 0), dark pool (the shape offset (3, 4) in `BLACK` @45 %, down-right because
light comes from the top-left), outline (`OUTLINE` 2.5 wider than the rim), ramped body (light at (0.34, 0.30) of
its box, base at 0.5, dark at the edge), interior detail, signature feature, and a `WHITE` @85 % glint at the
top-left. Every colour is a `colours.ts` name. A form may lie at a tilt (`tiltDeg`); the pool's offset is applied
after the tilt, so its shade stays down-right on screen.

| Trait               | Signature (what the silhouette says)                                                 | Idle motion                      |
| ------------------- | ------------------------------------------------------------------------------------ | -------------------------------- |
| `nucleoid`          | a glowing `NUCLEOID_STRAND` tangle in a faint film                                   | spin (the tangle)                |
| `simple_flagellum`  | a small cell with a long `FLAGELLUM` sine tail                                       | sway about the tail's root       |
| `cell_wall`         | a thick plated `CELL_WALL` band around the membrane                                  | breathe                          |
| `ribosomes`         | a `RIBOSOME` stipple ring inside the membrane                                        | breathe                          |
| `mitochondrion`     | a `MITO_*` bean with three cristae, tilted −24°                                      | beat                             |
| `chloroplast`       | a `CHLORO_*` lens with six grana on its lit edge, 16°                                | breathe                          |
| `nuclear_envelope`  | a nucleus inside a double `ENVELOPE` ring of 16 `PORE`s                              | spin (the rings and pores)       |
| `cytoskeleton`      | eleven `CYTOSKELETON` spokes from a nucleus to the rim                               | breathe                          |
| `cilia`             | a cell with a fringe of 28 leaning `CILIA` hairs                                     | sway (the fringe)                |
| `food_vacuole`      | three `MITO_BASE` bubbles, one holding food                                          | rise (the two small bubbles)     |
| `toxin_vacuole`     | a `TOXIN_*` bladder leaking three `TOXIN_GLOW` wisps                                 | beat (bladder), sway (wisps)     |
| `amoeba_pseudopods` | a lobed `VAC_*` body with a nucleus                                                  | breathe                          |
| `paramecium_cilia`  | a `VAC_*` slipper with a cilia fringe and oral groove                                | sway (the fringe)                |
| `euglena_eyespot`   | a `CHLORO_*` spindle with a red `EYESPOT` and a flagellum                            | breathe (body), sway (flagellum) |
| `diatom_shell`      | a `SILICA_*` valve with striae and eight bright spines                               | spin (spines, tips, striae)      |
| `stentor_trumpet`   | a `VAC_*` trumpet with a membranelle crown and beaded nucleus in a `TOXIN_GLOW` haze | sway about the foot              |

Two traits are drawn louder than in the dish, for legibility at 20 px: the stentor's `TOXIN_GLOW` haze is @22 %
here (@8 % on the cell, cells-and-organelles.md §4), and the eyespot carries its own `EYESPOT` halo.

**Motion.** One slow loop per glyph (`GLYPH_PERIOD_MS`): breathe 4 200 ms to 1.04×, beat 1 000 ms to 1.08× in the
first 15 %, sway 2 600 ms ±4°, spin 40 000 ms per turn, rise 2 000 ms by 3 units. All stay under §5's 1.14×
pulse ceiling, and `prefers-reduced-motion` stops them. A layer lit by a ramp, and a glint, never spins: a turning
ramp would turn the light (§1).

**Sizes, LOD and still.** The SVG fills its host, so the caller sizes it (`game/glyphs/glyph-constants.ts`):
`TRAIT_GLYPH_CARD_PX` 56 at the `card` LOD on a picker card (`PICKER_CARD_MEDALLION_PX` is that constant) and on an
encyclopedia tile or entry header; `TRAIT_GLYPH_LIST_PX` 20 beside one `body` line at the `list` LOD (the menu's
`Your traits`, the encyclopedia list), which drops the `detail` layers (chromatin, striae, inner stipple, granules),
keeps the frame, body, signature and glint, thickens the glyph's strokes by `GLYPH_LIST_STROKE_BOOST` 1.8 so hairs,
spokes, rings and tails stay a pixel wide at a fifth of a unit per pixel, and draws the glyph `GLYPH_LIST_ZOOM` 1.2×
about the centre so it fills the medallion (the frame is unchanged by both). `still` drops the idle loop and nothing
else: list rows draw still, since many loops side by side are noise beside the live preview; a card or tile keeps its
loop. In code: `<app-trait-glyph [traitId]="id" lod="list" still />` (`game/glyphs/trait-glyph.component.ts`),
drawing `TRAIT_GLYPHS` (`game/glyphs/trait-glyphs.ts`). The glyphs live in the neutral `game/glyphs/` so the
encyclopedia never imports `hud/`.
