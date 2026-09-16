// The entry definition content writes and the resolved entry the UI binds (docs/architecture/encyclopedia.md §12.2).
// A resolved entry holds every value already formatted and every link already titled, so a component only lays out.

import type { CellStage, DnaTag, TraitCategory, TraitId, TraitRarity, TraitTier } from '@evolution/shared';
import type { PreviewSpec } from '../../render/preview/preview-spec';
import type { EncyclopediaCategory } from './categories';
import type { ENTRY_SUBJECT, EntryId, EntrySubject } from './entry-id';
import type { FactDefinition } from './fact';
import type { EntryGroupId } from './groups';
import type { PROSE_TOKEN, ProseTemplate } from './prose';

export interface EntryDefinition {
  readonly id: EntryId;
  /** A catalog `name` where one exists (traits); content-owned copy otherwise. Never a number. */
  readonly title: string;
  readonly summary: ProseTemplate;
  readonly facts: readonly FactDefinition[];
  readonly sections: readonly SectionDefinition[];
  /** Hand-picked links; the derived ones (a trait's requires) are added at resolve time. */
  readonly seeAlso: readonly EntryId[];
  readonly preview: PreviewSpec | null;
}

/** A trait's `tier_<n>` section: its heading and facts are generated from the live tier table (§12.3). */
export interface TierSectionSource {
  readonly traitId: TraitId;
  readonly tier: TraitTier;
}

export interface SectionDefinition {
  /** `tier_2`, `aerobic`. */
  readonly key: string;
  /** Content-written for every section but a generated tier section, whose heading is empty here. */
  readonly heading: ProseTemplate;
  readonly body: ProseTemplate;
  /** A generated tier section declares none: its facts are the tier's non-identity modifiers. */
  readonly facts: readonly FactDefinition[];
  /** A section may re-point the preview (a trait's tier tabs); `null` keeps the entry's. */
  readonly preview: PreviewSpec | null;
  /** Set for a trait's tier section, `null` for a written one. */
  readonly tier: TierSectionSource | null;
}

export type ProseSegment =
  | { readonly kind: typeof PROSE_TOKEN.text; readonly text: string }
  | { readonly kind: typeof PROSE_TOKEN.value; readonly factKey: string; readonly text: string }
  | {
      readonly kind: typeof PROSE_TOKEN.link;
      readonly entryId: EntryId;
      /** The anchored section (`tier_2` of `[[trait:cilia#tier_2]]`), `null` for a whole entry. */
      readonly sectionKey: string | null;
      readonly text: string;
    };

export type ResolvedSubject =
  | {
      readonly kind: typeof ENTRY_SUBJECT.trait;
      readonly traitId: TraitId;
      readonly traitCategory: TraitCategory;
      readonly rarity: TraitRarity;
      readonly dnaTags: readonly DnaTag[];
      readonly stage: CellStage;
      /** From `balance.traits.TRAIT_TIERS`. */
      readonly tierCount: number;
    }
  | { readonly kind: Exclude<EntrySubject, typeof ENTRY_SUBJECT.trait>; readonly codeId: string };

export interface EntryLink {
  readonly entryId: EntryId;
  readonly title: string;
}

export interface ResolvedFact {
  /** A formula or balance fact's key; in a trait's `tier_n` section, the modifier key (`speedMultiplier`). */
  readonly key: string;
  /** In a tier section, `MODIFIER_LABELS[key].noun` (`speed`). */
  readonly label: string;
  /** The formatted value with its unit: `20 mass`, `+15 %`; a link fact's text is its target's title. */
  readonly text: string;
  /** Set for a link-valued fact, `null` otherwise. A link with several targets is one fact per target. */
  readonly link: EntryLink | null;
}

export interface ResolvedSection {
  readonly key: string;
  readonly heading: readonly ProseSegment[];
  readonly body: readonly ProseSegment[];
  readonly facts: readonly ResolvedFact[];
  readonly preview: PreviewSpec | null;
}

export interface ResolvedEntry {
  readonly id: EntryId;
  readonly category: EncyclopediaCategory;
  /** What the page's chips and breadcrumb read, per subject; never re-read from the catalog by the UI. */
  readonly subject: ResolvedSubject;
  /** The list header the entry sits under; `null` in a category without groups (abilities, actions). */
  readonly group: EntryGroupId | null;
  readonly title: string;
  readonly summary: readonly ProseSegment[];
  /** A landing tile's one fact: the entry's first fact, `null` when it has none. */
  readonly headline: ResolvedFact | null;
  readonly facts: readonly ResolvedFact[];
  readonly sections: readonly ResolvedSection[];
  readonly seeAlso: readonly EntryLink[];
  readonly preview: PreviewSpec | null;
}

/** `entriesIn(category)`: the category's groups in walk order, each with its entries; one `null` group when ungrouped. */
export interface ResolvedGroup {
  readonly group: EntryGroupId | null;
  readonly entries: readonly EntryLink[];
}
