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
  `roundPhase`, `roundTimeLeftMs`, `roundFirstEntityNumber`, then each array in order (`cells`,
  `food`, `dnaFragments`, `players`, `wildSeats`, `gelPatches`), the two `spawners`, the `random`
  streams in `SERVER_RANDOM_STREAM_LABELS` order, then `nextEntityNumber`; each record's fields in
  the order `HASHED_FIELDS[kind]` declares. Every scalar is preceded by a type tag
  (so `0`, `false`, `""` and `null` differ); numbers hash by their IEEE-754 bits (one shared
  `DataView`), strings by a length prefix then UTF-16 code units, booleans as 0/1, `null` as a
  marker byte; arrays and enum records by a length prefix then their items.
- **No object-key iteration.** `Record<DnaTag, number>` and `Record<BacteriumVariant, number>`
  are walked in `DNA_TAGS` / `BACTERIUM_VARIANTS` order; `world.random` in
  `SERVER_RANDOM_STREAM_LABELS` order (the client's `cosmetic` stream is never in the hashed
  world). A record field that is not in `HASHED_FIELDS` is not hashed, so adding a debug-only
  field cannot silently change the hash, and a new gameplay field must be added to the list
  (the test table pins that every non-derived field is listed).
- Random stream state is included (a run that consumed a different number of draws differs).
- Derived data (spatial hash, `leaderboard`, `effects`, `balance`, `config`) is excluded:
  the leaderboard is a function of the players, effects are transient, and balance and config
  are inputs recorded by the replay instead.
- Cost: O(entities); computed on demand (tests, `debug_get_state_hash`, replay end, the
  `getRoomGameState` summary), never every tick in production.
