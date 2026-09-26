// The one balance record (docs/architecture/constants-files-tests.md §9): the tunable domain modules spread into plain
// records. Each room starts from a `structuredClone` of `DEFAULT_BALANCE`, `debug_set_balance`
// patches number leaves of the room's copy, and the client predicts with the copy it receives in
// `game_state`. Nothing here is read by the simulation as a module import; it arrives as
// `context.balance`. The record is deep-frozen: it aliases the module constants, so a room that
// forgot to clone would otherwise rewrite every room and the constants themselves.
// `data/balance.json` is generated from this record by `pnpm generate:balance` and pinned equal
// by balance.test.ts. Engineering constants (simulation.ts) are not tunables and stay out.
// One ladder constant stays out too: `ENDOSYMBIOSIS_BACTERIA_REQUIRED` reaches a room only as the
// catalog's `unlockedBy.count` (traits.ts), the number the draft gate and the ladder orbit read. A
// second copy under `ladder` would be read by nobody, agreeing with the catalog only by coincidence (#286).
// Constants computed from balance leaves stay out as well (`DERIVED_BALANCE_CONSTANTS`): a patch of the leaves they
// come from must move them, and a patch of their own copy would disagree with those leaves (#367).

import * as absorption from './absorption.js';
import { deepFreeze } from './deep-freeze.js';
import * as controls from './controls.js';
import * as ecology from './ecology.js';
import * as growth from './growth.js';
import * as ladder from './ladder.js';
import * as progression from './progression.js';
import * as session from './session.js';
import * as traits from './traits.js';
import * as wildCells from './wild-cells.js';
import * as world from './world.js';
import * as worldClock from './world-clock.js';

/**
 * A constant declared as `export const X = 3000` has the literal type `3000`; a patched copy
 * holds other numbers, so the config type widens every number leaf to `number`. Ids, tables and
 * arrays keep their literal types: they are structure, not tunables.
 */
type WidenNumberLeaves<Value> = Value extends number
  ? number
  : Value extends string | boolean | null | undefined
    ? Value
    : { [Key in keyof Value]: WidenNumberLeaves<Value[Key]> };

/**
 * Every constant the design tables mark `derived`: computed from balance leaves, so never a leaf itself. Each is
 * derived at read time from the leaves it comes from (`simulation/engulf-pace.ts`) and declared outside the domain
 * modules (`absorption-derived.ts`), so no domain spreads it in: balance.test.ts checks that no domain carries one,
 * and constants-ledger.test.ts that every `derived` row of the design tables is listed here, so a new derived
 * constant cannot slip into the balance untagged (#367).
 */
export const DERIVED_BALANCE_CONSTANTS = [
  'ENGULF_BASE_DURATION_SECONDS',
  'ENGULF_WRAP_START_PROGRESS',
  'ENGULF_SEAL_PROGRESS',
] as const;

/** `source` as a plain record without `key`: the spread every other domain gets, less one constant. */
function omitConstant<Source extends object, Key extends keyof Source>(source: Source, key: Key): Omit<Source, Key> {
  return Object.fromEntries(Object.entries(source).filter(([name]) => name !== key)) as Omit<Source, Key>;
}

// Module namespaces are exotic objects (their `toString` tag is `Module`); spreading them makes
// plain records that serialise, compare and clone like the JSON they generate.
const BALANCE_DEFAULTS = {
  world: { ...world },
  session: { ...session },
  worldClock: { ...worldClock },
  controls: { ...controls },
  ladder: omitConstant(ladder, 'ENDOSYMBIOSIS_BACTERIA_REQUIRED'),
  ecology: { ...ecology },
  growth: { ...growth },
  wildCells: { ...wildCells },
  absorption: { ...absorption },
  progression: { ...progression },
  traits: { ...traits },
};

export type BalanceConfig = WidenNumberLeaves<typeof BALANCE_DEFAULTS>;

export const DEFAULT_BALANCE: BalanceConfig = deepFreeze(BALANCE_DEFAULTS);
