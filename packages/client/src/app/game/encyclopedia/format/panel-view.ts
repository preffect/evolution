// The panel element's own derived values, pure (docs/ui/encyclopedia.md §11.6): what `data-location` reads.
//
// The attribute is how a test — and a person reading the DOM — sees where the reader is without opening the state
// service. §11.6 writes it `<category>|<entryId>`; on a landing there is no entry, and the half after the separator
// is empty rather than absent, so the shape is the same string either way and a parser never has to branch.

import type { EncyclopediaLocation } from './navigation';

export const ENCYCLOPEDIA_LOCATION_SEPARATOR = '|';

/** `evolutions|trait:mitochondrion` on an entry, `evolutions|` on that category's landing. */
export function locationAttributeFor(location: EncyclopediaLocation): string {
  return `${location.category}${ENCYCLOPEDIA_LOCATION_SEPARATOR}${location.entryId ?? ''}`;
}
