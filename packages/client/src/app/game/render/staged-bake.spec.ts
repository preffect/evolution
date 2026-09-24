import { describe, expect, it } from 'vitest';
import { StagedBake, baked } from './staged-bake';

function recording(count: number) {
  const ran: number[] = [];
  const bake = new StagedBake(
    Array.from({ length: count }, (_unused, index) => () => ran.push(index)),
    () => ({ ran: [...ran] }),
  );
  return { bake, ran };
}

describe('StagedBake', () => {
  it('runs one step per call, in order, and nothing once done', () => {
    const { bake, ran } = recording(3);
    expect(bake.stepCount).toBe(3);
    bake.runNext();
    expect(ran).toEqual([0]);
    expect(bake.isDone).toBe(false);
    bake.runNext();
    bake.runNext();
    bake.runNext();
    expect(ran).toEqual([0, 1, 2]);
    expect(bake.isDone).toBe(true);
  });

  it('refuses to assemble before its last step, and assembles once', () => {
    const { bake } = recording(2);
    bake.runNext();
    expect(() => bake.result()).toThrow(/1 of 2 steps/);
    const whole = bake.runAll();
    expect(whole).toEqual({ ran: [0, 1] });
    expect(bake.result()).toBe(whole);
  });

  it('finishes a partly run bake with the steps left, never re-running one', () => {
    const { bake, ran } = recording(4);
    bake.runNext();
    bake.runAll();
    expect(ran).toEqual([0, 1, 2, 3]);
  });
});

describe('baked', () => {
  it('passes a made value through and names a missing one', () => {
    expect(baked(0, 'zero')).toBe(0);
    expect(() => baked(undefined, 'vignette')).toThrow(/vignette/);
  });
});
