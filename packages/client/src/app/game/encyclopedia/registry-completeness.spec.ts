// @vitest-environment node
// docs/architecture/encyclopedia.md §12.6: the assembled registry against the code's closed sets at runtime: one entry
// per value of every subject, every anchor target present, every category filled.

import { describe, expect, it } from 'vitest';
import {
  CELL_KIND,
  CELL_STAGE,
  CELL_STATE,
  DEFAULT_BALANCE,
  DNA_TAG,
  ENTITY_KIND,
  FOOD_KIND,
  GAME_MODE,
  WORLD_STANDING,
  ZONE_ID,
  createTestPlayerProgressView,
  markdownSection,
  tableRows,
  type CellModifiers,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { ownCellIndicatorsFor } from '../state/own-cell-indicators';
import { HUD_TEST_ID } from '../test-ids/hud-test-ids';
import { readRepoDocument } from '../../../testing/repo-document';
import { tierSectionKey } from './build-entries';
import { TRAIT_ENTRY_ROWS, contentByTrait } from './content/trait-entries';
import { ABILITY, ABILITY_BY_MODIFIER } from './model/abilities';
import { ACTION, ACTION_BY_INTENT } from './model/actions';
import { CONCEPT } from './model/concepts';
import { HUD_ELEMENT_BY_TOPIC, HUD_ELEMENT_KIND, HUD_TOPIC } from './model/hud-topics';
import {
  ENCYCLOPEDIA_CATEGORY,
  ENCYCLOPEDIA_CATEGORY_LABEL,
  ENCYCLOPEDIA_CATEGORY_ORDER,
  categoryOf,
} from './model/categories';
import { ENTRY_BY_ENTITY_KIND } from './model/entity-kinds';
import { ENTRY_BY_EFFECT, ENTRY_BY_WORLD_STANDING } from './model/entry-anchors';
import { ENTRY_SUBJECT, splitEntryId, type EntrySubject } from './model/entry-id';
import { CATEGORY_GROUPS, ENTRY_GROUP, ENTRY_GROUP_LABEL } from './model/groups';
import { RESERVED_EXCLUSION_GROUP, RESERVED_FROM_ENCYCLOPEDIA } from './model/reserved';
import { WORLD_TOPIC } from './model/world-topics';
import { ENCYCLOPEDIA_ENTRIES, entriesIn, isEntryReference } from './registry';
import type { TraitTier } from '@evolution/shared';

const traits = DEFAULT_BALANCE.traits;

function idsOf(subject: EntrySubject): string[] {
  return ENCYCLOPEDIA_ENTRIES.map((entry) => splitEntryId(entry.id))
    .filter((split) => split.subject === subject)
    .map((split) => split.codeId);
}

function expectReachable(reference: string): void {
  expect(isEntryReference(reference), reference).toBe(true);
}

describe('the encyclopedia registry', () => {
  it('holds one trait entry per catalog row, with one tier section per tier of its row', () => {
    expect(idsOf(ENTRY_SUBJECT.trait)).toEqual(traits.TRAIT_CATALOG.map((row) => row.id));
    for (const row of traits.TRAIT_CATALOG) {
      const entry = ENCYCLOPEDIA_ENTRIES.find((candidate) => candidate.id === `trait:${row.id}`);
      const expectedKeys = traits.TRAIT_TIERS[row.id].map((_tierRow, index) =>
        tierSectionKey((index + 1) as TraitTier),
      );
      expect(entry?.sections.map((section) => section.key)).toEqual(expectedKeys);
    }
  });

  it('refuses trait content with two rows for one trait', () => {
    const [firstRow] = TRAIT_ENTRY_ROWS;
    expect(() => contentByTrait([...TRAIT_ENTRY_ROWS, firstRow] as never)).toThrow(/more than one content row/);
  });

  it('holds one entry per stage and per DNA tag, in their walk orders', () => {
    expect(idsOf(ENTRY_SUBJECT.stage)).toEqual([...DEFAULT_BALANCE.ladder.STAGE_ORDER]);
    expect([...idsOf(ENTRY_SUBJECT.stage)].sort()).toEqual(Object.values(CELL_STAGE).sort());
    expect(idsOf(ENTRY_SUBJECT.dnaTag)).toEqual([...DEFAULT_BALANCE.progression.DNA_TAGS]);
    expect([...idsOf(ENTRY_SUBJECT.dnaTag)].sort()).toEqual(Object.values(DNA_TAG).sort());
  });

  it('holds one entry per cell kind, food kind, bacterium variant, zone, world topic and concept', () => {
    expect(idsOf(ENTRY_SUBJECT.cellKind)).toEqual(Object.values(CELL_KIND));
    expect(idsOf(ENTRY_SUBJECT.food)).toEqual(Object.values(FOOD_KIND));
    expect(idsOf(ENTRY_SUBJECT.bacterium)).toEqual([...DEFAULT_BALANCE.ecology.BACTERIUM_VARIANTS]);
    expect(idsOf(ENTRY_SUBJECT.zone)).toEqual(Object.values(ZONE_ID));
    expect(idsOf(ENTRY_SUBJECT.world)).toEqual(Object.values(WORLD_TOPIC));
    expect(idsOf(ENTRY_SUBJECT.concept)).toEqual(Object.values(CONCEPT));
  });

  it('holds one HUD entry per topic, each anchored to its own element that exists', () => {
    expect(idsOf(ENTRY_SUBJECT.hud)).toEqual(Object.values(HUD_TOPIC));
    const anchors = Object.values(HUD_ELEMENT_BY_TOPIC);
    expect(new Set(anchors.map((anchor) => JSON.stringify(anchor))).size).toBe(anchors.length);
    const indicators = ownCellIndicatorsFor({
      ownCell: createTestCellView(),
      ownProgress: createTestPlayerProgressView(),
      balance: DEFAULT_BALANCE,
      threats: [],
      previewTraitId: null,
    });
    for (const anchor of anchors) {
      if (anchor.kind === HUD_ELEMENT_KIND.dom) expect(Object.keys(HUD_TEST_ID)).toContain(anchor.testId);
      else expect(Object.keys(indicators)).toContain(anchor.field);
    }
  });

  it('holds the DNA fragment as the one entity entry, with one section per DNA tag in walk order', () => {
    expect(idsOf(ENTRY_SUBJECT.entity)).toEqual([ENTITY_KIND.dnaFragment]);
    const fragment = ENCYCLOPEDIA_ENTRIES.find((entry) => entry.id === 'entity:dna_fragment');
    expect(fragment?.sections.map((section) => section.key)).toEqual([...DEFAULT_BALANCE.progression.DNA_TAGS]);
  });

  it('has a world standing section for every standing the HUD shows', () => {
    for (const standing of Object.values(WORLD_STANDING)) {
      expect(isEntryReference(`concept:world_standing#${standing}`), standing).toBe(true);
    }
  });

  it('holds one entry per ability and per action, in their walk orders', () => {
    expect(idsOf(ENTRY_SUBJECT.ability)).toEqual(Object.values(ABILITY));
    expect(idsOf(ENTRY_SUBJECT.action)).toEqual(Object.values(ACTION));
  });

  it('has unique ids, each in a category of the navigation order', () => {
    const ids = ENCYCLOPEDIA_ENTRIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(ENCYCLOPEDIA_CATEGORY_ORDER).toContain(categoryOf(id));
  });

  it('leaves no category empty', () => {
    for (const category of ENCYCLOPEDIA_CATEGORY_ORDER) expect(entriesIn(category).length, category).toBeGreaterThan(0);
  });

  it('gives every entry of a grouped category a group, and lists the groups in the category’s walk', () => {
    for (const category of ENCYCLOPEDIA_CATEGORY_ORDER) {
      const walk = CATEGORY_GROUPS[category];
      const groups = entriesIn(category).map((resolvedGroup) => resolvedGroup.group);
      if (walk.length === 0) {
        expect(groups.every((group) => group === null)).toBe(true);
        continue;
      }
      const positions = groups.map((group) => walk.indexOf(group as never));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((first, second) => first - second));
    }
  });

  it('reaches every anchor target: every effect, entity kind, world standing, intent and modifier', () => {
    const targets = [
      ...Object.values(ENTRY_BY_EFFECT),
      ...Object.values(ENTRY_BY_ENTITY_KIND),
      ...Object.values(ENTRY_BY_WORLD_STANDING),
      ...Object.values(ACTION_BY_INTENT).map((action) => `action:${action}`),
      ...Object.values(ABILITY_BY_MODIFIER).map((ability) => `ability:${ability}`),
    ];
    for (const target of targets) expectReachable(target);
  });

  it('maps every modifier to exactly one ability and every intent to an action', () => {
    const modifierKeys = Object.keys(traits.DEFAULT_CELL_MODIFIERS) as (keyof CellModifiers)[];
    expect(Object.keys(ABILITY_BY_MODIFIER).sort()).toEqual([...modifierKeys].sort());
    for (const key of modifierKeys) expect(Object.values(ABILITY)).toContain(ABILITY_BY_MODIFIER[key]);
    for (const action of Object.values(ACTION_BY_INTENT)) expect(Object.values(ACTION)).toContain(action);
  });

  it('excludes reserved values by name, and each is still reserved in code', () => {
    expect(Object.values(CELL_STATE)).toEqual(expect.arrayContaining([...RESERVED_FROM_ENCYCLOPEDIA.cellStates]));
    expect(Object.values(GAME_MODE)).toEqual(expect.arrayContaining([...RESERVED_FROM_ENCYCLOPEDIA.gameModes]));
    expect(traits.EXCLUSION_GROUPS).toContain(RESERVED_EXCLUSION_GROUP);
    const usedGroups = (traits.TRAIT_CATALOG as readonly { exclusionGroup?: string }[]).map(
      (row) => row.exclusionGroup,
    );
    for (const group of RESERVED_FROM_ENCYCLOPEDIA.exclusionGroups) expect(usedGroups).not.toContain(group);
    const catalogIds: readonly string[] = traits.TRAIT_CATALOG.map((row) => row.id);
    for (const reservedId of traits.RESERVED_TRAIT_IDS) expect(catalogIds).not.toContain(reservedId);
    for (const field of RESERVED_FROM_ENCYCLOPEDIA.inputFields)
      expect(Object.keys(ACTION_BY_INTENT)).not.toContain(field);
  });
});

describe('the category and group labels', () => {
  const section = markdownSection(readRepoDocument('docs/ui/encyclopedia.md'), '### 11.2');
  const rows = tableRows(section).filter(([positionCell = '']) => /^\d/.test(positionCell));

  it('follow docs/ui/encyclopedia.md §11.2: every category, its label and its position', () => {
    expect(markdownSection(readRepoDocument('docs/ui/encyclopedia.md'), '## 11. Encyclopedia')).toContain('### 11.2');
    const categories = rows.map((cells) => cells[1]?.replaceAll('`', ''));
    expect(categories).toEqual([...ENCYCLOPEDIA_CATEGORY_ORDER]);
    expect([...ENCYCLOPEDIA_CATEGORY_ORDER].sort()).toEqual(Object.values(ENCYCLOPEDIA_CATEGORY).sort());
    for (const cells of rows) {
      const category = cells[1]?.replaceAll('`', '') as keyof typeof ENCYCLOPEDIA_CATEGORY_LABEL;
      expect(ENCYCLOPEDIA_CATEGORY_LABEL[category]).toBe(cells[2]);
    }
  });

  it('name each group the doc names', () => {
    const named = rows.flatMap((cells) => [...(cells[3] ?? '').matchAll(/([A-Z][A-Za-z ]*?) \(`(\w+)`\)/g)]);
    expect(named.map(([, , groupId]) => groupId)).toContain(ENTRY_GROUP.readingTheScreen);
    for (const [, label, groupId] of named) {
      expect(ENTRY_GROUP_LABEL[groupId as keyof typeof ENTRY_GROUP_LABEL], groupId).toBe(label);
    }
  });
});
