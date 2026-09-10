// Scripted inputs (docs/TESTING.md §8, docs/ECOLOGY.md §8). A script sees the state before the
// step it feeds and answers with a `PlayerCommand`; the runner merges the commands one player
// produced for one tick and hands the adapter the result. "Target N radii east" is measured
// from the cell's *current* centre every tick, exactly as the fixture convention says. A script
// whose player has no cell this tick (absorbed, spectating, not yet spawned) sends nothing.

import type { PlayerId, RandomSource } from '@evolution/shared';
import type { CellLocation, PlayerCommand, TraitChoiceCommand } from './adapter.js';

export interface ScriptContext<Snapshot> {
  /** The tick of `snapshot`: the state the script is looking at. */
  readonly tick: number;
  /** The tick the command will be applied in (`tick + 1`). */
  readonly stepTick: number;
  readonly playerIndex: number;
  readonly playerId: PlayerId;
  readonly snapshot: Snapshot;
  /** The player's cell, or `undefined` when the player has none; an adapter with no world throws here. */
  readonly cell: CellLocation | undefined;
  readonly seed: number;
  /** This player's own stream, forked from the scenario seed: the only place a bot may draw from. */
  readonly random: RandomSource;
}

/** Answers the command to submit before `stepTick`, or `null` to send nothing this tick. */
export type PlayerScript<Snapshot> = (context: ScriptContext<Snapshot>) => PlayerCommand | null;

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

/** No input at all ("idle" in the scenario tables). */
export const idle: PlayerScript<unknown> = () => null;

export function targetPoint(x: number, y: number): PlayerScript<unknown> {
  return () => ({ targetX: x, targetY: y });
}

function radiiEastOf(cell: CellLocation, radii: number): PlayerCommand {
  return { targetX: cell.x + radii * cell.radiusWu, targetY: cell.y };
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
