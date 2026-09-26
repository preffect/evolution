// Walking one loop of a preview scene the way the session does — test-only, out of
// `render/preview/scenes/engulf-scenes.spec.ts` for its line limit (#367): the frames of each whole tick with their
// effects, a cell of a frame, the first effect of a kind, and the tick a held prey first reads as held.

import { CELL_STATE, DEFAULT_BALANCE, type BalanceConfig, type CellView, type GameEffect } from '@evolution/shared';
import { expect } from 'vitest';
import type { PreviewScene, PreviewSceneFrame } from '../app/game/render/preview/preview-scene';

/** Every whole tick strictly inside one loop, as the session walks it, with the effects of each step. */
export function walkOneLoop(
  scene: PreviewScene,
  balance: BalanceConfig = DEFAULT_BALANCE,
): { tick: number; frame: PreviewSceneFrame }[] {
  const period = scene.periodTicks(balance);
  const frames = [];
  let previousTick = 0;
  for (let tick = 0; tick < period; tick += 1) {
    frames.push({ tick, frame: scene.frameAt(tick, previousTick, balance) });
    previousTick = tick;
  }
  return frames;
}

export function cellIn(frame: PreviewSceneFrame, id: string): CellView | undefined {
  return frame.cells.find((cell) => cell.id === id);
}

/** The first effect of `kind` in one loop, with its tick; null when the loop emits none. */
export function firstEffectOf(scene: PreviewScene, kind: GameEffect['kind'], balance: BalanceConfig = DEFAULT_BALANCE) {
  for (const { tick, frame } of walkOneLoop(scene, balance)) {
    const effect = frame.effects.find((one) => one.kind === kind);
    if (effect !== undefined) return { tick, effect };
  }
  return null;
}

/** The first tick at which the prey reads as held. */
export function contactTickOf(scene: PreviewScene, preyId: string, balance: BalanceConfig = DEFAULT_BALANCE): number {
  const first = walkOneLoop(scene, balance).find(
    ({ frame }) => cellIn(frame, preyId)?.states.includes(CELL_STATE.beingEngulfed) === true,
  );
  expect(first, 'the pair never made contact').toBeDefined();
  return first!.tick;
}
