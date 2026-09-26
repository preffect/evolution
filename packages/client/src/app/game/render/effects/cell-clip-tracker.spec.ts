// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, MOTION_CLIP, entityId } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { CellClipTracker, cellsById, engulfClipInput } from './cell-clip-tracker';

const cell = createTestCellView({ id: entityId('c'), x: 0, y: 0 });
const absorption = DEFAULT_BALANCE.absorption;
/** `ENGULF_WRAP_SECONDS` 0.4 → 1.0 moves the room's seal from 0.5 to 2/3 (ticket #703). */
const longerWrap = { ...absorption, ['ENGULF_WRAP_SECONDS']: 1.0 };

describe('engulfClipInput', () => {
  it('reads the prey angle and progress off the views, rest when not engulfing or the prey is unknown', () => {
    const prey = createTestCellView({ id: entityId('prey'), x: 0, y: 10, engulfProgress: 0.5 });
    const predator = { ...cell, engulfingCellId: prey.id };
    expect(engulfClipInput(predator, cellsById([predator, prey]), absorption)).toEqual({
      preyAngle: Math.PI / 2,
      engulfClipPosition: 0.5,
    });
    const rest = { preyAngle: null, engulfClipPosition: null };
    expect(engulfClipInput(cell, cellsById([cell]), absorption)).toEqual(rest);
    expect(engulfClipInput(predator, cellsById([predator]), absorption)).toEqual(rest);
  });

  it('places the prey progress on the clip at the balance it is given, the seal on the clip seal', () => {
    const prey = createTestCellView({ id: entityId('prey'), x: 0, y: 10, engulfProgress: 2 / 3 });
    const predator = { ...cell, engulfingCellId: prey.id };
    expect(engulfClipInput(predator, cellsById([predator, prey]), longerWrap).engulfClipPosition).toBeCloseTo(0.5, 12);
  });
});

describe('CellClipTracker', () => {
  it('plays an aimed eat on its cell: the dimple at the mote, the pulse, then rest with no entry', () => {
    const tracker = new CellClipTracker();
    expect(tracker.start([{ cellId: cell.id, clipId: MOTION_CLIP.eat, angle: Math.PI / 2 }], 0)).toBe(1);
    const atPulse = tracker.deformations([cell], 160, absorption).get(cell.id)!;
    expect(atPulse.pulse).toBeCloseTo(1.09, 9);
    expect(atPulse.bumps[0]).toMatchObject({ amplitude: -0.12, centre: Math.PI / 2 });
    expect(atPulse.alpha).toBe(1);
    expect(tracker.deformations([cell], 300, absorption).has(cell.id)).toBe(false);
    expect(tracker.size).toBe(1);
  });

  it('refuses a second level-up mid-burst, fades a respawn in, and drops the state of a cell that left', () => {
    const tracker = new CellClipTracker();
    const other = createTestCellView({ id: entityId('o') });
    tracker.start(
      [
        { cellId: cell.id, clipId: MOTION_CLIP.levelUp, angle: null },
        { cellId: other.id, clipId: MOTION_CLIP.respawn, angle: null },
      ],
      0,
    );
    expect(tracker.start([{ cellId: cell.id, clipId: MOTION_CLIP.levelUp, angle: null }], 100)).toBe(0);
    const at100 = tracker.deformations([cell, other], 100, absorption);
    expect(at100.get(other.id)!.alpha).toBeGreaterThan(0);
    expect(at100.get(other.id)!.alpha).toBeLessThan(1);
    expect(at100.get(other.id)!.pulse).toBeLessThan(1);
    const at250 = tracker.deformations([cell, other], 250, absorption);
    expect(at250.get(cell.id)!.pulse).toBeCloseTo(1.14, 9);
    tracker.deformations([cell], 300, absorption);
    expect(tracker.size).toBe(1);
    tracker.clear();
    expect(tracker.size).toBe(0);
  });

  it('bends a predator toward its prey from engulfProgress with no clip playing', () => {
    const tracker = new CellClipTracker();
    const prey = createTestCellView({ id: entityId('prey'), x: 10, y: 0, engulfProgress: 0.5 });
    const predator = { ...cell, engulfingCellId: prey.id };
    const deformation = tracker.deformations([predator, prey], 0, absorption).get(predator.id)!;
    expect(deformation.bumps.map((bump) => bump.amplitude)).toEqual([0.62, 0.62, -0.1, 0]);
    expect(tracker.deformations([predator, prey], 0, absorption).has(prey.id)).toBe(false);
  });

  it('holds the arms at their peak until a patched seal, in step with the HUD', () => {
    const tracker = new CellClipTracker();
    const armAt = (engulfProgress: number): number => {
      const prey = createTestCellView({ id: entityId('prey'), x: 10, y: 0, engulfProgress });
      const predator = { ...cell, engulfingCellId: prey.id };
      return tracker.deformations([predator, prey], 0, longerWrap).get(predator.id)!.bumps[0]!.amplitude;
    };
    expect(armAt(2 / 3)).toBeCloseTo(0.62, 12);
    expect(armAt(0.6)).toBeLessThan(armAt(2 / 3));
  });
});
