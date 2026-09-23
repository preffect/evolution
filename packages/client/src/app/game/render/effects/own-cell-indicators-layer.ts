// The own-cell indicators layer (docs/rendering/own-cell-indicators.md §10): draws the HUD's `OwnCellIndicators`
// record on the own cell each frame — every ring, track and arc as rows of one `ArcMesh` (one draw call), the
// ladder's ghosts and pip blocks from one pooled sprite batch over the indicator atlas, the level numeral and the
// label as text. It keeps the two per-cell clocks the record cannot: the DNA fill's tween, and the `level_up`
// clip whose `ringFlash` track flashes the ring and the numeral gold from the frame the own cell's `level_up` effect
// arrives — the server's moment, never a diff of the record (docs/architecture/client.md §6). Placements are
// `own-cell-indicators.ts`'s data; this class only applies them. Nothing is drawn without a record or an own cell.
// It also draws the relation labels on their rings (`relation-label-placements.ts`). Every label it placed is kept as a
// box, so the legibility cues drawn after it can yield to them (docs/ui/hud.md §3.1.5).

import {
  EFFECT_KIND,
  MOTION_CLIP,
  MOTION_CLIPS,
  type CellView,
  type EntityId,
  type GameEffect,
} from '@evolution/shared';
import { LABEL_PILL_HEIGHT_PX } from '../constants';
import { HALF, type UprightBox } from '../geometry';
import { placeSpriteBatch } from '../sprite-pool';
import type { OwnCellIndicators } from '../../state/own-cell-indicators';
import type { IndicatorTextures } from '../textures/indicator-textures';
import { ArcMesh } from './arc-mesh';
import { IndicatorFillTween } from './indicator-fill-tween';
import { createBitmapIndicatorText, type IndicatorText, type IndicatorTextFactory } from './indicator-text';
import { MotionClipPlayer } from './motion-clip-player';
import { ladderOrbitRadiusPx } from './own-cell-geometry';
import { OwnCellLayer, type OwnCellLayerSubject } from './own-cell-layer';
import {
  escapeArcs,
  ownCellIndicatorPlacements,
  type IndicatorLabelPlacement,
  type OwnCellIndicatorPlacements,
  type ThreatAnchor,
} from './own-cell-indicators';
import { NO_RELATION_LABEL_SCENE, relationLabelPlacements, type RelationLabelScene } from './relation-label-placements';

/**
 * How much of the own-cell chrome a frame draws. `hud` is the game: every indicator, label and cue. `lens` is the
 * encyclopedia preview (docs/architecture/encyclopedia.md §12.7, ticket #505): a lens shows the creature and its
 * action, never HUD chrome, so it draws only the escape arc — the escape window is the `escape` scene's action —
 * and no DNA ring, numeral, ladder, label or cue. The self ring and the warning ring are cell tells, drawn either way.
 */
export const OWN_CELL_CHROME = { hud: 'hud', lens: 'lens' } as const;
export type OwnCellChrome = (typeof OWN_CELL_CHROME)[keyof typeof OWN_CELL_CHROME];

export interface OwnCellIndicatorsLayerFrame {
  readonly indicators: OwnCellIndicators | null;
  readonly ownCell: CellView | null;
  readonly zoom: number;
  readonly nowMs: number;
  readonly threat: ThreatAnchor | null;
  /** The effects this frame's render tick reached; the own cell's `level_up` among them starts the flash. */
  readonly effects: readonly GameEffect[];
  /** The drawn relation rings and the labels for them (`relationLabelSceneFor`); absent draws no label. */
  readonly relationScene?: RelationLabelScene;
  /** Where the cue column rests (`CueLayer.restingColumn`, last frame's), px in the own cell's frame; labels keep off it. */
  readonly cueColumn?: UprightBox | null;
  /** `OWN_CELL_CHROME.hud` when absent. */
  readonly chrome?: OwnCellChrome;
}

export interface OwnCellIndicatorsLayerOutputs {
  /** Atlas sprites plus the label pill (docs/rendering/own-cell-indicators.md §10's sprite count). */
  readonly sprites: number;
  /** Arc rows in the one arc draw. */
  readonly arcs: number;
  /** The numeral and every label shown. */
  readonly texts: number;
}

/** The `level_up` track the ring and the numeral flash with (docs/rendering/contents-and-motion.md §4). */
const RING_FLASH_TRACK = 'ringFlash';
const NO_FLASH = 0;
const NUMERAL_TEXTS = 1;
const HIDDEN_ZOOM = 1;
const OPAQUE = 1;
const NOTHING_DRAWN: OwnCellIndicatorsLayerOutputs = { sprites: 0, arcs: 0, texts: 0 };

export class OwnCellIndicatorsLayer extends OwnCellLayer<
  OwnCellIndicators,
  IndicatorText,
  OwnCellIndicatorsLayerOutputs,
  OwnCellIndicatorsLayerFrame
> {
  private readonly arcMesh = new ArcMesh();
  private readonly flash = new MotionClipPlayer();
  private readonly fill = new IndicatorFillTween();
  private labelBoxesPx: readonly UprightBox[] = [];

  constructor(textures: IndicatorTextures, createText: IndicatorTextFactory = createBitmapIndicatorText) {
    super(textures, NOTHING_DRAWN, createText);
    this.container.addChild(this.arcMesh.mesh, this.spriteContainer);
  }

  protected draw(
    subject: OwnCellLayerSubject<OwnCellIndicators, IndicatorText>,
    frame: OwnCellIndicatorsLayerFrame,
  ): OwnCellIndicatorsLayerOutputs {
    const { indicators, ownCell, text } = subject;
    if (frame.chrome === OWN_CELL_CHROME.lens) return this.drawLens(indicators, ownCell, text, frame.zoom);
    const clocks = this.advanceClocks(ownCell.id, indicators, frame);
    const placements = ownCellIndicatorPlacements({
      indicators,
      ownCell,
      zoom: frame.zoom,
      ...clocks,
      threat: frame.threat,
      textures: this.textures,
      measureLabelPx: (label) => text.measureLabelPx(label),
    });
    this.arcMesh.draw(placements.arcs, frame.zoom);
    placeSpriteBatch(this.pool, placements.sprites, OPAQUE);
    const relationLabels = relationLabelPlacements({
      scene: frame.relationScene ?? NO_RELATION_LABEL_SCENE,
      ownCell,
      zoom: frame.zoom,
      threat: frame.threat,
      placedLabel: placements.label,
      cueColumn: frame.cueColumn ?? null,
      measureLabelPx: (label) => text.measureLabelPx(label),
    });
    showTexts(text, placements, frame.zoom);
    text.showRelationLabels(relationLabels, frame.zoom);
    const labels = placements.label === null ? relationLabels : [placements.label, ...relationLabels];
    this.labelBoxesPx = labels.map((label) => labelBoxOf(label, ownCell, frame.zoom));
    return outputsOf(placements, labels.length, this.arcMesh.count);
  }

  /** The lens's one piece of chrome: the escape arc while `being_engulfed`, on the orbit's radius; nothing else. */
  private drawLens(
    indicators: OwnCellIndicators,
    ownCell: CellView,
    text: IndicatorText,
    zoom: number,
  ): OwnCellIndicatorsLayerOutputs {
    const { escape } = indicators;
    const centre = { x: ownCell.x, y: ownCell.y };
    const arcs = escape === null ? [] : escapeArcs(escape, centre, ladderOrbitRadiusPx(ownCell.radius * zoom));
    this.arcMesh.draw(arcs, zoom);
    this.pool.hideFrom(0);
    text.hideNumeral();
    text.hideLabel();
    text.hideRelationLabels();
    this.labelBoxesPx = [];
    return { sprites: 0, arcs: this.arcMesh.count, texts: 0 };
  }

  /** The arc rows the next render draws, `ARC_INSTANCE_FLOATS` each: a test reads them. */
  get arcRows(): Readonly<Float32Array> {
    return this.arcMesh.instances;
  }

  /** The threat or escape label's pill and the relation labels' as last placed, px in the own cell's frame. */
  get labelBoxes(): readonly UprightBox[] {
    return this.labelBoxesPx;
  }

  /** The fill's tween and the level-up flash: a new cell starts both fresh, its own `level_up` flashes and jumps the fill. */
  private advanceClocks(
    cellId: EntityId,
    indicators: OwnCellIndicators,
    frame: Pick<OwnCellIndicatorsLayerFrame, 'nowMs' | 'effects'>,
  ): { readonly dnaFill: number; readonly ringFlash: number } {
    const { nowMs } = frame;
    const isNewCell = cellId !== this.cellId;
    const isLevelUp = frame.effects.some((effect) => effect.kind === EFFECT_KIND.levelUp && effect.cellId === cellId);
    if (isNewCell) this.flash.clear();
    if (isLevelUp) this.flash.play(MOTION_CLIPS[MOTION_CLIP.levelUp], nowMs);
    this.cellId = cellId;
    return {
      dnaFill: this.fill.update(indicators.dnaFraction, nowMs, isNewCell || isLevelUp),
      ringFlash: this.flash.sample(nowMs)[RING_FLASH_TRACK] ?? NO_FLASH,
    };
  }

  /** No own cell or no record (spectating, the lobby): nothing drawn, and the next cell starts fresh. */
  protected hide(): void {
    this.arcMesh.draw([], HIDDEN_ZOOM);
    this.pool.hideFrom(0);
    this.text?.hideNumeral();
    this.text?.hideLabel();
    this.text?.hideRelationLabels();
    this.cellId = null;
    this.labelBoxesPx = [];
    this.fill.reset();
    this.flash.clear();
  }

  /** The arc mesh's shader and instance texture before the children, as the indicator sheet does. */
  destroy(): void {
    this.arcMesh.destroy();
    this.container.destroy({ children: true });
  }
}

function showTexts(text: IndicatorText, placements: OwnCellIndicatorPlacements, zoom: number): void {
  text.showNumeral(placements.numeral, zoom);
  if (placements.label === null) text.hideLabel();
  else text.showLabel(placements.label, zoom);
}

/** A placed label's pill in px from the own cell's centre: what the cue layout keeps clear of. */
function labelBoxOf(label: IndicatorLabelPlacement, ownCell: CellView, zoom: number): UprightBox {
  return {
    x: (label.x - ownCell.x) * zoom,
    y: (label.y - ownCell.y) * zoom,
    halfWidth: label.pillWidthPx * HALF,
    halfHeight: LABEL_PILL_HEIGHT_PX * HALF,
  };
}

/** Each label is one pill sprite and one text. */
function outputsOf(
  placements: OwnCellIndicatorPlacements,
  labels: number,
  arcs: number,
): OwnCellIndicatorsLayerOutputs {
  return { sprites: placements.sprites.length + labels, arcs, texts: NUMERAL_TEXTS + labels };
}
