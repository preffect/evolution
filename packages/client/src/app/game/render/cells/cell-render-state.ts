// The per-cell render state (docs/RENDERING.md §1–§3): the cosmetic fork's phases and the strip
// row, the held heading, the organelle slots (append-only) and the clips this cell plays. One
// `update` per frame turns the interpolated `CellView` into the instance record the shader reads
// and the mapped organelle placements the sprite layer draws. Pure over its inputs and the
// injected time; nothing here touches Pixi.

import {
  RADIANS_PER_FULL_TURN,
  RANDOM_STREAM,
  canEngulf,
  maxSpeedForMass,
  type BalanceConfig,
  type CellView,
  type EntityId,
  type RandomSource,
  type TraitId,
} from '@evolution/shared';
import {
  ENGULF_WARNING_RING_MIN_PX,
  ENGULF_WARNING_RING_RADII,
  HEADING_HOLD_SPEED_RATIO,
  NOISE_STRIP_ROWS,
  NUCLEUS_DRIFT_HZ,
  NUCLEUS_DRIFT_RADII,
} from '../constants';
import { MotionClipPlayer } from '../effects/motion-clip-player';
import { buildCellInstance } from './cell-instance-builder';
import type { NoiseStrip } from '../noise/noise-strip';
import { cellLodFor, type CellLod } from './cell-lod';
import type { CellInstance } from './cell-instance';
import { summariseCellTraits, type CellTraitSummary } from './cell-traits';
import { clipShapeValues, type ClipAngles } from './cell-clips';
import { laggedSlot, mapSlot, type MappedPoint } from './organelle-mapper';
import { NUCLEUS_KINDS } from './organelle-kinds';
import type { OrganelleKind } from './organelle-kinds';
import { layoutOrganelles, type OrganelleSlot } from './organelle-layout';
import type { ShapeBump } from './radial-profile';
import { buildShapeTerms, headingOf, type ShapeTerms } from './shape-terms';

/** What the frame hands every cell: time, zoom, the live balance and the own cell for the warning ring. */
export interface CellFrameContext {
  readonly timeSeconds: number;
  readonly nowMs: number;
  readonly zoom: number;
  readonly balance: Pick<BalanceConfig, 'growth' | 'absorption'>;
  readonly ownCell: CellView | null;
  readonly strip: NoiseStrip;
  readonly previewTraitId: TraitId | null;
  readonly contactDent: ShapeBump | null;
  /** The predator's seal from a ghost's `absorbed` clip, keyed by predator id (§2.3). */
  readonly absorbedSealByPredator: ReadonlyMap<EntityId, number>;
  /** Each engulfing predator's prey progress, keyed by predator id: the engulf clip's domain. */
  readonly preyProgressByPredator: ReadonlyMap<EntityId, number>;
}

export interface OrganellePlacement {
  readonly kind: OrganelleKind;
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

export class CellRenderState {
  readonly clips = new MotionClipPlayer();
  readonly angles: ClipAngles = { moteAngle: null, preyAngle: null };
  private readonly cosmetic: RandomSource;
  private readonly phase: number;
  private readonly stripRow: number;
  private heldHeading = 0;
  private slots: OrganelleSlot[] = [];
  private traitsKey = '';
  private lastViewValue: CellView | null = null;

  constructor(
    readonly id: EntityId,
    roundRandom: RandomSource,
  ) {
    this.cosmetic = roundRandom.fork(`${RANDOM_STREAM.cosmetic}:${id}`);
    this.phase = this.cosmetic.nextFloat();
    this.stripRow = this.cosmetic.nextInt(0, NOISE_STRIP_ROWS - 1);
  }

  get lastView(): CellView | null {
    return this.lastViewValue;
  }

  private traitsFor(view: CellView, previewTraitId: TraitId | null): CellTraitSummary {
    const traits = summariseCellTraits(view, previewTraitId);
    const key = `${view.stage}|${view.traits.map((owned) => `${owned.traitId}:${owned.tier}`).join(',')}|${previewTraitId ?? ''}`;
    if (key !== this.traitsKey) {
      this.traitsKey = key;
      this.slots = layoutOrganelles(traits, this.cosmetic, this.slots);
    }
    return traits;
  }

  private speedRatioOf(view: CellView, context: CellFrameContext): number {
    const speed = Math.hypot(view.velocityX, view.velocityY);
    const ratio = speed / maxSpeedForMass(view.mass, context.balance.growth);
    return ratio < HEADING_HOLD_SPEED_RATIO ? 0 : Math.min(1, ratio);
  }

  private warningRingPx(view: CellView, context: CellFrameContext): number {
    const own = context.ownCell;
    if (own === null || own.id === view.id || !canEngulf(view, own, context.balance.absorption)) return 0;
    return Math.max(ENGULF_WARNING_RING_RADII * view.radius * context.zoom, ENGULF_WARNING_RING_MIN_PX);
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

  private termsFor(view: CellView, context: CellFrameContext, traits: CellTraitSummary, speedRatio: number) {
    const clips = clipShapeValues(this.clips, view, context, context.preyProgressByPredator.get(view.id) ?? null);
    const terms = buildShapeTerms({
      view,
      traits,
      timeSeconds: context.timeSeconds,
      speedRatio,
      heldHeading: this.heldHeading,
      phase: this.phase,
      stripRow: this.stripRow,
      strip: context.strip,
      clips: clips.shape,
      preyAngle: this.angles.preyAngle,
      moteAngle: this.angles.moteAngle,
      contactDent: context.contactDent,
      pseudopods: [],
      form: null,
    });
    return { clips, terms };
  }

  /** One frame: the view, interpolated, plus the frame context, to the instance and the placements. */
  update(view: CellView, context: CellFrameContext): CellFrameOutput {
    this.lastViewValue = view;
    const traits = this.traitsFor(view, context.previewTraitId);
    const speedRatio = this.speedRatioOf(view, context);
    this.heldHeading = headingOf(view, speedRatio, this.heldHeading);
    const { clips, terms } = this.termsFor(view, context, traits, speedRatio);
    const lod = cellLodFor(view.radius * context.zoom);
    const organelles = lod.isFarDot ? [] : this.placeOrganelles(terms, speedRatio, context.timeSeconds);
    const nucleus = organelles.find((placement) => NUCLEUS_KINDS.has(placement.kind)) ?? null;
    const warningRingPx = lod.hasTells ? this.warningRingPx(view, context) : 0;
    const instance = buildCellInstance({
      view,
      traits,
      terms,
      lod,
      clips,
      speedRatio,
      warningRingPx,
      nucleusOffset:
        nucleus === null ? { x: 0, y: 0 } : { x: nucleus.point.x / view.radius, y: nucleus.point.y / view.radius },
      isOwn: context.ownCell?.id === view.id,
      cosmetic: { stripRow: this.stripRow, phase: this.phase },
      zoom: context.zoom,
    });
    return { instance, terms, lod, organelles, traits };
  }
}
