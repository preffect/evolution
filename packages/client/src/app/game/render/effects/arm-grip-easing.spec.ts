// @vitest-environment node
// The engulf grip (#768, #771, docs/visual-style/motion-and-legibility.md §5.1): it closes at the grab, opens when the
// engulf ends and slides to a new prey over `PSEUDOPOD_GRIP_EASE_MS` on the render clock, never in one frame. The lobes
// it moves are stepped frame by frame in `arm-easing-frames.spec.ts`.

import { describe, expect, it } from 'vitest';
import { entityId } from '@evolution/shared';
import { PSEUDOPOD_GRIP_EASE_MS } from '../constants';
import { wrapAngle } from '../geometry';
import { ArmGripEasing } from './arm-grip-easing';

const PREY_A = entityId('a');
const PREY_B = entityId('b');

describe('ArmGripEasing', () => {
  it('closes linearly from the grab, lets go from where it was, and hands nothing back once open', () => {
    const grip = new ArmGripEasing();
    expect(grip.letGo(0)).toBeNull();
    expect(grip.hold(PREY_A, 0.5, 0.3, 100).armGrip.share).toBe(0);
    expect(grip.hold(PREY_A, 0.6, 0.3, 100 + PSEUDOPOD_GRIP_EASE_MS / 4).armGrip.share).toBeCloseTo(0.25, 12);
    expect(grip.hold(PREY_A, 0.6, 0.3, 100 + PSEUDOPOD_GRIP_EASE_MS * 2).armGrip.share).toBe(1);
    const escaped = 100 + PSEUDOPOD_GRIP_EASE_MS * 3;
    expect(grip.letGo(escaped)).toEqual({ armHoldRadii: 0.3, armGrip: { angle: 0.6, share: 1 } });
    expect(grip.letGo(escaped + PSEUDOPOD_GRIP_EASE_MS / 2)?.armGrip.share).toBeCloseTo(0.5, 12);
    const regrabbed = escaped + PSEUDOPOD_GRIP_EASE_MS / 2;
    expect(grip.hold(PREY_A, 0.6, 0.3, regrabbed).armGrip.share).toBeCloseTo(0.5, 12);
    expect(grip.letGo(regrabbed)?.armGrip.share).toBeCloseTo(0.5, 12);
    expect(grip.letGo(regrabbed + PSEUDOPOD_GRIP_EASE_MS / 2)).toBeNull();
  });

  it('still turns the fan back from a prey the body had covered, with no arm on it (#771)', () => {
    const grip = new ArmGripEasing();
    grip.hold(PREY_A, 0.5, 0, 0);
    expect(grip.letGo(PSEUDOPOD_GRIP_EASE_MS)).toEqual({ armHoldRadii: 0, armGrip: { angle: 0.5, share: 1 } });
    expect(grip.letGo(2 * PSEUDOPOD_GRIP_EASE_MS)).toBeNull();
  });

  it('slides from the old prey to a new one over the ease, keeping its grip (#771)', () => {
    const grip = new ArmGripEasing();
    grip.hold(PREY_A, 0.5, 0.4, 0);
    const switched = 2 * PSEUDOPOD_GRIP_EASE_MS;
    expect(grip.hold(PREY_B, -1.5, 0.2, switched)).toEqual({ armHoldRadii: 0.4, armGrip: { angle: 0.5, share: 1 } });
    const halfway = grip.hold(PREY_B, -1.5, 0.2, switched + PSEUDOPOD_GRIP_EASE_MS / 2);
    expect(halfway.armGrip.angle).toBeCloseTo(-0.5, 12);
    expect(halfway.armHoldRadii).toBeCloseTo(0.3, 12);
    expect(grip.hold(PREY_B, -1.5, 0.2, switched + PSEUDOPOD_GRIP_EASE_MS)).toEqual({
      armHoldRadii: 0.2,
      armGrip: { angle: -1.5, share: 1 },
    });
  });

  it('keeps sliding the way it started when the new prey crosses the line opposite the old grip (#771)', () => {
    const grip = new ArmGripEasing();
    grip.hold(PREY_A, 0, 0.4, 0);
    const switched = 2 * PSEUDOPOD_GRIP_EASE_MS;
    grip.hold(PREY_B, Math.PI - 0.1, 0.4, switched);
    const crossed = -(Math.PI - 0.1);
    const halfway = grip.hold(PREY_B, crossed, 0.4, switched + PSEUDOPOD_GRIP_EASE_MS / 2).armGrip.angle;
    expect(halfway).toBeCloseTo((Math.PI + 0.1) / 2, 12);
    expect(wrapAngle(grip.hold(PREY_B, crossed, 0.4, switched + PSEUDOPOD_GRIP_EASE_MS).armGrip.angle)).toBe(crossed);
  });

  it('slides the short way round and only while it still grips', () => {
    const grip = new ArmGripEasing();
    grip.hold(PREY_A, 3, 0.4, 0);
    const switched = 2 * PSEUDOPOD_GRIP_EASE_MS;
    grip.hold(PREY_B, -3, 0.4, switched);
    const halfway = grip.hold(PREY_B, -3, 0.4, switched + PSEUDOPOD_GRIP_EASE_MS / 2).armGrip.angle;
    expect(Math.abs(wrapAngle(halfway - Math.PI))).toBeCloseTo(0, 9);
    const released = switched + 2 * PSEUDOPOD_GRIP_EASE_MS;
    expect(grip.letGo(released)).not.toBeNull();
    expect(grip.letGo(released + PSEUDOPOD_GRIP_EASE_MS)).toBeNull();
    expect(grip.hold(PREY_A, 1, 0.4, released + 2 * PSEUDOPOD_GRIP_EASE_MS).armGrip).toEqual({ angle: 1, share: 0 });
  });
});
