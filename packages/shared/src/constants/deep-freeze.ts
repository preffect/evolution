// `DEFAULT_BALANCE` is shared by every room and aliases the module constants (docs/ARCHITECTURE.md
// §9): a room that patched it without cloning would rewrite every other room and the constants
// themselves. Freezing the whole graph turns that mistake into a throw in tests (ESM is strict
// mode); `structuredClone` of a frozen graph is a writable copy, so the room's own copy patches fine.

function isFreezable(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/** Freezes `value` and every object or array reachable from it, in place, and returns it. */
export function deepFreeze<Value>(value: Value): Readonly<Value> {
  if (!isFreezable(value) || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const member of Object.values(value)) deepFreeze(member);
  return value;
}
