// Whom the camera follows (docs/game-design/controls-and-scope.md §7): the own cell while alive, the killer's cell
// while spectating, nothing when neither exists. Pure over the frame.

import { followTargetIn, playerId, type CellView } from '@evolution/shared';
import type { RenderFrame } from '../net/world-store';
import type { CameraTarget } from './camera';

export { DISH_CENTRE_TARGET } from '@evolution/shared';

/** The own player's cell in the frame, or `null` while dead, spectating or not yet spawned. */
export function ownCellOf(frame: RenderFrame, ownPlayerId: string | null): CellView | null {
  if (ownPlayerId === null) return null;
  return frame.cells.find((cell) => cell.playerId === ownPlayerId) ?? null;
}

export function followTarget(frame: RenderFrame, ownPlayerId: string | null): CameraTarget | null {
  if (ownPlayerId === null) return null;
  // The one rule the server's per-viewer camera follows too (docs/architecture/wire-contract.md §4.2 lever 1).
  return followTargetIn(frame.cells, playerId(ownPlayerId), frame.latest.ownProgress?.spectatingCellId ?? null);
}
