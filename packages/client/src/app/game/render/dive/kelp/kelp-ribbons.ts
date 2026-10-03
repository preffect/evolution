// The stranded kelp's ribbons (docs/rendering/opening-dive.md §4, ticket #802, the mockup's `spline`, `BLADES` and
// `STIPE`): Catmull-Rom curves through the control points, sampled every few millimetres with their arc length and
// unit tangent, and each sample's half width either side of the curve: a blade narrow at the bulb, tapering at the
// tip, its margins ruffled; the stipe swelling toward the bulb. Built once a page; the meshes are made from them.

import {
  KELP_BLADE,
  KELP_BLADE_POINTS,
  KELP_CATMULL_ROM_BASIS,
  KELP_CATMULL_ROM_SCALE,
  KELP_SPLINE,
  KELP_STIPE,
  KELP_STIPE_POINTS,
  KELP_TURN,
  type KelpPoint,
} from '../../constants/dive-kelp';
import { HALF, smoothstep } from '../../geometry';
import { valueNoise } from '../shore/shore-noise';

/** A point on a curve: where it is, how far along (metres), and its unit tangent. */
export interface CurveSample {
  readonly x: number;
  readonly y: number;
  readonly u: number;
  readonly tangentX: number;
  readonly tangentY: number;
}

/** A ribbon's sample: its half widths to the left (`+` normal, `(-ty, tx)`) and to the right of the curve. */
export interface RibbonSample extends CurveSample {
  readonly leftM: number;
  readonly rightM: number;
}

export interface Ribbon {
  readonly samples: readonly RibbonSample[];
  readonly lengthM: number;
}

/** Catmull-Rom's polynomial on one axis at `t` through `b` → `c` of `[a, b, c, d]`, `a` and `d` the neighbours. */
function catmullRom(controls: readonly number[], along: number): number {
  let power = 1;
  let sum = 0;
  for (const row of KELP_CATMULL_ROM_BASIS) {
    sum += power * row.reduce((total, weight, index) => total + weight * (controls[index] ?? 0), 0);
    power *= along;
  }
  return sum * KELP_CATMULL_ROM_SCALE;
}

/** The curve through `points` sampled about every `stepM` metres along each span (`spline`). */
export function catmullRomSamples(points: readonly KelpPoint[], stepM: number): CurveSample[] {
  const positions: { x: number; y: number; u: number }[] = [];
  const spanControls = KELP_CATMULL_ROM_BASIS[0] ?? [];
  let length = 0;
  let [previousX, previousY] = points[0] ?? [0, 0];
  const pointAt = (index: number): KelpPoint => points[Math.min(points.length - 1, Math.max(0, index))] ?? [0, 0];
  for (let span = 0; span < points.length - 1; span += 1) {
    // the span's start and end, with the points before and after it
    const controls = spanControls.map((_weight, offset) => pointAt(span - 1 + offset));
    const [start = [0, 0], end = [0, 0]] = controls.slice(1);
    const steps = Math.max(
      KELP_SPLINE.minSamplesPerSpan,
      Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / stepM),
    );
    for (let step = span === 0 ? 0 : 1; step <= steps; step += 1) {
      const along = step / steps;
      const x = catmullRom(
        controls.map((point) => point[0]),
        along,
      );
      const y = catmullRom(
        controls.map((point) => point[1]),
        along,
      );
      length += Math.hypot(x - previousX, y - previousY);
      previousX = x;
      previousY = y;
      positions.push({ x, y, u: length });
    }
  }
  return positions.map((position, index) => {
    const before = positions[Math.max(0, index - 1)] ?? position;
    const after = positions[Math.min(positions.length - 1, index + 1)] ?? position;
    const chord = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    return { ...position, tangentX: (after.x - before.x) / chord, tangentY: (after.y - before.y) / chord };
  });
}

/** One margin's ruffle at `u` along blade `blade`, `side` 0 on the left and 1 on the right. */
function ruffle(arcM: number, blade: number, side: number): number {
  let share = 1;
  for (const wave of KELP_BLADE.waves) {
    share += wave.amplitude * Math.sin((arcM / wave.periodM) * KELP_TURN + blade * wave.perBlade + side * wave.perSide);
  }
  const noise = KELP_BLADE.ruffleNoise;
  return (
    share +
    noise.amplitude *
      (valueNoise(arcM / noise.periodM, blade * noise.perBlade + side * noise.perSide, noise.salt) - HALF)
  );
}

/** Blade `blade`'s full width: blade 0's is `widthM`, the others a little wider each. */
export function bladeWidthM(blade: number): number {
  const other = KELP_BLADE.otherWidth;
  return blade === 0 ? KELP_BLADE.widthM : KELP_BLADE.widthM * (other.base + other.perBlade * blade);
}

function bladeOf(points: readonly KelpPoint[], blade: number): Ribbon {
  const curve = catmullRomSamples(points, KELP_SPLINE.bladeStepM);
  const lengthM = curve.at(-1)?.u ?? 0;
  const halfWidth = bladeWidthM(blade) * HALF;
  const taper = KELP_BLADE.taper;
  const samples = curve.map((sample): RibbonSample => {
    const narrowing =
      (taper.baseShare + (1 - taper.baseShare) * smoothstep(0, taper.growM, sample.u)) *
      (1 - taper.tipShare * smoothstep(lengthM - taper.tipM, lengthM, sample.u));
    return {
      ...sample,
      leftM: halfWidth * narrowing * ruffle(sample.u, blade, 0),
      rightM: halfWidth * narrowing * ruffle(sample.u, blade, 1),
    };
  });
  return { samples, lengthM };
}

let blades: readonly Ribbon[] | null = null;
let stipe: Ribbon | null = null;

/** The five blades (`BLADES`), made once a page; blade 0 runs through the focus. */
export function kelpBlades(): readonly Ribbon[] {
  blades ??= KELP_BLADE_POINTS.map((points, blade) => bladeOf(points, blade));
  return blades;
}

/** The stipe (`STIPE`), made once a page: thin in the water, swelling over its last metres to the bulb. */
export function kelpStipe(): Ribbon {
  if (stipe !== null) return stipe;
  const curve = catmullRomSamples(KELP_STIPE_POINTS, KELP_SPLINE.stipeStepM);
  const lengthM = curve.at(-1)?.u ?? 0;
  const samples = curve.map((sample): RibbonSample => {
    const halfWidth =
      KELP_STIPE.baseHalfWidthM + KELP_STIPE.swellM * smoothstep(lengthM - KELP_STIPE.swellOverM, lengthM, sample.u);
    return { ...sample, leftM: halfWidth, rightM: halfWidth };
  });
  stipe = { samples, lengthM };
  return stipe;
}

/** Blade 0's direction at the focus (`BLADE_ANG`): the close-ups' grain lies along it. */
export const KELP_BLADE_ANGLE = Math.atan2(KELP_BLADE.directionY, KELP_BLADE.directionX);
