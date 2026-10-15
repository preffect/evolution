// The non-number balance leaves a `debug_set_balance` patch may write (docs/architecture/debug-mcp.md §8,
// docs/game-design/early-life.md §15.10, docs/game-design/phases.md §14.2.4): each declared by its path with a kind (a
// stage id, a trait-id list, an era list), and each kind with its validator.
// Every other leaf takes a finite number, as before; a value of any other shape, or at an undeclared path, is refused
// (balance-patch.ts). A new non-number leaf declares its path here, and a new kind its validator, once.

import {
  GAME_ERA_ORDER,
  STAGE_ORDER,
  TRAIT_CATALOG,
  isCellStage,
  isDistinctTraitIdList,
  isErasInPlayList,
  type BalanceConfig,
} from '@evolution/shared';

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

/** An era list: a non-empty prefix of `GAME_ERA_ORDER`, written as a copy (balance-patch.ts); any other list refused. */
export const ERA_LIST_LEAF_KIND: BalanceLeafKind = {
  expected: `a prefix of the eras (${GAME_ERA_ORDER.join(', ')}), the dish first`,
  accepts: isErasInPlayList,
};

/**
 * A trait-id list: distinct catalog ids, the empty list allowed (the swallow switch off), written as a copy
 * (balance-patch.ts); a non-catalog id, an id twice or a value that is not a list refused.
 */
export const TRAIT_ID_LIST_LEAF_KIND: BalanceLeafKind = {
  expected: `a list of distinct trait ids (${TRAIT_CATALOG.map((trait) => trait.id).join(', ')}), the empty list allowed`,
  accepts: isDistinctTraitIdList,
};

/** Between the keys of a dotted balance path: `absorption.SWALLOW_GATE_TRAITS`. */
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
  [balanceLeafPath('absorption', 'SWALLOW_GATE_TRAITS'), TRAIT_ID_LIST_LEAF_KIND],
  [balanceLeafPath('earlyLife', 'LATCH_FROM_STAGE'), STAGE_ID_LEAF_KIND],
  [balanceLeafPath('eras', 'ERAS_IN_PLAY'), ERA_LIST_LEAF_KIND],
]);
