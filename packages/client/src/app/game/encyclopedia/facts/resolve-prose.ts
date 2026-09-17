// A prose template to segments (docs/architecture/encyclopedia.md §12.6): a value token becomes its fact's formatted
// text, a link its target's title or the shown text. An unknown fact key or a link to nothing throws, so the prose
// spec fails instead of a player's screen. Pure.

import type { ProseSegment, ResolvedFact } from '../model/entry';
import { splitEntryReference, type EntryId } from '../model/entry-id';
import { PROSE_TOKEN, parseProseTemplate, type ProseTemplate, type ProseToken } from '../model/prose';
import type { TitleOf } from './resolve-fact';

export interface ProseScope {
  /** The facts a value token may name: the section's and the entry's. */
  readonly facts: readonly ResolvedFact[];
  readonly titleOf: TitleOf;
  /** Whether a link's reference names a registry entry, or a section of one. */
  readonly isReference: (reference: string) => boolean;
}

/** A link fact with several targets reads as the list of their titles, in prose and in the facts table alike. */
export const FACT_LIST_SEPARATOR = ', ';

function segmentOf(token: ProseToken, template: ProseTemplate, scope: ProseScope): ProseSegment {
  switch (token.kind) {
    case PROSE_TOKEN.text:
      return token;
    case PROSE_TOKEN.value: {
      const facts = scope.facts.filter((fact) => fact.key === token.factKey);
      if (facts.length === 0) throw new Error(`The prose token {${token.factKey}} names no fact: "${template}"`);
      return {
        kind: token.kind,
        factKey: token.factKey,
        text: facts.map((fact) => fact.text).join(FACT_LIST_SEPARATOR),
      };
    }
    case PROSE_TOKEN.link: {
      if (!scope.isReference(token.reference)) {
        throw new Error(`The prose link [[${token.reference}]] names no entry: "${template}"`);
      }
      const { entryId, sectionKey } = splitEntryReference(token.reference);
      const text = token.shownText ?? scope.titleOf(entryId as EntryId);
      return { kind: token.kind, entryId: entryId as EntryId, sectionKey, text };
    }
  }
}

export function resolveProse(template: ProseTemplate, scope: ProseScope): readonly ProseSegment[] {
  return parseProseTemplate(template).map((token) => segmentOf(token, template, scope));
}
