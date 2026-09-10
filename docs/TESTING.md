# Evolution — Testing Standards

The bar every PR is reviewed against (#76). `ENGINEERING.md` §2 gives the principles; this
document gives the tiers, the file rules, the builders and the coverage numbers the gate
enforces. Placement rules are `CODE-STANDARDS.md` §10; the determinism rules every test obeys
are `DETERMINISM.md`.

## 1. The tiers

| Tier            | Proves                                                                           | File                                                             | Runs in                                     | Required when                                                     |
| --------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| **Unit**        | one pure function, class or module in isolation; no I/O; < 100 ms                | `foo.test.ts` beside `foo.ts` (client `foo.spec.ts`)             | `./validate.sh test` (part of `all`)        | always: every function, formula, modifier, schema, reducer branch |
| **Integration** | a wire between subsystems: room + module + router, `/ws` over a real socket pair | `foo.integration.test.ts` / `.integration.spec.ts`               | `./validate.sh integration` (opt-in)        | any change that crosses a subsystem boundary                      |
| **Gameplay**    | a rule or a balance number, as a scenario on a fixed seed (section 8)            | `packages/server/src/testing/scenarios/<table>.gameplay.test.ts` | `./validate.sh integration` (opt-in)        | any change to rules, tunables or the step order                   |
| **UI**          | a component renders and dispatches; a critical flow works end to end             | `*.spec.ts` (component); Playwright smoke                        | `./validate.sh test`; smoke by the QA roles | HUD, prompts, lobby and any critical flow                         |

A unit test that needs a server, a socket or a browser is an integration test with the wrong
name: rename it rather than slowing the unit tier (`ENGINEERING.md` §2.2). Gameplay scenarios
build a world, step N ticks, assert values and the state hash on the framework of section 8; one
file per design table, tests named by row id (`E9`, `P3`, `T4`, `G2`). A single row is cheap,
but a table steps the real module for thousands of ticks (G2 runs 37 200), so the tier runs with
the opt-in integration run rather than on every save.

## 2. How the tiers are selected

- `vitest.tiers.ts` at the repo root is the one place the globs live; every package's
  `vitest.config.ts` spreads `testTierOptions()` and `coverageOptions(thresholds)` from it.
- Default runs include `src/**/*.test.ts` and exclude `*.integration.test.ts` and
  `*.gameplay.test.ts`. Each package's `test:integration` script (`RUN_INTEGRATION=1 vitest run`;
  the client's `ng run client:test-integration`) flips to the opt-in globs (integration plus
  gameplay), with `passWithNoTests` so a package without any yet still passes. The gameplay
  suffix is its own glob (`GAMEPLAY_TEST_GLOBS`) rather than a third command: the scenarios are
  run at the same moment as the integration tests (the end of a task), and one opt-in run is one
  thing to remember; the distinct suffix keeps them selectable (`vitest run src/testing/scenarios`)
  and lets a later ticket split the command without renaming a file.
- The client's `test` target in `angular.json` excludes `**/*.integration.spec.ts`; its
  `test-integration` target includes only them.
- Run the integration tier at the end of a task that may have caused a cross-subsystem
  regression, never on every save.

## 3. Naming and placement

- Co-located, same basename: `game-room.ts` → `game-room.test.ts`. No `__tests__/` directories.
- `describe` names the unit (`'PerformanceTracker'`, `'debug_get_room'`); `it` states one
  behaviour in the present tense: `it('drops an input whose sequence is not newer', …)`.
- One behaviour per test. Assert values and hashes; never snapshot a large object, never
  assert object identity on the in-place simulation state (`ARCHITECTURE.md` §3.1).
- A test that needs randomness seeds it (`createSeededRandom(TEST_SEED)`); a test that needs
  time uses `ManualClock` or vitest fake timers. `Math.random`, `Date.now` and
  `performance.now` are lint-banned in tests too (`CODE-STANDARDS.md` §8).

## 4. Builders, not fixture files

Each package keeps its test doubles in `src/testing/`:

| Package  | File                        | Provides                                                                                                                                            |
| -------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server` | `testing/builders.ts`       | `createTestConnection`, `createSpyGameModule`, `createTestLobby`, `createTestDebugContext`, `createToolCapture` (invoke MCP tools), `parseToolJson` |
| `server` | `testing/gameplay/` (#75)   | the scenario runner of section 8: `createScenarioDsl`, `player`, the scripts, the fixture helpers, replay and the echo adapter                      |
| `client` | `testing/fake-websocket.ts` | `FakeWebSocket`: install with `vi.stubGlobal('WebSocket', FakeWebSocket)`, then `open()` / `receive()` / `close()` from the test                    |
| `shared` | `testing/builders.ts` (#98) | `createTestCell`, `createTestWorld`, `createTestSnapshot` once the simulation lands                                                                 |

Rules: builders take a partial and fill defaults (`createTestCell({ mass: 40 })`); builder
defaults are the only tolerated inline test numbers; a shape change is one edit in the
builder. `src/testing/**` is excluded from coverage and from `jscpd`.

## 5. Coverage thresholds

`./validate.sh test` runs `@vitest/coverage-v8` (shared, server) and the Angular unit-test
builder's coverage (client) and **fails below the thresholds** in each package's config:

| Package  | Target (lines / branches / functions / statements) | Where                                                              | Today                      |
| -------- | -------------------------------------------------- | ------------------------------------------------------------------ | -------------------------- |
| `shared` | 95 %                                               | `packages/shared/vitest.config.ts`                                 | 100 % lines                |
| `server` | 90 %                                               | `packages/server/vitest.config.ts`                                 | 92 % lines, 93 % branches  |
| `client` | 80 %                                               | `packages/client/angular.json` → `test.options.coverageThresholds` | 100 % lines, 82 % branches |

- Thresholds are floors that only move up: raise them in the same PR that raises coverage,
  never lower them to land a change.
- A new package starts at its target from its first PR.
- Excluded from measurement (they are not logic): `**/index.ts` barrels and composition roots,
  `src/main.ts`, `src/app/app.config.ts`, `src/testing/**`, `*.d.ts`, and the tests themselves.
  Nothing else is excluded; a hard-to-test file is split, not hidden.
- Integration runs do not measure coverage; they prove wiring.

## 6. Flaky tests

A test that fails intermittently is a bug in the test or a determinism bug in the code, never
"just flaky". Do not retry, `.skip` or loosen it. Find the shared state, the unseeded draw or
the wall-clock read; a hash mismatch in a simulation test is bisected by hashing every tick
(`DETERMINISM.md` §7). `./validate.sh all` runs with no retries so a flake surfaces immediately.

## 7. Definition of tested (what a reviewer checks, with `file:line`)

1. Every new function or branch has a unit test for the happy path, the edges and the error.
2. A new wire (message, MCP tool, socket handler, room hook) has an integration test.
3. A changed rule or number has a scenario named by its design-table row.
4. Fixtures come from `src/testing/`; no ad-hoc object literals repeated across tests.
5. No `.only`, no `.skip`, no snapshot of a large object, no `Math.random`, no real time.
6. Coverage did not go down; if it went up, the threshold went up with it.

## 8. Gameplay tier: the scenario runner (`packages/server/src/testing/gameplay/`, #75)

The design tables (`ECOLOGY.md` §8, `GAME-DESIGN.md` §13, `PROGRESSION.md` §7, `TRAITS.md` §6)
read "given seed S and inputs I, after N ticks assert X". The runner turns one row into one test
without a server, a socket or a browser: it builds the room's `GameModule` the way the lobby
would, drives it under a `ManualClock` through the production `FixedStepAccumulator`
(`DETERMINISM.md` §2; never wall time, bursts capped at `MAX_TICKS_PER_ADVANCE`), feeds joins,
leaves and scripted inputs before the step they apply in, hashes the state at checkpoints and
evaluates every expectation at its tick. The framework knows nothing about the game: a
`ScenarioAdapter` (`adapter.ts`) tells it how to create the module, read a snapshot, hash the
state, turn a command into the wire input, find a player's cell and place a fixture.
`echo-adapter.ts` serves the template's echo module today; #98 adds the Evolution adapter, and
the scenario tables (#102) import that binding.

### 8.1 Writing a scenario

```ts
// packages/server/src/testing/scenarios/ecology.gameplay.test.ts
import { createDecayedHelper, player, targetRadiiEast } from '../gameplay/index.js';
import { evolutionScenario as scenario, massOf } from '../gameplay/evolution-adapter.js'; // #98

const decayed = createDecayedHelper({ cellStartingMass: ..., massDecayRatePerSecond: ... }); // from DEFAULT_BALANCE

it('E9: A absorbs B on tick 30', () => {
  scenario('E9')
    .seed(42)
    .players(2)
    .placeCell({ playerIndex: 0, mass: 100 })                          // broth point (1500, 0)
    .placeCell({ playerIndex: 1, mass: 20, eastOfFirstCellWu: 10 })    // east of A, centres 10 wu apart
    .advance(30)
    .expect('A mass', (view) => massOf(view, 0)).atTick(30).toBeCloseTo(decayed(100, 30) + 16, 0.01)
    .expect('B spectating', (view) => view.snapshot.players[view.playerId(1)]?.lifeState).atEnd().toBe('spectating')
    .runDeterministic();
});
```

- **Seed and roster.** `.seed(S)` is required; `.players(n)` gives indices `0 … n − 1` present
  from tick 0 (ids `player_<index>`, names `Player <index>`). `.playerJoinsAt(tick)` adds a late
  joiner (its index is the count before the call, G9/P7); `.playerLeavesAt(tick, index)` removes
  one before that step (G10: the fixture drives the room's grace timer). `.config({...})`
  overrides the session config.
- **Placement.** `.placeCell`, `.placeMote` and `.placeFragment` follow `ECOLOGY.md` §8
  (`fixtures.ts`): the first cell sits at the broth point, anything after it is placed
  `eastOfFirstCellWu` (the row's centre distance) or at an explicit `at`; `isPinned` and
  `traitIds` are the "pinned" and "fixture-granted" conventions. `VENT_POINT`, `shallowsPoint`
  and `GEL_PATCH_CLEARANCE_WU` name the other points of the convention. Placing anything means
  the adapter disables the initial fill and both spawners for that run.
- **Inputs.** "At tick T" means submitted between tick T − 1 and tick T, so step T applies it
  (inputs apply at tick boundaries; tick 0 is the initial state, so inputs start at tick 1).
  `.atTick(T, player(i).does(script))` fires once; `.from(T, …)` every step from T;
  `.between(T1, T2, …)`; `.every(n, …, fromTick)` re-evaluates every n ticks ("greedy bot,
  re-evaluated every 30 ticks"). Scripts (`scripts.ts`) see the state before the step and answer
  a `PlayerCommand`: `targetPoint`, `targetRadiiEast(n)` (measured from the _current_ centre every
  tick, the convention), `targetRadiiAwayFrom`, `sprint()`, `chooseTrait({ offerId, cardIndex })`,
  `command({...})`, `idle`, and `combineScripts([...])` for "sprint + target 5 radii east".
  Commands for one player in one tick are merged (later fields win, the sprint flag is
  OR-merged, `ARCHITECTURE.md` §3.2) and the adapter stamps the sequence.
- **Bots.** `.bot(index, strategy, everyTicks)` drives a player from a `BotStrategy`
  (`bots.ts`): the interface the `graze` / `hunt` / `flee` / `idle` strategies of #15 implement
  and the headless bot client reuses. `createScriptedStrategy(name, script)` wraps a script.
- **Time.** `.advance(ticks)` accumulates the run length; `.hashEvery(n)` sets the checkpoint
  cadence (default 600; tick 0 and the final tick are always checkpoints).
- **Assertions.** `.expect(label, selector).atTick(T)` or `.atEnd()` then `.toBe`, `.toEqual`,
  `.toBeNull`, `.toBeCloseTo(value, tolerance)` ("± 0.01" in the tables) or
  `.toSatisfy(predicate, description)`. A selector gets a `ScenarioView`: `tick`, `seed`,
  `snapshot`, `playerId(index)` and `cell(index)`. Failures are collected, not thrown one at a
  time: `.run()` throws one `ScenarioAssertionError` listing every miss.
- **Run.** `.run()` executes once and returns the replay, the final snapshot and hash and the
  checkpoints. `.runDeterministic()` runs twice and throws `ScenarioDivergenceError` at the first
  checkpoint the runs disagree on; every table row uses it, so a rule that reads the wall clock or
  an unseeded draw fails the row that exercises it.

### 8.2 Replay and the failure output

Every run records a `ScenarioReplay` (`replay-format.ts`): seed, config, fixtures, the tick-0
roster, every join and leave and every applied input stamped with the tick it was applied in,
plus the hash checkpoints. `verifyReplay(replay, adapter)` rebuilds a fresh module from the
record and must reproduce every checkpoint; `replayScenario` returns the verdict without
throwing. A failing `.run()` writes the replay through the adapter binding's sink, by default
`qa/replays/<scenario-slug>.replay.json` (gitignored), and the error names it. The output always
carries what reproduces the failure:

```text
Scenario "E9" failed (seed 42):
  at tick 30: A mass
    expected 115.92 ± 0.01, got 110.4 (off by 5.52)
  replay written to /workspace/qa/replays/e9.replay.json

Scenario "E9" diverged (seed 42): first differing checkpoint at tick 600: expected 1f3a…, got 9c0e… (identical through tick 0)
```

A divergence is bisected by lowering `.hashEvery(1)` on that scenario: the report then names the
exact tick (`DETERMINISM.md` §7). A framework test never uses the file sink: pass
`createMemoryReplaySink()` to `createScenarioDsl(adapter, { replaySink })`.

### 8.3 Proving scenarios

`packages/server/src/testing/scenarios/echo.gameplay.test.ts` runs the framework against the echo
module: inputs echo from the tick they were applied and a late joiner is present from its step,
each hash-equal across two runs and reproduced by its replay; two more fail on purpose (a wrong
expectation, a script with an unseeded closure) and pin the failure output above. The echo
adapter hashes `JSON.stringify(serializeRoomState())` through `hashText` (`DETERMINISM.md` §7)
because the echo game has no `WorldState`; it cannot locate cells or place fixtures, and says so.
`toy-adapter.ts` is a two-rule world used only by the framework's own unit tests.
