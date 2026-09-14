# Engineering Standards: architecture conventions, forbidden shortcuts and the Definition of Done

§4–§6 of the split [`ENGINEERING.md`](../ENGINEERING.md), which keeps the shared context and the file list.

## 4. Architecture Conventions (enforce on every change)

1. **`packages/shared` stays pure** — zero side effects, no framework/DOM/Node-only APIs, no
   imports from `server` or `client`. It is the only code both sides may import. Shared types
   live here.
2. **Server authority for the values that must be owned.** The trust model is LOCAL-ONLY, so
   the client may compute most things for responsiveness — but any value the server must own
   (score, lives, win/lose, collisions, spawns) is computed in `reduceGameState` and merged
   into the snapshot. The client renders snapshots; it never invents authoritative state.
3. **Validate at the boundary.** Every inbound WebSocket message is parsed/validated in
   `message-schemas.ts` (Zod) before any handler trusts it. When the game defines a real
   `GameInput`, replace the `z.unknown()` payload with a real schema. Trust internal code;
   never trust external input.
4. **One code path per operation.** If an action can be triggered from the UI, a key, or MCP,
   all paths call the same function. No duplicated logic — extract the shared path.
5. **Pure core, IO edge.** Reducers/state machines are pure functions communicating through
   explicit parameters and return values. State flows down (as args), results flow up (as
   returns); modules do not reach up to mutate parent state. **This is not a ban on OOP** —
   classes are encouraged for genuinely stateful, encapsulated things (the WS connection, a
   render container, entity instances). The rule is that _decision logic_ (how state changes)
   lives in pure, testable functions/methods, not buried in IO or the render loop. Prefer
   composition over deep inheritance, but inheritance is fine for a real "is-a" relationship.
6. **Module size & shape.** Keep modules focused — one responsibility each. Sizes are the
   numbers in `docs/CODE-STANDARDS.md` §5 (300 lines per file, 40 per function, complexity 10,
   4 parameters, nesting 3; design target ≈ 250 lines per file), lint-enforced once #69 lands
   and reviewed by hand until then; template-owned files carry the exemption list in §5. Split
   along a responsibility seam — never delete, inline, or compress working code just to push a
   line count down. Orchestrators (the room loop, the game loop) stay thin — a sequence of calls
   to focused subsystems, not a place for business logic.
7. **No circular dependencies.** Imports form a DAG; shared types go in a common module both
   sides import.
8. **Diagrams are ASCII only**, inside a plain code block, ≤~70 columns, one concept each. No
   Mermaid (the CLI cannot render it).

---

## 5. Forbidden Shortcuts / Anti-Patterns (reject on sight)

1. Running raw tools (`pnpm test`, `npx tsc`, `pnpm eslint`, `pnpm --filter ... exec vitest`)
   instead of `./validate.sh`.
2. Merging without a green `./validate.sh all --affected` on the final head (§1 item 2).
   Committing red. Moving on with failures.
3. `.skip`-ing, `.only`-ing, deleting, or weakening a test to get a green run. (Deleting an
   architecture-guard test is exactly the regression those guards exist to catch.)
4. Dumping slow / cross-subsystem setup into a `*.test.ts` to avoid an `*.integration.test.ts`
   — rename the file instead.
5. `as any` / `any` / `@ts-ignore` / `@ts-expect-error` / inline `eslint-disable` without a
   justifying comment. Reaching for `unknown`-less casts at boundaries.
6. The client inventing authoritative state, or computing server-owned values locally and not
   reconciling with the snapshot.
7. Unvalidated message handling — trusting a WS payload without parsing it through the schema.
8. Config defaults/fallbacks silently papering over missing required config. Throw on missing
   required config instead of guessing.
9. `Math.random()` in shared/simulation code.
10. Magic strings or magic numbers — duplicated/unexplained literals instead of named constants
    or `as const` id objects.
11. God files / fat orchestrators — **multi-responsibility** modules or business logic in the
    main loop (the smell is mixed responsibilities, not the raw line count), and circular
    imports.
12. Routing around `validate.sh` / `run.sh` when they misbehave — fix the script or prompt the
    user to extend it.
13. `console.log` left in committed code.
14. Deferring agreed-upon work to a vague "follow-up" without asking. Once you agreed to do it,
    do it.

---

## 6. Definition of Done (checklist — ALL must hold)

- [ ] New/changed logic is extracted into pure functions and has unit tests covering happy
      path, edge cases, and error cases.
- [ ] Cross-subsystem wiring (if any) has a `*.integration.test.ts` and it passes via
      `./validate.sh integration`; coverage floors (`docs/testing/tiers-and-builders.md` §5) did not go down.
- [ ] Scoped checks are green on everything touched, and `./validate.sh all --affected` (lint +
      duplication + typecheck + unit tests + the integration tier) is green on the final head, run once by whoever merges.
      No test was skipped, `.only`-ed, deleted, or weakened to achieve it.
- [ ] No `any` / `@ts-ignore` / `@ts-expect-error` / inline `eslint-disable` without a
      justifying comment. No new magic strings or magic numbers. No `console.log` left behind.
- [ ] Inbound messages are validated at the boundary; server-owned values are computed in the
      reducer and merged into the snapshot.
- [ ] No module took on a second responsibility; sizes within `docs/CODE-STANDARDS.md` §5
      (split along a seam, never compress working code); orchestrators stayed thin; no circular
      imports introduced.
- [ ] `docs/CODE-STANDARDS.md` holds: no magic values (every constant in its home per its
      §2), no duplicated logic, full descriptive names, `docs/DETERMINISM.md` preserved (seeded
      streams, injected clock, stable ordering), structure per `docs/ARCHITECTURE.md`.
- [ ] No `Math.random()` in shared/simulation code.
- [ ] Any visual asset added meets `docs/ASSET-GENERATION.md`'s acceptance criteria.
- [ ] Any audio asset added went through `docs/AUDIO-PIPELINE.md` (`./ai-pipeline.sh check` clean).
- [ ] Every task you agreed to is actually done — nothing silently punted.
