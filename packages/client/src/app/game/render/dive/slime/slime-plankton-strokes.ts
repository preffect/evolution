// The plankton's moving strokes (docs/rendering/opening-dive.md §4, ticket #803): the larva's rowing limbs, setae and
// tail, the ciliate's beating cilia, pulsing vacuole and membranelles, the dinoflagellate's two flagella, worked out
// each frame on the clock exactly as the mockup's `nauplius`, `ciliate` and `dino` drew them, in the organism's own
// unit. Curves become a few straight pieces; `slime-strokes.ts` lays every piece as an antialiased quad on the GPU.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { CHANNEL_MAX, hexToRgb } from '../../colour';
import { CILIA } from '../../constants';
import { SLIME_STROKE_PIECES } from '../../constants/dive-slime';
import { SLIME_CILIATE, SLIME_DINO, SLIME_NAUPLIUS } from '../../constants/dive-slime-plankton';
import { HALF } from '../../geometry';
import { lerp } from '../shore/shore-noise';
import { lineWidth, type UnitScale } from './slime-glass';

/** A quadratic Bézier's middle term: `2 (1 − t) t`. */
const QUADRATIC_CROSS_WEIGHT = 2;

/** A colour, 0–1 channels and its alpha. */
export type StrokeColour = readonly [number, number, number, number];

/** One stroked polyline in the organism's unit: its flat points, width, colour, and round or butt ends. */
export interface PlanktonStroke {
  readonly points: readonly number[];
  readonly width: number;
  readonly colour: StrokeColour;
  readonly isRound: boolean;
}

/** A CSS `rgba(r,g,b,a)`, as the mockup writes it. */
export function strokeColourOf(rgba: string): StrokeColour {
  const [red = 0, green = 0, blue = 0, alpha = 1] = (rgba.match(/[\d.]+/g) ?? []).map(Number);
  return [red / CHANNEL_MAX, green / CHANNEL_MAX, blue / CHANNEL_MAX, alpha];
}

/** A hex colour at an alpha. */
export function hexStrokeColour(hex: string, alpha: number): StrokeColour {
  const [red, green, blue] = hexToRgb(hex);
  return [red, green, blue, alpha];
}

/** A quadratic curve from `from` through the control to `to`, in `SLIME_STROKE_PIECES.curve` straight pieces. */
export function quadraticPoints(from: readonly number[], control: readonly number[], end: readonly number[]): number[] {
  const points: number[] = [];
  const pieces = SLIME_STROKE_PIECES.curve;
  for (let piece = 0; piece <= pieces; piece += 1) {
    const done = piece / pieces;
    const [fromX = 0, fromY = 0] = from;
    const [controlX = 0, controlY = 0] = control;
    const [toX = 0, toY = 0] = end;
    const left = 1 - done;
    points.push(
      left * left * fromX + QUADRATIC_CROSS_WEIGHT * left * done * controlX + done * done * toX,
      left * left * fromY + QUADRATIC_CROSS_WEIGHT * left * done * controlY + done * done * toY,
    );
  }
  return points;
}

/** The larva's six rowing limbs, each with its setae once it is big enough. */
export function naupliusLimbStrokes(pen: UnitScale, timeSeconds: number): PlanktonStroke[] {
  const { limbs, beat, reach, limb, setae } = SLIME_NAUPLIUS;
  const strokes: PlanktonStroke[] = [];
  const limbColour = strokeColourOf(limb.colour);
  const setaColour = strokeColourOf(setae.colour);
  for (const side of [-1, 1]) {
    for (const [rootX = 0, length = 0, phase = 0] of limbs) {
      const swing = Math.sin(timeSeconds * beat.rate + phase) * beat.amount;
      const angle = side * (beat.spread + swing * beat.swing);
      const rootY = side * beat.rootY;
      const tipX = rootX + Math.cos(angle - side * beat.bend) * length * reach.along - length * reach.back;
      const tipY = rootY + Math.sin(angle) * length * reach.across;
      const control = [rootX + reach.controlX, rootY + side * length * reach.control];
      const points = quadraticPoints([rootX, rootY], control, [tipX, tipY]);
      strokes.push({ points, width: lineWidth(pen, limb.width), colour: limbColour, isRound: true });
      if (pen.unitPx <= setae.abovePx) continue;
      for (let seta = 0; seta < setae.count; seta += 1) {
        const along = setae.from + seta * setae.step;
        const x = lerp(rootX, tipX, along);
        const y = lerp(rootY, tipY, along);
        const end = [x - setae.back, y + side * (setae.out + seta * setae.outStep)];
        strokes.push({ points: [x, y, ...end], width: lineWidth(pen, setae.width), colour: setaColour, isRound: true });
      }
    }
  }
  return strokes;
}

/** The larva's forked tail, flicking. */
export function naupliusTailStrokes(pen: UnitScale, timeSeconds: number): PlanktonStroke[] {
  const { tail } = SLIME_NAUPLIUS;
  const colour = strokeColourOf(tail.colour);
  const flick = tail.tipY + Math.sin(timeSeconds * tail.wave.rate) * tail.wave.amount;
  return [-1, 1].map((side) => ({
    points: quadraticPoints(
      [tail.rootX, side * tail.rootY],
      [tail.controlX, side * tail.controlY],
      [tail.tipX, side * flick],
    ),
    width: lineWidth(pen, tail.width),
    colour,
    isRound: true,
  }));
}

/** The ciliate's cilia, beating in a travelling wave round its rim, once it is big enough. */
export function ciliaStrokes(pen: UnitScale, timeSeconds: number, darkField: number): PlanktonStroke[] {
  const { cilia, width } = SLIME_CILIATE;
  if (pen.unitPx <= cilia.abovePx) return [];
  const colour = hexStrokeColour(CILIA, cilia.base + cilia.darkField * darkField);
  const strokeWidth = lineWidth(pen, cilia.width);
  const strokes: PlanktonStroke[] = [];
  for (let cilium = 0; cilium < cilia.count; cilium += 1) {
    const turn = (cilium / cilia.count) * RADIANS_PER_FULL_TURN;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const lean = Math.sin(turn * cilia.waves - timeSeconds * cilia.rate) * cilia.lean;
    const x = cos * HALF;
    const y = sin * width * HALF;
    const normalX = cos / HALF;
    const normalY = sin / (width * HALF);
    const normal = Math.hypot(normalX, normalY);
    const outX = normalX / normal;
    const outY = normalY / normal;
    const end = [x + (outX - outY * lean) * cilia.length, y + (outY + outX * lean) * cilia.length];
    strokes.push({ points: [x, y, ...end], width: strokeWidth, colour, isRound: false });
  }
  return strokes;
}

/** The ciliate's contractile vacuole, pulsing, then the mouth's membranelles. */
export function ciliateMouthStrokes(pen: UnitScale, timeSeconds: number): PlanktonStroke[] {
  const { vacuole, membranelles, width, membranelleAlpha } = SLIME_CILIATE;
  const radius =
    vacuole.radius * (vacuole.pulse.base + vacuole.pulse.amount * Math.sin(timeSeconds * vacuole.pulse.rate));
  const ring: number[] = [];
  for (let piece = 0; piece <= SLIME_STROKE_PIECES.circle; piece += 1) {
    const turn = (piece / SLIME_STROKE_PIECES.circle) * RADIANS_PER_FULL_TURN;
    ring.push(vacuole.x + Math.cos(turn) * radius, width * vacuole.y + Math.sin(turn) * radius);
  }
  const strokes: PlanktonStroke[] = [
    { points: ring, width: lineWidth(pen, vacuole.width), colour: strokeColourOf(vacuole.colour), isRound: false },
  ];
  const colour = hexStrokeColour(CILIA, membranelleAlpha);
  const middle = (membranelles.count - 1) * HALF;
  for (let membranelle = 0; membranelle < membranelles.count; membranelle += 1) {
    const angle = Math.PI + (membranelle - middle) * membranelles.spread;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const wave = Math.sin(timeSeconds * membranelles.wave.rate + membranelle) * membranelles.wave.amount;
    const points = [
      cos * membranelles.from,
      sin * width * membranelles.from,
      cos * membranelles.to,
      sin * width * membranelles.toY + wave,
    ];
    strokes.push({ points, width: lineWidth(pen, membranelles.width), colour, isRound: false });
  }
  return strokes;
}

/** The dinoflagellate's trailing flagellum, once it is big enough. */
export function dinoTrailingStrokes(pen: UnitScale, timeSeconds: number): PlanktonStroke[] {
  const { trailing, trailingAlpha, trailingColour } = SLIME_DINO;
  if (pen.unitPx <= trailing.abovePx) return [];
  const points: number[] = [];
  for (let along = 0; along <= 1 + SLIME_STROKE_PIECES.stepSlack; along += trailing.step) {
    const wave = Math.sin(along * trailing.waves - timeSeconds * trailing.rate) * trailing.amount * along;
    points.push(trailing.fromX - along * trailing.length, wave);
  }
  const colour = hexStrokeColour(trailingColour, trailingAlpha);
  return [{ points, width: lineWidth(pen, trailing.width), colour, isRound: false }];
}

/** The flagellum lying in the dinoflagellate's girdle, once it is big enough. */
export function dinoGirdleStrokes(pen: UnitScale, timeSeconds: number): PlanktonStroke[] {
  const { girdleFlagellum: flagellum, girdleFlagellumWidth, girdleFlagellumAlpha, trailingColour } = SLIME_DINO;
  if (pen.unitPx <= flagellum.abovePx) return [];
  const points: number[] = [];
  for (let along = 0; along <= 1 + SLIME_STROKE_PIECES.stepSlack; along += flagellum.step) {
    const fromMiddle = along - HALF;
    const bow = flagellum.bow * (1 - flagellum.bowCurve * fromMiddle * fromMiddle);
    const wave = Math.sin(along * flagellum.waves - timeSeconds * flagellum.rate) * flagellum.amount;
    points.push(flagellum.x + bow + wave, fromMiddle * flagellum.length);
  }
  const colour = hexStrokeColour(trailingColour, girdleFlagellumAlpha);
  return [{ points, width: lineWidth(pen, girdleFlagellumWidth), colour, isRound: false }];
}
