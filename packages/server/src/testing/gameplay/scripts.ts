// Scripted inputs (docs/TESTING.md §8, docs/ECOLOGY.md §8). A script sees the state before the
// step it feeds and answers with a `PlayerCommand`; the runner merges the commands one player
// produced for one tick and hands the adapter the result. "Target N radii east" is measured
// from the cell's *current* centre every tick, exactly as the fixture convention says.

import type { PlayerId } from '@evolution/shared';
import type { CellLocation, PlayerCommand, TraitChoiceCommand } from './adapter.js';
import { ScenarioSetupError } from './errors.js';

export interface ScriptContext<Snapshot> {
  /** The tick of `snapshot`: the state the script is looking at. */
  readonly tick: number;
  /** The tick the command will be applied in (`tick + 1`). */
  readonly stepTick: number;
  readonly playerIndex: number;
  readonly playerId: PlayerId;
  readonly snapshot: Snapshot;
  /** The player's cell, or `undefined` when the adapter finds none. */
  readonly cell: CellLocation | undefined;
}

/** Answers the command to submit before `stepTick`, or `null` to send nothing this tick. */
export type PlayerScript<Snapshot> = (context: ScriptContext<Snapshot>) => PlayerCommand | null;

/** Later fields win; the sprint one-shot is OR-merged so it is never lost (docs/ARCHITECTURE.md §3.2). */
export function mergeCommands(base: PlayerCommand, next: PlayerCommand): PlayerCommand {
  const merged: PlayerCommand = { ...base, ...next };
  if (base.isSprinting === true || next.isSprinting === true) {
    return { ...merged, isSprinting: true };
  }
  return merged;
}

/** The same literal command every tick. */
export function command(fixed: PlayerCommand): PlayerScript<unknown> {
  return () => fixed;
}

/** No input at all ("idle" in the scenario tables). */
export const idle: PlayerScript<unknown> = () => null;

export function targetPoint(x: number, y: number): PlayerScript<unknown> {
  return () => ({ targetX: x, targetY: y });
}

/** Targets `radii × radius` east of the cell's current centre: full throttle, never reached. */
export function targetRadiiEast(radii: number): PlayerScript<unknown> {
  return (context) => {
    const cell = requireCell(context, `target ${radii} radii east`);
    return { targetX: cell.x + radii * cell.radiusWu, targetY: cell.y };
  };
}

/** Targets `radii × radius` directly away from `fromPoint` (E11: "away from A"). */
export function targetRadiiAwayFrom(radii: number, fromPoint: { x: number; y: number }): PlayerScript<unknown> {
  return (context) => {
    const cell = requireCell(context, `target ${radii} radii away`);
    const deltaX = cell.x - fromPoint.x;
    const deltaY = cell.y - fromPoint.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance === 0) {
      return { targetX: cell.x + radii * cell.radiusWu, targetY: cell.y };
    }
    const reach = (radii * cell.radiusWu) / distance;
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

function requireCell<Snapshot>(context: ScriptContext<Snapshot>, what: string): CellLocation {
  if (context.cell === undefined) {
    throw new ScenarioSetupError(
      `player ${context.playerIndex} has no cell at tick ${context.tick}, so "${what}" cannot be resolved ` +
        '(the echo module has no world; use targetPoint or the Evolution adapter)',
    );
  }
  return context.cell;
}
