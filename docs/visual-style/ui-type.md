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
colours; the rest of the overlay is the `PANEL_TOP` → `PANEL_BOTTOM` panel with the `PANEL_RIM` rim so the
dish stays the brightest thing on screen.

**The UI kit** (#354, [`ui/components-and-constants.md §10`](../ui/components-and-constants.md#10-the-ui-kit-354)) adds no
role. A panel title is `title`, an entry or category name `headline`; buttons, rows, fields and prose are `body`; a
fact's value is `figure` (tabular, beside its `body` name); chips, breadcrumbs and list section headers are `label`;
key hints are `caption`. Mixed-case text set at `label`'s size (the menu's effect lines, a tile's fact) keeps its
tracking without the uppercase transform, as input-and-onboarding.md §6 already allows.
