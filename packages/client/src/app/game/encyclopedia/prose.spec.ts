// docs/architecture/encyclopedia.md §12.6: prose carries no numbers. Every title, template, heading and label of every
// entry and section is free of digits and tier numerals; every token names a fact in scope and every link a registry
// id or anchor; every entry resolves over `DEFAULT_BALANCE`. The token parser's malformed cases throw.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { factContextFor } from './encyclopedia-context';
import { PROSE_TOKEN, parseProseTemplate, type ProseToken } from './model/prose';
import { ENCYCLOPEDIA_ENTRIES, isEntryReference, resolveEntry } from './registry';

/** A link token's reference, none for any other token. */
function referenceOf(token: ProseToken): string[] {
  return token.kind === PROSE_TOKEN.link ? [token.reference] : [];
}

/** Every `{factKey}` token of `template` names one of `factKeys`. */
function expectValueTokensIn(template: string, factKeys: readonly string[], where: string): void {
  for (const token of parseProseTemplate(template)) {
    if (token.kind !== PROSE_TOKEN.value) continue;
    expect(factKeys, `${where} {${token.factKey}}`).toContain(token.factKey);
  }
}

const DIGIT = /\d/;
const TIER_WORD_NUMERAL = /\btier\s+[ivx]+\b/i;
const BARE_NUMERAL = /\b[IVX]{2,}\b/;
/** A count written as a word drifts with the catalog as a digit would; `one` stays ("One form per cell" is a rule). */
const NUMBER_WORD = /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|either|both)\b/i;

/** What a typed number in copy looks like: the reasons `text` fails the prose rule, empty when it passes. */
function proseViolations(text: string): string[] {
  return [DIGIT, TIER_WORD_NUMERAL, BARE_NUMERAL, NUMBER_WORD].filter((pattern) => pattern.test(text)).map(String);
}

const context = factContextFor(null);

describe('the prose rule', () => {
  it('rejects a digit and a tier numeral, and passes plain copy', () => {
    expect(proseViolations('Gives 3 mass')).not.toEqual([]);
    expect(proseViolations('At Tier II it doubles')).not.toEqual([]);
    expect(proseViolations('The III coil')).not.toEqual([]);
    expect(proseViolations('the five body forms')).not.toEqual([]);
    expect(proseViolations('Owning either trait')).not.toEqual([]);
    expect(proseViolations('Keeps {dnaKeptOnDeathFraction} of your DNA')).toEqual([]);
  });

  it('holds for every title, template, heading and fact label in the registry', () => {
    for (const entry of ENCYCLOPEDIA_ENTRIES) {
      const texts = [
        entry.title,
        entry.summary,
        ...entry.facts.map((fact) => fact.label),
        ...entry.sections.flatMap((section) => [
          section.heading,
          section.body,
          ...section.facts.map((fact) => fact.label),
        ]),
      ];
      for (const text of texts) expect(proseViolations(text), `${entry.id}: ${text}`).toEqual([]);
    }
  });

  it('holds for the generated tier fact labels too', () => {
    for (const entry of ENCYCLOPEDIA_ENTRIES) {
      for (const section of resolveEntry(entry.id, context).sections) {
        for (const fact of section.facts) expect(proseViolations(fact.label), `${entry.id}#${section.key}`).toEqual([]);
      }
    }
  });

  it('never lets an entry or section fact key collide with a modifier key a tier token reads', () => {
    const modifierKeys = Object.keys(DEFAULT_BALANCE.traits.DEFAULT_CELL_MODIFIERS);
    for (const entry of ENCYCLOPEDIA_ENTRIES) {
      const keys = [...entry.facts, ...entry.sections.flatMap((section) => section.facts)].map((fact) => fact.key);
      for (const key of keys) expect(modifierKeys, `${entry.id} {${key}}`).not.toContain(key);
    }
  });

  it('names only registry entries and anchors in its links', () => {
    for (const entry of ENCYCLOPEDIA_ENTRIES) {
      const templates = [entry.summary, ...entry.sections.flatMap((section) => [section.heading, section.body])];
      const references = templates.flatMap(parseProseTemplate).flatMap(referenceOf);
      for (const reference of references) expect(isEntryReference(reference), `${entry.id}: ${reference}`).toBe(true);
    }
  });

  it('names only facts in scope at the shipped balance, so every entry resolves over it', () => {
    for (const entry of ENCYCLOPEDIA_ENTRIES) {
      const resolved = resolveEntry(entry.id, context);
      const entryKeys = resolved.facts.map((fact) => fact.key);
      expectValueTokensIn(entry.summary, entryKeys, entry.id);
      for (const [index, section] of entry.sections.entries()) {
        // A tier token names a modifier its tier actually sets, or a fact of the entry.
        const sectionKeys = [...entryKeys, ...(resolved.sections[index]?.facts ?? []).map((fact) => fact.key)];
        expectValueTokensIn(section.body, sectionKeys, `${entry.id}#${section.key}`);
      }
    }
  });
});

describe('parseProseTemplate', () => {
  it('splits text, value tokens and links, with an optional shown text', () => {
    expect(parseProseTemplate('Gives {massGain} to [[trait:cilia]] and [[stage:eukaryote|true cells]].')).toEqual([
      { kind: PROSE_TOKEN.text, text: 'Gives ' },
      { kind: PROSE_TOKEN.value, factKey: 'massGain' },
      { kind: PROSE_TOKEN.text, text: ' to ' },
      { kind: PROSE_TOKEN.link, reference: 'trait:cilia', shownText: null },
      { kind: PROSE_TOKEN.text, text: ' and ' },
      { kind: PROSE_TOKEN.link, reference: 'stage:eukaryote', shownText: 'true cells' },
      { kind: PROSE_TOKEN.text, text: '.' },
    ]);
    expect(parseProseTemplate('[[trait:cilia#tier_2]]')).toEqual([
      { kind: PROSE_TOKEN.link, reference: 'trait:cilia#tier_2', shownText: null },
    ]);
  });

  it.each([
    ['an unclosed value token', 'Gives {massGain mass'],
    ['a stray closing brace', 'Gives massGain} mass'],
    ['an unclosed link', 'See [[trait:cilia'],
    ['a malformed fact key', 'Gives {mass_gain}'],
    ['an empty value token', 'Gives {}'],
    ['a reference without a subject', 'See [[cilia]]'],
    ['an empty shown text', 'See [[trait:cilia| ]]'],
    ['two shown texts', 'See [[trait:cilia|one|two]]'],
  ])('throws on %s', (_case, template) => {
    expect(() => parseProseTemplate(template)).toThrow();
  });
});
