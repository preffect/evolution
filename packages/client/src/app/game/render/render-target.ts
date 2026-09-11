// Whom the camera follows (docs/GAME-DESIGN.md §7): the own cell while alive, the killer's cell
// while spectating, nothing when neither exists. Pure over the frame.

import type { CellView } from '@evolution/shared';
import type { RenderFrame } from '../net/world-store';
import type { CameraTarget } from './camera';

/** Where the camera parks before anyone exists to follow: the dish centre at a unit radius. */
export const DISH_CENTRE_TARGET: CameraTarget = { x: 0, y: 0, radius: 1 };

/** The own player's cell in the frame, or `null` while dead, spectating or not yet spawned. */
export function ownCellOf(frame: RenderFrame, ownPlayerId: string | null): CellView | null {
  if (ownPlayerId === null) return null;
  return frame.cells.find((cell) => cell.playerId === ownPlayerId) ?? null;
}

export function followTarget(frame: RenderFrame, ownPlayerId: string | null): CameraTarget | null {
  if (ownPlayerId === null) return null;
  const own = ownCellOf(frame, ownPlayerId);
  if (own !== null) return { x: own.x, y: own.y, radius: own.radius };
  const spectatingCellId = frame.latest.players[ownPlayerId]?.spectatingCellId ?? null;
  const killer = spectatingCellId === null ? undefined : frame.cells.find((cell) => cell.id === spectatingCellId);
  return killer === undefined ? null : { x: killer.x, y: killer.y, radius: killer.radius };
}
