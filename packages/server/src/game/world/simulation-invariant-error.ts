// The simulation-wide invariant error (docs/CODE-STANDARDS.md §9): a state no step, lookup or
// draw should ever reach (a missing record a system references, a weighted draw over nothing, a
// gel layout that does not fit). It is a bug, never player input, and propagates; the request
// counterpart for the debug seam is `debug/debug-request-error.ts`.

export class SimulationInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationInvariantError';
  }
}
