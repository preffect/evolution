// The kit's scroll area (docs/ui/components-and-constants.md §10.2): `overflow: auto` with a thin themed scrollbar and
// an edge fade on each side that has content beyond it, so a column shows it continues without a hard cut. It is a
// Tab stop only while it overflows and holds nothing focusable of its own: then the keyboard can still scroll it,
// and otherwise the controls inside already can. The page itself never scrolls. `scrolled` reports the viewport's
// `scrollTop` on every scroll, for a feature that reacts to where the reader is (the encyclopedia's sticky title).

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  type AfterViewInit,
  type ElementRef,
} from '@angular/core';
import { observeElementSize } from './element-size';
import { focusableElementsIn } from './focus-trap-stack';

export interface ScrollEdges {
  readonly isOverflowing: boolean;
  readonly hasContentBefore: boolean;
  readonly hasContentAfter: boolean;
}

/** A fractional layout leaves under a pixel of phantom overflow at either end; that is not content. */
const SCROLL_EDGE_TOLERANCE_PX = 1;

export const NO_SCROLL_EDGES: ScrollEdges = { isOverflowing: false, hasContentBefore: false, hasContentAfter: false };

/** Which edges of a vertical scroller have content beyond them. */
export function scrollEdgesFor(scrollTop: number, scrollHeight: number, clientHeight: number): ScrollEdges {
  return {
    isOverflowing: scrollHeight - clientHeight > SCROLL_EDGE_TOLERANCE_PX,
    hasContentBefore: scrollTop > SCROLL_EDGE_TOLERANCE_PX,
    hasContentAfter: scrollHeight - clientHeight - scrollTop > SCROLL_EDGE_TOLERANCE_PX,
  };
}

@Component({
  selector: 'ui-scroll-area',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #viewport
      class="viewport"
      [attr.tabindex]="isFocusable() ? 0 : null"
      [attr.role]="isFocusable() ? 'region' : null"
      [attr.aria-label]="isFocusable() ? label() : null"
      [attr.data-testid]="testId()"
      (scroll)="onScroll()"
    >
      <div #content class="content"><ng-content /></div>
    </div>
  `,
  host: {
    '[attr.data-overflowing]': 'edges().isOverflowing || null',
    '[attr.data-fade-start]': 'edges().hasContentBefore || null',
    '[attr.data-fade-end]': 'edges().hasContentAfter || null',
  },
  styleUrl: './ui-scroll-area.component.css',
})
export class UiScrollAreaComponent implements AfterViewInit {
  /** The region's name while it is a Tab stop, so a screen reader says what scrolls. */
  readonly label = input<string | null>(null);
  readonly testId = input<string | null>(null);
  /** The viewport's `scrollTop`, on every scroll. */
  readonly scrolled = output<number>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');
  private readonly holdsFocusable = signal(false);

  protected readonly edges = signal<ScrollEdges>(NO_SCROLL_EDGES);
  protected readonly isFocusable = computed(() => this.edges().isOverflowing && !this.holdsFocusable());

  ngAfterViewInit(): void {
    const stops = [this.viewport(), this.content()].map((element) =>
      observeElementSize(element.nativeElement, () => this.measure()),
    );
    this.destroyRef.onDestroy(() => stops.forEach((stop) => stop()));
  }

  protected onScroll(): void {
    this.measure();
    this.scrolled.emit(this.viewport().nativeElement.scrollTop);
  }

  /** Re-reads the edges and whether the content holds a control; a feature calls it after changing the content. */
  measure(): void {
    const viewport = this.viewport().nativeElement;
    this.edges.set(scrollEdgesFor(viewport.scrollTop, viewport.scrollHeight, viewport.clientHeight));
    this.holdsFocusable.set(focusableElementsIn(this.content().nativeElement).length > 0);
  }
}
