// A clip running across a scene swap (docs/architecture/encyclopedia.md §12.7): the rule that the preview's render
// tick is monotonic and never wraps, and the consequence that makes it matter.

import { MILLISECONDS_PER_SECOND, MOTION_CLIP, MOTION_CLIPS, ManualClock, TICK_INTERVAL_S } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { MotionClipPlayer } from '../effects/motion-clip-player';
import { PreviewLocalClock } from './preview-clock';

/**
 * **The defect this exists for was latent for a whole ticket.** `show` restarts a scene's loop, and if it did so
 * by moving the clock back, a clip started before the swap would see `nowMs` jump backwards: `isClipFinished`
 * goes negative, the clip is never pruned, and the cell wears its deformation forever. Ticket #363's review
 * found and fixed that — but nothing could observe it, because none of the four scenes it shipped emitted an
 * effect, so no clip was ever running when a swap happened.
 *
 * Ticket #364's action scenes do emit effects, so the swap now has something to strand. These drive the real
 * `MotionClipPlayer` off the real `PreviewLocalClock` across a `restartScene`, which is the pair the fix lives in.
 */
describe('a clip running across a scene swap', () => {
  const eatClip = MOTION_CLIPS[MOTION_CLIP.eat];

  /** The render tick as milliseconds, which is exactly what `GameRenderer` hands the clip player as `nowMs`. */
  function renderNowMs(clock: PreviewLocalClock): number {
    return clock.renderTick() * TICK_INTERVAL_S * MILLISECONDS_PER_SECOND;
  }

  it('is pruned after its own duration, even though the swap restarted the loop', () => {
    const wall = new ManualClock(0);
    const clock = new PreviewLocalClock(wall);
    const player = new MotionClipPlayer();
    clock.restartScene();

    // The reader has been on this entry a while before the clip starts. That matters: a clip that started at
    // render time zero survives a clock reset by accident, because `nowMs - startMs` is still positive
    // afterwards. This clip starts late enough that a reset would put `nowMs` *behind* it, which is the shape of
    // the defect — verified by mutating `restartScene` to move the clock instead of the phase.
    wall.advanceMilliseconds(watchedForMs);
    player.play(eatClip, renderNowMs(clock));
    expect(player.activeCount).toBe(1);

    // The reader turns the page a third of the way through the clip.
    wall.advanceMilliseconds(eatClip.duration / 3);
    clock.restartScene();
    expect(player.isPlaying(MOTION_CLIP.eat, renderNowMs(clock))).toBe(true);

    // Past the clip's own duration, counted from when it started rather than from the swap.
    wall.advanceMilliseconds(eatClip.duration);
    player.sample(renderNowMs(clock));
    expect(player.activeCount).toBe(0);
  });

  /**
   * The mechanism, stated on its own so a future change that reintroduces the defect fails here with the reason
   * rather than only in the pruning test above. A swap must move the scene's **phase**, never the clock.
   */
  it('never sees the render tick go backwards, while the scene’s own tick restarts', () => {
    const wall = new ManualClock(0);
    const clock = new PreviewLocalClock(wall);
    clock.restartScene();
    wall.advanceMilliseconds(someMilliseconds);
    const beforeSwap = clock.renderTick();
    expect(clock.sceneTick()).toBeGreaterThan(0);

    clock.restartScene();

    expect(clock.renderTick()).toBeGreaterThanOrEqual(beforeSwap);
    expect(clock.sceneTick()).toBe(0);
  });

  const someMilliseconds = 400;
  /** Long enough that a clock reset lands well behind the clip's start. */
  const watchedForMs = 5_000;
});
