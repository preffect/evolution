// What the bot client refuses: a swarm it cannot build (a bad bot count, an unusable argument),
// a socket it cannot open, a game the server would not seat it in. Thrown, never logged, so the
// CLI prints it once and exits non-zero and a test asserts on it.

export class BotClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BotClientError';
  }
}
