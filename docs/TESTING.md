# Evolution — Testing Standards

The bar every PR is reviewed against (#76). `engineering/testing-and-typescript.md` §2 gives the principles; this
document gives the tiers, the file rules, the builders and the coverage numbers the gate
enforces. Placement rules are `CODE-STANDARDS.md` §10; the determinism rules every test obeys
are `DETERMINISM.md`.

## Files

This document is split into topic files (#313). Read only the file a ticket or brief cites.

| File                                                                       | Sections  | Topic                                                |
| -------------------------------------------------------------------------- | --------- | ---------------------------------------------------- |
| [`testing/tiers-and-builders.md`](./testing/tiers-and-builders.md)         | §1–§7     | Tiers, placement, builders, coverage and flaky tests |
| [`testing/scenario-runner.md`](./testing/scenario-runner.md)               | §8–§8.2   | Gameplay tier: the scenario runner and replay        |
| [`testing/bots-and-design-tables.md`](./testing/bots-and-design-tables.md) | §8.3–§8.5 | Bots, proving scenarios and the design tables        |
