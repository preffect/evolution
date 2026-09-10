# Evolution — Code Standards

The concrete, checkable rules behind [`ENGINEERING.md`](./ENGINEERING.md). Every rule here is
either enforced by `./validate.sh lint` once #69 / #70 land, or checked line-by-line in review
(`WORKFLOW.md` §6). Where `ENGINEERING.md` gives a principle, this document gives the number,
the home and an example. Where the two differ, the stricter one wins. Structure is
[`ARCHITECTURE.md`](./ARCHITECTURE.md); the gameplay numbers themselves are owned by the
design docs ([`GAME-DESIGN.md §12`](./GAME-DESIGN.md#12-constants-table) and companions).

## 1. No magic values

Every literal that carries meaning has a name and a home (section 2). Lint: `no-magic-numbers`
(ignores `0`, `1`, `-1` and array indexes) in `shared` and `server` fully; client render code
only inside `render/constants.ts`. Strings: message verbs, entity kinds, trait ids, stage names,
stream labels and effect names are `as const` objects or literal unions derived from a constant
array, never bare literals in logic.

```ts
// wrong
if (predator.mass >= prey.mass * 1.25) startEngulf(predator, prey, 1.0);
socket.send(JSON.stringify({ type: 'player_input', payload }));

// right
const { ENGULF_MASS_RATIO, ENGULF_BASE_DURATION_SECONDS } = context.balance.absorption;
if (predator.mass >= prey.mass * (ENGULF_MASS_RATIO + prey.modifiers.membraneRatioBonus)) {
  startEngulf(predator, prey, ENGULF_BASE_DURATION_SECONDS);
}
send({ type: CLIENT_MESSAGE_TYPE.playerInput, payload });
```

A literal is allowed inline only when it is the definition of the constant itself, a unit
factor in `packages/shared/src/constants/units.ts` (`MILLISECONDS_PER_SECOND`), or a test value.

## 2. Where every constant, enum and config value lives

**Decision (#72): `packages/shared/src/constants/<domain>.ts` is the single source of truth for
every tunable; `data/balance.json` is generated from it, never edited, and exists for the debug
MCP live-tuning tools.** One file per domain, named and owned as the design tables say:

| File (`packages/shared/src/constants/`)                           | Owned by                             | Contents                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `units.ts`, `network.ts`, `lobby.ts`, `identity.ts`               | the template (already split in #112) | `MILLISECONDS_PER_SECOND`; `TICK_HZ`, `TICK_INTERVAL_MS`, `DISCONNECT_GRACE_MS`, ports; name/avatar/player bounds; storage key                                                                                                                                                                                                                                                                                                |
| `world.ts`, `session.ts`, `controls.ts`, `ladder.ts`, `camera.ts` | `GAME-DESIGN.md §12`                 | dish, spawn safety, round, seed bound, sprint, `STAGE_ORDER`, camera                                                                                                                                                                                                                                                                                                                                                          |
| `ecology.ts`, `growth.ts`, `absorption.ts`                        | `ECOLOGY.md §7`                      | food kinds, spawners, zones, decay, curves, engulf                                                                                                                                                                                                                                                                                                                                                                            |
| `progression.ts`                                                  | `PROGRESSION.md §6`                  | levels, draft weights, timeout, late join                                                                                                                                                                                                                                                                                                                                                                                     |
| `traits.ts`                                                       | `TRAITS.md §5`                       | `TRAIT_CATALOG`, `TRAIT_TIERS`, `DEFAULT_CELL_MODIFIERS`                                                                                                                                                                                                                                                                                                                                                                      |
| `balance.ts`                                                      | `ARCHITECTURE.md §9`                 | `DEFAULT_BALANCE` (the domain modules as namespaces), `BalanceConfig`                                                                                                                                                                                                                                                                                                                                                         |
| `simulation.ts`, `netcode.ts`                                     | `ARCHITECTURE.md §3, §5`             | engineering constants that are not gameplay tunables: `SPATIAL_HASH_CELL_SIZE_WU`, `MAX_TICKS_PER_ADVANCE`, `FIXED_STEP_ROUNDING_TOLERANCE_TICKS`, `SNAPSHOT_EVERY_TICKS`, `SNAPSHOT_POSITION_DECIMALS`, `SNAPSHOT_BUFFER_SIZE`, `INTEREST_MARGIN_WU`, `MAX_EXTRAPOLATION_TICKS`, `RECONCILE_SNAP_DISTANCE_WU`, `RECONCILE_BLEND_SECONDS`, `INTERPOLATION_DELAY_TICKS`, `REPLAY_FORMAT_VERSION`; excluded from `balance.json` |

| Kind of value                                                                                                     | Home                                                                                                                                             | Naming                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Every gameplay number, protocol limit, timing value, curve or weight table                                        | the domain file above; reached inside the simulation as `context.balance.<domain>.<NAME>`                                                        | `UPPER_SNAKE_CASE`, unit suffix from section 6 (`ROUND_DURATION_SECONDS`, `DISH_RADIUS`) |
| The generated balance file                                                                                        | `data/balance.json`, written by `scripts/generate-balance.ts` from `DEFAULT_BALANCE`; pinned equal by `balance.test.ts`                          | keys are the constant names, grouped by domain                                           |
| Ids and kinds (message verbs, `EntityKind`, `TraitId`, `CellStage`, `DnaTag`, `BacteriumVariant`, `SoundEventId`) | `types/messages.ts` (verbs) and `types/game.ts` as `as const` objects / unions derived from the constant arrays (`(typeof STAGE_ORDER)[number]`) | object `UPPER_SNAKE_CASE`, keys camelCase, values `snake_case`                           |
| Random stream labels                                                                                              | `packages/shared/src/random/stream-labels.ts` (`RANDOM_STREAM`)                                                                                  | values `snake_case`                                                                      |
| Client render-only numbers (colours, layer z, wobble amplitude, granule count)                                    | `packages/client/src/app/game/render/constants.ts` only; camera numbers are gameplay-visible and live in `camera.ts`                             | `UPPER_SNAKE_CASE`, unit suffix                                                          |
| Ports, environment                                                                                                | `PORTS.env` (host), `constants/network.ts` (defaults), `process.env` read once in `index.ts`                                                     | —                                                                                        |
| Test-only values                                                                                                  | `testing/builders.ts` per package (`createTestCell({ mass: 40 })`)                                                                               | builder defaults are the only tolerated inline numbers                                   |

Rules that keep this honest:

- **Derived values are computed, never declared** (`GAME-DESIGN.md §12`): `TICK_INTERVAL_MS`
  and `TICK_INTERVAL_S` derive from `TICK_HZ` in `network.ts`; the steer blend per tick from
  `CELL_ACCELERATION_SECONDS`; `STARTING_STAGE` is `STAGE_ORDER[0]`. There is no
  `SIMULATION_TICK_HZ` alias: two names for one fact is the same reject as two constants.
- A constant lives in exactly one module; other modules import it. Two constants with the same
  meaning in different files is a review reject (`MAX_PLAYERS_PER_GAME` is the room bound; there
  is no `ROOM_MAX_PLAYERS`).
- The simulation reads tunables from `context.balance`, never from `constants/` directly
  (`ARCHITECTURE.md §3.3`); the client receives the live values in `game_state.balance` for
  prediction and never keeps its own copy of a balance number.
- `debug_set_balance` patches number leaves only; tables and id arrays are structure, not
  tunables. Nothing reads `data/balance.json` at runtime.
- `balance.test.ts` pins every constant a design table names (one assertion per row,
  generated from a literal table in the test) and that `data/balance.json` equals
  `DEFAULT_BALANCE`; a hand edit of the JSON fails the gate.
- Time constants are stored in seconds (or ms with the suffix) and converted to ticks in one
  place: `secondsToTicks` in `packages/shared/src/time/units.ts`.

## 3. No duplicated logic

Before writing a helper, search (`rg`) for the behaviour. Shared behaviour goes in one module
both callers import; parallel code paths doing the same thing are a review reject. `jscpd`
(#70) fails the gate on ≥ 5 duplicated lines / 50 tokens outside test fixtures.

```ts
// wrong: server and client each compute radius from mass
const radius = CELL_RADIUS_SCALE * Math.sqrt(cell.mass); // server/game/simulation/movement.ts
const radius = CELL_RADIUS_SCALE * Math.sqrt(snapshot.mass); // client/render/cells/cell-view.ts

// right: one formula, one home (the wire carries `radius` so the client never recomputes it)
import { radiusForMass } from '@evolution/shared'; // shared/simulation/mass-curves.ts
```

## 4. SOLID, applied

- **Single responsibility.** One module = one reason to change: a system, a view, a schema, a
  loader. The room loop, `game-setup.ts`, `evolution-module.ts` and `index.ts` are composition
  roots that only wire.
- **Open/closed by data.** Trait effects are the `TRAIT_TIERS` tables folded by
  `foldModifiers` into one `CellModifiers` record (TRAITS §2); food kinds, bacterium variants,
  zones and sound events are rows in constant tables looked up by id. Never a growing `switch`
  over ids inside a system.
- **Depend on interfaces.** `Clock`, `Ticker`, `RandomSource`, the transport (`send`) and the
  balance are injected through constructors or function parameters. No module reaches for a
  singleton.
- **Interface segregation.** Callers receive the narrowest type: a system gets `StepContext`,
  not the `GameRoom`; a view gets `CellView`, not `WorldStore`.

```ts
// wrong
function applyTrait(cell: CellRecord, traitId: TraitId): void {
  switch (traitId) {
    case 'simple_flagellum':
      cell.modifiers.speedMultiplier *= 1.05;
      break;
    // ... 16 cases
  }
}

// right: data + fold
cell.modifiers = foldModifiers(player.ownedTraits, context.balance.traits.TRAIT_TIERS);
```

## 5. Small units (lint-enforced sizes, #69)

| Limit                 | Value | Lint rule                              |
| --------------------- | ----- | -------------------------------------- |
| Lines per file        | 300   | `max-lines` (design target ≈ 250)      |
| Lines per function    | 40    | `max-lines-per-function`               |
| Cyclomatic complexity | 10    | `complexity`                           |
| Cognitive complexity  | 15    | `sonarjs/cognitive-complexity`         |
| Parameters            | 4     | `max-params` (pass an options object)  |
| Nesting depth         | 3     | `max-depth`, `max-nested-callbacks: 3` |

Split along a responsibility seam; never suppress the rule in game code and never compress
working code to dodge a count. The 300-line cap replaces the "≈ 400 lines is a smell" guidance
that used to be in `ENGINEERING.md` §4.6.

**Template-owned files (decision).** The size cap and the determinism bans (section 8) apply to
game code. Files the template owns and `scripts/sync-from-template.sh` overwrites get an
explicit per-file `overrides` block in `eslint.config.js`, each entry carrying the ticket that
retires it, so #69 lands without splitting or weakening them. The list today, retired by #118:

| File                                                     | Exempt from                      |
| -------------------------------------------------------- | -------------------------------- |
| `packages/server/src/lobby/lobby-manager.ts` (339 lines) | `max-lines`, timers              |
| `packages/server/src/lobby/game-room.ts`                 | timers, `performance.now` (#111) |
| `packages/client/src/app/services/websocket.service.ts`  | timers                           |
| `packages/client/src/app/services/identity.service.ts`   | `Date.now`, `Math.random`        |

Adding a file to that block needs a ticket number in the entry and a line in #118; a game file
never goes there.

## 6. Full descriptive names

- **No abbreviations.** `playerCell` not `pc`, `deltaSeconds` not `dt`, `index` not `i`,
  `connection` not `conn`, `message` not `msg`, `context` not `ctx`. Lint:
  `unicorn/prevent-abbreviations` with the allow-list below, `id-length` minimum 3 with the
  same allow-list.
- **Allow-list (the whole list; extend it here, never in an inline disable):**
  - single letters `x`, `y` (coordinates) and `id`;
  - **unit suffixes** on numbers: `Ms` / `_MS` (milliseconds), `S` / `_SECONDS` (seconds,
    spelled out), `Hz` / `_HZ`, `Wu` / `_WU` (world units — the design's suffix; `_UNITS` is not
    used), `Mb` / `Kb`, `P95` (`frameTimeP95Ms`);
  - framework-imposed `env`, `params`, `ref`;
  - domain acronyms as words: `Dna`, `Npc`, `Hud`, `Mcp`, `Ffa`, `Ws` (`dnaTagPoints`, `McpServer`).
- **Booleans read as predicates:** `isEngulfing`, `hasTraitOffer`, `canStart`.
- **Units in names** when a number has one: `radiusWu`, `tickIntervalMs`, `speedWuPerSecond`,
  `decayPerSecond`; a bare unitless name for a dimensioned value is a reject.
- **Casing** (`@typescript-eslint/naming-convention`): `camelCase` values and functions,
  `PascalCase` types/classes/components, `UPPER_SNAKE_CASE` module-level constants, file names
  `kebab-case.ts` matching the main export (`food-delta-tracker.ts` → `FoodDeltaTracker`);
  wire and data id values `snake_case` (`'free_for_all'`, `'food_mote'`, `'simple_flagellum'`).
- Functions are verbs (`computeStateHash`, `resolveEngulf`), types are nouns, effects are past
  tense (`cell_absorbed`), handlers are `onX`.

## 7. Simplicity

Prefer pure functions and plain data; classes for genuinely stateful things (`ENGINEERING.md`
§4.5). No premature abstraction: three concrete uses before a generic helper. Delete dead code
instead of commenting it out; a declared-but-unused constant, stream label or field is dead
code. Comments explain **why** (a trade-off, a trap, a link to the ticket), never restate the
code. No `TODO` without a ticket number, with one exemption: the template's `TODO(game)` /
`TODO(init)` markers are its extension points and are removed by the Build 1 tickets that fill
them (#97, #98); they are not to-dos of this repo.

## 8. Determinism (scope decision)

Game code never calls `Math.random`, `Date.now`, `performance.now`, `setTimeout` or
`setInterval`. Lint (`no-restricted-globals` / `no-restricted-properties`, #69) applies to the
game paths, with the allowed call sites inside them:

| Path                                  | Allowed inside it                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `packages/shared/src/**`              | `random/` (`Math.random` never; the PRNG), `time/` (`SystemClock` is the one `performance.now`) |
| `packages/server/src/game/**`         | nothing                                                                                         |
| `packages/client/src/app/game/**`     | nothing (`Clock` is injected; cosmetics use the seeded stream)                                  |
| `packages/server/src/lobby/ticker.ts` | `setInterval` (`IntervalTicker`)                                                                |

Template infrastructure outside those paths (`lobby-manager.ts`, `game-room.ts` until #111,
`websocket.service.ts`, `identity.service.ts`) is exempt by the per-file list in section 5,
retired by #118. The full contract, including ordering rules, hashing and replay, is
[`DETERMINISM.md`](./DETERMINISM.md).

## 9. Error handling

- **Boundaries validate, the core trusts.** Every WebSocket message and MCP argument is parsed
  with Zod; inside the simulation, types are the guarantee.
- **Throw on impossible state, never on player input.** Missing required config, an unknown
  `TraitId` in a table, an entity referenced by a stale id in a system → throw a typed error
  (`errors.ts` per package: `ConfigurationError`, `SimulationInvariantError`). A player input
  that cannot apply (sprint on cooldown, `traitChoice` for an offer that is not the shown one,
  a stale `sequence`) is ignored and counted in `PerfTracker.rejectedInputs`; it is not an error.
  The reserved `split` / `eject` flags pass the schema and are ignored without counting
  (`ARCHITECTURE.md §3.2`).
- **Boundaries convert.** The router replies `{ type: 'error', message }`; MCP handlers return
  `isError: true`; the room loop catches, logs through Fastify's logger and keeps ticking.
- **Never swallow.** No empty `catch`; no `catch` that only logs unless the comment says why
  continuing is safe. No `console.log`; `server.log` on the server, nothing in `shared`.
- **Client:** `AudioService` and the renderer degrade silently by design (documented in
  `ARCHITECTURE.md` §7); everything else surfaces through the HUD's error banner.

## 10. Tests: placement and shape

- Co-located: `foo.ts` → `foo.test.ts` (client `foo.spec.ts`); integration
  `foo.integration.test.ts` (`ENGINEERING.md` §2.2). Gameplay scenarios in
  `packages/server/src/testing/scenarios/`, one file per design table, tests named by row id
  (`E9`, `P3`, `T4`, `G2`) (#75, #102).
- Builders, not fixtures files: `createTestCell`, `createTestWorld`, `createTestSnapshot` in
  each package's `src/testing/builders.ts`; defaults are the only inline numbers allowed.
- One behaviour per test, named `it('drops an input whose sequence is not newer', …)`.
- Assert values and hashes, not object identity and not snapshots of large objects
  (`ARCHITECTURE.md §3.1`: the simulation mutates in place; `expect(result).not.toBe(prev)`
  is for reducers that return new state).
- Seed every random test (`createSeededRandom(TEST_SEED)`); a test that uses time uses
  `ManualClock`. Scenario arithmetic follows the fixture conventions of `ECOLOGY.md §8`.

## 11. Review checklist (what a reviewer cites, with `file:line`)

1. Any bare literal with meaning? → section 1/2, name it and move it home.
2. A tunable imported from `constants/` inside a system, or a hand edit of `data/balance.json`? → section 2.
3. Same behaviour in two places? → section 3, one module.
4. A `switch` over ids, or a module reaching for a singleton? → section 4.
5. File > 300 / function > 40 / params > 4 / nesting > 3 in game code? → section 5, split.
6. Any abbreviation outside the allow-list, unitless number name, non-predicate boolean? → section 6.
7. `Math.random`, wall clock, object-key iteration over state, an unused stream label? → sections 7/8.
8. Empty `catch`, silent default, player-input `throw`? → section 9.
9. Missing unit test, integration test for a new wire, seed for a random test, scenario id? → section 10.
