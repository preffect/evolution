// Buckets tick-stamped events once (docs/DETERMINISM.md §6): a replay looks a step up in O(1)
// instead of scanning the log per tick. The module's replay runner and the scenario framework's
// replay share this one fold.

export function indexByTick<Event extends { readonly tick: number }>(events: readonly Event[]): Map<number, Event[]> {
  const byTick = new Map<number, Event[]>();
  for (const event of events) {
    const bucket = byTick.get(event.tick);
    if (bucket === undefined) {
      byTick.set(event.tick, [event]);
    } else {
      bucket.push(event);
    }
  }
  return byTick;
}
