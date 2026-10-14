// The non-number balance leaves a `debug_set_balance` patch may write (docs/architecture/debug-mcp.md §8,
// docs/game-design/early-life.md §15.10): each declared by its path with a kind, and each kind with its validator.
// Every other leaf takes a finite number, as before; a value of any other shape, or at an undeclared path, is refused
// (balance-patch.ts). A new non-number leaf declares its path here, and a new kind its validator, once.

import { STAGE_ORDER, isCellStage, type BalanceConfig } from '@evolution/shared';

/** A kind of non-number leaf: what a refusal says the leaf takes, and the validator a written value must pass. */
export interface BalanceLeafKind {
  /** Completes "takes …" in a refusal: `a stage id (protocell, prokaryote, …)`. */
  readonly expected: string;
  readonly accepts: (value: unknown) => boolean;
}

/** A stage id: a member of `STAGE_ORDER`, any other value refused. */
export const STAGE_ID_LEAF_KIND: BalanceLeafKind = {
  expected: `a stage id (${STAGE_ORDER.join(', ')})`,
  accepts: isCellStage,
};

/** Between the keys of a dotted balance path: `absorption.SWALLOW_FROM_STAGE`. */
export const BALANCE_PATH_SEPARATOR = '.';

/** The dotted path of a balance leaf, typed so a renamed domain or constant fails to compile here. */
function balanceLeafPath<Domain extends keyof BalanceConfig>(
  domain: Domain,
  leaf: keyof BalanceConfig[Domain] & string,
): string {
  return [domain, leaf].join(BALANCE_PATH_SEPARATOR);
}

/** Every non-number leaf a patch may write, by dotted path. */
export const NON_NUMBER_BALANCE_LEAVES: ReadonlyMap<string, BalanceLeafKind> = new Map([
  [balanceLeafPath('absorption', 'SWALLOW_FROM_STAGE'), STAGE_ID_LEAF_KIND],
  [balanceLeafPath('earlyLife', 'LATCH_FROM_STAGE'), STAGE_ID_LEAF_KIND],
]);
