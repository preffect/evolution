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
radius `r` (`ecology/mass-and-movement.md §5.1`: `r = CELL_RADIUS_SCALE × √mass`). Time is in ms, easings by their
Penner names (`packages/client/src/app/game/render/easing.ts`, added by #99, holds the curves; no inline
cubic-bezier literals). `UI.md` (#30, in flight on `feat/30-ui-design`) is the HUD companion referenced below.

## Files

This document is split into topic files (#313). Read only the file a ticket or brief cites.

| File                                                                                       | Sections | Topic                                          |
| ------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------- |
| [`visual-style/principles-and-palette.md`](./visual-style/principles-and-palette.md)       | §1–§2    | Dark-field principles and palette              |
| [`visual-style/cells-and-organelles.md`](./visual-style/cells-and-organelles.md)           | §3–§4    | Cell layer stack and organelle vocabulary      |
| [`visual-style/motion-and-legibility.md`](./visual-style/motion-and-legibility.md)         | §5–§6    | Membrane motion and legibility at play scale   |
| [`visual-style/ui-type.md`](./visual-style/ui-type.md)                                     | §7       | UI colours, type and trait glyphs              |
| [`visual-style/performance-and-checklist.md`](./visual-style/performance-and-checklist.md) | §8–§9    | Performance intent and the per-asset checklist |
