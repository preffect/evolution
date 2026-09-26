// The invariants a seeded bot playthrough checks at every checkpoint (#199): what must hold of any dish, whoever is
// playing it. Not a test file; `multiplayer.gameplay.test.ts` imports it. Each check answers the violations it found as
// sentences, so one `toEqual([])` prints every broken rule with the cell or player it broke on.

import { CELL_STATE, PLAYER_LIFE_STATE, TICK_HZ, type BalanceConfig, type CellView } from '@evolution/shared';
import type { EvolutionView } from '../gameplay/evolution-views.js';

function isFiniteCell(cell: CellView): boolean {
  return [cell.x, cell.y, cell.velocityX, cell.velocityY, cell.mass, cell.radius].every(Number.isFinite);
}

/**
 * Every cell is a finite, positive body under the mass cap with its centre inside the dish (docs/ecology/mass-and-movement.md
 * §5). The centre, not the rim: separation runs after the wall clamp (docs/architecture/server-simulation.md §3, step 3),
 * so a cell a neighbour presses into the wall sits a fraction of a wu past `DISH_RADIUS − radius` (seed 42, ~0.1 wu for
 * hundreds of ticks; reported on ticket #199).
 */
function cellBodyViolations(cells: readonly CellView[], balance: BalanceConfig): string[] {
  return cells.flatMap((cell) => {
    if (!isFiniteCell(cell)) {
      return [`cell ${cell.id} has a non-finite position, velocity, mass or radius`];
    }
    const violations: string[] = [];
    if (cell.mass <= 0 || cell.mass > balance.growth.CELL_MAX_MASS) {
      violations.push(`cell ${cell.id} mass ${cell.mass} outside (0, ${balance.growth.CELL_MAX_MASS}]`);
    }
    const centreDistance = Math.hypot(cell.x, cell.y);
    if (centreDistance > balance.world.DISH_RADIUS) {
      violations.push(
        `cell ${cell.id} centre ${centreDistance} wu out, past the dish radius ${balance.world.DISH_RADIUS}`,
      );
    }
    return violations;
  });
}

/** Both ends of every engulf name each other and carry their states (docs/ecology/absorption.md §6.1). */
function engulfLinkViolations(cells: readonly CellView[]): string[] {
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  return cells.flatMap((cell) => {
    const { engulfedByCellId, engulfingCellId, engulfProgress, states } = cell;
    const checks: [isHeld: boolean, violation: string][] = [
      [
        engulfedByCellId === null || byId.get(engulfedByCellId)?.engulfingCellId === cell.id,
        `prey ${cell.id} is held by ${engulfedByCellId}, which does not hold it`,
      ],
      [
        engulfingCellId === null || byId.get(engulfingCellId)?.engulfedByCellId === cell.id,
        `predator ${cell.id} holds ${engulfingCellId}, which is not held by it`,
      ],
      [
        (engulfedByCellId !== null) === states.includes(CELL_STATE.beingEngulfed),
        `cell ${cell.id}: being_engulfed does not match its predator link`,
      ],
      [
        (engulfingCellId !== null) === states.includes(CELL_STATE.engulfing),
        `cell ${cell.id}: engulfing does not match its prey link`,
      ],
      [engulfProgress >= 0 && engulfProgress <= 1, `cell ${cell.id} engulf progress ${engulfProgress} outside [0, 1]`],
    ];
    return checks.filter(([isHeld]) => !isHeld).map(([, violation]) => violation);
  });
}

/** A living player has exactly one cell; a spectating one has none and respawns inside the spectate (§5.2). */
function lifeStateViolations(view: EvolutionView, balance: BalanceConfig): string[] {
  // A death sets the countdown one tick over the spectate and step 9 of the same tick already counts it down once
  // (`SPECTATED_DEATH_TICK`, game/session/death.ts), so no snapshot shows more than the spectate itself.
  const maxRespawnTicks = balance.session.RESPAWN_SPECTATE_SECONDS * TICK_HZ;
  return Object.entries(view.snapshot.progressByPlayer).flatMap(([playerId, progress]) => {
    const cellCount = view.snapshot.cells.filter((cell) => cell.playerId === playerId).length;
    const expectedCells = progress.lifeState === PLAYER_LIFE_STATE.alive ? 1 : 0;
    const violations: string[] = [];
    if (cellCount !== expectedCells) {
      violations.push(`${playerId} is ${progress.lifeState} with ${cellCount} cells`);
    }
    if (progress.respawnInTicks < 0 || progress.respawnInTicks > maxRespawnTicks) {
      violations.push(`${playerId} respawns in ${progress.respawnInTicks} ticks, outside [0, ${maxRespawnTicks}]`);
    }
    return violations;
  });
}

/** The board is ranked 1…n by score, highest first (docs/game-design/session.md §5.3). */
function leaderboardViolations(view: EvolutionView): string[] {
  const rows = view.snapshot.leaderboard;
  return rows.flatMap((row, index) => {
    const previous = rows[index - 1];
    const violations: string[] = [];
    if (row.rank !== index + 1) {
      violations.push(`leaderboard row ${index} has rank ${row.rank}`);
    }
    if (previous !== undefined && previous.score < row.score) {
      violations.push(
        `leaderboard ranks ${previous.playerId} (${previous.score}) above ${row.playerId} (${row.score})`,
      );
    }
    return violations;
  });
}

/** Every invariant the dish breaks at this checkpoint; `[]` when the dish is sound. */
export function playthroughViolations(view: EvolutionView, balance: BalanceConfig): string[] {
  const { cells } = view.snapshot;
  return [
    ...cellBodyViolations(cells, balance),
    ...engulfLinkViolations(cells),
    ...lifeStateViolations(view, balance),
    ...leaderboardViolations(view),
  ];
}
