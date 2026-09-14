# Evolution — Ecology, Growth and Absorption

Tickets: #23 (food ecology), #26 (size, mass, speed, mitosis), #27 (absorption). Epic #2.
World geometry, the evolution ladder, session rules and controls: [`GAME-DESIGN.md`](./GAME-DESIGN.md).
DNA and levels: [`PROGRESSION.md`](./PROGRESSION.md). Trait modifiers named below: [`TRAITS.md`](./TRAITS.md).

Units: world units (wu), mass units (mass), seconds (s), ticks at `TICK_HZ` = 60 (`constants/network.ts`).
All randomness comes from the seeded `spawner` stream (#73) except gel placement (`zones`), safe
spawn placement (`spawnPlacement`, [`game-design/session.md §5.2`](./game-design/session.md#52-spawn-death-and-respawn))
and mote motion (`moteMotion`, label `mote_motion`: bacteria random-walk headings every tick and a
fragment's drift direction at spawn, so the number of living bacteria never shifts a spawn point)
and the spit-out rolls of §6.1 (`engulf`, label `engulf`: one draw per tick per wrapped or sealed prey
whose `spitOutChancePerSecond` is positive, and none otherwise); nothing here uses wall time. Stream labels: [`determinism/random-streams.md §3`](./determinism/random-streams.md#3-seeded-random-streams-packagessharedsrcrandom-73).

## Files

This document is split into topic files (#306). Read only the file a ticket or brief cites.

| File                                                             | Sections  | Topic                                      |
| ---------------------------------------------------------------- | --------- | ------------------------------------------ |
| [`ecology/food-and-spawn.md`](./ecology/food-and-spawn.md)       | §1–§3.2   | Food, zones and the spawn model            |
| [`ecology/wild-cells.md`](./ecology/wild-cells.md)               | §3.3–§3.4 | Wild cells and what a fresh protocell sees |
| [`ecology/mass-and-movement.md`](./ecology/mass-and-movement.md) | §4–§5     | Mass decay, size, mass and speed           |
| [`ecology/absorption.md`](./ecology/absorption.md)               | §6        | Absorption and engulf                      |
| [`ecology/constants.md`](./ecology/constants.md)                 | §7        | Constants table                            |
| [`ecology/acceptance.md`](./ecology/acceptance.md)               | §8        | Acceptance scenarios                       |
