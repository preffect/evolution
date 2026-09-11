// The DNA fragment sprite (docs/VISUAL-STYLE.md §2, sheet 02): two strands crossing as sines, the
// tag-coloured rungs between them, the strand halo and the tag's wide halo. One bake per tag, so a
// fragment is one sprite.

import type { DnaTag } from '@evolution/shared';
import {
  DNA_FRAGMENT_HALO,
  DNA_FRAGMENT_RUNGS,
  DNA_FRAGMENT_RUNG_PX,
  DNA_FRAGMENT_SIZE_WU,
  DNA_STRAND,
  DNA_STRAND_LIGHT,
  DNA_TAG_COLOR,
  MOTE_ATLAS_PX_PER_WU,
} from '../constants';
import { hexWithAlpha } from '../colour';
import { fillHalo, type BakeCanvas, type BakeCanvasFactory, type BakeContext2D } from './texture-bake';

const HALF = 0.5;
const SIDE_LENGTH = 2;
const HELIX_TURNS = 2;
const HELIX_STRAND_PX = 2;
const STRAND_ALPHA = 0.95;
const RUNG_ALPHA = 0.85;

interface HelixFrame {
  readonly centre: number;
  readonly left: number;
  readonly length: number;
  readonly height: number;
  readonly pxScale: number;
}

function paintRungs(context: BakeContext2D, frame: HelixFrame, colour: string): void {
  context.lineCap = 'round';
  context.strokeStyle = colour;
  context.globalAlpha = RUNG_ALPHA;
  context.lineWidth = DNA_FRAGMENT_RUNG_PX * frame.pxScale + 1;
  for (let rung = 0; rung < DNA_FRAGMENT_RUNGS; rung += 1) {
    const share = (rung + HALF) / DNA_FRAGMENT_RUNGS;
    const x = frame.left + share * frame.length;
    const rise = Math.sin(share * Math.PI * HELIX_TURNS) * frame.height * HALF;
    context.beginPath();
    context.moveTo(x, frame.centre - rise);
    context.lineTo(x, frame.centre + rise);
    context.stroke();
  }
}

function paintStrand(context: BakeContext2D, frame: HelixFrame, colour: string, phase: number): void {
  context.strokeStyle = colour;
  context.globalAlpha = STRAND_ALPHA;
  context.lineWidth = HELIX_STRAND_PX * frame.pxScale + 1;
  context.beginPath();
  for (let step = 0; step <= frame.length; step += 1) {
    const share = step / frame.length;
    const y = frame.centre + Math.sin(share * Math.PI * HELIX_TURNS + phase) * frame.height * HALF;
    if (step === 0) context.moveTo(frame.left, y);
    else context.lineTo(frame.left + step, y);
  }
  context.stroke();
}

export function bakeFragmentSprite(factory: BakeCanvasFactory, tag: DnaTag, pxPerWu: number): BakeCanvas {
  const length = DNA_FRAGMENT_SIZE_WU.length * pxPerWu;
  const height = DNA_FRAGMENT_SIZE_WU.height * pxPerWu;
  const halo = DNA_FRAGMENT_HALO.radius * pxPerWu;
  const size = Math.ceil(Math.max(length, halo * SIDE_LENGTH) + halo);
  const canvas = factory.create(size, size);
  const { context } = canvas;
  const centre = size * HALF;
  const tagColour = DNA_TAG_COLOR[tag];
  fillHalo(context, { x: centre, y: centre, radius: halo }, { colour: tagColour, alpha: DNA_FRAGMENT_HALO.alpha });
  fillHalo(
    context,
    { x: centre, y: centre, radius: DNA_FRAGMENT_HALO.innerRadius * pxPerWu },
    { colour: DNA_STRAND, alpha: DNA_FRAGMENT_HALO.innerAlpha },
  );
  const frame: HelixFrame = {
    centre,
    left: centre - length * HALF,
    length,
    height,
    pxScale: pxPerWu / MOTE_ATLAS_PX_PER_WU,
  };
  paintRungs(context, frame, hexWithAlpha(tagColour, 1));
  paintStrand(context, frame, DNA_STRAND_LIGHT, 0);
  paintStrand(context, frame, DNA_STRAND, Math.PI);
  context.globalAlpha = 1;
  return canvas;
}
