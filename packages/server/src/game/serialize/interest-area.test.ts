import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, INTEREST_VIEW_ASPECT_RATIO, interestMarginFor } from '@evolution/shared';
import { interestAreaOf, isInInterestArea, viewAreaOf } from './interest-area.js';

const CAMERA = { x: 100, y: -50, viewHalfHeightWu: 500 };
const MARGIN_WU = interestMarginFor(DEFAULT_BALANCE);

describe('viewAreaOf', () => {
  it('spans the view at the widest covered aspect, grown by the margin on every side', () => {
    const halfWidth = CAMERA.viewHalfHeightWu * INTEREST_VIEW_ASPECT_RATIO + MARGIN_WU;
    const halfHeight = CAMERA.viewHalfHeightWu + MARGIN_WU;
    expect(viewAreaOf(CAMERA, MARGIN_WU)).toEqual({
      minX: CAMERA.x - halfWidth,
      minY: CAMERA.y - halfHeight,
      maxX: CAMERA.x + halfWidth,
      maxY: CAMERA.y + halfHeight,
    });
  });

  it('grows with the margin it is given', () => {
    expect(viewAreaOf(CAMERA, MARGIN_WU * 2).maxY - viewAreaOf(CAMERA, MARGIN_WU).maxY).toBe(MARGIN_WU);
  });
});

describe('interestAreaOf', () => {
  it('is the view of a single camera state', () => {
    expect(interestAreaOf([CAMERA], MARGIN_WU)).toEqual(viewAreaOf(CAMERA, MARGIN_WU));
  });

  it('covers every recent state: a pan and a zoom still settling', () => {
    // Far enough right that its narrow view still ends past the zoomed-out one.
    const panned = { x: 4000, y: 400, viewHalfHeightWu: 300 };
    const zoomedOut = { x: 100, y: -50, viewHalfHeightWu: 1500 };
    const area = interestAreaOf([zoomedOut, CAMERA, panned], MARGIN_WU);
    expect(area.minX).toBe(viewAreaOf(zoomedOut, MARGIN_WU).minX);
    expect(area.maxX).toBe(viewAreaOf(panned, MARGIN_WU).maxX);
    expect(area.minY).toBe(viewAreaOf(zoomedOut, MARGIN_WU).minY);
    expect(area.maxY).toBe(viewAreaOf(zoomedOut, MARGIN_WU).maxY);
  });
});

describe('isInInterestArea', () => {
  const area = viewAreaOf(CAMERA, MARGIN_WU);

  it('keeps a point inside and on the edge, and culls one just past it', () => {
    expect(isInInterestArea(area, CAMERA.x, CAMERA.y)).toBe(true);
    expect(isInInterestArea(area, area.maxX, area.minY)).toBe(true);
    expect(isInInterestArea(area, area.maxX + 1, CAMERA.y)).toBe(false);
    expect(isInInterestArea(area, CAMERA.x, area.minY - 1)).toBe(false);
  });

  it('keeps a point the canvas cannot show yet but the margin reaches', () => {
    const justOffTheTop = CAMERA.y - CAMERA.viewHalfHeightWu - MARGIN_WU / 2;
    expect(isInInterestArea(area, CAMERA.x, justOffTheTop)).toBe(true);
  });
});
