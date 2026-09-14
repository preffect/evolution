# Engineering Standards: testing principles and TypeScript strictness

§2–§3 of the split [`ENGINEERING.md`](../ENGINEERING.md), which keeps the shared context and the file list.

## 2. Testing Standards

The full bar — tiers, naming, builders, coverage floors, flaky-test policy — is
[`TESTING.md`](../TESTING.md). The principles:

### 2.1 Every change is tested

1. **All new logic must have unit tests.** When you add or modify any non-trivial logic
   (functions, classes, reducers, state machines, message handlers, math, generation),
   extract it into **pure, testable functions** and write tests covering the **happy path,
   edge cases, and error cases**.
2. The lever that makes this possible: **pull logic out of orchestrators/loops into pure
   functions** so it can be tested without a server, socket, or browser. A state transition
   should be expressible as `transition(state, input) -> { nextState, effects }`. **This is
   about testability, not banning OOP** — see §4.5: use classes for stateful things; just keep
   the decision logic in pure, callable functions/methods.
3. **Tests live co-located** with the code they test: `*.test.ts` next to the module under
   `packages/*/src` (Angular client uses `*.spec.ts`). Keep the test beside its subject.

### 2.2 Unit vs integration split

| Tier        | Filename suffix                                                                                                                                                                                  | Run via                     | In `all`?      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | -------------- |
| Unit        | `*.test.ts` (client `*.spec.ts`)                                                                                                                                                                 | `./validate.sh test`        | yes            |
| Integration | `*.integration.test.ts` / `*.integration.spec.ts`                                                                                                                                                | `./validate.sh integration` | **no, opt-in** |
| Gameplay    | `*.gameplay.test.ts` (scenario tables on the runner of [`testing/scenario-runner.md` §8](../testing/scenario-runner.md#8-gameplay-tier-the-scenario-runner-packagesserversrctestinggameplay-75)) | `./validate.sh integration` | **no, opt-in** |

1. **Write a unit test when** the change is a single pure function, class, or module in
   isolation — no cross-subsystem orchestration, runs in <100ms. This is almost everything.
2. **Write an integration test when** the change wires two or more subsystems together and
   the value of the test is proving the wire (e.g. input → reduce → snapshot round-trip;
   lobby → room → broadcast; save → load → replay).
3. **Keep the unit tier lean.** A fresh `./validate.sh all` takes about five minutes on the
   shared 4-core container (#281: 278 s at load 4, 298 s at load 7–8), three quarters of it `test`
   and nearly all of that per-file startup (jsdom, TestBed, module collection), not test bodies.
   That is why the build loop runs scoped (§1). Do NOT dump slow or cross-subsystem setup into a
   `*.test.ts` to dodge writing an integration test — **rename the file to
   `*.integration.test.ts` instead.**
4. Integration tests are selected by each package's `test:integration` script
   (`RUN_INTEGRATION=1` for vitest via the shared `vitest.tiers.ts`; the client's
   `test-integration` target): the default `include` excludes `*.integration.*`, the
   integration run includes only them, with `passWithNoTests` so a package without any still
   passes (a targeted run that selects nothing fails, §1). Run them only at the **end of a task
   that may have caused a cross-subsystem regression**, scoped to what it touched, and by
   whoever merges when the change crosses subsystems (§1) — never on every
   save or pre-commit.
5. `./validate.sh integration` is that run (`pnpm -r --if-present test:integration`); never
   invoke vitest or `ng test` directly. The same run executes the gameplay scenarios
   (`*.gameplay.test.ts`, `testing/scenario-runner.md` §8): they step a real module for thousands of ticks, which
   is integration-tier cost even though nothing crosses a socket.

### 2.3 What must be covered (template-specific)

- **Shared logic / math / data:** any pure helper, id/branding utilities, config.
- **The reducer (`reduceGameState`) and `submitInput`:** valid input produces the expected
  state + snapshot; invalid input is rejected/ignored. For reducers that return new state (lobby
  and room descriptors, the client store) assert **immutability**
  (`expect(result).not.toBe(prevState)` when state changes); the game simulation mutates its one
  `WorldState` in place by design (`docs/architecture/server-simulation.md` §3.1), so its tests assert values and
  state hashes, never object identity.
- **Message handling / envelope validation (`message-schemas.ts`, `message-router.ts`):**
  each verb routes to the right handler; **invalid JSON, invalid schema, and removed/unknown
  message types produce error responses** — the validation itself is under test.
- **Lobby / room / session lifecycle:** create/join/start/delete, late-join, disconnect grace.
- **The debug MCP tools:** each tool's registration is invoked through
  `createToolCapture()` (`packages/server/src/testing/builders.ts`) and its JSON asserted; the
  `/debug-mcp` mount itself is an integration test.
- **Architecture invariants as executable tests** (optional but encouraged): a test that
  scans `src` for banned patterns and fails the build if they reappear. Guard the guard
  (`expect(files.length).toBeGreaterThan(N)`) so it can't silently scan nothing.

### 2.4 Determinism

1. **No `Math.random()` in shared / simulation / reducer code.** Use a seeded PRNG so the
   simulation is reproducible and tests can assert exact outputs.
2. Keep the reducer a pure function of `(state, inputs, defs)`; content/config (`GameDefs`,
   `GameSessionConfig`) is a **parameter, never a hidden singleton**.

---

## 3. TypeScript & Lint Strictness

### 3.1 Required tsconfig flags (already set in `tsconfig.base.json`)

```jsonc
"strict": true,
"noUncheckedIndexedAccess": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"verbatimModuleSyntax": true,
"isolatedModules": true,
"forceConsistentCasingInFileNames": true,
"module": "ESNext", "moduleResolution": "bundler", "target": "ES2022"
```

Do not weaken these. Per-package `composite`/`declaration`/`declarationMap` stay on for
project references.

### 3.2 Lint / format rules

- `@typescript-eslint/no-unused-vars: 'error'` with `argsIgnorePattern: '^_'`. A leading `_`
  means "intentionally unused" — it is **not** a license to leave a stub instead of real code.
- `@typescript-eslint/no-explicit-any` is a warning; treat it as a rule. **No `any`** — use
  `unknown` plus a type guard / Zod parse at the boundary, then a narrow type inward.
- The `docs/CODE-STANDARDS.md` rules are lint (`eslint.config.js`, #69): `no-magic-numbers`,
  the size limits, `id-length` + `unicorn/name-replacements` with the §6 allow-list,
  `@typescript-eslint/naming-convention` (predicate booleans need type information, so
  `packages/*/src` is linted with `projectService`), `sonarjs` complexity / duplication, the
  determinism bans, `no-console`, `unicorn/filename-case`.
- angular-eslint component rules apply in `packages/client` (selector prefix, etc.).
- Prettier (already configured): 2-space indent, single quotes, trailing commas, semicolons,
  **120-char width**. Lint ignores `dist/`, `node_modules/`, build caches, and prose dirs.

### 3.3 Forbidden escape hatches

- **No `as any`, no `// @ts-ignore`, no `// @ts-expect-error`, no inline `eslint-disable`**
  without a justification. For `eslint-disable` the justification goes on the directive itself
  (`// eslint-disable-next-line rule -- why this is safe`); `./validate.sh lint` counts the
  directives and fails on one without a `-- reason`.
- **No magic strings or magic numbers.** Use named constants, `as const` id objects, or
  string-literal union types for any repeated or non-obvious literal — message verbs, ids, and
  modes, AND numeric tunables (tick rates, sizes, thresholds, costs, timeouts, durations). A
  bare `0.92` or `300` sitting in logic is a magic number; give it a named constant.
- **No `console.log` in committed code.** Remove debug logging before validating.
