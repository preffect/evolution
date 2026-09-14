# Engineering Standards

These are **enforceable rules**, not suggestions. They are written in the imperative and
each is checkable. An AI building a game from this template MUST follow every rule here.
"It compiles" and "it renders" are never sufficient — the gate below is.

> **THE GATE:** `./validate.sh all` (lint + duplication + typecheck + test) is the single source
> of truth for whether work may merge. Whoever merges runs it once, as `./validate.sh all --affected`
> on the final head right before the merge ([`engineering/validation-gate.md`](./engineering/validation-gate.md) §1 item 2); everyone else runs scoped checks. Never commit red.

## Files

This document is split into topic files (#313). Read only the file a ticket or brief cites.

| File                                                                               | Sections | Topic                                                                    |
| ---------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| [`engineering/validation-gate.md`](./engineering/validation-gate.md)               | §1       | The validation gate                                                      |
| [`engineering/testing-and-typescript.md`](./engineering/testing-and-typescript.md) | §2–§3    | Testing principles and TypeScript strictness                             |
| [`engineering/conventions-and-done.md`](./engineering/conventions-and-done.md)     | §4–§6    | Architecture conventions, forbidden shortcuts and the Definition of Done |
