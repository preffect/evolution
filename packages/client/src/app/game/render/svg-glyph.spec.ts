// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { dotRingPath, dotsPath, polygonPath, radialStrokesPath } from './svg-glyph';

function moveCount(pathData: string): number {
  return pathData.split('M').length - 1;
}

describe('radialStrokesPath', () => {
  it('draws one stroke per count, the first from the inner radius at the phase to the outer radius', () => {
    const pathData = radialStrokesPath({
      cx: 50,
      cy: 50,
      count: 4,
      innerRadius: 10,
      outerRadius: 20,
      leanTurns: 0,
      phaseTurns: 0,
    });
    expect(moveCount(pathData)).toBe(4);
    expect(pathData.startsWith('M60.00 50.00 L70.00 50.00')).toBe(true);
  });

  it('leans the outer end by the lean in turns', () => {
    const pathData = radialStrokesPath({
      cx: 0,
      cy: 0,
      count: 1,
      innerRadius: 10,
      outerRadius: 10,
      leanTurns: 0.25,
      phaseTurns: 0,
    });
    expect(pathData).toBe('M10.00 0.00 L0.00 10.00');
  });
});

describe('dotRingPath', () => {
  it('draws one closed pair of arcs per dot, starting left of each dot centre', () => {
    const pathData = dotRingPath({ cx: 50, cy: 50, count: 16, ringRadius: 29, dotRadius: 1.5, phaseTurns: 0 });
    expect(moveCount(pathData)).toBe(16);
    expect(pathData.startsWith('M77.50 50.00 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0')).toBe(true);
  });
});

describe('dotsPath', () => {
  it('draws a dot at every listed centre', () => {
    expect(
      dotsPath(
        [
          [10, 20],
          [30, 40],
        ],
        2,
      ),
    ).toBe('M8.00 20.00 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M28.00 40.00 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0');
  });
});

describe('polygonPath', () => {
  it('draws one closed path through every corner, the first at the phase', () => {
    const pathData = polygonPath({ cx: 0, cy: 0, sides: 4, radius: 10, phaseTurns: 0 });
    expect(pathData.startsWith('M10.00 0.00 L0.00 10.00 L-10.00 0.00')).toBe(true);
    expect(pathData.endsWith(' Z')).toBe(true);
    expect(pathData.split(' L')).toHaveLength(4);
  });
});
