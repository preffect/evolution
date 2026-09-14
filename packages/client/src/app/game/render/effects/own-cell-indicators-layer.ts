// The own-cell indicators layer (docs/rendering/own-cell-indicators.md §10): draws the HUD's `OwnCellIndicators`
// record on the own cell each frame — every ring, track and arc as rows of one `ArcMesh` (one draw call), the
// ladder's ghosts and pip blocks from one pooled sprite batch over the indicator atlas, the level numeral and the
// label as text. It keeps the two per-cell clocks the record cannot: the DNA fill's tween, and the `level_up`
// clip whose `ringFlash` track flashes the ring and the numeral gold on the frame the level rises. Placements are
// `own-cell-indicators.ts`'s data; this class only applies them. Nothing is drawn without a record or an own cell.

import { MOTION_CLIP, MOTION_CLIPS, type CellView, type EntityId } from '@evolution/shared';
import { Container, type Sprite } from 'pixi.js';
import { SpritePool, placeSprite } from '../sprite-pool';
import type { OwnCellIndicators } from '../../state/own-cell-indicators';
import type { IndicatorTextures } from '../textures/indicator-textures';
import { ArcMesh } from './arc-mesh';
import { IndicatorFillTween } from './indicator-fill-tween';
import { createBitmapIndicatorText, type IndicatorText, type IndicatorTextFactory } from './indicator-text';
import { MotionClipPlayer } from './motion-clip-player';
import { ownCellIndicatorPlacements, type OwnCellIndicatorPlacements, type ThreatAnchor } from './own-cell-indicators';

export interface OwnCellIndicatorsLayerFrame {
  readonly indicators: OwnCellIndicators | null;
  readonly ownCell: CellView | null;
  readonly zoom: number;
  readonly nowMs: number;
  readonly threat: ThreatAnchor | null;
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

export class OwnCellIndicatorsLayer {
  readonly container = new Container();
  private readonly spriteContainer = new Container();
  private readonly pool = new SpritePool(this.spriteContainer);
  private readonly arcMesh = new ArcMesh();
  private readonly flash = new MotionClipPlayer();
  private readonly fill = new IndicatorFillTween();
  /** Built on the first frame with something to say: `BitmapText` wants a real canvas (`indicator-text.ts`). */
  private text: IndicatorText | null = null;
  private cellId: EntityId | null = null;
  private lastLevel: number | null = null;

  constructor(
    private readonly textures: IndicatorTextures,
    private createText: IndicatorTextFactory = createBitmapIndicatorText,
  ) {
    this.container.addChild(this.arcMesh.mesh, this.spriteContainer);
  }

  /** Swaps the text factory before the first text is built: a test passes a fake. */
  useText(factory: IndicatorTextFactory): void {
    this.createText = factory;
  }

  update(frame: OwnCellIndicatorsLayerFrame): OwnCellIndicatorsLayerOutputs {
    const { indicators, ownCell } = frame;
    if (indicators === null || ownCell === null) {
      this.hide();
      return NOTHING_DRAWN;
    }
    const text = this.textView();
    const clocks = this.advanceClocks(ownCell.id, indicators, frame.nowMs);
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
    placements.sprites.forEach((placement, index) =>
      placeSprite(this.pool.spriteAt(index), placement.texture.texture, { ...placement, alpha: OPAQUE }),
    );
    this.pool.hideFrom(placements.sprites.length);
    showTexts(text, placements, frame.zoom);
    return outputsOf(placements, this.arcMesh.count);
  }

  /** The pooled atlas sprites in placement order: a test reads them. */
  get sprites(): readonly Sprite[] {
    return this.pool.all;
  }

  /** The arc rows the next render draws, `ARC_INSTANCE_FLOATS` each: a test reads them. */
  get arcRows(): Readonly<Float32Array> {
    return this.arcMesh.instances;
  }

  /** The fill's tween and the level-up flash: a new cell starts both fresh, a level rise flashes and jumps the fill. */
  private advanceClocks(
    cellId: EntityId,
    indicators: OwnCellIndicators,
    nowMs: number,
  ): { readonly dnaFill: number; readonly ringFlash: number } {
    const isNewCell = cellId !== this.cellId;
    const isLevelUp = !isNewCell && this.lastLevel !== null && indicators.level > this.lastLevel;
    if (isNewCell) this.flash.clear();
    if (isLevelUp) this.flash.play(MOTION_CLIPS[MOTION_CLIP.levelUp], nowMs);
    this.cellId = cellId;
    this.lastLevel = indicators.level;
    return {
      dnaFill: this.fill.update(indicators.dnaFraction, nowMs, isNewCell || isLevelUp),
      ringFlash: this.flash.sample(nowMs)[RING_FLASH_TRACK] ?? NO_FLASH,
    };
  }

  private textView(): IndicatorText {
    if (this.text === null) {
      this.text = this.createText(this.textures);
      this.container.addChild(this.text.container);
    }
    return this.text;
  }

  /** No own cell or no record (spectating, the lobby): nothing drawn, and the next cell starts fresh. */
  private hide(): void {
    this.arcMesh.draw([], HIDDEN_ZOOM);
    this.pool.hideFrom(0);
    this.text?.hideNumeral();
    this.text?.hideLabel();
    this.cellId = null;
    this.lastLevel = null;
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

function outputsOf(placements: OwnCellIndicatorPlacements, arcs: number): OwnCellIndicatorsLayerOutputs {
  const hasLabel = placements.label !== null;
  return {
    sprites: placements.sprites.length + (hasLabel ? LABEL_PILL_SPRITES : 0),
    arcs,
    texts: hasLabel ? NUMERAL_AND_LABEL : NUMERAL_ONLY,
  };
}
