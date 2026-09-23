// @vitest-environment node
// docs/ui/hud.md §3.1.5's layout inequalities: the notice stack, the orbit and the labels, at §3.1.3's sizes and at
// `CELL_MAX_MASS` on the smallest viewport and the reference one, plus #324's caveat scene.

import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  radiusForMass,
  viewHalfHeightFor,
  type BacteriumVariant,
} from '@evolution/shared';
import { NOTICE_STACK_MAX_Y_PX } from '../../hud/hud-constants';
import { ladderFor, type Ladder } from '../../state/own-cell-ladder';
import {
  CUE_GAP_PX,
  CUE_PILL_HEIGHT_PX,
  CUE_ROW_GAP_PX,
  ENGULF_WARNING_RING_RADII,
  LABEL_PILL_HEIGHT_PX,
  RATE_TAG_ROWS_MAX,
  RELATION_RING_MIN_GAP_PX,
  RELATION_RING_RADII,
} from '../constants';
import { HALF, boxesIntersect, type UprightBox } from '../geometry';
import {
  cueColumnBox,
  cueLayout,
  floaterColumnSpan,
  floaterLeftPx,
  rateTagColumnTopPx,
  type CueLayout,
} from './cue-layout';
import { orientedBoxGapPx, type OrientedBox } from './oriented-box';
import { ghostBoxOf, orbitLayout, pipBlockBoxOf } from './orbit-layout';
import { escapeLabelAbovePx, ladderOrbitExtentPx, selfRingRadiusPx } from './own-cell-geometry';
import { threatLabelPlacement } from './threat-label-placement';

/** §3.1.3's own-cell sizes under Z1. */
const GEOMETRY_SIZES_PX = [24, 32, 47.4, 64, 94.8, 128] as const;
const CHIP_WIDTH_PX = 96;
const TAG_WIDTH_PX = 150;
const ZONE_PILL_WIDTH_PX = 240;
/** `SPRINT TO ESCAPE`'s label pill (#512). */
const ESCAPE_LABEL_WIDTH_PX = 140;
/** The caveat scene (#324): a `EDIBLE · TOXIC` pill, and a bigger cell whose `… CAN ENGULF YOU` pill is wider. */
const CAVEAT_PREY_LABEL_WIDTH_PX = 120;
const CAVEAT_THREAT_LABEL_WIDTH_PX = 200;
const CAVEAT_THREAT_MASS = 600;
const CAVEAT_THREAT_CENTRE_PX = { x: 260, y: 230 } as const;
const ALL_EATEN: Record<BacteriumVariant, number> = { plain: 0, aerobic: 3, photosynthetic: 3 };
/** The prokaryote's two counters, and the envelope ghost beside an unclaimed counter (#285 B). */
const LADDERS: readonly Ladder[] = [
  ladderFor(CELL_STAGE.prokaryote, [], ALL_EATEN, null),
  ladderFor(CELL_STAGE.endosymbiosis, [{ traitId: 'mitochondrion', tier: 1 }], ALL_EATEN, null),
];

function layoutAt(rPx: number, labelBoxes: readonly UprightBox[] = []): CueLayout {
  return cueLayout({
    rPx,
    chipWidthPx: CHIP_WIDTH_PX,
    tagWidthsPx: Array.from({ length: RATE_TAG_ROWS_MAX }, () => TAG_WIDTH_PX),
    zonePillWidthPx: ZONE_PILL_WIDTH_PX,
    labelBoxes,
  });
}

function asOriented(box: UprightBox): OrientedBox {
  return { x: box.x, y: box.y, rotation: 0, halfLength: box.halfWidth, halfHeight: box.halfHeight };
}

function orbitBoxes(ladder: Ladder, rPx: number): OrientedBox[] {
  const layout = orbitLayout(ladder, rPx);
  return [...layout.ghosts.map(ghostBoxOf), ...layout.pipBlocks.map(pipBlockBoxOf)];
}

/** The own cell's on-screen radius at `mass` on a viewport `heightPx` tall, through the Z1 camera. */
function onScreenRadiusPx(mass: number, heightPx: number): number {
  const radius = radiusForMass(mass, DEFAULT_BALANCE.growth);
  return radius * ((heightPx * HALF) / viewHalfHeightFor(radius));
}

function cueBoxes(layout: CueLayout): UprightBox[] {
  return [layout.chip, ...layout.tags, ...(layout.zonePill === null ? [] : [layout.zonePill])];
}

describe('cueLayout: the notice stack', () => {
  it.each([
    { width: 1024, height: 640, screenTop: 105 },
    { width: 1280, height: 800, screenTop: 164 },
  ])('keeps a full rate-tag column under the notices at CELL_MAX_MASS on $width × $height', ({ height, screenTop }) => {
    const rPx = onScreenRadiusPx(DEFAULT_BALANCE.growth.CELL_MAX_MASS, height);
    const top = height * HALF - rateTagColumnTopPx(rPx, RATE_TAG_ROWS_MAX);
    expect(top).toBeGreaterThanOrEqual(NOTICE_STACK_MAX_Y_PX);
    expect(Math.round(top)).toBe(screenTop);
    const layout = layoutAt(rPx);
    expect(layout.tags.at(-1)!.y - CUE_PILL_HEIGHT_PX * HALF).toBeCloseTo(-rateTagColumnTopPx(rPx, RATE_TAG_ROWS_MAX));
  });
});

describe.each(GEOMETRY_SIZES_PX)('cueLayout at r_px %s', (rPx) => {
  const layout = layoutAt(rPx);

  it('stacks the chip on the self ring and the tags upward from it, CUE_GAP_PX and CUE_ROW_GAP_PX apart', () => {
    expect(layout.chip.y + layout.chip.halfHeight).toBeCloseTo(-(selfRingRadiusPx(rPx) + CUE_GAP_PX));
    const bottoms = layout.tags.map((tag) => tag.y + tag.halfHeight);
    const tops = [layout.chip, ...layout.tags].map((box) => box.y - box.halfHeight);
    bottoms.forEach((bottom, row) => expect(tops[row]! - bottom).toBeCloseTo(CUE_ROW_GAP_PX));
  });

  it('puts the zone pill CUE_GAP_PX under the orbit extent', () => {
    const pill = layout.zonePill!;
    expect(pill.y - LABEL_PILL_HEIGHT_PX * HALF).toBeCloseTo(ladderOrbitExtentPx(rPx) + CUE_GAP_PX);
  });

  it.each(LADDERS.map((ladder, index) => ({ ladder, index })))(
    'lets no cue box meet an orbit box (ladder $index)',
    ({ ladder }) => {
      for (const orbit of orbitBoxes(ladder, rPx)) {
        for (const cue of cueBoxes(layout)) expect(orientedBoxGapPx(asOriented(cue), orbit)).toBeGreaterThan(0);
      }
    },
  );

  it.each(LADDERS.map((ladder, index) => ({ ladder, index })))(
    'starts a floater column above the 3 o’clock line, clear of the orbit (ladder $index)',
    ({ ladder }) => {
      const span = floaterColumnSpan();
      expect(span.bottom).toBeLessThan(0);
      const left = floaterLeftPx(rPx, [layout.chip, ...layout.tags]);
      const floater: UprightBox = {
        x: left + CUE_PILL_HEIGHT_PX * HALF,
        y: (span.top + span.bottom) * HALF,
        halfWidth: CUE_PILL_HEIGHT_PX * HALF,
        halfHeight: (span.bottom - span.top) * HALF,
      };
      for (const orbit of orbitBoxes(ladder, rPx)) {
        expect(orientedBoxGapPx(asOriented(floater), orbit)).toBeGreaterThan(0);
      }
    },
  );
});

describe.each(GEOMETRY_SIZES_PX)('cueLayout: the chip yields to a label at r_px %s (#512)', (rPx) => {
  const escapeLabel: UprightBox = {
    x: 0,
    y: -escapeLabelAbovePx(rPx),
    halfWidth: ESCAPE_LABEL_WIDTH_PX * HALF,
    halfHeight: LABEL_PILL_HEIGHT_PX * HALF,
  };
  const unmoved = layoutAt(rPx);

  it('raises the chip CUE_GAP_PX above the escape label it would meet, the tags stacked on it', () => {
    expect(boxesIntersect(escapeLabel, unmoved.chip)).toBe(true);
    const layout = layoutAt(rPx, [escapeLabel]);
    expect(layout.chip.y + layout.chip.halfHeight).toBeCloseTo(escapeLabel.y - escapeLabel.halfHeight - CUE_GAP_PX);
    for (const cue of cueBoxes(layout)) expect(boxesIntersect(escapeLabel, cue)).toBe(false);
    expect(layout.chip.y - layout.chip.halfHeight - (layout.tags[0]!.y + layout.tags[0]!.halfHeight)).toBeCloseTo(
      CUE_ROW_GAP_PX,
    );
  });

  it('keeps the chip on the self ring when the label box does not meet it', () => {
    const aside: UprightBox = { ...escapeLabel, x: unmoved.chip.halfWidth + escapeLabel.halfWidth + CUE_GAP_PX };
    expect(layoutAt(rPx, [aside]).chip).toEqual(unmoved.chip);
  });
});

describe('cueLayout: labels come first', () => {
  const rPx = 47.4;

  it('hides the zone pill while a label box meets it, and shows it again when none does', () => {
    const pill = layoutAt(rPx).zonePill!;
    const covering: UprightBox = { ...pill, x: pill.x + 20, halfWidth: 30 };
    expect(layoutAt(rPx, [covering]).zonePill).toBeNull();
    expect(layoutAt(rPx, [{ ...covering, y: -300 }]).zonePill).not.toBeNull();
  });

  it('pushes a new floater past a label box in its column, and past the tags', () => {
    const layout = layoutAt(rPx);
    const label: UprightBox = { x: 90, y: -20, halfWidth: 40, halfHeight: LABEL_PILL_HEIGHT_PX * HALF };
    const left = floaterLeftPx(rPx, [layout.chip, ...layout.tags, label]);
    expect(left).toBeCloseTo(label.x + label.halfWidth + CUE_GAP_PX);
    expect(floaterLeftPx(rPx, [layout.chip, ...layout.tags])).toBeGreaterThanOrEqual(
      layout.tags[0]!.x + layout.tags[0]!.halfWidth + CUE_GAP_PX,
    );
  });

  it("pins #324's caveat scene: mass 312 on 1280 × 800, a toxic cell touching at 135°, a threat lower right", () => {
    const own = onScreenRadiusPx(312, 800);
    expect(own).toBeCloseTo(47.4, 1);
    const zoom = own / radiusForMass(312, DEFAULT_BALANCE.growth);
    const labelBox = (centre: { x: number; y: number }, ringPx: number, widthPx: number): UprightBox => {
      const placed = threatLabelPlacement({
        threatCentre: centre,
        warningRingPx: ringPx,
        ownCentre: { x: 0, y: 0 },
        ownRadiusPx: own,
        pillWidthPx: widthPx,
      });
      return { x: placed.x, y: placed.y, halfWidth: widthPx * HALF, halfHeight: LABEL_PILL_HEIGHT_PX * HALF };
    };
    // Toxin Vacuole I prey at mass 96, touching at 135° (lower right); its `EDIBLE · TOXIC` pill flips outward.
    const preyPx = radiusForMass(96, DEFAULT_BALANCE.growth) * zoom;
    const touching = own + preyPx;
    const prey = { x: Math.SQRT1_2 * touching, y: Math.SQRT1_2 * touching };
    const preyRingPx = Math.max(RELATION_RING_RADII * preyPx, preyPx + RELATION_RING_MIN_GAP_PX);
    const preyLabel = labelBox(prey, preyRingPx, CAVEAT_PREY_LABEL_WIDTH_PX);
    // A bigger threat further out to the lower right, its label facing the own cell.
    const threatPx = radiusForMass(CAVEAT_THREAT_MASS, DEFAULT_BALANCE.growth) * zoom;
    const threatLabel = labelBox(
      CAVEAT_THREAT_CENTRE_PX,
      ENGULF_WARNING_RING_RADII * threatPx,
      CAVEAT_THREAT_LABEL_WIDTH_PX,
    );
    const layout = layoutAt(own, [preyLabel, threatLabel]);
    expect(preyLabel.y).toBeGreaterThan(ladderOrbitExtentPx(own));
    expect(layout.zonePill).toBeNull();
    for (const label of [preyLabel, threatLabel]) {
      for (const cue of cueBoxes(layout)) expect(boxesIntersect(label, cue)).toBe(false);
    }
  });
});

describe('cueColumnBox', () => {
  it('bounds the chip and every tag, the widest setting the width', () => {
    const chip = { x: 0, y: -40, halfWidth: 50, halfHeight: 9 };
    const tags = [{ x: 0, y: -64, halfWidth: 70, halfHeight: 9 }];
    expect(cueColumnBox({ chip, tags })).toEqual({ x: 0, y: -52, halfWidth: 70, halfHeight: 21 });
    expect(cueColumnBox({ chip, tags: [] })).toEqual(chip);
  });
});
