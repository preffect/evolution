// The per-cell render state (docs/RENDERING.md §1–§3): the cosmetic fork's phase and strip row,
// the held heading and the organelle slots (append-only). One `update` per frame turns the
// interpolated `CellView` into the instance record the shader reads and the mapped organelle
// placements the sprite layer draws. Pure over its inputs and the frame's time; nothing here
// touches Pixi. The frame's deformation map (#207's clips) is merged here with the cell's contact
// dent and the seal it owes a ghost, and the engulf-warning ring is decided from the own cell.

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
import {
  CILIA_BEAT_HZ,
  CILIA_BEAT_IDLE_HZ,
  HEADING_HOLD_SPEED_RATIO,
  NOISE_STRIP_ROWS,
  NUCLEUS_DRIFT_HZ,
  NUCLEUS_DRIFT_RADII,
} from '../constants';
import { wrapUnit } from '../geometry';
import type { NoiseStrip } from '../noise/noise-strip';
import { REST_CLIP_INPUT, clipDeformation } from './cell-clips';
import type { CellDeformation } from './cell-deformation';
import { buildCellInstance, warningRingPxFor } from './cell-instance-builder';
import type { CellInstance } from './cell-instance';
import { cellLodFor, type CellLod } from './cell-lod';
import { summariseCellTraits, type CellTraitSummary } from './cell-traits';
import { NO_CONTACT_DENTS, withContactDent, type ContactDents } from './contact-dents';
import type { GhostSource, PredatorSeal } from './ghost-cells';
import { NUCLEUS_KINDS } from './organelle-kinds';
import { layoutOrganelles, type OrganelleSlot } from './organelle-layout';
import { laggedSlot, mapSlot, type MappedPoint } from './organelle-mapper';
import { buildShapeTerms, headingOf, type ShapeTerms } from './shape-terms';

/** What the frame hands every cell: time, zoom, the live balance, the own cell, the strip, the dents and the seals. */
export interface CellFrameContext {
  readonly timeSeconds: number;
  readonly zoom: number;
  readonly balance: Pick<BalanceConfig, 'growth' | 'absorption'>;
  readonly ownCell: CellView | null;
  readonly strip: NoiseStrip;
  readonly previewTraitId: TraitId | null;
  /** This frame's contact dents by cell id (contact-dents.ts). */
  readonly contactDents: ContactDents;
  /** The seal each predator owes the ghost it just absorbed (ghost-cells.ts). */
  readonly absorbedSeals: ReadonlyMap<EntityId, PredatorSeal>;
}

export const NO_ABSORBED_SEALS: ReadonlyMap<EntityId, PredatorSeal> = new Map();
/** The rest context's dents and seals, for a caller that has neither. */
export const NO_CELL_CONTACTS = { contactDents: NO_CONTACT_DENTS, absorbedSeals: NO_ABSORBED_SEALS } as const;

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

/**
 * The anchor the shader's nucleus ramp disc (#231) reads: the mapped nucleus sprite's centre as a
 * fraction of `r`, so the disc and the sprite always land on the same point; the origin when the
 * cell has no nucleus sprite (a far dot, or a stage without one).
 */
export function nucleusOffsetOf(
  organelles: readonly OrganellePlacement[],
  radius: number,
): { readonly x: number; readonly y: number } {
  const nucleus = organelles.find((placement) => NUCLEUS_KINDS.has(placement.kind));
  return nucleus === undefined ? ORIGIN : { x: nucleus.point.x / radius, y: nucleus.point.y / radius };
}

/** The trait key a layout is valid for: stage, owned tiers and the preview. */
function traitsKeyOf(view: CellView, previewTraitId: TraitId | null): string {
  const owned = view.traits.map((trait) => `${trait.traitId}:${trait.tier}`).join(',');
  return `${view.stage}|${owned}|${previewTraitId ?? ''}`;
}

export class CellRenderState {
  private readonly cosmetic: RandomSource;
  /** Cosmetic phase in turns, the strip row and the speckle seed, drawn once from the cell's fork, in this order. */
  private readonly phase: number;
  private readonly stripRow: number;
  private readonly speckleSeed: number;
  private heldHeading = 0;
  private slots: OrganelleSlot[] = [];
  private traitsKey = '';
  /** The cilia beat's phase in turns, integrated so the rate can change without a jump. */
  private ciliaPhase = 0;
  private lastTimeSeconds: number | null = null;
  /** The view this cell was last drawn with: the ghost's source when the cell is absorbed. */
  private drawnView: CellView | null = null;

  constructor(
    readonly id: EntityId,
    cosmetic: RandomSource,
  ) {
    this.cosmetic = cosmetic.fork(`${COSMETIC_SUB_STREAM.cell}:${id}`);
    this.phase = this.cosmetic.nextFloat();
    this.stripRow = this.cosmetic.nextInt(0, NOISE_STRIP_ROWS - 1);
    this.speckleSeed = this.cosmetic.nextFloat();
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

  get lastView(): CellView | null {
    return this.drawnView;
  }

  /** What a ghost of this cell is built from (ghost-cells.ts): the last drawn view, its slots and its speckle seed. */
  get ghostSource(): GhostSource | null {
    return this.drawnView === null ? null : { view: this.drawnView, slots: this.slots, speckleSeed: this.speckleSeed };
  }

  /** The beat runs at `CILIA_BEAT_HZ` while moving and `CILIA_BEAT_IDLE_HZ` at rest (VISUAL-STYLE §4). */
  private stepCiliaPhase(speedRatio: number, timeSeconds: number): number {
    const elapsed = this.lastTimeSeconds === null ? 0 : Math.max(0, timeSeconds - this.lastTimeSeconds);
    this.lastTimeSeconds = timeSeconds;
    this.ciliaPhase = wrapUnit(this.ciliaPhase + (speedRatio > 0 ? CILIA_BEAT_HZ : CILIA_BEAT_IDLE_HZ) * elapsed);
    return this.ciliaPhase;
  }

  /** The frame's deformation plus the seal owed to a ghost and the contact dent (docs/RENDERING.md §2.1). */
  private deformationFor(
    view: CellView,
    traits: CellTraitSummary,
    context: CellFrameContext,
    base: CellDeformation,
  ): CellDeformation {
    const seal = context.absorbedSeals.get(view.id);
    const sealed =
      seal === undefined
        ? base
        : {
            ...base,
            bumps: [
              ...base.bumps,
              ...clipDeformation({ ...REST_CLIP_INPUT, preyAngle: seal.angle, absorbedSeal: seal.seal }).bumps,
            ],
          };
    const isEngulfing = view.engulfingCellId !== null;
    return withContactDent(sealed, context.contactDents.get(view.id), { isTaut: traits.isTaut, isEngulfing });
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
  update(view: CellView, context: CellFrameContext, baseDeformation: CellDeformation): CellFrameOutput {
    this.drawnView = view;
    const traits = this.traitsFor(view, context.previewTraitId);
    const speedRatio = this.speedRatioOf(view, context);
    this.heldHeading = headingOf(view, speedRatio, this.heldHeading);
    const deformation = this.deformationFor(view, traits, context, baseDeformation);
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
    const instance = buildCellInstance({
      view,
      traits,
      terms,
      lod,
      speedRatio,
      nucleusOffset: nucleusOffsetOf(organelles, view.radius),
      isOwn: context.ownCell?.id === view.id,
      cosmetic: { stripRow: this.stripRow, phase: this.phase, speckleSeed: this.speckleSeed },
      alpha: deformation.alpha,
      warningRingPx: warningRingPxFor(view, context.ownCell, context.balance, lod),
      ciliaPhase: this.stepCiliaPhase(speedRatio, context.timeSeconds),
      rimDash: 0,
    });
    return { instance, terms, lod, organelles, traits };
  }
}
