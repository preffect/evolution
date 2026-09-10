# Evolution — Testing Standards

The bar every PR is reviewed against (#76). `ENGINEERING.md` §2 gives the principles; this
document gives the tiers, the file rules, the builders and the coverage numbers the gate
enforces. Placement rules are `CODE-STANDARDS.md` §10; the determinism rules every test obeys
are `DETERMINISM.md`.

## 1. The tiers

| Tier            | Proves                                                                           | File                                                 | Runs in                                     | Required when                                                     |
| --------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| **Unit**        | one pure function, class or module in isolation; no I/O; < 100 ms                | `foo.test.ts` beside `foo.ts` (client `foo.spec.ts`) | `./validate.sh test` (part of `all`)        | always: every function, formula, modifier, schema, reducer branch |
| **Integration** | a wire between subsystems: room + module + router, `/ws` over a real socket pair | `foo.integration.test.ts` / `.integration.spec.ts`   | `./validate.sh integration` (opt-in)        | any change that crosses a subsystem boundary                      |
| **Gameplay**    | a rule or a balance number, as a scenario on a fixed seed                        | `packages/server/src/testing/scenarios/<table>.ts`   | `./validate.sh test` (they are unit-speed)  | any change to rules, tunables or the step order                   |
| **UI**          | a component renders and dispatches; a critical flow works end to end             | `*.spec.ts` (component); Playwright smoke            | `./validate.sh test`; smoke by the QA roles | HUD, prompts, lobby and any critical flow                         |

A unit test that needs a server, a socket or a browser is an integration test with the wrong
name: rename it rather than slowing the unit tier (`ENGINEERING.md` §2.2). Gameplay scenarios
are unit-speed because the simulation is pure: build a world, step N ticks, assert values and
`computeStateHash`; one file per design table, tests named by row id (`E9`, `P3`, `T4`, `G2`).

## 2. How the tiers are selected

- `vitest.tiers.ts` at the repo root is the one place the globs live; every package's
  `vitest.config.ts` spreads `testTierOptions()` and `coverageOptions(thresholds)` from it.
- Default runs include `src/**/*.test.ts` and exclude `*.integration.test.ts`. Each package's
  `test:integration` script (`RUN_INTEGRATION=1 vitest run`; the client's
  `ng run client:test-integration`) flips to the integration globs, with `passWithNoTests` so a
  package without integration tests yet still passes.
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

| Package  | File                        | Provides                                                                                                                                                                                                                                                                                                                   |
| -------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server` | `testing/builders.ts`       | `createTestConnection`, `createSpyGameModule`, `createDebugCapableGameModule(handle)`, `createManualRoomTiming` (`ManualClock` + `ManualTicker`), `createTestLobby(options)`, `createTestDebugContext`, `createActiveRoomFixture` (a started room + tool capture), `createToolCapture` (invoke MCP tools), `parseToolJson` |
| `client` | `testing/fake-websocket.ts` | `FakeWebSocket`: install with `vi.stubGlobal('WebSocket', FakeWebSocket)`, then `open()` / `receive()` / `close()` from the test                                                                                                                                                                                           |
| `shared` | `testing/builders.ts` (#98) | `createTestCell`, `createTestWorld`, `createTestSnapshot` once the simulation lands                                                                                                                                                                                                                                        |

Rules: builders take a partial and fill defaults (`createTestCell({ mass: 40 })`); builder
defaults are the only tolerated inline test numbers; a shape change is one edit in the
builder. `src/testing/**` is excluded from coverage and from `jscpd`.

## 5. Coverage thresholds

`./validate.sh test` runs `@vitest/coverage-v8` (shared, server) and the Angular unit-test
builder's coverage (client) and **fails below the thresholds** in each package's config:

| Package  | Target (lines / branches / functions / statements) | Where                                                              | Today                      |
| -------- | -------------------------------------------------- | ------------------------------------------------------------------ | -------------------------- |
| `shared` | 95 %                                               | `packages/shared/vitest.config.ts`                                 | 100 % lines                |
| `server` | 90 %                                               | `packages/server/vitest.config.ts`                                 | 94 % lines, 96 % branches  |
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
