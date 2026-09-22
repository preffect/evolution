# Evolution — Testing Standards: the gameplay scenario runner and replay

§8–§8.2 of the split [`TESTING.md`](../TESTING.md), which keeps the shared context and the file list.

## 8. Gameplay tier: the scenario runner (`packages/server/src/testing/gameplay/`, #75)

The design tables (`ecology/acceptance.md` §8, `game-design/constants-and-acceptance.md` §13, `PROGRESSION.md` §7, `traits/constants-and-acceptance.md` §6)
read "given seed S and inputs I, after N ticks assert X". The runner turns one row into one test
without a server, a socket or a browser: it builds the room's `GameModule` the way the lobby
would, drives it under a `ManualClock` through the production `FixedStepAccumulator`
(`determinism/contract-and-clock.md` §2; never wall time, bursts capped at `MAX_TICKS_PER_ADVANCE`, the clock
positioned at the absolute time of each burst's last tick so no float residue accumulates),
feeds joins, leaves, scheduled fixtures and scripted inputs before the step they apply in,
hashes the state at checkpoints and evaluates every expectation at its tick. The framework
knows nothing about the game: a `ScenarioAdapter` (`adapter.ts`) tells it how to create the
module, read a snapshot, hash the state, turn a command into the wire input, find a player's
cell and place a fixture. `echo-adapter.ts` serves the template's echo module (the proving
scenarios); `evolution-adapter.ts` serves the Evolution module, and the scenario tables under
`testing/scenarios/` import that binding.

### 8.1 Writing a scenario

```ts
// packages/server/src/testing/scenarios/ecology.gameplay.test.ts
import { createDecayedHelper, insideCellOf, player, targetRadiiEast } from '../gameplay/index.js';
import { PLACED_ROW_SEED, evolutionScenario as scenario } from '../gameplay/evolution-adapter.js';
import { massOf } from '../gameplay/evolution-views.js';

const decayed = createDecayedHelper({ cellStartingMass: ..., massDecayRatePerSecond: ... }); // from DEFAULT_BALANCE

it('E9: A absorbs B on tick 30', async () => {
  await scenario('E9')
    .seed(PLACED_ROW_SEED)
    .players(2)
    .placeCell({ playerIndex: 0, mass: 100 })                          // broth point (1500, 0)
    .placeCell({ playerIndex: 1, mass: 20, eastOfFirstCellWu: 10 })    // east of A, centres 10 wu apart
    .advance(30)
    .expect('A mass', (view) => massOf(view, 0)).atTick(30).toBeCloseTo(decayed(100, 30) + 16, 0.01)
    .expect('B spectating', (view) => progressOf(view, 1)?.lifeState).atEnd().toBe('spectating') // the snapshot's progressByPlayer
    .runDeterministic();
});
```

- **Seed and roster.** `.seed(S)` is required; `.players(n)` (a whole number ≥ 1) gives indices
  `0 … n − 1` present from tick 0 (ids `player_<index>`, names `Player <index>`).
  `.playerJoinsAt(tick)` adds a late joiner (its index is the count before the call, G9/P7);
  `.playerLeavesAt(tick, index)` removes one before that step (G10: the fixture drives the room's
  grace timer) and must come after the join. `.config({...})` overrides the session config.
- **Placement.** `.placeCell`, `.placeMote` and `.placeFragment` follow `ecology/acceptance.md` §8
  (`fixtures.ts`, `placement.ts`): the first cell sits at the broth point, anything after it is
  placed `eastOfFirstCellWu` (the row's centre distance) or at an explicit `at`. `at` is an
  **anchor**, resolved by the adapter once the world exists: a bare `{ x, y }`, a zone
  (`ZONE.broth`, `ZONE.vent`, `ZONE.shallows`), `insideCellOf(i)` (E12, E15, P2),
  `eastOfCellOf(i, wu)` (E4 against a seeded cell) or `gelPatchCentre(n)` (E8). A cell takes
  `isPinned`, `traits` (`'cilia'` is tier I, `{ traitId: 'nucleoid', tier: 2 }` names the tier,
  traits/model.md §2; `[]` strips every trait, G13's "A at level 1"; left out, the cell keeps its own),
  `dnaCumulative` (P7, P10: "level 12 with fixture DNA 1760") and `dnaCatchUpGift`,
  the entry-rule gift inside that DNA (E9c: "140 with 100 gift"). A setup placement
  applies before tick 1; **`.atTick(T).placeMote(...)`** schedules the same record to apply
  between tick T − 1 and tick T, after that tick's joins and leaves and before its scripts
  (E13–E16, P2, P6, P7, P11: "one bacterium inside the cell per tick for 10 ticks" is ten
  `.atTick(t).placeMote(...)` calls). Scheduled fixtures are recorded in the replay as
  `patches`. Placing anything means the adapter disables the initial fill and both spawners for
  that run, vacates the wild seats (a seeded wanderer would otherwise walk into a placed cell and its
  separation push or engulf would break the row's arithmetic; a placed row seats only the wild cells
  it places, so `.placeWildCell` seats its record on demand), and fails the scenario when a seeded gel
  patch lies within `GEL_PATCH_CLEARANCE_WU` of the broth point (`isClearOfGelPatches`; pick another
  seed, never tolerate it).
  **`.placeWildCell({ seat, spreadFactor, at | eastOfFirstCellWu })`** (ecology/acceptance.md §8.1: the W rows
  and G13; #498) sets wild seat `seat`'s spread factor, places or replaces its cell (the broth point when
  no player cell was placed, else `at` or east of the first placed player cell; a wild cell is never "the
  first cell") and clears the seat's target and velocity as a respawn does, so the seat has no target
  until its next decision tick; the seat keeps its heading, a cell it already had is withdrawn without
  detritus (`withdrawCell`, its engulfs aborted), and the new one is seated through the simulation's own
  `seatWildCell`, pinned to the world from its first tick. It schedules with `.atTick(T)` like any placement
  (W6: placed after tick 21 599, seat 0 decides on 21 600). An adapter may add fixtures of its own beside the placed
  records (`.place(fixture)` / `.atTick(T).place(fixture)`): the Evolution adapter's
  `resetSpawnerAccumulators` and `clearFood` are the E14 / W3 / W9 window fixtures.
- **Seeds and the Evolution snapshot.** `TABLE_SEED` (42) is what every row names;
  `PLACED_ROW_SEED` (48) is what the placed rows run on, because only the gel patches come from
  the seed and seed 42 puts one 73 wu from the broth point (ecology/acceptance.md §8's clearance rule refuses
  it). The scenario snapshot is the full snapshot with **exact values** (`EXACT_SNAPSHOT_VALUES`: the tables
  assert ± 0.01 wu; only the wire rounds positions, velocity, mass, radius and the leaderboard's score and mass to
  their `SNAPSHOT_*_DECIMALS`, #341; the bots a scenario drives read it too, so they perceive exact values where a
  `debug_spawn_bot` or `bot-client` bot perceives the wire's, and a hunter within one 0.1-mass step of the engulf
  ratio can decide differently in a table row than in a live room), plus that tick's `effects`
  and the spawners' `spawnedCounts` (E2, E14 count spawns, not populations), plus `wildSeats`: every
  seat record with its cell's latched target (`WildSeatView`; the world clock never rides the wire, and
  W6 and W7 read where a decision sent a seat). `evolution-views.ts`
  holds the selectors a row reads through (`cellOf`, `progressOf`, `massOf`, `speedOf`,
  `foodCount`, `fragmentCount`, `effectsOfKind`, `distanceBetweenCells`, and for the seats `wildSeatOf`,
  `wildCellOf`, `wildCellsOf`).
- **Inputs.** "At tick T" means submitted between tick T − 1 and tick T, so step T applies it
  (inputs apply at tick boundaries; tick 0 is the initial state, so inputs start at tick 1).
  `.atTick(T, player(i).does(script))` fires once; `.from(T, …)` every step from T;
  `.between(T1, T2, …)`; `.every(n, …, fromTick)` re-evaluates every n ticks ("greedy bot,
  re-evaluated every 30 ticks"). A window must start while its player is in the room and must
  not claim ticks after they leave (`build()` rejects it); an open window simply stops feeding a
  player who has left. Scripts (`scripts.ts`) see the state before the step and answer a
  `PlayerCommand`: `targetPoint`, `targetRadiiEast(n)` (measured from the _current_ centre every
  tick, the convention), `targetRadiiAwayFrom`, `sprint()`, `chooseTrait({ offerId, cardIndex })`,
  `command({...})`, `idle`, and `combineScripts([...])` for "sprint + target 5 radii east". A
  cell-relative script whose player has no cell this tick (absorbed, spectating, the tick it
  joins) sends nothing; an adapter with no world (echo) throws instead. Commands for one player
  in one tick are merged (later fields win; the sprint flag and the trait pick are OR-merged,
  `architecture/server-simulation.md` §3.2) and the adapter stamps the sequence.
- **Bots.** `.bot(index, factory, everyTicks)` drives a player from a `BotStrategy` built by
  `factory` (`bots.ts`): the interface the `idle` / `wander` / `grazer` / `hunter` / `flee` strategies of
  section 8.3 implement and the headless bot client reuses. The schedule holds the **factory**, not an
  instance: every run (both runs of `runDeterministic`) gets a fresh strategy, so a strategy may
  keep state across its decisions. Its only other input is `ScriptContext`, and its only source
  of randomness is `context.random`, a stream forked from the scenario seed per player
  (`scenario_player_<index>`): a strategy that draws from anywhere else, or a factory that
  returns a shared instance, diverges on the second run. A bot starts deciding at tick 1 or at
  its join tick. `createScriptedStrategy(name, script)` wraps a pure script as a factory.
- **Time.** `.advance(ticks)` accumulates the run length; `.hashEvery(n)` sets the checkpoint
  cadence (default 600; tick 0 and the final tick are always checkpoints).
- **Assertions.** `.expect(label, selector).atTick(T)` or `.atEnd()` then `.toBe`, `.toEqual`,
  `.toBeNull`, `.toBeCloseTo(value, tolerance)` ("± 0.01" in the tables), `.toBeLessThan`,
  `.toBeGreaterThan`, `.toBeAtLeast` ("≥ 5"), `.toBeAtMost`, `.toBeBetween(low, high)`
  (inclusive, "between 70 and 74") or `.toSatisfy(predicate, description)` for anything else,
  where `description` is exactly what the failure prints, so it carries the bound and the unit
  ("between 70 and 74 motes"). A selector gets a `ScenarioView`: `tick`, `seed`, `snapshot`,
  `playerId(index)`, `cell(index)` and `captured(label)`. A selector that yields `undefined` (a
  cell that is gone, `?.lifeState` on a missing player) fails every matcher with `got undefined`;
  `toBeNull` accepts `null` only. Failures are collected, not thrown one at a time: `.run()`
  rejects with one `ScenarioAssertionError` listing every miss.
- **Captures.** `.capture(label, selector).atTick(T)` stores the selected value before that
  tick's expectations run; a later selector reads it as `view.captured(label)` (G10: detritus
  mass from the cell's mass at tick 2399; G7: the speed cap from the mass at that tick). Reading
  a label not captured yet yields `undefined` and fails the expectation.
- **Run.** `.run()` executes once and resolves to the replay, the final snapshot and hash and the
  checkpoints. `.runDeterministic()` runs twice and rejects with `ScenarioDivergenceError` at the
  first checkpoint the runs disagree on; every table row uses it, so a rule that reads the wall
  clock or an unseeded draw fails the row that exercises it. Both are async and a row awaits them:
  the tick driver returns to the event loop after every burst, as the room loop does, because a
  whole round held synchronously starved the test worker's RPC past its 60 s timeout (#262).

**Table wording → tick stamp.** Expectation and script ticks are absolute across accumulated
`.advance()` calls, and `build()` throws `ScenarioSetupError` for anything stamped past the last
advanced tick (an expectation, a capture, a script window, a join, a leave, a scheduled
fixture): a test that could never fail is not a test. So "After N ticks" is the run length and
must cover the largest assertion tick (G7 says "After 2 ticks" but asserts at 31, 100 and 181:
`.advance(181)`). "Joins before tick 6000 steps" is `playerJoinsAt(6000)` and "join + 1" is
`.atTick(6000)` (P7's 199.994 is one decay tick after placement, so join + 1 _is_ 6000). "The
fixture calls `removePlayer` at tick 2400" is `playerLeavesAt(2400, i)`; the cell's last
observable state is tick 2399 (capture it there). "Fixture sets A.mass = 23 before tick 10" is
`.atTick(10).placeCell({ playerIndex: 0, mass: 23 })`. "Idle" is no script at all.

### 8.2 Replay and the failure output

Every run records a `ScenarioReplay` (`replay-format.ts`): seed, config, setup fixtures, the
tick-0 roster, every join and leave, every scheduled fixture (`patches`) and every applied input
stamped with the tick it was applied in, plus the hash checkpoints. `verifyReplay(replay,
adapter)` rebuilds a fresh module from the record, buckets the log by tick once (a replay costs
the run plus the log, never the log per tick) and must reproduce every checkpoint;
`replayScenario` returns the verdict without throwing. A replay never calls a script or a
strategy: it feeds the recorded inputs. A failing `.run()` writes the replay through the adapter
binding's sink, by default `qa/replays/<scenario-slug>.replay.json` (gitignored), and the error
names it. The output always carries what reproduces the failure:

```text
Scenario "E9" failed (seed 42):
  at tick 30: A mass
    expected 115.92003865463975 ± 0.01, got 110.4 (off by 5.52)
  replay written to /workspace/qa/replays/e9.replay.json

Scenario "E9" diverged (seed 42): first differing checkpoint at tick 600: expected 1f3a…, got 9c0e… (identical through tick 0)
```

`toBeCloseTo` prints the expected value as computed and "off by" rounded to the tolerance's
decimals. A divergence is bisected by lowering `.hashEvery(1)` on that scenario: the report then
names the exact tick (`determinism/replay-tests-and-traps.md` §7). To run one scenario file on its own, scope the
integration tier to it (`engineering/validation-gate.md` §1):

```bash
./validate.sh integration --scope packages/server/src/testing/scenarios/ecology-engulf.gameplay.test.ts
./validate.sh integration --scope server -- ecology   # every server opt-in file whose path contains "ecology"
```

A framework test never uses the file sink: pass `createMemoryReplaySink()` to
`createScenarioDsl(adapter, { replaySink })`.
