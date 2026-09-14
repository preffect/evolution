# Evolution — Rendering

Ticket #120, epic #85. The implementation contract for the Pixi v8 renderer (#99, decided in #33) and the
specialised forms (#121). It decides **how a cell is drawn**; what it looks like is
[`VISUAL-STYLE.md`](./VISUAL-STYLE.md) and the sheets in [`concept-art/README.md`](./concept-art/README.md).
Every number here is traced to a sheet table or a design doc; the few new ones are named constants whose
home is `packages/client/src/app/game/render/constants.ts` (`CODE-STANDARDS.md §2`, "client render-only
numbers") unless a table below says otherwise. Units follow `VISUAL-STYLE.md`: wu, fractions of `r`, ms.

**Decisions that supersede earlier text.** The concept sheets are SVGs built from per-layer blur and
turbulence filters; **SVG is a spec, never a runtime asset**, and nothing in `render/` loads, parses or
rasterises one. `visual-style/performance-and-checklist.md §8`'s "36-point membrane as `Graphics` geometry, one shader effect only"
was the pre-#120 intent; its goals (nothing filtered per frame, glows as cached sprites, deformations as
functions of `t` and the cosmetic stream) stand, its means are replaced by §2 below. `determinism/replay-tests-and-traps.md §7`'s
`membrane-mesh.spec.ts` is `cells/radial-profile.spec.ts` (§9). `architecture/client.md §6, architecture/constants-files-tests.md §10` link here.

## Files

This document is split into topic files (#306). Read only the file a ticket or brief cites.

| File                                                                     | Sections | Topic                                         |
| ------------------------------------------------------------------------ | -------- | --------------------------------------------- |
| [`rendering/cells.md`](./rendering/cells.md)                             | §1–§2    | Inputs and the cell shader                    |
| [`rendering/contents-and-motion.md`](./rendering/contents-and-motion.md) | §3–§5    | Contents, motion tables and LOD               |
| [`rendering/budget.md`](./rendering/budget.md)                           | §6–§7    | Batching plan and frame budget                |
| [`rendering/files-and-tests.md`](./rendering/files-and-tests.md)         | §8–§9    | File plan and test plan                       |
| [`rendering/own-cell-indicators.md`](./rendering/own-cell-indicators.md) | §10      | Own-cell indicators and world-anchored labels |
