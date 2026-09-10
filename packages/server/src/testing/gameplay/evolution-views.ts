// How the scenario adapter and the bot binding read the Evolution wire snapshot (docs/TESTING.md
// §8): a player's cell as a `CellLocation`. A leaf on purpose: both the adapter (which builds the
// module) and the binding (which the module builds its bots over) import it, so neither imports
// the other; the command → input mapping they also share is `wire-input.ts`.

import type { GameSnapshot, PlayerId } from '@evolution/shared';
import type { CellLocation } from './adapter.js';

/** The player's cell in a wire snapshot, or `undefined` while the player has none (spectating). */
export function locateCellInSnapshot(snapshot: GameSnapshot, playerId: PlayerId): CellLocation | undefined {
  const cell = snapshot.cells.find((candidate) => candidate.playerId === playerId);
  return cell === undefined ? undefined : { x: cell.x, y: cell.y, radiusWu: cell.radius };
}
