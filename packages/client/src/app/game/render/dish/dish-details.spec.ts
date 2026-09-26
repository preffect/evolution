import { describe, expect, it } from 'vitest';
import { Graphics } from 'pixi.js';
import {
  DISH_DETAIL_BAND_HYSTERESIS,
  DISH_DETAIL_BAND_MIN_ZOOMS,
  DISH_DETAIL_MIN_STROKE_PX,
  MIRE_STRAND,
  STAGE_SCRATCH,
  STAGE_SCRATCHES,
  ZONE_GEL,
} from '../constants';
import type { DishDetailStroke } from '../textures/dish-field-details';
import { HALF } from '../geometry';
import { dishDetailAlpha, dishDetailBandFor, dishDetailWidthWu, drawDishDetails } from './dish-details';

const FAR_BAND = 0;
const NEAR_BAND = DISH_DETAIL_BAND_MIN_ZOOMS.length - 1;
/** The camera's zoom ends at 1080p (visual-style/motion-and-legibility.md §6): the view ceiling and the spawn floor. */
const FAR_ZOOM = 0.36;
const NEAR_ZOOM = 1.8;

const STRAND: DishDetailStroke = {
  start: { x: 100, y: 100 },
  control: { x: 130, y: 90 },
  end: { x: 160, y: 120 },
  widthWu: MIRE_STRAND.widthWuMin,
  colour: ZONE_GEL,
  alpha: 0.2,
};
const SCRATCH: DishDetailStroke = {
  start: { x: 3080, y: 0 },
  control: null,
  end: { x: 3080, y: 150 },
  widthWu: STAGE_SCRATCHES.widthWu,
  colour: STAGE_SCRATCH,
  alpha: 0.3,
};

describe('dishDetailBandFor', () => {
  it('picks each band from its lowest zoom up, and the far band under the first', () => {
    DISH_DETAIL_BAND_MIN_ZOOMS.forEach((minZoom, band) => expect(dishDetailBandFor(minZoom)).toBe(band));
    expect(dishDetailBandFor(DISH_DETAIL_BAND_MIN_ZOOMS[1] - 0.01)).toBe(FAR_BAND);
    expect(dishDetailBandFor(0.1)).toBe(FAR_BAND);
  });

  it('draws the camera zoom ends in the far and the near band, and zoom 1 in neither', () => {
    expect(dishDetailBandFor(FAR_ZOOM)).toBe(FAR_BAND);
    expect(dishDetailBandFor(NEAR_ZOOM)).toBe(NEAR_BAND);
    expect(dishDetailBandFor(1)).not.toBe(FAR_BAND);
    expect(dishDetailBandFor(1)).not.toBe(NEAR_BAND);
  });
});

describe('dishDetailBandFor with a current band (the edge dead zone)', () => {
  const edge = DISH_DETAIL_BAND_MIN_ZOOMS[NEAR_BAND]!;
  const deadZoneTop = edge * (1 + DISH_DETAIL_BAND_HYSTERESIS);

  it('enters a nearer band only past the dead zone above its edge', () => {
    expect(dishDetailBandFor(edge, NEAR_BAND - 1)).toBe(NEAR_BAND - 1);
    expect(dishDetailBandFor((edge + deadZoneTop) * HALF, NEAR_BAND - 1)).toBe(NEAR_BAND - 1);
    expect(dishDetailBandFor(deadZoneTop, NEAR_BAND - 1)).toBe(NEAR_BAND);
  });

  it('holds the current band down to its own edge and leaves it just under', () => {
    expect(dishDetailBandFor(edge, NEAR_BAND)).toBe(NEAR_BAND);
    expect(dishDetailBandFor(edge * 0.99, NEAR_BAND)).toBe(NEAR_BAND - 1);
  });

  it('draws with no current band from the edges themselves', () => {
    expect(dishDetailBandFor(edge)).toBe(NEAR_BAND);
    expect(dishDetailBandFor(edge, null)).toBe(NEAR_BAND);
  });
});

describe('dishDetailAlpha', () => {
  it('keeps a line ink per length (alpha × width) the same in every band', () => {
    const inks = DISH_DETAIL_BAND_MIN_ZOOMS.map((_, band) => {
      const widenedWu = dishDetailWidthWu(STRAND.widthWu, band);
      return dishDetailAlpha(STRAND, widenedWu) * widenedWu;
    });
    for (const ink of inks) expect(ink).toBeCloseTo(STRAND.alpha * STRAND.widthWu, 12);
  });

  it('leaves a line drawn at its own width at its own alpha', () => {
    expect(dishDetailAlpha(STRAND, STRAND.widthWu)).toBe(STRAND.alpha);
  });
});

describe('dishDetailWidthWu', () => {
  it('keeps every sheet width in the near band: at zoom 1.8 the lines are drawn at their true width', () => {
    expect(dishDetailWidthWu(MIRE_STRAND.widthWuMin, NEAR_BAND)).toBe(MIRE_STRAND.widthWuMin);
    expect(dishDetailWidthWu(STAGE_SCRATCHES.widthWu, NEAR_BAND) * NEAR_ZOOM).toBeGreaterThanOrEqual(
      DISH_DETAIL_MIN_STROKE_PX,
    );
  });

  it('never draws a line thinner than the px floor at its band lowest zoom, and keeps a wider line', () => {
    DISH_DETAIL_BAND_MIN_ZOOMS.forEach((minZoom, band) => {
      expect(dishDetailWidthWu(STAGE_SCRATCHES.widthWu, band) * minZoom).toBeGreaterThanOrEqual(
        DISH_DETAIL_MIN_STROKE_PX - 1e-9,
      );
    });
    const wide = 10;
    expect(dishDetailWidthWu(wide, FAR_BAND)).toBe(wide);
  });

  it('widens a thin line in the far band only as far as the one-px floor', () => {
    const farWidth = dishDetailWidthWu(STAGE_SCRATCHES.widthWu, FAR_BAND);
    expect(farWidth).toBeGreaterThan(STAGE_SCRATCHES.widthWu);
    expect(farWidth * DISH_DETAIL_BAND_MIN_ZOOMS[FAR_BAND]).toBeCloseTo(DISH_DETAIL_MIN_STROKE_PX, 9);
  });
});

describe('drawDishDetails', () => {
  it('strokes every detail at world scale over its own extent', () => {
    const graphics = new Graphics();
    drawDishDetails(graphics, [STRAND, SCRATCH], NEAR_BAND);
    const bounds = graphics.getLocalBounds();
    expect(bounds.minX).toBeLessThanOrEqual(STRAND.start.x);
    expect(bounds.maxX).toBeGreaterThanOrEqual(SCRATCH.start.x);
    expect(bounds.maxY).toBeGreaterThanOrEqual(SCRATCH.end.y);
  });

  it('replaces what it drew before, so a band change leaves one set of lines', () => {
    const graphics = new Graphics();
    drawDishDetails(graphics, [SCRATCH], NEAR_BAND);
    drawDishDetails(graphics, [STRAND], FAR_BAND);
    expect(graphics.getLocalBounds().maxX).toBeLessThan(SCRATCH.start.x);
  });

  it('strokes a widened line at the alpha that keeps its ink, and a true-width line at its own alpha', () => {
    const strokeAlpha = (band: number) => {
      const graphics = new Graphics();
      drawDishDetails(graphics, [STRAND], band);
      const [instruction] = graphics.context.instructions;
      return instruction?.action === 'stroke' ? instruction.data.style.alpha : Number.NaN;
    };
    expect(strokeAlpha(NEAR_BAND)).toBe(STRAND.alpha);
    expect(strokeAlpha(FAR_BAND)).toBeCloseTo(dishDetailAlpha(STRAND, dishDetailWidthWu(STRAND.widthWu, FAR_BAND)), 12);
    expect(strokeAlpha(FAR_BAND)).toBeLessThan(STRAND.alpha);
  });

  it('draws the far band wider than the near band', () => {
    const near = new Graphics();
    drawDishDetails(near, [SCRATCH], NEAR_BAND);
    const far = new Graphics();
    drawDishDetails(far, [SCRATCH], FAR_BAND);
    expect(far.getLocalBounds().width).toBeGreaterThan(near.getLocalBounds().width);
  });
});
