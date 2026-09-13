// The endosymbiosis counters' pip blocks (docs/UI.md §3.1.2, docs/RENDERING.md §10; the unlock ring is an arc row).
// A pip block is one sprite per (variant, eaten): `required` pips in rows of `LADDER_PIP_ROW_MAX`, ⌀
// `LADDER_PIP_PX` with `LADDER_PIP_GAP_PX` between, laid along x (the orbit's clockwise tangent) and
// lit in that order, the row nearest the cell first. A sprite rotated to the tangent points its +y at
// the cell, so that row is the bottom of the bake. The tally per variant is the catalog's own
// `unlockedBy`, the number the record and the server's draft gate read. CSS px throughout.

import {
  CELL_STAGE,
  RADIANS_PER_FULL_TURN,
  STAGE_GATE_TRAITS,
  TRAIT_CATALOG,
  clamp,
  type BacteriumVariant,
  type TraitDefinition,
  type TraitId,
} from '@evolution/shared';
import { hexWithAlpha } from '../colour';
import {
  CALLOUT_BACKING,
  INDICATOR_VARIANT_RAMP,
  LADDER_PIP_GAP_PX,
  LADDER_PIP_LIT_ALPHA,
  LADDER_PIP_PX,
  LADDER_PIP_ROW_MAX,
  LADDER_PIP_STROKE_PX,
  LADDER_PIP_UNLIT_ALPHA,
  PIP_BAKE,
  WHITE,
  type IndicatorRamp,
} from '../constants';
import { pipBlockSizePx } from '../effects/orbit-layout';
import { DIAMETER_PER_RADIUS, HALF } from '../geometry';
import { LIGHT_DIRECTION_RADIANS } from '../light-direction';
import {
  createPxCanvas,
  fillDisc,
  fillHalo,
  paintGlint,
  strokeDisc,
  type BakeCanvasFactory,
  type BakeContext2D,
  type DiscSpec,
  type PxBakedSprite,
} from './texture-bake';

/** An endosymbiont the orbit counts toward: its variant, the tally it needs and its organelle colour. */
export interface EndosymbiontTally {
  readonly traitId: TraitId;
  readonly variant: BacteriumVariant;
  readonly required: number;
  readonly ramp: IndicatorRamp;
}

/** Every endosymbiont of the `endosymbiosis` gate with an `unlockedBy` and a ramp, in catalog order. */
export function endosymbiontTallies(): readonly EndosymbiontTally[] {
  const gate = STAGE_GATE_TRAITS[CELL_STAGE.endosymbiosis];
  const catalog: readonly TraitDefinition[] = TRAIT_CATALOG;
  const ramps: Partial<Record<BacteriumVariant, IndicatorRamp>> = INDICATOR_VARIANT_RAMP;
  return catalog.flatMap((trait): EndosymbiontTally[] => {
    const unlock = trait.unlockedBy;
    const ramp = unlock === undefined ? undefined : ramps[unlock.bacteriumVariant];
    if (!gate.includes(trait.id) || unlock === undefined || ramp === undefined) return [];
    return [{ traitId: trait.id, variant: unlock.bacteriumVariant, required: unlock.count, ramp }];
  });
}

/**
 * The atlas key of a pip block. `eaten` is clamped to `[0, required]` here too: the atlas has no entry
 * past either end, and a raw tally keeps climbing until the trait is picked (UI.md §3.1.4).
 */
export function pipBlockKey(variant: BacteriumVariant, eaten: number, required: number): string {
  return `${variant}:${clamp(Math.round(eaten), 0, required)}`;
}

/** Pip `index`'s centre, px from the block's top-left: columns along +x, rows up from the bottom edge (nearest the cell). */
export function pipCentrePx(index: number, required: number): { readonly x: number; readonly y: number } {
  const pitch = LADDER_PIP_PX + LADDER_PIP_GAP_PX;
  const column = index % LADDER_PIP_ROW_MAX;
  const row = Math.floor(index / LADDER_PIP_ROW_MAX);
  const radius = LADDER_PIP_PX * HALF;
  return { x: radius + column * pitch, y: pipBlockSizePx(required).height - radius - row * pitch };
}

function paintLitPip(context: BakeContext2D, pip: DiscSpec, ramp: IndicatorRamp): void {
  const shadow = { ...pip, x: pip.x + PIP_BAKE.shadowOffsetPx, y: pip.y + PIP_BAKE.shadowOffsetPx };
  fillDisc(context, shadow, { colour: CALLOUT_BACKING, alpha: PIP_BAKE.shadowAlpha });
  fillHalo(context, { ...pip, radius: pip.radius + PIP_BAKE.haloPx }, { colour: ramp.tone, alpha: PIP_BAKE.haloAlpha });
  const focus = pip.radius * PIP_BAKE.focusShare;
  const gradient = context.createRadialGradient(
    pip.x + Math.cos(LIGHT_DIRECTION_RADIANS) * focus,
    pip.y + Math.sin(LIGHT_DIRECTION_RADIANS) * focus,
    0,
    pip.x,
    pip.y,
    pip.radius,
  );
  gradient.addColorStop(0, hexWithAlpha(ramp.light, LADDER_PIP_LIT_ALPHA));
  gradient.addColorStop(HALF, hexWithAlpha(ramp.tone, LADDER_PIP_LIT_ALPHA));
  gradient.addColorStop(1, hexWithAlpha(ramp.dark, LADDER_PIP_LIT_ALPHA));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(pip.x, pip.y, pip.radius, 0, RADIANS_PER_FULL_TURN);
  context.fill();
  paintGlint(context, pip, { colour: WHITE, alpha: PIP_BAKE.glintAlpha });
}

function paintUnlitPip(context: BakeContext2D, pip: DiscSpec, ramp: IndicatorRamp): void {
  const inside = { ...pip, radius: pip.radius - LADDER_PIP_STROKE_PX * HALF };
  fillDisc(context, inside, { colour: ramp.tone, alpha: PIP_BAKE.unlitWashAlpha });
  strokeDisc(context, inside, { colour: ramp.tone, alpha: LADDER_PIP_UNLIT_ALPHA, width: LADDER_PIP_STROKE_PX });
}

/** One pip block with `eaten` of its `required` pips lit, centred on a canvas that holds the halos. */
export function bakePipBlock(
  factory: BakeCanvasFactory,
  scale: number,
  tally: EndosymbiontTally,
  eaten: number,
): PxBakedSprite {
  const block = pipBlockSizePx(tally.required);
  const margin = PIP_BAKE.haloPx * DIAMETER_PER_RADIUS;
  const sprite = createPxCanvas(factory, block.width + margin, block.height + margin, scale);
  const { context } = sprite.canvas;
  context.save();
  context.translate((sprite.widthPx - block.width) * HALF, (sprite.heightPx - block.height) * HALF);
  for (let index = 0; index < tally.required; index += 1) {
    const pip = { ...pipCentrePx(index, tally.required), radius: LADDER_PIP_PX * HALF };
    if (index < eaten) paintLitPip(context, pip, tally.ramp);
    else paintUnlitPip(context, pip, tally.ramp);
  }
  context.restore();
  return sprite;
}
