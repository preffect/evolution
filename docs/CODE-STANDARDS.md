# Evolution — Code Standards

The concrete, checkable rules behind [`ENGINEERING.md`](../ENGINEERING.md). Every rule here is
either enforced by `./validate.sh lint` (#69, #70) or checked line-by-line in review
(`WORKFLOW.md` §6). Where `ENGINEERING.md` gives a principle, this document gives the number,
the home and an example. Where the two differ, the stricter one wins.

## 1. No magic values

Every literal that carries meaning has a name and a home (section 2). Lint: `no-magic-numbers`
(ignores `0`, `1`, `-1` and array indexes) in `shared` and `server` fully; client render code
only inside `render/constants.ts`. Strings: message types, entity kinds, trait ids, stream
labels and event names are `as const` objects with a derived union type, never bare literals.

```ts
// wrong
if (predator.mass >= prey.mass * 1.25) startEngulf(predator, prey, 0.75);
socket.send(JSON.stringify({ type: 'player_input', payload }));

// right
if (predator.mass >= prey.mass * balance.absorption.minimumMassRatio) {
  startEngulf(predator, prey, balance.absorption.durationSeconds);
}
send({ type: CLIENT_MESSAGE_TYPE.playerInput, payload });
```

A literal is allowed inline only when it is the definition of the constant itself, a unit
factor in `packages/shared/src/constants/units.ts` (`MILLISECONDS_PER_SECOND`), or a test value.

## 2. Where every constant, enum and config value lives

| Kind of value                                                                                    | Home                                                                                                                                                                       | Naming                                                                                       |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Protocol, limits, timing, physics that code depends on                                           | `packages/shared/src/constants/<domain>.ts` (`network`, `lobby`, `world`, `ecology`, `growth`, `progression`, `traits`)                                                    | `UPPER_SNAKE_CASE` with unit suffix: `TICK_INTERVAL_MS`, `WORLD_RADIUS_UNITS`                |
| Designer-tunable numbers (rates, thresholds, curves, weights)                                    | `data/balance.json`; zod schema + type in `packages/shared/src/data/balance-schema.ts`; loaded, validated and hot-reloaded by `packages/server/src/data/balance-loader.ts` | camelCase keys with unit suffix: `decayPerSecond`, `engulfDurationSeconds`                   |
| Trait catalogue (#25)                                                                            | `data/traits.json`; schema `packages/shared/src/data/traits-schema.ts`                                                                                                     | `traitId` values `kebab-case`, keys camelCase                                                |
| Ids and kinds (`MessageType`, `EntityKind`, `TraitId`, `FoodKindId`, `DnaTagId`, `SoundEventId`) | `packages/shared/src/types/ids.ts` (and `messages.ts` for message types) as `as const` objects + derived union types                                                       | object `UPPER_SNAKE_CASE`, keys camelCase, values `snake_case` (wire) or `kebab-case` (data) |
| Random stream labels                                                                             | `packages/shared/src/random/stream-labels.ts`                                                                                                                              | `RANDOM_STREAM.spawner`                                                                      |
| Client render-only numbers (colours, layer z, wobble amplitude, zoom curve)                      | `packages/client/src/app/game/render/constants.ts` only                                                                                                                    | `UPPER_SNAKE_CASE`, unit suffix                                                              |
| Ports, environment                                                                               | `PORTS.env` (host), `packages/shared/src/constants/network.ts` (defaults), `process.env` read once in `index.ts`                                                           | —                                                                                            |
| Test-only values                                                                                 | `testing/builders.ts` per package (`createTestCell({ mass: 40 })`)                                                                                                         | builder defaults are the only tolerated inline numbers                                       |

Rules that keep this honest:

- The server reads `data/*.json` exactly once at startup through the typed loader and throws
  on a schema error; there are no silent defaults for required keys.
- Ids in the `as const` objects are validated against `data/*.json` by a unit test in
  `packages/shared` (every `TraitId` exists in `traits.json` and vice versa).
- A value used by both sides ships from the server in `game_state.balance`; the client never
  duplicates a balance number in its own constants.
- A constant lives in exactly one module; other modules import it. Two constants with the
  same meaning in different files is a review reject.
- Time constants are stored in seconds (or ms with the suffix) and converted to ticks in one
  place: `secondsToTicks` in `packages/shared/src/time/units.ts`.

## 3. No duplicated logic

Before writing a helper, search (`rg`) for the behaviour. Shared behaviour goes in one module
both callers import; parallel code paths doing the same thing are a review reject. `jscpd`
(#70) fails the gate on ≥ 5 duplicated lines / 50 tokens outside test fixtures.

```ts
// wrong: server and client each compute radius from mass
const radius = Math.sqrt(cell.mass / Math.PI); // server/systems/eating.ts
const radius = Math.sqrt(snapshot.mass / Math.PI); // client/render/cells/cell-view.ts

// right: one formula, one home
import { radiusForMass } from '@evolution/shared'; // shared/simulation/mass-curves.ts
```

## 4. SOLID, applied

- **Single responsibility.** One module = one reason to change: a system, a view, a schema, a
  loader. The room loop, `game-setup.ts` and `index.ts` are composition roots that only wire.
- **Open/closed by data + strategy.** Trait effects, food kinds, NPC behaviours and sound
  events are entries in data plus a small strategy object looked up by id — never a growing
  `switch` over ids inside a system.
- **Depend on interfaces.** `Clock`, `Ticker`, `RandomSource`, the transport (`send`) and the
  balance loader are injected through constructors or function parameters. No module reaches
  for a singleton.
- **Interface segregation.** Callers receive the narrowest type: a system gets
  `StepContext`, not the `GameRoom`; a view gets `CellSnapshot`, not `WorldStore`.

```ts
// wrong
function applyTrait(cell: Cell, traitId: TraitId): void {
  switch (traitId) {
    case 'flagellum':
      cell.speedMultiplier *= 1.3;
      break;
    case 'thick-wall':
      cell.armor += 2;
      break;
    // ... 25 cases
  }
}

// right: data + strategy
const traitEffect = TRAIT_EFFECTS[traitId]; // Record<TraitId, TraitEffect>, keyed from traits.json
traitEffect.apply(cellStats, traitDefinition.tiers[tier]);
```

## 5. Small units (lint-enforced sizes)

| Limit                 | Value | Lint rule                              |
| --------------------- | ----- | -------------------------------------- |
| Lines per file        | 300   | `max-lines` (design target ≈ 250)      |
| Lines per function    | 40    | `max-lines-per-function`               |
| Cyclomatic complexity | 10    | `complexity`                           |
| Cognitive complexity  | 15    | `sonarjs/cognitive-complexity`         |
| Parameters            | 4     | `max-params` (pass an options object)  |
| Nesting depth         | 3     | `max-depth`, `max-nested-callbacks: 3` |

Split along a responsibility seam; never suppress the rule and never compress working code to
dodge a count. The 300-line cap replaces the "≈ 400 lines is a smell" guidance in
`ENGINEERING.md` §4.6.

## 6. Full descriptive names

- **No abbreviations.** `playerCell` not `pc`, `deltaSeconds` not `dt`, `index` not `i`,
  `connection` not `conn`, `message` not `msg`, `context` not `ctx`. Lint:
  `unicorn/prevent-abbreviations` with the project allow-list, `id-length` minimum 3.
- **Allow-list:** `x`, `y`, `id` (coordinates and identifiers), plus `env`, `params` and `ref`
  where a framework API imposes them. Domain acronyms are words: `Dna`, `Npc`, `Hud`, `Mcp`,
  `Ffa` (`dnaTagIds`, `McpServer`).
- **Booleans read as predicates:** `isEngulfing`, `hasTraitOffer`, `canSplit`.
- **Units in names** when a number has one: `radiusUnits`, `tickDurationMilliseconds`,
  `speedUnitsPerSecond`, `decayPerSecond`.
- **Casing** (`@typescript-eslint/naming-convention`): `camelCase` values and functions,
  `PascalCase` types/classes/components, `UPPER_SNAKE_CASE` module-level constants, file names
  `kebab-case.ts` matching the main export (`food-delta-tracker.ts` → `FoodDeltaTracker`).
- Functions are verbs (`computeStateHash`, `resolveEngulf`), types are nouns, events are past
  tense (`cellAbsorbed`), handlers are `onX`.

## 7. Simplicity

Prefer pure functions and plain data; classes for genuinely stateful things (`ENGINEERING.md`
§4.5). No premature abstraction: three concrete uses before a generic helper. Delete dead code
instead of commenting it out. Comments explain **why** (a trade-off, a trap, a link to the
ticket), never restate the code. No `TODO` without a ticket number.

## 8. Determinism

Simulation code never calls `Math.random`, `Date.now`, `performance.now`, `setTimeout` or
`setInterval` (lint: `no-restricted-globals` / `no-restricted-properties`, allowed only in
`shared/src/random/`, `shared/src/time/` and `server/src/lobby/ticker.ts`). The full contract,
including ordering rules, is [`DETERMINISM.md`](./DETERMINISM.md).

## 9. Error handling

- **Boundaries validate, the core trusts.** Every WebSocket message and MCP argument is parsed
  with Zod; inside the simulation, types are the guarantee.
- **Throw on impossible state, never on player input.** Missing required config, an unknown
  `TraitId` in data, an entity referenced by a stale id in a system → throw a typed error
  (`errors.ts` per package: `ConfigurationError`, `SimulationInvariantError`). A player input
  that cannot apply (split on cooldown, trait not in the offer) is ignored and counted in
  `PerfTracker.rejectedInputs`; it is not an error.
- **Boundaries convert.** The router replies `{ type: 'error', message }`; MCP handlers return
  `isError: true`; the room loop catches, logs through Fastify's logger and keeps ticking.
- **Never swallow.** No empty `catch`; no `catch` that only logs unless the comment says why
  continuing is safe. No `console.log`; `server.log` on the server, nothing in `shared`.
- **Client:** `AudioService` and the renderer degrade silently by design (documented in
  `ARCHITECTURE.md` §7); everything else surfaces through the HUD's error banner.

## 10. Tests: placement and shape

- Co-located: `foo.ts` → `foo.test.ts` (client `foo.spec.ts`); integration
  `foo.integration.test.ts` (`ENGINEERING.md` §2.2). Gameplay scenarios in
  `packages/server/src/testing/scenarios/` (#75).
- Builders, not fixtures files: `createTestCell`, `createTestState`, `createTestSnapshot` in
  each package's `src/testing/builders.ts`; defaults are the only inline numbers allowed.
- One behaviour per test, named `it('drops an input whose sequence is not newer', …)`.
- Assert values, not snapshots of large objects; assert hashes for whole-state equality.
- Seed every random test (`createSeededRandom(TEST_SEED)`); a test that uses time uses
  `ManualClock`.

## 11. Review checklist (what a reviewer cites, with `file:line`)

1. Any bare literal with meaning? → section 1/2, name it and move it home.
2. Same behaviour in two places? → section 3, one module.
3. A `switch` over ids, or a module reaching for a singleton? → section 4.
4. File > 300 / function > 40 / params > 4 / nesting > 3? → section 5, split.
5. Any abbreviation, unitless number name, non-predicate boolean? → section 6.
6. `Math.random`, wall clock, object-key iteration over state? → section 8.
7. Empty `catch`, silent default, player-input `throw`? → section 9.
8. Missing unit test, integration test for a new wire, seed for a random test? → section 10.
