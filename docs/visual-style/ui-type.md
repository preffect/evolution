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
| `headline`  | 26  | sans | results winner line; encyclopedia entry and category names                                                                                                                                                                                                 |
| `clock`     | 24  | mono | round timer                                                                                                                                                                                                                                                |
| `value`     | 20  | mono | secondary numbers (DNA count, sprint meter, scores)                                                                                                                                                                                                        |
| `title`     | 22  | sans | overlay titles (respawn, menu, encyclopedia)                                                                                                                                                                                                               |
| `card_name` | 16  | sans | trait card name                                                                                                                                                                                                                                            |
| `body`      | 14  | sans | body text, hint pill; buttons, list rows, encyclopedia prose                                                                                                                                                                                               |
| `figure`    | 14  | mono | `body`'s size in the mono face: a changing number inside a dense row — the leaderboard's score, mass and absorptions columns (`ui/hud.md` §3.1.1), which need `body`'s weight and tabular digits at a 24 px row height, where `value`'s 28 px does not fit |
| `label`     | 12  | sans | labels, uppercase tracked 0.08 em; the reading floor; chips, breadcrumbs, list section headers                                                                                                                                                             |
| `caption`   | 11  | sans | key hints, muted captions; never carries a fact                                                                                                                                                                                                            |

Colour roles: the own row
on the leaderboard is tinted with the player's own rim colour @12 %; a player swatch is the palette base
with a rim-colour ring and the seat-mark bead count of §2; danger, gold and DNA are the only saturated UI
colours, plus the three legibility cue roles of §2 (`GAIN`, `ZONE_CUE`, `TRAIT_CUE`, decision #324), which colour
rims, dots, rings and glyphs and never text; the rest of the overlay is the `PANEL_TOP` → `PANEL_BOTTOM` panel with the `PANEL_RIM` rim so the
dish stays the brightest thing on screen.

**The UI kit** (#354, [`ui/components-and-constants.md §10`](../ui/components-and-constants.md#10-the-ui-kit-354)) adds no
role. A panel title is `title`, an entry or category name `headline`; buttons, rows, fields and prose are `body`; a
fact's value is `figure` (tabular, beside its `body` name); chips, breadcrumbs and list section headers are `label`;
key hints are `caption`. Mixed-case text set at `label`'s size (the menu's effect lines, a tile's fact) keeps its
tracking without the uppercase transform, as input-and-onboarding.md §6 already allows. A countdown inside a `label` line (the offer alert's `6.5 s`) is set in `figure`, so its digits do not jitter. A rarity chip is `label`: the picker card's `caption` rarity chip (ui/overlays.md §3.2) moves to `label` when the picker adopts the kit.

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
| `cell_wall`         | a thick plated `CELL_WALL` hexagon around the membrane, its corners sharp at 20 px   | breathe                          |
| `ribosomes`         | `RIBOSOME` studs standing proud of a smaller membrane: a bumpy ring                  | breathe                          |
| `mitochondrion`     | a `MITO_*` kidney bean, notched in its lower edge, with three cristae, tilted −24°   | beat                             |
| `chloroplast`       | a `CHLORO_*` lens with six grana bulging past its lit edge, 16°                      | breathe                          |
| `nuclear_envelope`  | a nucleus inside a double `ENVELOPE` ring notched by 8 `PORE`s                       | spin (the rings and pores)       |
| `cytoskeleton`      | eleven `CYTOSKELETON` spokes from a nucleus out past the rim                         | breathe                          |
| `cilia`             | a cell with a long fringe of 20 leaning `CILIA` hairs                                | sway (the fringe)                |
| `food_vacuole`      | three `MITO_BASE` bubbles, one holding food                                          | rise (the two small bubbles)     |
| `toxin_vacuole`     | a `TOXIN_*` bladder leaking three `TOXIN_GLOW` wisps                                 | beat (bladder), sway (wisps)     |
| `amoeba_pseudopods` | a lobed `VAC_*` body with a nucleus                                                  | breathe                          |
| `paramecium_cilia`  | a `VAC_*` slipper notched by its oral groove, with a cilia fringe                    | sway (the fringe)                |
| `euglena_eyespot`   | a `CHLORO_*` spindle with a red `EYESPOT` and a flagellum                            | breathe (body), sway (flagellum) |
| `diatom_shell`      | a `SILICA_*` valve with striae and eight bright spines                               | spin (spines, tips, striae)      |
| `stentor_trumpet`   | a `VAC_*` trumpet with a membranelle crown and beaded nucleus in a `TOXIN_GLOW` haze | sway about the foot              |

Two traits are drawn louder than in the dish, for legibility at 20 px: the stentor's `TOXIN_GLOW` haze is @22 %
here (@8 % on the cell, cells-and-organelles.md §4), and the eyespot carries its own `EYESPOT` halo.

**Silhouette at 20 px** (graphics-qa on #394; `principles-and-palette.md` §1, never hue alone): every trait's tell
is on its outline, never only in its interior or its colour. That means the notch, the bumps, the plates, the studs,
the pores, the spokes or the hairs. Glyphs that share a category must differ in outline, not just in hue
(Mitochondrion and Chloroplast; Cytoskeleton and Cilia). A dashed stroke ends square, so a pore or plate gap stays
open when the list LOD thickens the stroke. Evidence keeps a frameless silhouette strip at both 56 px and 20 px.

**Motion.** One slow loop per glyph. The periods are `GLYPH_PERIOD_MS` and the amplitudes `GLYPH_MOTION_AMPLITUDE`,
both in `render/constants/trait-glyph-layers.ts`:

- breathe: 4 200 ms, swelling to 1.04×
- beat: 2 400 ms, swelling to 1.08× in the first 15 % (near §5's 0.5 Hz rest rate, so no card in the picker pulls
  the eye)
- sway: 2 600 ms, ±4°
- spin: 40 000 ms per turn
- rise: 2 000 ms, by 3 units

The amplitudes reach the keyframes as `--glyph-…` custom properties the component publishes on its host
(`glyphs/glyph-motion-variables.ts`), so no amplitude is a stylesheet literal. A spec holds both pulses under
`GLYPH_PULSE_CEILING` (§5's 1.14×). `prefers-reduced-motion` stops every loop. A layer lit by a ramp, and a glint,
never spins: a turning ramp would turn the light (§1).

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

### 7.2 Subject glyphs (#391)

One code-drawn SVG glyph per **non-trait** encyclopedia subject — 55 of them on the model as it stands — so every
row, tile and entry header in the encyclopedia is named by a picture as well as by words. They sit on §7.1's
medallion, use §7.1's layer stack, LODs, `still` and motions, and are drawn by the same builder and the same
stylesheet: `<app-subject-glyph [entryId] lod="list" still />` is the sibling of `<app-trait-glyph>`, and neither
owns the SVG (`glyphs/glyph-layers.component.ts` is it). What follows is only what is different.

**The two halves.** Things the dish already draws are **drawn as they look there** — the cell kinds, the food kinds,
the three bacterium rods, the DNA fragment, the four zones — read off `render/` and `cells-and-organelles.md` §3–4,
not invented. Topics have no dish form, so they are designed here: the stages, DNA tags, abilities, actions, world
topics and concepts below.

**Family marks.** Four sets would otherwise blur into each other, so each carries one rule. The **negative** half of
each rule is enforced and holds everywhere; the **positive** half has four known gaps (three concepts carry no
relation, `ability:food_attraction` no cell), tracked on **#457** — read the table as the rule the set is held to,
not as a claim that all 55 already meet it.

An honest caveat about what does the work at 20 px: an arrowhead there is about two pixels and effectively
invisible. `ability:sprint` and `action:sprint` separate because of **where the mass sits** — chevrons ahead of the
bead against speed lines behind it — not because one has a head. The arrowhead is the card-size mark; layout is the
list-size one, and a new pair that shares a hue _and_ a layout will not be rescued by the rule alone.

| Family  | Mark                                                                                                                                                                                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DNA tag | The motif sits inside a **cartouche**: the lit lens two crossing `DNA_STRAND` strands enclose, tinted that tag's `DNA_TAG_COLOR`. It is what keeps a tag apart from the trait that grants it (metabolic against Mitochondrion, photic against Chloroplast). |
| Ability | An organ or an effect **on a cell**, in that ability's organelle colours, and **never an arrowhead**.                                                                                                                                                       |
| Action  | A bold **arrow gesture** — every action has an arrowhead and no ability does — with the thing it acts on beside it.                                                                                                                                         |
| Concept | A **relation, drawn as a relation**: two cells against a measuring mark (a caliper, a beam, a datum line), never a single object.                                                                                                                           |

**Palette.** A subject glyph paints only `colours.ts` names, the table values included (`DNA_TAG_COLOR`,
`PLAYER_PALETTE_TABLE`). §7.1 keeps gold, danger and DNA off a trait glyph; the rule underneath that, which §7.2
follows, is **a reserved colour may be used only by the subject that colour denotes**. Gold is banned on a trait
because gold means _level_ — so `action:level_up` and `concept:score` may wear it, and `action:pick_trait` may not,
because picking a trait is not levelling. Likewise `DANGER` on `action:escape`, the DNA ramp on
`entity:dna_fragment`, `ability:genome`, `concept:dna_and_levels` and the tag cartouches, and the first seat's
palette (`GLYPH_PLAYER_SEAT`) on `cell_kind:player`, whose subject _is_ the player's own cell. A colour borrowed for
emphasis rather than for meaning is the thing this forbids.

**Inside the medallion.** Every drawn layer stays within `GLYPH_MEDALLION_REACH` 39 of the centre: the frame's radius
47 divided by `GLYPH_LIST_ZOOM` 1.2, so a drawing that fits at the card LOD still fits once the list LOD enlarges it.
`subject-glyphs.spec.ts` fails on a layer that reaches further, measuring with `src/testing/glyph-bounds.ts` — which
walks arcs rather than jumping them and reads a circle from its own geometry, since a circle's path data runs between
its _horizontal_ extremes and measuring through it hides the top and bottom of every disc.

**Halos are the exception, and the clip is why.** A halo may reach past the rim, because it is a soft glow that fades
to nothing at its edge; the view builder clips **the halo layers and only those** to the medallion disc, so the part
that would have smeared onto the panel is the part nobody can see. Drawn layers are never clipped — clipping those
would crop artwork rather than protect it, and would crop 15 of #312's 16 trait glyphs at the list LOD, which were
authored before this budget existed. For drawn layers the budget is the whole guarantee.

**The drawings.** Files: `render/constants/subject-glyphs-{cells,food,stages,tags,abilities-contest,abilities-reach,actions,zones,world,concepts}.ts`,
on the shapes of `subject-glyph-shapes.ts`, the motifs of `subject-glyph-motifs.ts` and the paint of
`subject-glyph-palette.ts` (the ramps, the line weights `SUBJECT_STROKE`, the alphas `SUBJECT_ALPHA` and
`GLYPH_MEDALLION_REACH`).

| Subject                    | Signature (what the silhouette says)                                                           | Idle motion         |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ------------------- |
| `cell_kind:player`         | a seat-lit blob inside its dashed `WHITE` self ring, with one seat-mark bead at the light      | breathe, ring spin  |
| `cell_kind:wild`           | the same body in steel, no bead and no ring, crawling on a six-lobed outline                   | breathe             |
| `food:algae`               | a `FOOD_MOTE` disc with its dark `FOOD_MOTE_EDGE` band inside the rim                          | breathe             |
| `food:detritus`            | a squat `LIPID_*` ellipse with a darker concentric core                                        | breathe             |
| `food:bacterium`           | three rods of the three proportions: the food kind, not one variant                            | breathe             |
| `bacterium:plain`          | a middling pale rod with its translucent film line inside the rim, tilted −18°                 | breathe             |
| `bacterium:aerobic`        | a plump `MITO_*` rod with one hot `WHITE` seam down its axis, tilted 14°                       | beat                |
| `bacterium:photosynthetic` | a long thin `CHLORO_*` rod banded three times across its middle half                           | breathe             |
| `entity:dna_fragment`      | the lit helix lens, two strands crossing over five tag-coloured rungs                          | breathe             |
| `stage:protocell`          | a faint film bubble, double-lined, with three drifting granules                                | breathe             |
| `stage:prokaryote`         | a glowing `NUCLEOID_STRAND` tangle in a cell ringed with ribosome studs                        | spin (the tangle)   |
| `stage:endosymbiosis`      | a cell swallowing a rod: the rod's free end breaks the rim and the membrane dimples round it   | beat                |
| `stage:eukaryote`          | a nucleus behind a double `ENVELOPE` ring notched by eight `PORE`s                             | breathe, ring spin  |
| `stage:specialised`        | a spined `SILICA_*` wall over three different organelles at once                               | breathe, spin       |
| `dna_tag:motile`           | a flagellum sweep in the cartouche                                                             | sway                |
| `dna_tag:photic`           | six rays converging in the cartouche                                                           | breathe             |
| `dna_tag:predatory`        | a mouth crescent closing in the cartouche                                                      | beat                |
| `dna_tag:armored`          | a plated hexagon in the cartouche                                                              | breathe             |
| `dna_tag:toxic`            | a toxin droplet in the cartouche                                                               | beat                |
| `dna_tag:sensory`          | an eyespot, ring and pupil, in the cartouche                                                   | beat                |
| `dna_tag:metabolic`        | a cristae bean in the cartouche                                                                | beat                |
| `ability:movement`         | a cell at the end of the dotted track it has already swum: speed held                          | breathe             |
| `ability:sprint`           | a cell behind two hard chevrons: speed spent                                                   | beat                |
| `ability:engulf_defence`   | two shells, one inside the other, on the cell's lit side                                       | breathe             |
| `ability:engulf_grip`      | a mouth already closed most of the way round its prey                                          | beat                |
| `ability:digestion`        | a vacuole with a mote breaking up inside it, its rim dashed                                    | breathe, beat       |
| `ability:photosynthesis`   | a `CHLORO_*` lens under three rays from the top-left                                           | breathe             |
| `ability:spines`           | a bead with eight `SILICA_LIGHT` spikes                                                        | spin (the spikes)   |
| `ability:toxin`            | a bladder leaking three wisps into a wide `TOXIN_GLOW` haze                                    | beat, sway          |
| `ability:food_attraction`  | a steel horseshoe with two motes drawn into its gap                                            | breathe, rise       |
| `ability:genome`           | a closed plasmid ring standing off a lit nucleoid: a loop, where the fragment is loose         | spin (the ring)     |
| `ability:gel_resistance`   | a cell holding its line through four parting `ZONE_GEL` strands                                | breathe, sway       |
| `action:steer`             | a curved arrow from a cell to a ticked reticle                                                 | beat                |
| `action:sprint`            | a straight arrow out of a cell, with three speed lines behind it                               | beat                |
| `action:eat`               | a green mote arrowed into an open mouth                                                        | beat                |
| `action:engulf`            | an arrow wrapping round a prey bead inside a thick crescent                                    | beat                |
| `action:escape`            | the same crescent broken, the arrow leaving through the gap, in `DANGER`                       | beat                |
| `action:pick_trait`        | three cards, the middle one lifted and lit, under a down arrow                                 | breathe             |
| `action:level_up`          | an arrow up through a `LEVEL_GOLD` ring                                                        | beat                |
| `action:respawn`           | a ring arrow closing on a fresh cell: the one gesture that comes back                          | spin, breathe       |
| `zone:sunlit_shallows`     | a green band hugging the glass wall's bright hairline, caustics across it                      | breathe, sway       |
| `zone:warm_vent`           | two plates of basalt broken apart over a molten `VENT_SEAM_HOT` seam                           | beat (the cracks)   |
| `zone:viscous_gel`         | a violet patch thick with three bent strands                                                   | breathe, sway       |
| `zone:open_broth`          | no tint and no feature: the condenser pool and the depth motes drifting through it             | rise                |
| `world:dish`               | the dish from above: the glass wall's rings, the shallows inside them, the broth in the middle | breathe, rise       |
| `world:world_clock`        | a ticked dial with one hand                                                                    | spin (the hand)     |
| `world:bloom`              | a bright core throwing motes out along eight rays                                              | beat                |
| `world:round`              | an hourglass running down                                                                      | breathe, beat       |
| `concept:mass_and_size`    | two cells over a caliper: mass is size, and size is measured                                   | breathe             |
| `concept:mass_decay`       | a cell inside the dashed ghost of what it was, with what it lost falling away                  | breathe, spin, rise |
| `concept:engulf_ratio`     | a beam that has already tipped: a threshold, not a contest                                     | breathe             |
| `concept:dna_and_levels`   | a helix climbing into a `LEVEL_GOLD` ring                                                      | breathe, beat       |
| `concept:score`            | a gold tally rising left to right, its top bar lit                                             | beat                |
| `concept:world_standing`   | a cell held above the world's own datum line, a ghost sitting on it                            | breathe             |
| `concept:food`             | the three food kinds together: the overview, not one kind's page                               | breathe             |

**Two glyphs that are not read off the dish, and say so.** The renderer has **no branch on cell kind at all** —
`CellView.kind` is read nowhere under `render/`, and every cell is drawn as a player's — so `cell_kind:wild` is
invented on every axis: its desaturated body, its missing seat bead and its lobed crawling outline. It is painted
from the stage's own inert greys (`STAGE_SCRATCH`, `DEPTH_NEAR`), which no organelle family owns, so it borrows no
other subject's colour; revisit it when #99 lands a real wild palette. And the dish bakes one DNA fragment per
`DnaTag`, so `entity:dna_fragment` shows one of them — the first in `DNA_TAG`'s walk order — since the entity page
has no tag of its own.

**Not yet drawn.** `HUD_TOPIC` (architecture/encyclopedia.md §12.4) has no model file and no `hud` subject, so the
seven HUD pages have no glyph (**#450**). The completeness spec is derived from `EntryId`, so the day that subject
lands the spec fails until its seven are drawn.
