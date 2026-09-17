// What `<app-trait-glyph>` and `<app-subject-glyph>` have in common (docs/visual-style/ui-type.md §7.1 and §7.2):
// the `lod` and `still` inputs, the idle amplitudes published to the keyframes, the gradient id
// prefix unique to this drawing, and the view built from all of it. Only what a glyph *is* differs — the id input and
// the table it looks up — so the two components are a table lookup each, and this file is the one place the contract
// lives. Neither component owns an `<svg>`: `glyph-layers.component.ts` *is* the SVG, so the drawing exists once.
// Each tags itself through its host element instead (`data-trait-id`, `data-entry-id`).

import { Directive, booleanAttribute, computed, input } from '@angular/core';
import type { GlyphDrawing } from '../render/svg-glyph';
import { glyphMotionVariables } from './glyph-motion-variables';
import { GLYPH_LOD, glyphView, type GlyphLod } from './glyph-view';

let drawingsStarted = 0;

/** A gradient and clip id prefix unique in the document: ids are global, and a row draws several glyphs at once. */
function nextIdPrefix(): string {
  drawingsStarted += 1;
  return `glyph-${drawingsStarted}`;
}

@Directive()
export abstract class GlyphHost {
  /** `card` at medallion size; `list` at one line of text, where the interior detail drops. */
  readonly lod = input<GlyphLod>(GLYPH_LOD.card);
  /** `still`: no idle loop (list rows, where many glyphs sit together); the drawing is otherwise the same. */
  readonly still = input(false, { transform: booleanAttribute });

  protected readonly motionVariables = glyphMotionVariables();
  private readonly idPrefix = nextIdPrefix();
  protected readonly view = computed(() => glyphView(this.drawing(), this.lod(), this.idPrefix));

  /** The drawing this glyph is: a table lookup on the id its component adds. */
  protected abstract drawing(): GlyphDrawing;
}
