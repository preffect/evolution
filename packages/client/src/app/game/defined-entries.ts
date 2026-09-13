// One small utility the composition root and the input seam share (docs/CODE-STANDARDS.md §3).
//
// `exactOptionalPropertyTypes` refuses an explicit `undefined` where a property is optional, so an
// absent handler has to be an absent *key*, not a key holding `undefined`. Written inline that is a
// ternary per handler per forwarding site, and the HUD forwards a growing set of them (#188's
// preview, #189's overlays, #190's notices) through two files. This drops the undefined values once
// instead, so adding a handler costs one key in one object literal.

/** The record without the keys whose value is `undefined`; every other key is passed through. */
export function definedEntriesOf<T extends object>(candidate: T): Partial<T> {
  const defined: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (value !== undefined) defined[key] = value;
  }
  return defined as Partial<T>;
}
