// docs/architecture/encyclopedia.md §12.6: resolving follows the live balance. A patched leaf (on a clone, as a room's
// `debug_set_balance` copy) changes the facts that read it and the trait tier lines; the tier headings follow the
// tier table; the derived links match the balance's catalog; groups and see-also are derived, never written.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, ENTITY_KIND, TRAIT_CATEGORY, type BalanceConfig } from '@evolution/shared';
import { buildEntryDefinitions } from './build-entries';
import { factContextFor } from './encyclopedia-context';
import { DERIVED_LINK, derivedLinkTargets } from './facts/derived-links';
import { resolveProse } from './facts/resolve-prose';
import { ABILITY } from './model/abilities';
import { ENCYCLOPEDIA_CATEGORY } from './model/categories';
import type { ResolvedEntry } from './model/entry';
import { ENTRY_GROUP } from './model/groups';
import { ENTRY_BY_ID, entriesIn, entryTitle, isEntryReference, resolveEntry } from './registry';
import { resolveEntryDefinition } from './resolve-entry';

type MutableBalance = { -readonly [Domain in keyof BalanceConfig]: Record<string, unknown> };

function patchedBalance(patch: (balance: MutableBalance) => void): BalanceConfig {
  const balance = structuredClone(DEFAULT_BALANCE) as BalanceConfig;
  patch(balance as unknown as MutableBalance);
  return balance;
}

function factText(entry: ResolvedEntry, key: string, sectionKey: string | null = null): string[] {
  const facts =
    sectionKey === null ? entry.facts : (entry.sections.find((section) => section.key === sectionKey)?.facts ?? []);
  return facts.filter((fact) => fact.key === key).map((fact) => fact.text);
}

const shipped = factContextFor(null);

describe('resolveEntry over a patched balance', () => {
  it('changes a balance fact and the prose token that reads it', () => {
    const before = resolveEntry('dna_tag:motile', shipped);
    const after = resolveEntry(
      'dna_tag:motile',
      factContextFor(patchedBalance((balance) => (balance.progression['TAG_WEIGHT_PER_POINT'] = 0.25))),
    );
    expect(factText(before, 'weightPerPoint')).toEqual(['+10 %']);
    expect(factText(after, 'weightPerPoint')).toEqual(['+25 %']);
    const dosed = resolveEntry(
      'trait:toxin_vacuole',
      factContextFor(patchedBalance((balance) => (balance.absorption['ENGULF_SWALLOWED_TOXIN_MULTIPLIER'] = 4))),
    );
    expect(dosed.summary.some((segment) => segment.kind === 'value' && segment.text === '4×')).toBe(true);
  });

  it('changes a trait’s tier lines', () => {
    const patched = patchedBalance((balance) => {
      const tiers = balance.traits['TRAIT_TIERS'] as Record<string, Record<string, number>[]>;
      (tiers['cilia'] as Record<string, number>[])[1] = { speedMultiplier: 1.5, gripResistanceBonus: 0.1 };
    });
    const before = resolveEntry('trait:cilia', shipped);
    const after = resolveEntry('trait:cilia', factContextFor(patched));
    expect(factText(before, 'speedMultiplier', 'tier_2')).toEqual(['+20 %']);
    expect(factText(after, 'speedMultiplier', 'tier_2')).toEqual(['+50 %']);
    expect(after.sections[1]?.facts.map((fact) => fact.label)).toEqual(['speed', 'grip resistance']);
  });

  it('leaves a tier fact out when the patched tier sets that modifier to identity', () => {
    const patched = patchedBalance((balance) => {
      const tiers = balance.traits['TRAIT_TIERS'] as Record<string, Record<string, number>[]>;
      (tiers['cell_wall'] as Record<string, number>[])[0] = { membraneRatioBonus: 0.15, speedMultiplier: 1 };
    });
    const section = resolveEntry('trait:cell_wall', factContextFor(patched)).sections[0];
    expect(section?.facts.map((fact) => fact.key)).toEqual(['membraneRatioBonus']);
  });
});

describe('the generated tier sections', () => {
  it('follow the tier table: one section per tier row, headed by its numeral', () => {
    const resolved = resolveEntry('trait:nucleoid', shipped);
    expect(resolved.sections.map((section) => section.key)).toEqual(['tier_1', 'tier_2', 'tier_3']);
    expect(resolved.sections.map((section) => section.heading.map((segment) => segment.text).join(''))).toEqual([
      'Tier I',
      'Tier II',
      'Tier III',
    ]);
    expect(resolved.subject).toMatchObject({ kind: 'trait', tierCount: 3, traitCategory: TRAIT_CATEGORY.genome });
  });

  it('shrink with a shorter tier table', () => {
    const shorter = patchedBalance((balance) => {
      const tiers = balance.traits['TRAIT_TIERS'] as Record<string, unknown[]>;
      tiers['nucleoid'] = (tiers['nucleoid'] ?? []).slice(0, 2);
    });
    const definition = buildEntryDefinitions(shorter).find((entry) => entry.id === 'trait:nucleoid');
    if (definition === undefined) throw new Error('trait:nucleoid is missing');
    const resolved = resolveEntryDefinition(definition, factContextFor(shorter), {
      titleOf: entryTitle,
      isReference: isEntryReference,
    });
    expect(resolved.sections.map((section) => section.heading[0]?.text)).toEqual(['Tier I', 'Tier II']);
  });

  it('refuses a tier table longer than the trait’s tier prose', () => {
    const longer = patchedBalance((balance) => {
      const tiers = balance.traits['TRAIT_TIERS'] as Record<string, unknown[]>;
      tiers['nucleoid'] = [...(tiers['nucleoid'] ?? []), {}];
    });
    expect(() => buildEntryDefinitions(longer)).toThrow(/no prose for tier/);
  });
});

describe('the derived links', () => {
  it('give one fact per target, in the table’s order, and none without a target', () => {
    const endosymbiosis = resolveEntry('stage:endosymbiosis', shipped);
    expect(endosymbiosis.facts.filter((fact) => fact.key === 'reachedBy').map((fact) => fact.link?.entryId)).toEqual(
      DEFAULT_BALANCE.ladder.STAGE_GATE_TRAITS.endosymbiosis.map((traitId) => `trait:${traitId}`),
    );
    const protocell = resolveEntry('stage:protocell', shipped);
    expect(protocell.facts.filter((fact) => fact.key === 'reachedBy')).toEqual([]);
    expect(protocell.headline?.key).toBe('opens');
    const specialised = resolveEntry('stage:specialised', shipped);
    expect(specialised.facts.filter((fact) => fact.key === 'opens')).toEqual([]);
    expect(specialised.headline?.key).toBe('reachedBy');
  });

  it('match the catalog: stage, requires, the stage a gate climbs to and the unlock count', () => {
    const envelope = resolveEntry('trait:nuclear_envelope', shipped);
    expect(envelope.headline).toEqual({
      key: 'offeredFrom',
      label: 'Offered from',
      text: 'Endosymbiosis',
      link: { entryId: 'stage:endosymbiosis', title: 'Endosymbiosis' },
    });
    expect(factText(envelope, 'requires')).toEqual(['Nucleoid Coil']);
    expect(factText(envelope, 'climbsTo')).toEqual(['Eukaryote']);
    expect(envelope.seeAlso.map((link) => link.entryId)).toEqual(['trait:nucleoid']);
    expect(factText(resolveEntry('trait:mitochondrion', shipped), 'bacteriaToUnlock')).toEqual(['10']);
    expect(factText(resolveEntry('trait:nucleoid', shipped), 'bacteriaToUnlock')).toEqual([]);
  });

  it('find an ability’s granting traits and a tag’s traits from the tier tables and the catalog', () => {
    const balance = DEFAULT_BALANCE;
    expect(
      derivedLinkTargets(balance, { id: DERIVED_LINK.abilityTraits, argument: { abilityId: ABILITY.photosynthesis } }),
    ).toEqual(['trait:chloroplast']);
    expect(derivedLinkTargets(balance, { id: DERIVED_LINK.tagTraits, argument: { tag: 'sensory' } })).toEqual([
      'trait:euglena_eyespot',
    ]);
    expect(
      derivedLinkTargets(balance, { id: DERIVED_LINK.traitUnlockVariant, argument: { traitId: 'chloroplast' } }),
    ).toEqual(['bacterium:photosynthetic']);
    expect(
      derivedLinkTargets(balance, { id: DERIVED_LINK.foodZones, argument: { foodKind: ENTITY_KIND.dnaFragment } }),
    ).toEqual(['zone:warm_vent', 'zone:open_broth', 'zone:sunlit_shallows']);
  });
});

describe('the registry lookups', () => {
  it('group evolutions by stage, trait category in declaration order, then DNA tag, and leave empty categories empty', () => {
    expect(entriesIn(ENCYCLOPEDIA_CATEGORY.evolutions).map((group) => group.group)).toEqual([
      ENTRY_GROUP.stages,
      ENTRY_GROUP.genome,
      ENTRY_GROUP.locomotion,
      ENTRY_GROUP.membrane,
      ENTRY_GROUP.metabolism,
      ENTRY_GROUP.offense,
      ENTRY_GROUP.form,
      ENTRY_GROUP.dnaTags,
    ]);
    expect(entriesIn(ENCYCLOPEDIA_CATEGORY.abilities)).toEqual([]);
    expect(resolveEntry('trait:diatom_shell', shipped)).toMatchObject({ category: 'evolutions', group: 'form' });
  });

  it('accept an anchor to an existing section only', () => {
    expect(isEntryReference('trait:cilia#tier_2')).toBe(true);
    expect(isEntryReference('trait:cilia#tier_9')).toBe(false);
    expect(isEntryReference('ability:toxin')).toBe(false);
    expect(ENTRY_BY_ID.has('stage:eukaryote')).toBe(true);
    expect(() => resolveEntry('ability:toxin', shipped)).toThrow(/no entry/);
  });

  it('refuse a prose token with no fact and a link to nothing', () => {
    const scope = { facts: [], titleOf: entryTitle, isReference: isEntryReference };
    expect(() => resolveProse('Gives {massGain}', scope)).toThrow(/names no fact/);
    expect(() => resolveProse('See [[ability:toxin]]', scope)).toThrow(/names no entry/);
    expect(resolveProse('See [[trait:cilia#tier_2|its second tier]]', scope)).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'link', entryId: 'trait:cilia', sectionKey: 'tier_2', text: 'its second tier' },
    ]);
  });
});
