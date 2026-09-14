// The own-cell indicator contact sheet (docs/RENDERING.md §10, #294 evidence): `?bench&sheet=indicators`
// draws every baked indicator texture through the real Pixi path at its px floor size over the field
// colour — the five ghosts (the rung ghosts tinted a player's rim colour), both pip block series from empty
// to full, the label pills with `label` text and `value` numerals — and, below them, the arc primitive's panel
// (`indicator-sheet-arcs.ts`) through one `ArcMesh`. A screenshot enlarged nearest-neighbour shows the texels
// and the anti-aliased edges as drawn. Dev evidence only: the live renderer never builds it.

import { BitmapText, Container, NineSliceSprite, Sprite, Texture } from 'pixi.js';
import type { ViewportPx } from '../camera';
import { BG_FIELD, INDICATOR_SHEET, UI_TYPE, WHITE } from '../constants';
import { HALF } from '../geometry';
import { paletteFor } from '../palette';
import { LADDER_SILHOUETTE } from '../../state/own-cell-indicators';
import type { IndicatorSpriteTexture, IndicatorTextures } from '../textures/indicator-textures';
import { labelPillSpriteSizePx, labelPillWidthPx } from '../textures/label-pill-bake';
import { endosymbiontTallies, pipBlockKey } from '../textures/pip-block-bake';
import { ArcMesh } from '../effects/arc-mesh';
import { indicatorSheetArcs } from './indicator-sheet-arcs';

/** The sheet is drawn in screen px on the stage root: one px per world unit. */
const SHEET_ZOOM = 1;

export interface SheetLayer {
  readonly texture: IndicatorSpriteTexture;
  readonly tint: string;
}

export type SheetItem =
  | { readonly kind: 'sprites'; readonly layers: readonly SheetLayer[] }
  | { readonly kind: 'pill'; readonly text: string }
  | { readonly kind: 'numeral'; readonly text: string };

export interface SheetSize {
  readonly width: number;
  readonly height: number;
}

export interface SheetPoint {
  readonly x: number;
  readonly y: number;
}

function sprites(...layers: SheetLayer[]): SheetItem {
  return { kind: 'sprites', layers };
}

function ghostRow(textures: IndicatorTextures): SheetItem[] {
  const rim = paletteFor(INDICATOR_SHEET.rimPaletteIndex).rim;
  const row = Object.values(LADDER_SILHOUETTE).map((silhouette) =>
    sprites({ texture: textures.ghosts[silhouette]!, tint: rim }),
  );
  for (const tally of endosymbiontTallies())
    row.push(sprites({ texture: textures.ghosts[tally.traitId]!, tint: WHITE }));
  return row;
}

/** Each tally's pip blocks, every `eaten` from empty to full. */
function pipRows(textures: IndicatorTextures): SheetItem[][] {
  return endosymbiontTallies().map((tally) =>
    Array.from({ length: tally.required + 1 }, (_entry, eaten) =>
      sprites({ texture: textures.pipBlocks[pipBlockKey(tally.variant, eaten, tally.required)]!, tint: WHITE }),
    ),
  );
}

/** The sheet's rows, top to bottom: ghosts, the pip series, the pills, the numerals. */
export function indicatorSheetRows(textures: IndicatorTextures): SheetItem[][] {
  return [
    ghostRow(textures),
    ...pipRows(textures),
    INDICATOR_SHEET.labelTexts.map((text): SheetItem => ({ kind: 'pill', text })),
    INDICATOR_SHEET.numeralTexts.map((text): SheetItem => ({ kind: 'numeral', text })),
  ];
}

/** Items flowed left to right, rows top to bottom, each row as tall as its tallest item: every item's centre. */
export function flowSheetRows(sizes: readonly (readonly SheetSize[])[], origin: SheetPoint): SheetPoint[][] {
  let top = origin.y;
  return sizes.map((row) => {
    const rowHeight = Math.max(0, ...row.map((size) => size.height));
    let left = origin.x;
    const centres = row.map((size) => {
      const centre = { x: left + size.width * HALF, y: top + rowHeight * HALF };
      left += size.width + INDICATOR_SHEET.itemGapPx;
      return centre;
    });
    top += rowHeight + INDICATOR_SHEET.rowGapPx;
    return centres;
  });
}

function spritesView(layers: readonly SheetLayer[]): Container {
  const view = new Container();
  for (const layer of layers) {
    const sprite = new Sprite(layer.texture.texture);
    sprite.anchor.set(HALF);
    sprite.setSize(layer.texture.widthPx, layer.texture.heightPx);
    sprite.tint = layer.tint;
    view.addChild(sprite);
  }
  return view;
}

function textView(text: string, fontFamily: string, fontSize: number): BitmapText {
  const view = new BitmapText({ text, style: { fontFamily, fontSize } });
  view.anchor.set(HALF);
  return view;
}

/** The label pill as #187 draws it: a nine-slice in texels scaled back to px, the `label` text on it. */
function pillView(textures: IndicatorTextures, text: string): Container {
  const view = new Container();
  const label = textView(text, textures.fonts.label, UI_TYPE.label.px);
  const { labelPill, bakeScale } = textures;
  const size = labelPillSpriteSizePx(labelPillWidthPx(label.width));
  const pill = new NineSliceSprite({
    texture: labelPill.texture,
    leftWidth: labelPill.capWidthPx * bakeScale,
    rightWidth: labelPill.capWidthPx * bakeScale,
    topHeight: 0,
    bottomHeight: 0,
  });
  pill.setSize(size.width * bakeScale, size.height * bakeScale);
  pill.scale.set(1 / bakeScale);
  pill.position.set(-size.width * HALF, -size.height * HALF);
  view.addChild(pill, label);
  return view;
}

function itemView(textures: IndicatorTextures, item: SheetItem): Container {
  if (item.kind === 'sprites') return spritesView(item.layers);
  if (item.kind === 'pill') return pillView(textures, item.text);
  return textView(item.text, textures.fonts.value, UI_TYPE.value.px);
}

/** The sheet container owns its arc mesh, whose shader and instance texture go before the children do. */
class IndicatorSheetContainer extends Container {
  readonly arcMesh = new ArcMesh(INDICATOR_SHEET.arcs.capacity);

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.arcMesh.destroy();
    super.destroy(options);
  }
}

/** The arc panel: every arc row in one draw at zoom 1, then the orbit's ghosts and pip blocks over their backings. */
function addArcPanel(sheet: IndicatorSheetContainer, textures: IndicatorTextures): void {
  const { arcs, sprites } = indicatorSheetArcs(textures);
  sheet.addChild(sheet.arcMesh.mesh);
  sheet.arcMesh.draw(arcs, SHEET_ZOOM);
  for (const placed of sprites) {
    const view = spritesView([placed]);
    view.position.set(placed.x, placed.y);
    view.rotation = placed.rotation;
    sheet.addChild(view);
  }
}

/** Adds the sheet over everything on `stage`: the field colour, every texture row at its px floor size, the arc panel. */
export function attachIndicatorSheet(stage: Container, textures: IndicatorTextures, viewport: ViewportPx): Container {
  const sheet = new IndicatorSheetContainer();
  const field = new Sprite(Texture.WHITE);
  field.setSize(viewport.width, viewport.height);
  field.tint = BG_FIELD;
  sheet.addChild(field);
  addArcPanel(sheet, textures);
  const views = indicatorSheetRows(textures).map((row) => row.map((item) => itemView(textures, item)));
  const origin = { x: INDICATOR_SHEET.marginPx, y: INDICATOR_SHEET.marginPx };
  const centres = flowSheetRows(
    views.map((row) => row.map((view) => view.getLocalBounds())),
    origin,
  );
  views.forEach((row, rowIndex) =>
    row.forEach((view, itemIndex) => {
      const centre = centres[rowIndex]![itemIndex]!;
      view.position.set(centre.x, centre.y);
      sheet.addChild(view);
    }),
  );
  stage.addChild(sheet);
  return sheet;
}
