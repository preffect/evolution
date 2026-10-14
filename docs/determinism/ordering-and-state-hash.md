# Evolution — Deterministic Simulation Contract: ordering rules and the state hash

§4–§5 of the split [`DETERMINISM.md`](../DETERMINISM.md), which keeps the shared context and the file list.

## 4. Ordering rules

- **Players** are stepped in join order (`world.players`). Late joiners append.
- **Inputs:** one coalesced input per player per tick; a `sequence` ≤ the applied one is
  dropped. One-shots (`shouldSprint`, `traitChoice`) apply once.
- **Entities** are stepped in array order. Removal preserves order (`filter` into a new array
  or `splice`); never swap-remove. Spawns append. Cluster members spawn in draw order.
- **Spatial hash** results are id-sorted before use. Pair processing (separation, engulf)
  iterates the sorted pair list `(lowerId, higherId)`; "two predators reach one prey" resolves to
  the lower cell id (ecology/absorption.md §6.3).
- **Sorting** always ends in `compareEntityIds(a.id, b.id)`; the leaderboard comparator is
  score, then mass, then `joinOrder`.
- **Floating point.** Fixed evaluation order inside systems; sums over collections go
  left-to-right in array order; no `Math.fround` tricks; NaN/Infinity are bugs (the hash throws
  on them). Identical operation order gives identical results on one Node major version
  (`engines` in `package.json`).

## 5. State hash (`packages/shared/src/simulation/state-hash.ts`, `packages/server/src/game/world/state-hash.ts`)

```ts
export const computeStateHash: (world: HashableWorldState) => StateHash; // 16-hex-char string
```

The kernel is split in two: `simulation/state-hasher.ts` (`StateHasher`: the two lanes, the
scalar encodings, `digest()`) and `simulation/state-hash.ts` (the walk helpers `hashFields`,
`hashEnumRecord`, `hashArray`, `hashRandomStreams`, `hashText`); `computeStateHash` itself composes
them over the server records' `HASHED_FIELDS` lists in `packages/server/src/game/world/state-hash.ts`,
beside the records it walks. Both lanes fold bytes with the one FNV-1a primitive in
`hashing/fnv1a.ts`, which `hashLabel` shares. A `HashedField<T>` entry is a scalar field name
or `{ key, hash }` for a nested value, so listing a field with the wrong shape is a type error.

- Two independent 32-bit FNV-1a lanes over a **canonical walk**: `tick`, `seed`, `roundStartTick`,
  `roundPhase`, `roundTimeLeftMs`, `roundFirstEntityNumber`, `firstGiantSeatNumber`, then each array in order (`cells`,
  `food`, `dnaFragments`, `players`, `wildSeats`, `giantSeats`, `gelPatches`), the two `spawners`, the `random`
  streams in `ALWAYS_HASHED_RANDOM_STREAM_LABELS` order, then `nextEntityNumber`, then, only when some cell holds a bacterium,
  every cell's held list in cell order (`TRAILING_CELL_HASHED_FIELDS`: `latchedBacteria`, game-design/early-life.md
  §15.11; last, so a world in which no cell holds one hashes byte for byte as before the lists existed, and the
  section's presence is unambiguous: it is there or the walk has ended, #907), then, only once the world has **era
  state**, the eras' section (`game/world/era-hashed-section.ts`, `hashEraSection`): the era it moved into
  (`eraMovedInto`, architecture/server-simulation.md §3), the eras' three streams in `ERA_RANDOM_STREAM_LABELS` order,
  then the pool's own state, each `null` or its fields: `poolLayout`, `surge`, `copepodLane`, then the creatures' seats
  `poolCreatureSeats` (`POOL_CREATURE_SEAT_HASHED_FIELDS` per seat, in seat order; ticket #935; a creature cell's
  `poolCreature` is its seat's mirror and is left out as derived, as `isStarving` is)
  (`TRAILING_WORLD_HASHED_FIELDS` lists the world fields in walk order). A world has era state (`hasEraState`) once it
  has left the dish, drawn from one of the eras' streams (determinism/random-streams.md §3: they are hashed only once
  drawn) or holds a layout, a surge, a copepod's pass or the creatures' seats (an empty list included). Every world that never reaches the pool, every world while
  the eras are off, feeds the section nothing and hashes as before the eras (#931, #932). The era opens the section
  with a string's tag where the held lists open with an array's, so either section's presence reads from its first
  byte. This section is the home of all the eras' hashed state: the move's grace (ticket #868) and the rest of the
  creatures' state (the copepod's schedule, ticket #873) join it, inside it and under its gate: each joins `POOL_STATE_HASHED_FIELDS`, the one list the gate and the walk
  both iterate (null when the world has none of it), and its test then asks for a case that changes the field inside an
  open section, while a recorded hash of a world holding every field pins the walk's order; never in a third trailing
  section, so the
  pre-eras hash stays byte for byte and the sections' boundaries stay unambiguous;
  each record's fields in
  the order `HASHED_FIELDS[kind]` declares. Every scalar is preceded by a type tag
  (so `0`, `false`, `""` and `null` differ); numbers hash by their IEEE-754 bits (one shared
  `DataView`), strings by a length prefix then UTF-16 code units, booleans as 0/1, `null` as a
  marker byte; arrays and enum records by a length prefix then their items.
- **No object-key iteration.** `Record<DnaTag, number>` and `Record<BacteriumVariant, number>`
  are walked in `DNA_TAGS` / `BACTERIUM_VARIANTS` order; `world.random` in
  `ALWAYS_HASHED_RANDOM_STREAM_LABELS` order, then the eras' streams in `ERA_RANDOM_STREAM_LABELS` order inside their
  section (the client's `cosmetic` stream is never in the hashed
  world). A record field that is not in `HASHED_FIELDS` is not hashed, so adding a debug-only
  field cannot silently change the hash, and a new gameplay field must be added to the list
  (the test table pins that every non-derived field is listed, in its record's list or a trailing one).
- Random stream state is included (a run that consumed a different number of draws differs).
- Derived data (spatial hash, `leaderboard`, `effects`, `massFlow` (transient like `effects`, #383),
  `CellRecord.heldDisplacementX/Y` (transient: cleared at step 6, read only by the serializer, #774),
  `CellRecord.isStarving` and `CellRecord.poolCreature` (their seats' mirrors, #935), `balance`, `config`) is excluded:
  the leaderboard is a function of the players, effects are transient, and balance and config
  are inputs recorded by the replay instead.
- Cost: O(entities); computed on demand (tests, `debug_get_state_hash`, replay end, the
  `getRoomGameState` summary), never every tick in production.
