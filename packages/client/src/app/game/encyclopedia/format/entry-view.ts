// The entry page's view model (docs/ui/encyclopedia.md §11.4), pure: the title column's chips, the two facts tables
// and the prose's paragraphs. Every number it shows is already formatted — a `ResolvedEntry` holds text, not values
// (architecture/encyclopedia.md §12.2) — so nothing here calls `formatQuantity` except on the one figure the page
// owns itself, the tier numeral, which §11.4 names as a `formatQuantity` call.

import type { OwnedTrait, TraitRarity, TraitTier } from '@evolution/shared';
import { UI_CHIP_TONE, type UiChipTone } from '../../../ui-kit/ui-chip.component';
import type { UiFactRow } from '../../../ui-kit/ui-facts-table.component';
import { formatQuantity } from '../../quantities/format-quantity';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { DNA_TAG_COLOR } from '../../render/constants/colours';
import { tierOfSectionKey } from '../build-entries';
import { FACT_LIST_SEPARATOR } from '../facts/resolve-prose';
import {
  ENCYCLOPEDIA_OWNED_CHIP_LABEL,
  ENCYCLOPEDIA_OWNED_CHIP_SEPARATOR,
  ENCYCLOPEDIA_PREVIEW_REPLAY_LABEL,
  ENCYCLOPEDIA_TIER_CAPTION_PREFIX,
  ENCYCLOPEDIA_TIER_IDENTITY_TEXT,
} from '../encyclopedia-constants';
import type { PreviewActionScene, PreviewScene, PreviewSpec } from '../../render/preview/preview-spec';
import type { EntryLink, ProseSegment, ResolvedFact, ResolvedSection, ResolvedSubject } from '../model/entry';
import { ENTRY_SUBJECT, ENTRY_SUBJECT_LABEL, entryIdOf, type EntryId } from '../model/entry-id';
import { PROSE_TOKEN } from '../model/prose';

/** The registry's title of an entry, passed in so this file stays pure (`facts/resolve-fact.ts`'s `TitleOf`). */
type TitleOf = (entryId: EntryId) => string;

/** §10.2's rarity tones: the three greys, never the accent, with `dna` for the rare one. */
const CHIP_TONE_BY_RARITY: Readonly<Record<TraitRarity, UiChipTone>> = {
  common: UI_CHIP_TONE.muted,
  uncommon: UI_CHIP_TONE.strong,
  rare: UI_CHIP_TONE.dna,
};

/** A title-column chip (§11.4): sized to its text, wrapping within the column. */
export interface EncyclopediaChip {
  /** Unique within the row, so the template tracks by it. */
  readonly key: string;
  readonly text: string;
  readonly tone: UiChipTone;
  /** A `DNA_TAG_COLOR` for a tag chip; `null` draws no dot. */
  readonly dotColour: string | null;
}

/** `II`: the bare numeral §11.4 asks for, in the unit's numeral form. */
export function tierNumeral(tier: TraitTier): string {
  return formatQuantity(tier, QUANTITY_UNIT.tier, { presentation: QUANTITY_PRESENTATION.numeral });
}

/** The tier of the trait the page documents as the round has it, or `null` outside a round and on any other subject. */
export function ownedTierOf(ownedTraits: readonly OwnedTrait[], subject: ResolvedSubject): TraitTier | null {
  if (subject.kind !== ENTRY_SUBJECT.trait) return null;
  return ownedTraits.find((owned) => owned.traitId === subject.traitId)?.tier ?? null;
}

function traitChips(
  subject: Extract<ResolvedSubject, { kind: typeof ENTRY_SUBJECT.trait }>,
  titleOf: TitleOf,
): EncyclopediaChip[] {
  const tags = subject.dnaTags.map((tag) => ({
    key: tag,
    text: titleOf(entryIdOf(ENTRY_SUBJECT.dnaTag, tag)),
    tone: UI_CHIP_TONE.neutral,
    dotColour: DNA_TAG_COLOR[tag],
  }));
  return [
    { key: subject.rarity, text: subject.rarity, tone: CHIP_TONE_BY_RARITY[subject.rarity], dotColour: null },
    ...tags,
    {
      key: subject.stage,
      text: titleOf(entryIdOf(ENTRY_SUBJECT.stage, subject.stage)),
      tone: UI_CHIP_TONE.neutral,
      dotColour: null,
    },
  ];
}

/**
 * The chips under the title (§11.4): a trait's rarity, its DNA tags and its stage, then `OWNED · II` in level gold
 * while a round has it. Every other subject wears the one kind chip, which is what keeps its page from opening on a
 * title with nothing under it.
 */
export function entryChips(
  subject: ResolvedSubject,
  ownedTier: TraitTier | null,
  titleOf: TitleOf,
): readonly EncyclopediaChip[] {
  const chips =
    subject.kind === ENTRY_SUBJECT.trait
      ? traitChips(subject, titleOf)
      : [
          {
            key: subject.kind,
            text: ENTRY_SUBJECT_LABEL[subject.kind],
            tone: UI_CHIP_TONE.neutral,
            dotColour: null,
          },
        ];
  if (ownedTier === null) return chips;
  const text = `${ENCYCLOPEDIA_OWNED_CHIP_LABEL}${ENCYCLOPEDIA_OWNED_CHIP_SEPARATOR}${tierNumeral(ownedTier)}`;
  return [...chips, { key: ENCYCLOPEDIA_OWNED_CHIP_LABEL, text, tone: UI_CHIP_TONE.gold, dotColour: null }];
}

/** A facts row with the links its value is made of; the kit draws them through `ng-template[uiFactValue]`. */
export interface EncyclopediaFactRow extends UiFactRow {
  /** Empty on a plain value row; one entry per target on a link fact (§11.4). */
  readonly links: readonly EntryLink[];
}

/** Shared by every plain value row, so a row's identity does not change with each rebuild. */
const NO_FACT_LINKS: readonly EntryLink[] = [];

function factRowOf(run: readonly ResolvedFact[], rowId: string): EncyclopediaFactRow {
  const [first] = run;
  const links = run.map((fact) => fact.link).filter((link) => link !== null);
  const text = run.map((fact) => fact.text).join(FACT_LIST_SEPARATOR);
  return { rowId, name: first?.label ?? '', values: [text], links };
}

/**
 * `facts` as table rows (§11.4): consecutive facts sharing a `key` are one row — a link with several targets arrives
 * as one fact per target (§12.3) and reads as one `Requires` line. A key that comes back after another one starts a
 * second row, whose id is suffixed so two rows can never share a track key.
 */
export function factRowsFor(facts: readonly ResolvedFact[]): readonly EncyclopediaFactRow[] {
  const rows: EncyclopediaFactRow[] = [];
  const usedRowIds = new Set<string>();
  for (let index = 0; index < facts.length; index += 1) {
    const key = facts[index]!.key;
    const start = index;
    while (index + 1 < facts.length && facts[index + 1]!.key === key) index += 1;
    const rowId = usedRowIds.has(key) ? `${key}_${start}` : key;
    usedRowIds.add(rowId);
    rows.push(factRowOf(facts.slice(start, index + 1), rowId));
  }
  return rows;
}

/** The Effects by tier table (§11.4): one column per `tier_n` section, one row per modifier key any of them sets. */
export interface EncyclopediaTierTable {
  /** `You own II`, or empty outside a round: the header cell over the noun column. */
  readonly caption: string;
  /** The tier numerals, in tier order. */
  readonly columns: readonly string[];
  /** Plain value rows: a tier's effect is a figure, never a link, so every row's `links` is empty. */
  readonly rows: readonly EncyclopediaFactRow[];
  /** The owned tier's column, tinted accent; `null` when the round does not have the trait. */
  readonly highlightColumn: number | null;
}

/**
 * A modifier's noun as the tier table writes it: §11.4's `Mass decay`, from the `mass decay` the trait cards read
 * inside a sentence (`+15 % speed`). One place, so the two never drift into two spellings of one effect.
 */
export function factNameFromNoun(noun: string): string {
  return `${noun.slice(0, 1).toUpperCase()}${noun.slice(1)}`;
}

/** The union of the modifier keys the tier sections carry, in the order the sections first name each one. */
function modifierKeysOf(sections: readonly ResolvedSection[]): readonly ResolvedFact[] {
  const byKey = new Map<string, ResolvedFact>();
  for (const section of sections) {
    for (const fact of section.facts) if (!byKey.has(fact.key)) byKey.set(fact.key, fact);
  }
  return [...byKey.values()];
}

/** A tier section with the tier its key names: the shape both the tier table and the lens's tier switch are built of. */
interface TierSection {
  readonly section: ResolvedSection;
  readonly tier: TraitTier;
}

function tierSectionsOf(sections: readonly ResolvedSection[]): readonly TierSection[] {
  return sections
    .map((section) => ({ section, tier: tierOfSectionKey(section.key) }))
    .filter((column): column is TierSection => column.tier !== null);
}

/** One segment of the lens's tier switch (§11.4): the numeral it is labelled with and the preview it shows. */
export interface EncyclopediaTierSegment {
  readonly tier: TraitTier;
  readonly numeral: string;
  /** The section's own preview; `null` where a section re-points nothing, which leaves the entry's showing. */
  readonly preview: PreviewSpec | null;
}

export interface EncyclopediaTierSwitch {
  readonly segments: readonly EncyclopediaTierSegment[];
  /** Where the switch starts: the tier the round owns, else the first (§11.4). */
  readonly defaultTier: TraitTier;
}

/**
 * The lens control under a trait's lens, or `null` for an entry with no tier section — every entry but a trait. It
 * is built from the same sections as the Effects by tier table, so the switch and the table always have the same
 * columns: a numeral in one that is missing from the other would be the table and the lens disagreeing about the
 * trait.
 */
export function tierSwitchFor(
  sections: readonly ResolvedSection[],
  ownedTier: TraitTier | null,
): EncyclopediaTierSwitch | null {
  const tiers = tierSectionsOf(sections);
  const [firstTier] = tiers;
  if (firstTier === undefined) return null;
  const owned = tiers.find((column) => column.tier === ownedTier);
  return {
    segments: tiers.map(({ section, tier }) => ({ tier, numeral: tierNumeral(tier), preview: section.preview })),
    defaultTier: (owned ?? firstTier).tier,
  };
}

/**
 * The tier table, or `null` for an entry with no tier section — which is every entry but a trait, and a trait whose
 * tiers all sit at identity, where §11.4 says a table with no rows is left out rather than drawn empty.
 */
export function tierTableFor(
  sections: readonly ResolvedSection[],
  ownedTier: TraitTier | null,
): EncyclopediaTierTable | null {
  const tiers = tierSectionsOf(sections);
  const rows: EncyclopediaFactRow[] = modifierKeysOf(tiers.map((column) => column.section)).map((fact) => ({
    rowId: fact.key,
    name: factNameFromNoun(fact.label),
    values: tiers.map(
      (column) =>
        column.section.facts.find((tierFact) => tierFact.key === fact.key)?.text ?? ENCYCLOPEDIA_TIER_IDENTITY_TEXT,
    ),
    links: NO_FACT_LINKS,
  }));
  if (rows.length === 0) return null;
  const ownedColumn = tiers.findIndex((column) => column.tier === ownedTier);
  return {
    caption: ownedTier === null ? '' : `${ENCYCLOPEDIA_TIER_CAPTION_PREFIX}${tierNumeral(ownedTier)}`,
    columns: tiers.map((column) => tierNumeral(column.tier)),
    rows,
    highlightColumn: ownedColumn < 0 ? null : ownedColumn,
  };
}

/** A blank line in a template starts a new paragraph; nothing else does (§11.4, `text-wrap: pretty` per paragraph). */
const PROSE_PARAGRAPH_BREAK = '\n\n';

/**
 * `summary`'s segments as paragraphs (§11.4). A break can only fall inside a text segment — a value and a link are
 * one run of characters each — so the split walks the text and every other segment joins the paragraph it is in.
 */
export function proseParagraphs(segments: readonly ProseSegment[]): readonly (readonly ProseSegment[])[] {
  const paragraphs: ProseSegment[][] = [[]];
  for (const segment of segments) {
    if (segment.kind !== PROSE_TOKEN.text) {
      paragraphs[paragraphs.length - 1]!.push(segment);
      continue;
    }
    const pieces = segment.text.split(PROSE_PARAGRAPH_BREAK);
    pieces.forEach((text, index) => {
      if (index > 0) paragraphs.push([]);
      if (text !== '') paragraphs[paragraphs.length - 1]!.push({ kind: PROSE_TOKEN.text, text });
    });
  }
  return paragraphs.filter((paragraph) => paragraph.length > 0);
}

/** The `Replay` label under a lens showing an action scene (§11.4), or `null` for a scene that shows a subject. */
export function replayLabelFor(spec: PreviewSpec | null): string | null {
  return spec !== null && isActionScene(spec.scene) ? ENCYCLOPEDIA_PREVIEW_REPLAY_LABEL[spec.scene] : null;
}

function isActionScene(scene: PreviewScene): scene is PreviewActionScene {
  return Object.hasOwn(ENCYCLOPEDIA_PREVIEW_REPLAY_LABEL, scene);
}
