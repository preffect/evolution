import { Component, signal, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostSelector, styleRuleValue } from '../../testing/style-rules';
import { NO_SCROLL_EDGES, UiScrollAreaComponent, scrollEdgesFor } from './ui-scroll-area.component';

describe('scrollEdgesFor', () => {
  it('reports no overflow and no fades when the content fits', () => {
    expect(scrollEdgesFor(0, 200, 200)).toEqual(NO_SCROLL_EDGES);
    expect(scrollEdgesFor(0, 200.5, 200)).toEqual(NO_SCROLL_EDGES);
  });

  it('fades the far edge at the top, both mid-way, and the near edge at the bottom', () => {
    expect(scrollEdgesFor(0, 600, 200)).toEqual({
      isOverflowing: true,
      hasContentBefore: false,
      hasContentAfter: true,
    });
    expect(scrollEdgesFor(150, 600, 200)).toEqual({
      isOverflowing: true,
      hasContentBefore: true,
      hasContentAfter: true,
    });
    expect(scrollEdgesFor(400, 600, 200)).toEqual({
      isOverflowing: true,
      hasContentBefore: true,
      hasContentAfter: false,
    });
    expect(scrollEdgesFor(399.5, 600, 200).hasContentAfter).toBe(false);
  });
});

@Component({
  standalone: true,
  imports: [UiScrollAreaComponent],
  template: `
    <ui-scroll-area testId="scroll" label="Entries">
      <p>Prose</p>
      @if (hasButton()) {
        <button type="button">Chloroplast</button>
      }
    </ui-scroll-area>
  `,
})
class ScrollHostComponent {
  readonly hasButton = signal(false);
  readonly area = viewChild.required(UiScrollAreaComponent);
}

describe('UiScrollAreaComponent', () => {
  let fixture: ComponentFixture<ScrollHostComponent>;

  function viewport(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-testid="scroll"]')!;
  }

  function host(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('ui-scroll-area')!;
  }

  /** jsdom lays nothing out, so the spec gives the viewport the box a browser would. */
  function layOut(scrollHeight: number, clientHeight: number): void {
    Object.defineProperty(viewport(), 'scrollHeight', { configurable: true, value: scrollHeight });
    Object.defineProperty(viewport(), 'clientHeight', { configurable: true, value: clientHeight });
    fixture.componentInstance.area().measure();
    fixture.detectChanges();
  }

  function scrollTo(scrollTop: number): void {
    viewport().scrollTop = scrollTop;
    viewport().dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ScrollHostComponent] });
    fixture = TestBed.createComponent(ScrollHostComponent);
    fixture.detectChanges();
  });

  it('with content that fits shows no fade and is no Tab stop', () => {
    layOut(200, 200);
    expect(host().hasAttribute('data-overflowing')).toBe(false);
    expect(host().hasAttribute('data-fade-start')).toBe(false);
    expect(host().hasAttribute('data-fade-end')).toBe(false);
    expect(viewport().hasAttribute('tabindex')).toBe(false);
    expect(viewport().hasAttribute('role')).toBe(false);
  });

  it('overflowing with nothing focusable is a named Tab stop, so the keyboard can scroll it', () => {
    layOut(600, 200);
    expect(host().hasAttribute('data-overflowing')).toBe(true);
    expect(viewport().getAttribute('tabindex')).toBe('0');
    expect(viewport().getAttribute('role')).toBe('region');
    expect(viewport().getAttribute('aria-label')).toBe('Entries');
  });

  it('overflowing around a control of its own is no Tab stop: the control already scrolls it', () => {
    fixture.componentInstance.hasButton.set(true);
    fixture.detectChanges();
    layOut(600, 200);
    expect(viewport().hasAttribute('tabindex')).toBe(false);
  });

  it('fades the edges that have content beyond them as it scrolls', () => {
    layOut(600, 200);
    expect(host().hasAttribute('data-fade-start')).toBe(false);
    expect(host().hasAttribute('data-fade-end')).toBe(true);
    scrollTo(150);
    expect(host().hasAttribute('data-fade-start')).toBe(true);
    expect(host().hasAttribute('data-fade-end')).toBe(true);
    scrollTo(400);
    expect(host().hasAttribute('data-fade-start')).toBe(true);
    expect(host().hasAttribute('data-fade-end')).toBe(false);
  });

  it('reports the viewport’s scroll position on every scroll', () => {
    layOut(600, 200);
    const reported: number[] = [];
    fixture.componentInstance.area().scrolled.subscribe((scrollTop) => reported.push(scrollTop));
    scrollTo(150);
    scrollTo(0);
    expect(reported).toEqual([150, 0]);
  });

  describe('its stylesheet (docs/ui/components-and-constants.md §10.2)', () => {
    function rule(fragments: readonly string[], property: string): string | null {
      return styleRuleValue(document, [hostSelector(host()), ...fragments], property);
    }

    /** A rule on the viewport alone: Angular scopes it by content attribute, not by the host. */
    function viewportRule(fragments: readonly string[], property: string): string | null {
      return styleRuleValue(document, ['.viewport', ...fragments], property);
    }

    it('scrolls its viewport and masks each fading edge by the scroll fade', () => {
      expect(viewportRule([], 'overflow')).toBe('auto');
      expect(viewportRule([], 'mask-image')).toContain('var(--fade-start)');
      expect(viewportRule([], 'mask-image')).toContain('var(--fade-end)');
      expect(rule(['[data-fade-start]', '.viewport'], '--fade-start')).toBe(
        'calc(var(--ui-scroll-fade) * var(--ui-scale))',
      );
      expect(rule(['[data-fade-end]', '.viewport'], '--fade-end')).toBe(
        'calc(var(--ui-scroll-fade) * var(--ui-scale))',
      );
    });

    it('draws a thin themed scrollbar on the well, its thumb the panel rim lifted by the muted text colour', () => {
      expect(viewportRule(['::-webkit-scrollbar'], 'width')).toBe('calc(var(--ui-scrollbar) * var(--ui-scale))');
      expect(viewportRule(['::-webkit-scrollbar-thumb'], 'background-color')).toBe('var(--scroll-thumb)');
      const thumb = viewportRule([], '--scroll-thumb');
      expect(thumb).toContain('var(--ui-text-muted) calc(var(--ui-scroll-thumb-alpha) * 100%)');
      expect(thumb).toContain('var(--ui-panel-rim)');
      expect(viewportRule(['::-webkit-scrollbar-track'], 'background-color')).toBe('var(--ui-well)');
    });

    it('takes the pointer on its viewport while it overflows, even under a host that lets the pointer through', () => {
      expect(rule(['[data-overflowing]', '.viewport'], 'pointer-events')).toBe('auto');
      expect(viewportRule([], 'pointer-events')).toBeNull();
    });

    it('rings its viewport inside on focus-visible', () => {
      expect(viewportRule([':focus-visible'], 'outline')).toBe('var(--ui-focus-ring) solid var(--ui-text)');
    });
  });
});
