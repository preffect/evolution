# Evolution — Deterministic Simulation Contract

Same seed + same config + same balance + same inputs ⇒ the same state, on every run, on every
machine that runs the same Node version. This is what makes the design's acceptance scenarios
(#75, #102), replays, visual-regression screenshots and the 10 000-tick hash test (#73)
possible. Structure is in [`ARCHITECTURE.md`](./ARCHITECTURE.md); coding rules in
[`CODE-STANDARDS.md`](./CODE-STANDARDS.md); the gameplay rules that draw from the streams are
in [`GAME-DESIGN.md`](./GAME-DESIGN.md) and [`ECOLOGY.md`](./ECOLOGY.md).

## Files

This document is split into topic files (#313). Read only the file a ticket or brief cites.

| File                                                                                 | Sections | Topic                                         |
| ------------------------------------------------------------------------------------ | -------- | --------------------------------------------- |
| [`determinism/contract-and-clock.md`](./determinism/contract-and-clock.md)           | §1–§2    | The contract, clock and fixed step            |
| [`determinism/random-streams.md`](./determinism/random-streams.md)                   | §3       | Seeded random streams                         |
| [`determinism/ordering-and-state-hash.md`](./determinism/ordering-and-state-hash.md) | §4–§5    | Ordering rules and the state hash             |
| [`determinism/replay-tests-and-traps.md`](./determinism/replay-tests-and-traps.md)   | §6–§8    | Replay, what the tests assert and known traps |
