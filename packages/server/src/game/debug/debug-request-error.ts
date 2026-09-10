// A debug request the game module cannot honour (unknown player, unknown entity kind, a
// balance path that is not a number leaf). MCP handlers convert it into an `isError` result
// (docs/CODE-STANDARDS.md §9); anything else thrown by a handle is a bug and propagates.

export class DebugRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DebugRequestError';
  }
}
