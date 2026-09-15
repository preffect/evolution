// A full-viewport layer the kit draws on (docs/ui/components-and-constants.md §10.1): one per layer (the HUD shell,
// the lobby's encyclopedia host), never on a panel or a kit component. It observes its host's box, sets
// `--ui-scale` from the pure `uiScaleFor`, and spreads every `--ui-…` token, so everything under it reads
// one set of numbers.

import { Directive, ElementRef, computed, inject, signal, type OnDestroy, type OnInit } from '@angular/core';
import { observeElementSize, type ElementSize } from './element-size';
import { uiScaleVariable, uiStyleVariables } from './format/ui-css-variables';
import { uiScaleFor } from './format/ui-scale';

const NO_SIZE: ElementSize = { widthPx: 0, heightPx: 0 };

@Directive({
  selector: '[uiSurface]',
  standalone: true,
  host: { '[style]': 'styleVariables()' },
})
export class UiSurfaceDirective implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly size = signal<ElementSize>(NO_SIZE);
  private readonly tokens = uiStyleVariables();
  private stopObservingSize: (() => void) | null = null;

  /** The live scale of this layer, for a host that needs the number itself. */
  readonly scale = computed(() => uiScaleFor(this.size().widthPx, this.size().heightPx));

  protected readonly styleVariables = computed(() => ({ ...this.tokens, ...uiScaleVariable(this.scale()) }));

  ngOnInit(): void {
    this.stopObservingSize = observeElementSize(this.host.nativeElement, (size) => this.size.set(size));
  }

  ngOnDestroy(): void {
    this.stopObservingSize?.();
    this.stopObservingSize = null;
  }
}
