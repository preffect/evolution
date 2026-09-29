// @vitest-environment node
// The fan's aim and lean (#771, docs/visual-style/motion-and-legibility.md §5.1): the heading and the speed when nothing
// is held, the prey at the engulf lean at full grip, and the grip's share of the way between the two, the lobes'
// flank share moving evenly with it.

import { describe, expect, it } from 'vitest';
import { PSEUDOPOD_ENGULF_LEAN } from '../../constants';
import { REST_DEFORMATION } from '../cell-deformation';
import { flankShare } from './amoeba-pseudopods';
import { FanTurnMemory, pseudopodFan } from './pseudopod-fan';

const HEADING = 1;
const PREY_ANGLE = -2;
const SLOW = 0.1;

const gripped = (share: number, angle = PREY_ANGLE) => ({ ...REST_DEFORMATION, armGrip: { angle, share } });

describe('pseudopodFan', () => {
  it('points along the heading at the speed’s lean when nothing is held', () => {
    expect(pseudopodFan(HEADING, SLOW, REST_DEFORMATION)).toEqual({ aim: HEADING, lean: SLOW });
  });

  it('flanks the prey at the engulf lean at full grip, or when engulfing with no grip given', () => {
    const full = { aim: PREY_ANGLE, lean: PSEUDOPOD_ENGULF_LEAN, grip: { angle: PREY_ANGLE, share: 1 } };
    expect(pseudopodFan(HEADING, SLOW, gripped(1))).toEqual(full);
    expect(pseudopodFan(HEADING, SLOW, { ...REST_DEFORMATION, preyAngle: PREY_ANGLE })).toEqual(full);
  });

  it('keeps a faster lean than the engulf’s', () => {
    expect(pseudopodFan(HEADING, 1.4, gripped(1)).lean).toBe(1.4);
  });

  it('turns the short way round and moves the lobes to the flanks evenly with the grip', () => {
    const shortWay = -(Math.PI - 0.2);
    const fans = [0, 0.25, 0.5].map((share) => pseudopodFan(HEADING, SLOW, gripped(share, HEADING + Math.PI + 0.2)));
    expect(fans.map((fan) => fan.aim)).toEqual([
      expect.closeTo(HEADING, 12),
      expect.closeTo(HEADING + shortWay / 4, 12),
      expect.closeTo(HEADING + shortWay / 2, 12),
    ]);
    const from = flankShare(SLOW);
    expect(fans.map((fan) => flankShare(fan.lean))).toEqual(
      [0, 0.25, 0.5].map((share) => expect.closeTo(from + (1 - from) * share, 12)),
    );
  });
});

describe('FanTurnMemory (#771)', () => {
  const behind = HEADING + Math.PI;
  const turnOf = (memory: FanTurnMemory, heading: number, share: number) =>
    memory.apply(heading, gripped(share, behind)).armGrip?.turn;

  it('keeps the way round it started through an ease while the heading wobbles across the line behind the prey', () => {
    const memory = new FanTurnMemory();
    expect(turnOf(memory, HEADING + 0.01, 0)).toBeCloseTo(Math.PI - 0.01, 12);
    expect(turnOf(memory, HEADING - 0.01, 0.5)).toBeCloseTo(Math.PI + 0.01, 12);
    expect(turnOf(memory, HEADING + 0.01, 0.9)).toBeCloseTo(Math.PI - 0.01, 12);
  });

  it('takes the short way again once the fan is all the way on the prey or the heading', () => {
    const memory = new FanTurnMemory();
    turnOf(memory, HEADING + 0.01, 0.5);
    expect(turnOf(memory, HEADING - 0.01, 1)).toBeCloseTo(-(Math.PI - 0.01), 12);
    expect(turnOf(memory, HEADING + 0.01, 0)).toBeCloseTo(Math.PI - 0.01, 12);
  });

  it('passes a record with no grip through', () => {
    expect(new FanTurnMemory().apply(HEADING, REST_DEFORMATION)).toBe(REST_DEFORMATION);
  });

  it('turns the fan by the remembered way, the held arm swinging the same way (unwrapped)', () => {
    const fan = pseudopodFan(HEADING, SLOW, {
      ...gripped(0.5, behind),
      armGrip: { angle: behind, share: 0.5, turn: 4 },
    });
    expect(fan.aim).toBeCloseTo(HEADING + 2, 12);
    expect(fan.grip).toEqual({ angle: HEADING + 4, share: 0.5 });
  });
});
