// The entry page's view model (docs/ui/encyclopedia.md §11.4). Every guard below is written so that breaking the
// behaviour it names turns it red on its own: the rarity tones are walked for all three rarities rather than for the
// one the page happens to show, `proseParagraphs` is run both with a break and without one, and the row-id guard
// covers the repeated key as well as the consecutive run it was written for.

import { DEFAULT_BALANCE, TRAIT_RARITY, type TraitRarity, type TraitTier } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { UI_CHIP_TONE } from '../../../ui-kit/ui-chip.component';
import { DNA_TAG_COLOR } from '../../render/constants/colours';
import {
  ENCYCLOPEDIA_OWNED_CHIP_LABEL,
  ENCYCLOPEDIA_OWNED_CHIP_SEPARATOR,
  ENCYCLOPEDIA_TIER_CAPTION_PREFIX,
  ENCYCLOPEDIA_TIER_IDENTITY_TEXT,
} from '../encyclopedia-constants';
import type { ProseSegment, ResolvedEntry, ResolvedFact, ResolvedSection, ResolvedSubject } from '../model/entry';
import { ENTRY_SUBJECT, ENTRY_SUBJECT_LABEL, type EntryId } from '../model/entry-id';
import { PROSE_TOKEN } from '../model/prose';
import { entryTitle, resolveEntry } from '../registry';
import { entryChips, factRowsFor, ownedTierOf, proseParagraphs, tierNumeral, tierTableFor } from './entry-view';

const MITOCHONDRION = 'trait:mitochondrion' as EntryId;
const PROTOCELL = 'stage:protocell' as EntryId;
const FIRST = 1 as TraitTier;
const SECOND = 2 as TraitTier;

function resolve(entryId: EntryId): ResolvedEntry {
  return resolveEntry(entryId, { balance: DEFAULT_BALANCE });
}

function traitSubject(rarity: TraitRarity): ResolvedSubject {
  const subject = resolve(MITOCHONDRION).subject;
  if (subject.kind !== ENTRY_SUBJECT.trait) throw new Error('the mitochondrion entry is a trait');
  return { ...subject, rarity };
}

function valueFact(key: string, label: string, text: string): ResolvedFact {
  return { key, label, text, link: null };
}

function linkFact(key: string, label: string, entryId: EntryId, title: string): ResolvedFact {
  return { key, label, text: title, link: { entryId, title } };
}

function tierSection(key: string, facts: readonly ResolvedFact[]): ResolvedSection {
  return { key, heading: [], body: [], facts, preview: null };
}

describe('entryChips (docs/ui/encyclopedia.md §11.4)', () => {
  it('leads a trait with its rarity, in the §10.2 tone of each of the three rarities', () => {
    const tones = [TRAIT_RARITY.common, TRAIT_RARITY.uncommon, TRAIT_RARITY.rare].map(
      (rarity) => entryChips(traitSubject(rarity), null, entryTitle)[0],
    );
    expect(tones.map((chip) => chip?.text)).toEqual(['common', 'uncommon', 'rare']);
    expect(tones.map((chip) => chip?.tone)).toEqual([UI_CHIP_TONE.muted, UI_CHIP_TONE.strong, UI_CHIP_TONE.dna]);
  });

  it('gives each DNA tag its own colour dot and names the stage, both as the registry titles them', () => {
    const subject = traitSubject(TRAIT_RARITY.uncommon);
    if (subject.kind !== ENTRY_SUBJECT.trait) throw new Error('unreachable');
    const chips = entryChips(subject, null, entryTitle);
    const tagChips = chips.filter((chip) => chip.dotColour !== null);
    expect(tagChips.map((chip) => chip.dotColour)).toEqual(subject.dnaTags.map((tag) => DNA_TAG_COLOR[tag]));
    expect(tagChips.map((chip) => chip.text)).toEqual(
      subject.dnaTags.map((tag) => entryTitle(`dna_tag:${tag}` as EntryId)),
    );
    expect(chips[chips.length - 1]?.text).toBe(entryTitle(`stage:${subject.stage}` as EntryId));
  });

  it('adds the owned chip in level gold only in a round, with the tier as a numeral', () => {
    const subject = traitSubject(TRAIT_RARITY.uncommon);
    expect(entryChips(subject, null, entryTitle).some((chip) => chip.tone === UI_CHIP_TONE.gold)).toBe(false);
    const owned = entryChips(subject, SECOND, entryTitle).at(-1);
    expect(owned?.tone).toBe(UI_CHIP_TONE.gold);
    expect(owned?.text).toBe(`${ENCYCLOPEDIA_OWNED_CHIP_LABEL}${ENCYCLOPEDIA_OWNED_CHIP_SEPARATOR}II`);
  });

  it('gives an entry that is not a trait exactly one chip, naming its kind', () => {
    const chips = entryChips(resolve(PROTOCELL).subject, null, entryTitle);
    expect(chips.map((chip) => chip.text)).toEqual([ENTRY_SUBJECT_LABEL[ENTRY_SUBJECT.stage]]);
  });
});

describe('ownedTierOf (docs/ui/encyclopedia.md §11.4)', () => {
  const subject = resolve(MITOCHONDRION).subject;

  it('reads the tier of the trait the page documents and of no other', () => {
    expect(ownedTierOf([{ traitId: 'mitochondrion', tier: SECOND }], subject)).toBe(SECOND);
    expect(ownedTierOf([{ traitId: 'cilia', tier: SECOND }], subject)).toBeNull();
    expect(ownedTierOf([], subject)).toBeNull();
  });

  it('answers null for a subject that is not a trait, even while the round owns traits', () => {
    expect(ownedTierOf([{ traitId: 'mitochondrion', tier: SECOND }], resolve(PROTOCELL).subject)).toBeNull();
  });
});

describe('tierTableFor (docs/ui/encyclopedia.md §11.4)', () => {
  it('draws one column per tier section and one row per modifier any tier sets, in the entry’s own numbers', () => {
    const entry = resolve(MITOCHONDRION);
    const table = tierTableFor(entry.sections, null);
    expect(table?.columns).toEqual(entry.sections.map((_section, index) => tierNumeral((index + 1) as TraitTier)));
    const firstTier = entry.sections[0]!.facts;
    expect(table?.rows.map((row) => row.name)).toEqual(firstTier.map((fact) => fact.label));
    expect(table?.rows[0]?.values[0]).toBe(firstTier[0]!.text);
  });

  it('writes the identity dash where one tier leaves a key the others set, and only there', () => {
    const table = tierTableFor(
      [
        tierSection('tier_1', [valueFact('speedMultiplier', 'speed', '+10 %')]),
        tierSection('tier_2', [
          valueFact('speedMultiplier', 'speed', '+20 %'),
          valueFact('decayMultiplier', 'mass decay', '−15 %'),
        ]),
      ],
      null,
    );
    expect(table?.rows.map((row) => row.values)).toEqual([
      ['+10 %', '+20 %'],
      [ENCYCLOPEDIA_TIER_IDENTITY_TEXT, '−15 %'],
    ]);
  });

  it('tints the owned tier’s column under its caption, and neither outside a round', () => {
    const sections = [
      tierSection('tier_1', [valueFact('speedMultiplier', 'speed', '+10 %')]),
      tierSection('tier_2', [valueFact('speedMultiplier', 'speed', '+20 %')]),
    ];
    expect(tierTableFor(sections, SECOND)).toMatchObject({
      highlightColumn: 1,
      caption: `${ENCYCLOPEDIA_TIER_CAPTION_PREFIX}II`,
    });
    expect(tierTableFor(sections, FIRST)?.highlightColumn).toBe(0);
    expect(tierTableFor(sections, null)).toMatchObject({ highlightColumn: null, caption: '' });
  });

  it('is left out, never drawn empty, for an entry with no tier section and for tiers that set nothing', () => {
    expect(tierTableFor(resolve(PROTOCELL).sections, null)).toBeNull();
    expect(tierTableFor([tierSection('tier_1', [])], null)).toBeNull();
    expect(tierTableFor([tierSection('aerobic', [valueFact('speedMultiplier', 'speed', '+10 %')])], null)).toBeNull();
  });
});

describe('factRowsFor (docs/ui/encyclopedia.md §11.4)', () => {
  it('joins consecutive facts sharing a key into one row carrying every target', () => {
    const rows = factRowsFor([
      linkFact('requires', 'Requires', MITOCHONDRION, 'Mitochondrion'),
      linkFact('requires', 'Requires', PROTOCELL, 'Protocell'),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Requires');
    expect(rows[0]?.values).toEqual(['Mitochondrion, Protocell']);
    expect(rows[0]?.links.map((link) => link.entryId)).toEqual([MITOCHONDRION, PROTOCELL]);
  });

  it('keeps a plain value on its own row with no link, and a key that comes back on a row of its own id', () => {
    const rows = factRowsFor([
      linkFact('requires', 'Requires', MITOCHONDRION, 'Mitochondrion'),
      valueFact('bacteriaToUnlock', 'Bacteria eaten to unlock', '10'),
      linkFact('requires', 'Requires', PROTOCELL, 'Protocell'),
    ]);
    expect(rows.map((row) => row.values[0])).toEqual(['Mitochondrion', '10', 'Protocell']);
    expect(rows[1]?.links).toEqual([]);
    expect(new Set(rows.map((row) => row.rowId)).size).toBe(rows.length);
  });
});

describe('proseParagraphs (docs/ui/encyclopedia.md §11.4)', () => {
  const link: ProseSegment = { kind: PROSE_TOKEN.link, entryId: PROTOCELL, sectionKey: null, text: 'Protocell' };

  it('keeps prose with no blank line as one paragraph', () => {
    const segments: readonly ProseSegment[] = [{ kind: PROSE_TOKEN.text, text: 'One line. ' }, link];
    expect(proseParagraphs(segments)).toEqual([segments]);
  });

  it('starts a new paragraph at a blank line, carrying what follows into it', () => {
    const paragraphs = proseParagraphs([
      { kind: PROSE_TOKEN.text, text: 'First.\n\nSecond, about ' },
      link,
      { kind: PROSE_TOKEN.text, text: '.' },
    ]);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toEqual([{ kind: PROSE_TOKEN.text, text: 'First.' }]);
    expect(paragraphs[1]).toEqual([
      { kind: PROSE_TOKEN.text, text: 'Second, about ' },
      link,
      { kind: PROSE_TOKEN.text, text: '.' },
    ]);
  });

  it('draws no empty paragraph for prose that opens or closes on a break', () => {
    expect(proseParagraphs([{ kind: PROSE_TOKEN.text, text: '\n\nOnly.\n\n' }])).toEqual([
      [{ kind: PROSE_TOKEN.text, text: 'Only.' }],
    ]);
  });
});
