// A full-viewport layer the kit draws on (docs/ui/components-and-constants.md §10.1): one per layer (the HUD shell,
// the lobby's encyclopedia host), never on a panel or a kit component. It observes its host's box, sets
// `--ui-scale` from the pure `uiScaleFor`, and spreads every `--ui-…` token, so everything under it reads
// one set of numbers.

import { Directive, ElementRef, computed, inject, type OnInit } from '@angular/core';
import { ElementSizeTracker } from './element-size';
import { uiScaleVariable, uiStyleVariables } from './format/ui-css-variables';
import { uiScaleFor } from './format/ui-scale';

@Directive({
  selector: '[uiSurface]',
  standalone: true,
  exportAs: 'uiSurface',
  host: { '[style]': 'styleVariables()' },
})
export class UiSurfaceDirective implements OnInit {
  private readonly sizeTracker = new ElementSizeTracker(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
  private readonly tokens = uiStyleVariables();

  /** The live scale of this layer, for a host that needs the number itself. */
  readonly scale = computed(() => uiScaleFor(this.sizeTracker.size().widthPx, this.sizeTracker.size().heightPx));

  protected readonly styleVariables = computed(() => ({ ...this.tokens, ...uiScaleVariable(this.scale()) }));

  ngOnInit(): void {
    this.sizeTracker.start();
  }
}
