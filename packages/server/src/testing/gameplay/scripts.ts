// Scripted inputs (docs/TESTING.md §8, docs/ECOLOGY.md §8). A script sees the state before the
// step it feeds and answers with a `PlayerCommand`; the runner merges the commands one player
// produced for one tick and hands the adapter the result. "Target N radii east" is measured
// from the cell's *current* centre every tick, exactly as the fixture convention says. A script
// whose player has no cell this tick (absorbed, spectating, not yet spawned) sends nothing.
// The context and script types are the strategy seam's (`game/bots/bot-strategy.ts`), re-exported
// here so a scenario imports everything script-shaped from one place.

import type { PlayerCommand, PlayerScript, TraitChoiceCommand } from '../../game/bots/bot-strategy.js';
import type { CellLocation } from '../../game/bots/perception.js';

export { idle, type PlayerScript, type ScriptContext } from '../../game/bots/bot-strategy.js';

/**
 * Later fields win; the one-shots are OR-merged the way the module coalesces inputs
 * (docs/ARCHITECTURE.md §3.2): a sprint from either side survives, and a later `traitChoice:
 * null` never drops an earlier pick (a later pick replaces it).
 */
export function mergeCommands(base: PlayerCommand, next: PlayerCommand): PlayerCommand {
  const merged: PlayerCommand = { ...base, ...next };
  const isSprinting = base.isSprinting === true || next.isSprinting === true;
  const traitChoice = next.traitChoice ?? base.traitChoice ?? next.traitChoice;
  return {
    ...merged,
    ...(isSprinting ? { isSprinting } : {}),
    ...(traitChoice !== undefined ? { traitChoice } : {}),
  };
}

/** The same literal command every tick. */
export function command(fixed: PlayerCommand): PlayerScript<unknown> {
  return () => fixed;
}

export function targetPoint(x: number, y: number): PlayerScript<unknown> {
  return () => ({ targetX: x, targetY: y });
}

function radiiEastOf(cell: CellLocation, radii: number): PlayerCommand {
  return { targetX: cell.x + radii * cell.radius, targetY: cell.y };
}

/** Targets `radii × radius` east of the cell's current centre: full throttle, never reached. */
export function targetRadiiEast(radii: number): PlayerScript<unknown> {
  return (context) => {
    const cell = context.cell;
    return cell === undefined ? null : radiiEastOf(cell, radii);
  };
}

/** Targets `radii × radius` directly away from `fromPoint` (E11: "away from A"). */
export function targetRadiiAwayFrom(radii: number, fromPoint: { x: number; y: number }): PlayerScript<unknown> {
  return (context) => {
    const cell = context.cell;
    if (cell === undefined) {
      return null;
    }
    const deltaX = cell.x - fromPoint.x;
    const deltaY = cell.y - fromPoint.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance === 0) {
      return radiiEastOf(cell, radii);
    }
    const reach = (radii * cell.radius) / distance;
    return { targetX: cell.x + deltaX * reach, targetY: cell.y + deltaY * reach };
  };
}

export function sprint(): PlayerScript<unknown> {
  return () => ({ isSprinting: true });
}

export function chooseTrait(choice: TraitChoiceCommand): PlayerScript<unknown> {
  return () => ({ traitChoice: choice });
}

/** Runs every script and merges their commands in order ("sprint + target 5 radii east"). */
export function combineScripts<Snapshot>(scripts: readonly PlayerScript<Snapshot>[]): PlayerScript<Snapshot> {
  return (context) => {
    let merged: PlayerCommand | null = null;
    for (const script of scripts) {
      const next = script(context);
      if (next !== null) {
        merged = merged === null ? next : mergeCommands(merged, next);
      }
    }
    return merged;
  };
}
