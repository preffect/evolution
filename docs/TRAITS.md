# Evolution — Trait Catalog v1 (the ladder)

Ticket: #25. Epic #2. The ladder the catalog implements: [`game-design/core.md §3`](./game-design/core.md#3-the-evolution-ladder).
How traits are offered: [`PROGRESSION.md §3`](./PROGRESSION.md#3-draft-pool-and-weights). Base rules the
modifiers act on: [`ECOLOGY.md`](./ECOLOGY.md) and [`game-design/controls-and-scope.md §6`](./game-design/controls-and-scope.md#6-controls).
Visual language (colours, membrane, organelles): [`VISUAL-STYLE.md`](./VISUAL-STYLE.md) (#34) and
the concept sheets (#104–#106); this doc says _what_ each trait must show, not how it is drawn.

**Traits are organelles and forms.** Build 1 ships the sixteen traits in §3 at three tiers each,
arranged on the five rungs of the ladder: three protocell picks, three prokaryote organelles (two of
them endosymbionts), the nuclear envelope, four eukaryote organelles and five specialised forms. §4
names the later traits so tags, exclusion groups and the modifier model already account for them.
Machine-readable form: the catalog is an `as const` array in `packages/shared/src/constants/traits.ts`
(if #72 adopts `data/traits.json`, that file is generated from the same definitions and a test pins
them equal).

## Files

This document is split into topic files (#306). Read only the file a ticket or brief cites.

| File                                                                         | Sections    | Topic                                             |
| ---------------------------------------------------------------------------- | ----------- | ------------------------------------------------- |
| [`traits/model.md`](./traits/model.md)                                       | §1–§2       | Definition shape and modifier model               |
| [`traits/catalog-organelles.md`](./traits/catalog-organelles.md)             | §3–§3.11    | Build-1 catalog: rungs 1 to 4                     |
| [`traits/catalog-forms.md`](./traits/catalog-forms.md)                       | §3.12–§3.18 | Build-1 catalog: forms and the at-a-glance tables |
| [`traits/constants-and-acceptance.md`](./traits/constants-and-acceptance.md) | §4–§6       | Later traits, constants and acceptance            |
