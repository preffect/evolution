// A long synchronous run starves everything else on its thread. In a vitest worker that includes
// the RPC replies to the worker's own progress reports: once a test holds the thread for longer
// than the RPC timeout (60 s, reached by a whole-round scenario on a loaded box), the timeout fires
// before the reply is read and a green run exits 1 (#262). Long drivers hand the thread back with
// this between bursts, the way the room loop returns to the event loop between ticker fires.

/** Resolves on the next turn of the event loop, after the I/O callbacks already waiting have run. */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
