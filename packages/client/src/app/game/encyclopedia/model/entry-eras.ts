// The era gate (docs/architecture/encyclopedia.md §12.4): a page about a later era's world is written ahead of the
// slice that turns that era on, and the registry holds it only while its era is in the shipped balance's
// `ERAS_IN_PLAY` (`isEraInPlay`), so the live encyclopedia shows nothing of the pool until the pool is played. A page
// not listed here belongs to the dish, which every game plays. Every later era's page is gated by this one rule.

import { GAME_ERA, isEraInPlay, type BalanceConfig, type GameEra } from '@evolution/shared';
import type { EntryId } from './entry-id';

/** The era each later era's page belongs to. */
export const ENTRY_ERA: ReadonlyMap<EntryId, GameEra> = new Map<EntryId, GameEra>([
  ['food:green_speck', GAME_ERA.pool],
]);

/** True when `entryId`'s era is in `balance`'s `ERAS_IN_PLAY`: always for a dish page. */
export function isEntryInPlay(entryId: EntryId, balance: Pick<BalanceConfig, 'eras'>): boolean {
  const era = ENTRY_ERA.get(entryId);
  return era === undefined || isEraInPlay(era, balance);
}
