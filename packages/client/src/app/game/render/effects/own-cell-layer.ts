// What the own-cell layers share (docs/rendering/own-cell-indicators.md §10): the indicators layer and the legibility
// cues layer (docs/ui/hud.md §3.1.5) are built the same way and open every frame the same way. Both hang a sprite
// container off their own container and pool their atlas sprites in it; both build a text view on the first frame with
// something to say, because `BitmapText` needs a real canvas and a spec hands in a fake; both stand down when there is
// no record or no own cell (spectating, the lobby, the frames before the first snapshot), hiding what they drew and
// reporting empty outputs. All of that lives here once, so each layer holds only what it differs in — the arc mesh and
// its clocks, or the floater stack and the measured widths — and implements `draw`. Generic over the record, the text
// view, the outputs and the frame.

import type { CellView, EntityId } from '@evolution/shared';
import { Container, type Sprite } from 'pixi.js';
import { SpritePool } from '../sprite-pool';
import type { IndicatorTextures } from '../textures/indicator-textures';

/** The half of a layer's frame this class decides on; a layer's own frame carries the rest. */
export interface OwnCellLayerFrame<TIndicators> {
  readonly indicators: TIndicators | null;
  readonly ownCell: CellView | null;
}

/** Everything present: what a layer is given to draw. */
export interface OwnCellLayerSubject<TIndicators, TText> {
  readonly indicators: TIndicators;
  readonly ownCell: CellView;
  readonly text: TText;
}

/** Builds a layer's text view over the texture bundle; the real one in the app, a recording fake in a spec. */
export type OwnCellTextFactory<TText> = (textures: IndicatorTextures) => TText;

export abstract class OwnCellLayer<TIndicators, TText, TOutputs, TFrame extends OwnCellLayerFrame<TIndicators>> {
  readonly container = new Container();
  protected readonly spriteContainer = new Container();
  protected readonly pool = new SpritePool(this.spriteContainer);
  /** Built on the first frame with something to say, then kept for the layer's lifetime. */
  protected text: TText | null = null;
  /** The own cell the layer last drew: a different one starts its per-cell clocks fresh. */
  protected cellId: EntityId | null = null;

  constructor(
    protected readonly textures: IndicatorTextures,
    /** What a frame with nothing to draw reports. */
    private readonly nothingDrawn: TOutputs,
    private createText: OwnCellTextFactory<TText>,
  ) {}

  /** Swaps the text factory before the first text is built: a test passes a fake. */
  useText(factory: OwnCellTextFactory<TText>): void {
    this.createText = factory;
  }

  /** The pooled atlas sprites in placement order: a test reads them. */
  get sprites(): readonly Sprite[] {
    return this.pool.all;
  }

  /** Hide what the layer drew and forget its per-cell clocks; the next cell starts fresh. */
  protected abstract hide(): void;

  /** One frame, with the record, the own cell and the text view all present. */
  protected abstract draw(subject: OwnCellLayerSubject<TIndicators, TText>, frame: TFrame): TOutputs;

  /** Where a freshly built text view is added; the indicators append it, the cues put it under their sprites. */
  protected addTextView(view: TText & { readonly container: Container }): void {
    this.container.addChild(view.container);
  }

  /** The layer's text view, built on first use. */
  protected textView(): TText {
    if (this.text === null) {
      this.text = this.createText(this.textures);
      this.addTextView(this.text as TText & { readonly container: Container });
    }
    return this.text;
  }

  /**
   * One frame of the layer. The record and the cell are never half-present, so one check settles both; a stood-down
   * frame builds no text view, which is what keeps a hidden layer from needing a canvas at all.
   */
  update(frame: TFrame): TOutputs {
    const { indicators, ownCell } = frame;
    if (indicators === null || ownCell === null) {
      this.hide();
      return this.nothingDrawn;
    }
    return this.draw({ indicators, ownCell, text: this.textView() }, frame);
  }
}
