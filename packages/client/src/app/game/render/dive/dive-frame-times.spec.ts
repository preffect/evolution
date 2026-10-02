// @vitest-environment node
// What a dive frame costs per band (docs/rendering/opening-dive.md §6), on a manual clock.

import { ManualClock } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { DiveFrameTimes } from './dive-frame-times';

function harness() {
  const clock = new ManualClock(0);
  return {
    clock,
    times: new DiveFrameTimes(clock),
    spend: (durationMs: number) => () => clock.advanceMilliseconds(durationMs),
  };
}

describe('DiveFrameTimes', () => {
  it('reports each band’s mean per frame since the last take, then starts again', () => {
    const { times, spend } = harness();
    for (const upperMs of [4, 6]) {
      times.measureUpperBands(spend(upperMs));
      times.measurePlanet(spend(1));
      times.measureShore(spend(3));
      times.measureSubmit(spend(2));
      times.endFrame();
    }
    expect(times.take()).toEqual({ frames: 2, upperBandsMs: 5, planetMs: 1, shoreMs: 3, dishMs: 0, submitMs: 2 });
    expect(times.take()).toEqual({ frames: 0, upperBandsMs: 0, planetMs: 0, shoreMs: 0, dishMs: 0, submitMs: 0 });
  });

  it('charges a submit inside the dish’s frame to the submit, not to the dish', () => {
    const { times, spend } = harness();
    const outputs = times.measureDish(() => {
      spend(3)();
      times.measureSubmit(spend(7));
      return 'outputs';
    });
    times.endFrame();
    expect(outputs).toBe('outputs');
    expect(times.take()).toMatchObject({ dishMs: 3, submitMs: 7 });
  });
});
