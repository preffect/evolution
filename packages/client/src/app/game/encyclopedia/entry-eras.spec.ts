// @vitest-environment node
// docs/architecture/encyclopedia.md §12.4, the era gate: a later era's page is in the registry only while its era is
// in the balance's `ERAS_IN_PLAY`, so the shipped encyclopedia (the dish alone) shows no pool page, tile or deep link,
// and a pool-on balance shows the page with its numbers read from the pool's domain.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, FOOD_KIND, GAME_ERA, GAME_ERA_ORDER, isEraInPlay, withErasInPlay } from '@evolution/shared';
import { unbroken } from '../../../testing/unbroken-quantity';
import { buildEntryDefinitions } from './build-entries';
import { ENCYCLOPEDIA_CATEGORY } from './model/categories';
import type { EntryDefinition } from './model/entry';
import { ENTRY_ERA, isEntryInPlay } from './model/entry-eras';
import { ENTRY_SUBJECT, entryIdOf, splitEntryId, type EntryId } from './model/entry-id';
import { ENCYCLOPEDIA_ENTRIES, entriesIn, entryIdFrom, entryTitle, isEntryReference } from './registry';
import { resolveEntryDefinition } from './resolve-entry';

const GREEN_SPECK: EntryId = entryIdOf(ENTRY_SUBJECT.food, FOOD_KIND.greenSpeck);
const ALGAE: EntryId = entryIdOf(ENTRY_SUBJECT.food, FOOD_KIND.algae);
const POOL_ON = withErasInPlay([GAME_ERA.dish, GAME_ERA.pool]);

function idsOf(definitions: readonly EntryDefinition[]): EntryId[] {
  return definitions.map((definition) => definition.id);
}

function entityTileIds(): EntryId[] {
  return entriesIn(ENCYCLOPEDIA_CATEGORY.entities).flatMap((group) => group.entries.map((link) => link.entryId));
}

describe('the era gate', () => {
  it('leaves the green speck out while the pool is not in play: no page, no tile, no deep link', () => {
    expect(isEntryInPlay(GREEN_SPECK, DEFAULT_BALANCE)).toBe(false);
    expect(idsOf(buildEntryDefinitions(DEFAULT_BALANCE))).not.toContain(GREEN_SPECK);
    expect(idsOf(ENCYCLOPEDIA_ENTRIES)).not.toContain(GREEN_SPECK);
    expect(entityTileIds()).toContain(ALGAE);
    expect(entityTileIds()).not.toContain(GREEN_SPECK);
    expect(entryIdFrom(GREEN_SPECK)).toBeNull();
  });

  it('holds the green speck once the pool is in play, after the dish’s food kinds', () => {
    expect(isEntryInPlay(GREEN_SPECK, POOL_ON)).toBe(true);
    const foodIds = idsOf(buildEntryDefinitions(POOL_ON)).filter(
      (entryId) => splitEntryId(entryId).subject === ENTRY_SUBJECT.food,
    );
    expect(foodIds).toEqual(Object.values(FOOD_KIND).map((kind) => entryIdOf(ENTRY_SUBJECT.food, kind)));
  });

  it('resolves the green speck’s mass from the pool’s domain', () => {
    const definition = buildEntryDefinitions(POOL_ON).find((candidate) => candidate.id === GREEN_SPECK);
    if (definition === undefined) throw new Error('The pool-on registry has no green speck');
    const resolved = resolveEntryDefinition(
      definition,
      { balance: POOL_ON },
      { titleOf: entryTitle, isReference: isEntryReference },
    );
    expect(resolved.headline?.text).toBe(unbroken(`${POOL_ON.pool.POOL_GREEN_SPECK_MASS} mass`));
  });

  it('keeps every dish page whatever the eras in play, and gates only the pages of a later era', () => {
    expect(isEntryInPlay(ALGAE, DEFAULT_BALANCE)).toBe(true);
    const everyEra = idsOf(buildEntryDefinitions(withErasInPlay(GAME_ERA_ORDER)));
    const laterEraPages = [...ENTRY_ERA]
      .filter(([, era]) => !isEraInPlay(era, DEFAULT_BALANCE))
      .map(([entryId]) => entryId);
    expect(laterEraPages).toEqual([GREEN_SPECK]);
    expect(everyEra.filter((entryId) => !ENCYCLOPEDIA_ENTRIES.some((entry) => entry.id === entryId))).toEqual(
      laterEraPages,
    );
  });

  it('gives every food page its kind’s era, so no food kind reaches the encyclopedia ungated', () => {
    expect([...ENTRY_ERA.keys()]).toEqual(Object.values(FOOD_KIND).map((kind) => entryIdOf(ENTRY_SUBJECT.food, kind)));
    expect(ENTRY_ERA.get(GREEN_SPECK)).toBe(GAME_ERA.pool);
  });
});
