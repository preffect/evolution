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
      times.measureKelp(spend(4));
      times.measureSlime(spend(6));
      times.measureSubmit(spend(2));
      times.endFrame();
    }
    expect(times.take()).toEqual({
      frames: 2,
      upperBandsMs: 5,
      planetMs: 1,
      shoreMs: 3,
      kelpMs: 4,
      slimeMs: 6,
      dishMs: 0,
      submitMs: 2,
    });
    expect(times.take()).toEqual({
      frames: 0,
      upperBandsMs: 0,
      planetMs: 0,
      shoreMs: 0,
      kelpMs: 0,
      slimeMs: 0,
      dishMs: 0,
      submitMs: 0,
    });
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

  it('keeps the last frame’s time handing work to the GPU, the planet’s draw and the submit, apart (ticket #804)', () => {
    const { times, spend } = harness();
    times.measureUpperBands(spend(1));
    times.measurePlanet(spend(40));
    times.measureShore(spend(2));
    times.measureKelp(spend(3));
    times.measureSlime(spend(4));
    times.measureDish(() => {
      spend(5)();
      times.measureSubmit(spend(300));
    });
    // Until the frame ends, the last one's stands.
    expect(times.lastFrameIssueMs).toBe(0);
    times.endFrame();
    expect(times.lastFrameIssueMs).toBe(340);
    times.measureSubmit(spend(9));
    times.endFrame();
    expect(times.lastFrameIssueMs).toBe(9);
  });
});
