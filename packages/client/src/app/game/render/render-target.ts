// Whom the camera follows (docs/GAME-DESIGN.md §7): the own cell while alive, the killer's cell
// while spectating, nothing when neither exists. Pure over the frame.

import type { RenderFrame } from '../net/world-store';
import type { CameraTarget } from './camera';

export function followTarget(frame: RenderFrame, ownPlayerId: string | null): CameraTarget | null {
  if (ownPlayerId === null) return null;
  const own = frame.cells.find((cell) => cell.playerId === ownPlayerId);
  if (own !== undefined) return { x: own.x, y: own.y, radius: own.radius };
  const spectatingCellId = frame.latest.players[ownPlayerId]?.spectatingCellId ?? null;
  const killer = spectatingCellId === null ? undefined : frame.cells.find((cell) => cell.id === spectatingCellId);
  return killer === undefined ? null : { x: killer.x, y: killer.y, radius: killer.radius };
}
