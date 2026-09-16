// The own-cell indicators layer (docs/rendering/own-cell-indicators.md §10): draws the HUD's `OwnCellIndicators`
// record on the own cell each frame — every ring, track and arc as rows of one `ArcMesh` (one draw call), the
// ladder's ghosts and pip blocks from one pooled sprite batch over the indicator atlas, the level numeral and the
// label as text. It keeps the two per-cell clocks the record cannot: the DNA fill's tween, and the `level_up`
// clip whose `ringFlash` track flashes the ring and the numeral gold from the frame the own cell's `level_up` effect
// arrives — the server's moment, never a diff of the record (docs/architecture/client.md §6). Placements are
// `own-cell-indicators.ts`'s data; this class only applies them. Nothing is drawn without a record or an own cell.
// The label it placed is kept as a box, so the legibility cues drawn after it can yield to it (docs/ui/hud.md §3.1.5).

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
import { OwnCellLayer, type OwnCellLayerSubject } from './own-cell-layer';
import { ownCellIndicatorPlacements, type OwnCellIndicatorPlacements, type ThreatAnchor } from './own-cell-indicators';

export interface OwnCellIndicatorsLayerFrame {
  readonly indicators: OwnCellIndicators | null;
  readonly ownCell: CellView | null;
  readonly zoom: number;
  readonly nowMs: number;
  readonly threat: ThreatAnchor | null;
  /** The effects this frame's render tick reached; the own cell's `level_up` among them starts the flash. */
  readonly effects: readonly GameEffect[];
}

export interface OwnCellIndicatorsLayerOutputs {
  /** Atlas sprites plus the label pill (docs/rendering/own-cell-indicators.md §10's sprite count). */
  readonly sprites: number;
  /** Arc rows in the one arc draw. */
  readonly arcs: number;
  /** The numeral and, when shown, the label. */
  readonly texts: number;
}

/** The `level_up` track the ring and the numeral flash with (docs/rendering/contents-and-motion.md §4). */
const RING_FLASH_TRACK = 'ringFlash';
const NO_FLASH = 0;
const NUMERAL_ONLY = 1;
const NUMERAL_AND_LABEL = 2;
const LABEL_PILL_SPRITES = 1;
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
  private labelBoxPx: UprightBox | null = null;

  constructor(textures: IndicatorTextures, createText: IndicatorTextFactory = createBitmapIndicatorText) {
    super(textures, NOTHING_DRAWN, createText);
    this.container.addChild(this.arcMesh.mesh, this.spriteContainer);
  }

  protected draw(
    subject: OwnCellLayerSubject<OwnCellIndicators, IndicatorText>,
    frame: OwnCellIndicatorsLayerFrame,
  ): OwnCellIndicatorsLayerOutputs {
    const { indicators, ownCell, text } = subject;
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
    showTexts(text, placements, frame.zoom);
    this.labelBoxPx = labelBoxOf(placements, ownCell, frame.zoom);
    return outputsOf(placements, this.arcMesh.count);
  }

  /** The arc rows the next render draws, `ARC_INSTANCE_FLOATS` each: a test reads them. */
  get arcRows(): Readonly<Float32Array> {
    return this.arcMesh.instances;
  }

  /** The threat or escape label's pill as last placed, px in the own cell's frame; `null` when none shows. */
  get labelBox(): UprightBox | null {
    return this.labelBoxPx;
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
    this.cellId = null;
    this.labelBoxPx = null;
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

/** The placed label's pill in px from the own cell's centre: what the cue layout keeps clear of. */
function labelBoxOf(placements: OwnCellIndicatorPlacements, ownCell: CellView, zoom: number): UprightBox | null {
  const { label } = placements;
  if (label === null) return null;
  return {
    x: (label.x - ownCell.x) * zoom,
    y: (label.y - ownCell.y) * zoom,
    halfWidth: label.pillWidthPx * HALF,
    halfHeight: LABEL_PILL_HEIGHT_PX * HALF,
  };
}

function outputsOf(placements: OwnCellIndicatorPlacements, arcs: number): OwnCellIndicatorsLayerOutputs {
  const hasLabel = placements.label !== null;
  return {
    sprites: placements.sprites.length + (hasLabel ? LABEL_PILL_SPRITES : 0),
    arcs,
    texts: hasLabel ? NUMERAL_AND_LABEL : NUMERAL_ONLY,
  };
}
