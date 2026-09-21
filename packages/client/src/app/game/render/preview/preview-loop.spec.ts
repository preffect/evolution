// @vitest-environment node
// The scene loop (docs/architecture/encyclopedia.md §12.7, §12.9): each loop emits its effects once, at their
// absolute ticks, and `frameAt` never looks back more than one period — so a tab that was hidden for minutes
// returns with one loop's clips starting, not every loop it slept through starting at one `nowMs`.
//
// The four scene families ticket #363 builds emit no effects at all (they are #364's), so this drives the real
// `previewScene` wrapper over a fixture definition with a real schedule, rather than a stub of the wrapper.

import { DEFAULT_BALANCE, ENTITY_KIND, EFFECT_KIND, TICK_INTERVAL_S, ZONE_ID, entityId } from '@evolution/shared';
import type { GameEffect } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { PREVIEW_STILL_PERIOD_SECONDS, PREVIEW_ZONE_CENTRE_WU } from '../constants';
import { previewLoopEffects, previewScene, type ScheduledPreviewEffect } from './preview-scene';

const BALANCE = DEFAULT_BALANCE;

describe('the scene loop', () => {
  const firstEffectLoopTick = 10;
  const secondEffectLoopTick = 40;
  const periodTicks = PREVIEW_STILL_PERIOD_SECONDS / TICK_INTERVAL_S;

  function effect(eatenId: string): GameEffect {
    return {
      kind: EFFECT_KIND.eat,
      tick: 0,
      x: 0,
      y: 0,
      cellId: entityId('preview-cell'),
      eatenId: entityId(eatenId),
      eatenKind: ENTITY_KIND.foodMote,
      massGained: 1,
      dnaGained: 0,
    };
  }

  const schedule: readonly ScheduledPreviewEffect[] = [
    { atLoopTick: firstEffectLoopTick, effect: effect('first') },
    { atLoopTick: secondEffectLoopTick, effect: effect('second') },
  ];

  const scheduled = previewScene({
    subjectPlayerId: null,
    framing: () => ({ target: { ...PREVIEW_ZONE_CENTRE_WU[ZONE_ID.openBroth], radius: 1 }, viewRadiusWu: 1 }),
    periodSecondsFor: () => PREVIEW_STILL_PERIOD_SECONDS,
    contentAt: () => ({ cells: [], motes: [], fragments: [] }),
    schedule: () => schedule,
  });

  it('emits each of a loop’s effects exactly once, in tick order', () => {
    const emitted = scheduled.frameAt(periodTicks, 0, BALANCE).effects;
    expect(emitted.map((one) => one.tick)).toEqual([firstEffectLoopTick, secondEffectLoopTick]);
  });

  it('emits the next loop’s effects at their next absolute ticks', () => {
    const emitted = scheduled.frameAt(periodTicks * 2, periodTicks, BALANCE).effects;
    expect(emitted.map((one) => one.tick)).toEqual([
      periodTicks + firstEffectLoopTick,
      periodTicks + secondEffectLoopTick,
    ]);
  });

  /**
   * The clamp §12.7 asks for. A tab hidden for fifty loops returns with one `previousTick` fifty periods behind;
   * without the clamp every loop in between would start its clips at this one `nowMs`.
   */
  it('emits at most one loop’s effects after a jump of many periods', () => {
    const loopsSlept = 50;
    const tick = periodTicks * loopsSlept;
    const emitted = scheduled.frameAt(tick, 0, BALANCE).effects;
    expect(emitted).toHaveLength(schedule.length);
    for (const one of emitted) expect(one.tick).toBeGreaterThan(tick - periodTicks);
  });

  it('emits nothing across a span that holds no scheduled tick', () => {
    expect(scheduled.frameAt(firstEffectLoopTick - 1, firstEffectLoopTick - 2, BALANCE).effects).toEqual([]);
  });
});

describe('previewLoopEffects', () => {
  it('returns nothing for an empty schedule, whatever the span', () => {
    expect(previewLoopEffects([], 0, 10_000, 100)).toEqual([]);
  });
});
