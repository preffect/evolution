// The per-cell render state (docs/RENDERING.md §1–§3): the cosmetic fork's phase and strip row,
// the held heading and the organelle slots (append-only). One `update` per frame turns the
// interpolated `CellView` into the instance record the shader reads and the mapped organelle
// placements the sprite layer draws. Pure over its inputs and the frame's time; nothing here
// touches Pixi. The clips (#207) and the deformation sources (#216) hand in the cell's
// `CellDeformation`.

import {
  COSMETIC_SUB_STREAM,
  RADIANS_PER_FULL_TURN,
  maxSpeedForMass,
  type BalanceConfig,
  type CellView,
  type EntityId,
  type RandomSource,
  type TraitId,
} from '@evolution/shared';
import { HEADING_HOLD_SPEED_RATIO, NOISE_STRIP_ROWS, NUCLEUS_DRIFT_HZ, NUCLEUS_DRIFT_RADII } from '../constants';
import type { NoiseStrip } from '../noise/noise-strip';
import type { CellDeformation } from './cell-deformation';
import { buildCellInstance } from './cell-instance-builder';
import type { CellInstance } from './cell-instance';
import { cellLodFor, type CellLod } from './cell-lod';
import { summariseCellTraits, type CellTraitSummary } from './cell-traits';
import { NUCLEUS_KINDS } from './organelle-kinds';
import { layoutOrganelles, type OrganelleSlot } from './organelle-layout';
import { laggedSlot, mapSlot, type MappedPoint } from './organelle-mapper';
import { buildShapeTerms, headingOf, type ShapeTerms } from './shape-terms';

/** What the frame hands every cell: time, zoom, the live balance, the own cell and the strip. */
export interface CellFrameContext {
  readonly timeSeconds: number;
  readonly zoom: number;
  readonly balance: Pick<BalanceConfig, 'growth'>;
  readonly ownCell: CellView | null;
  readonly strip: NoiseStrip;
  readonly previewTraitId: TraitId | null;
}

export interface OrganellePlacement {
  readonly kind: OrganelleSlot['kind'];
  readonly slot: OrganelleSlot;
  /** World offset from the cell centre (wu) and the local membrane radius there. */
  readonly point: MappedPoint;
}

export interface CellFrameOutput {
  readonly instance: CellInstance;
  readonly terms: ShapeTerms;
  readonly lod: CellLod;
  readonly organelles: readonly OrganellePlacement[];
  readonly traits: CellTraitSummary;
}

const ORIGIN = { x: 0, y: 0 } as const;

/** The trait key a layout is valid for: stage, owned tiers and the preview. */
function traitsKeyOf(view: CellView, previewTraitId: TraitId | null): string {
  const owned = view.traits.map((trait) => `${trait.traitId}:${trait.tier}`).join(',');
  return `${view.stage}|${owned}|${previewTraitId ?? ''}`;
}

export class CellRenderState {
  private readonly cosmetic: RandomSource;
  /** Cosmetic phase in turns and the strip row, drawn once from the cell's fork. */
  private readonly phase: number;
  private readonly stripRow: number;
  private heldHeading = 0;
  private slots: OrganelleSlot[] = [];
  private traitsKey = '';

  constructor(
    readonly id: EntityId,
    cosmetic: RandomSource,
  ) {
    this.cosmetic = cosmetic.fork(`${COSMETIC_SUB_STREAM.cell}:${id}`);
    this.phase = this.cosmetic.nextFloat();
    this.stripRow = this.cosmetic.nextInt(0, NOISE_STRIP_ROWS - 1);
  }

  private traitsFor(view: CellView, previewTraitId: TraitId | null): CellTraitSummary {
    const traits = summariseCellTraits(view, previewTraitId);
    const key = traitsKeyOf(view, previewTraitId);
    if (key !== this.traitsKey) {
      this.traitsKey = key;
      this.slots = layoutOrganelles(traits, this.cosmetic, this.slots);
    }
    return traits;
  }

  /** `‖velocity‖ / maxSpeed(mass)` clamped to 1, and 0 under the hold threshold so the heading holds. */
  private speedRatioOf(view: CellView, context: CellFrameContext): number {
    const ratio = Math.hypot(view.velocityX, view.velocityY) / maxSpeedForMass(view.mass, context.balance.growth);
    return ratio < HEADING_HOLD_SPEED_RATIO ? 0 : Math.min(1, ratio);
  }

  private placeOrganelles(terms: ShapeTerms, speedRatio: number, timeSeconds: number): OrganellePlacement[] {
    const driftAngle = (timeSeconds * NUCLEUS_DRIFT_HZ + this.phase) * RADIANS_PER_FULL_TURN;
    return this.slots.map((slot) => {
      const drift = NUCLEUS_KINDS.has(slot.kind) ? NUCLEUS_DRIFT_RADII : 0;
      const lagged = laggedSlot(slot.x, slot.y, {
        speedRatio,
        heading: terms.heading,
        driftX: Math.cos(driftAngle) * drift,
        driftY: Math.sin(driftAngle) * drift,
      });
      return { kind: slot.kind, slot, point: mapSlot(lagged.x, lagged.y, terms) };
    });
  }

  /** One frame: the view, interpolated, the frame context and this cell's deformation, to the instance and the placements. */
  update(view: CellView, context: CellFrameContext, deformation: CellDeformation): CellFrameOutput {
    const traits = this.traitsFor(view, context.previewTraitId);
    const speedRatio = this.speedRatioOf(view, context);
    this.heldHeading = headingOf(view, speedRatio, this.heldHeading);
    const terms = buildShapeTerms({
      view,
      traits,
      timeSeconds: context.timeSeconds,
      speedRatio,
      heading: this.heldHeading,
      phase: this.phase,
      stripRow: this.stripRow,
      strip: context.strip,
      deformation,
    });
    const lod = cellLodFor(view.radius * context.zoom);
    const organelles = lod.isFarDot ? [] : this.placeOrganelles(terms, speedRatio, context.timeSeconds);
    const nucleus = organelles.find((placement) => NUCLEUS_KINDS.has(placement.kind));
    const instance = buildCellInstance({
      view,
      traits,
      terms,
      lod,
      speedRatio,
      nucleusOffset:
        nucleus === undefined ? ORIGIN : { x: nucleus.point.x / view.radius, y: nucleus.point.y / view.radius },
      isOwn: context.ownCell?.id === view.id,
      cosmetic: { stripRow: this.stripRow, phase: this.phase },
      alpha: deformation.alpha,
    });
    return { instance, terms, lod, organelles, traits };
  }
}
