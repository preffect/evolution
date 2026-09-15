import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FocusTrapStack } from './focus-trap-stack';
import { UiAutofocusDirective, UiFocusTrapDirective } from './ui-focus-trap.directive';

@Component({
  standalone: true,
  imports: [UiFocusTrapDirective, UiAutofocusDirective],
  template: `
    <button data-testid="opener">Open</button>
    <button data-testid="elsewhere">Elsewhere</button>
    @if (isOuterOpen()) {
      <section uiFocusTrap [restoreTo]="restoreTo()" data-testid="outer">
        <button data-testid="outer-first">First</button>
        <button uiAutofocus data-testid="outer-autofocus">Autofocus</button>
        <button data-testid="outer-last">Last</button>
        @if (isInnerOpen()) {
          <section uiFocusTrap data-testid="inner">
            <button data-testid="inner-first">Stay</button>
            <button data-testid="inner-last">Leave</button>
          </section>
        }
      </section>
    }
    @if (isSiblingOpen()) {
      <section uiFocusTrap data-testid="sibling">
        <button data-testid="sibling-only">Only</button>
      </section>
    }
    @if (isEmptyOpen()) {
      <section uiFocusTrap data-testid="empty"><p>Nothing to press</p></section>
    }
  `,
})
class TrapHostComponent {
  readonly isOuterOpen = signal(false);
  readonly isInnerOpen = signal(false);
  readonly isSiblingOpen = signal(false);
  readonly isEmptyOpen = signal(false);
  readonly restoreTo = signal<HTMLElement | null>(null);
}

describe('UiFocusTrapDirective', () => {
  let fixture: ComponentFixture<TrapHostComponent>;

  function byTestId(testId: string): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
  }

  function set(update: (host: TrapHostComponent) => void): void {
    update(fixture.componentInstance);
    fixture.detectChanges();
  }

  /** Presses Tab where focus is; true when the trap took the key (the browser's own move was prevented). */
  function pressTab(isBackward = false): boolean {
    const target = document.activeElement ?? document.body;
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: isBackward, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TrapHostComponent] });
    fixture = TestBed.createComponent(TrapHostComponent);
    fixture.detectChanges();
    byTestId('opener').focus();
  });

  it('focuses the [uiAutofocus] element on open', () => {
    set((host) => host.isOuterOpen.set(true));
    expect(document.activeElement).toBe(byTestId('outer-autofocus'));
  });

  it('wraps Tab from the last stop to the first, and Shift+Tab from the first to the last', () => {
    set((host) => host.isOuterOpen.set(true));
    byTestId('outer-last').focus();
    expect(pressTab()).toBe(true);
    expect(document.activeElement).toBe(byTestId('outer-first'));
    expect(pressTab(true)).toBe(true);
    expect(document.activeElement).toBe(byTestId('outer-last'));
  });

  it('leaves Tab between inner stops to the browser', () => {
    set((host) => host.isOuterOpen.set(true));
    byTestId('outer-first').focus();
    expect(pressTab()).toBe(false);
    expect(pressTab(true)).toBe(true);
  });

  it('ignores every other key', () => {
    set((host) => host.isOuterOpen.set(true));
    byTestId('outer-last').focus();
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    byTestId('outer-last').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('restores focus to the element that opened it when it closes', () => {
    set((host) => host.isOuterOpen.set(true));
    set((host) => host.isOuterOpen.set(false));
    expect(document.activeElement).toBe(byTestId('opener'));
  });

  it('restores focus to restoreTo when one is given', () => {
    set((host) => {
      host.restoreTo.set(byTestId('elsewhere'));
      host.isOuterOpen.set(true);
    });
    set((host) => host.isOuterOpen.set(false));
    expect(document.activeElement).toBe(byTestId('elsewhere'));
  });

  describe('a trap over a trap', () => {
    beforeEach(() => {
      set((host) => host.isOuterOpen.set(true));
      byTestId('outer-last').focus();
      set((host) => host.isInnerOpen.set(true));
    });

    it('moves focus into the top trap, which alone handles Tab', () => {
      const stack = TestBed.inject(FocusTrapStack);
      expect(document.activeElement).toBe(byTestId('inner-first'));
      expect(stack.topmost()?.host).toBe(byTestId('inner'));
      byTestId('inner-last').focus();
      expect(pressTab()).toBe(true);
      // The outer trap saw the same keydown bubble past it and let the inner one decide.
      expect(document.activeElement).toBe(byTestId('inner-first'));
    });

    it('restores focus in order: the inner trap to the outer, the outer to the page', () => {
      set((host) => host.isInnerOpen.set(false));
      expect(document.activeElement).toBe(byTestId('outer-last'));
      expect(TestBed.inject(FocusTrapStack).topmost()?.host).toBe(byTestId('outer'));
      byTestId('outer-last').focus();
      expect(pressTab()).toBe(true);
      set((host) => host.isOuterOpen.set(false));
      expect(document.activeElement).toBe(byTestId('opener'));
      expect(TestBed.inject(FocusTrapStack).topmost()).toBeNull();
    });
  });

  it('closing a trap under another leaves focus in the top one', () => {
    set((host) => host.isOuterOpen.set(true));
    set((host) => host.isSiblingOpen.set(true));
    expect(document.activeElement).toBe(byTestId('sibling-only'));
    set((host) => host.isOuterOpen.set(false));
    expect(document.activeElement).toBe(byTestId('sibling-only'));
  });

  it('hands focus into the trap now on top when its return target lies outside that trap', () => {
    set((host) => host.isSiblingOpen.set(true));
    set((host) => {
      host.restoreTo.set(byTestId('elsewhere'));
      host.isOuterOpen.set(true);
    });
    expect(document.activeElement).toBe(byTestId('outer-autofocus'));
    // `elsewhere` sits under the sibling trap still open, so focus goes into that trap instead.
    set((host) => host.isOuterOpen.set(false));
    expect(document.activeElement).toBe(byTestId('sibling-only'));
    expect(TestBed.inject(FocusTrapStack).topmost()?.host).toBe(byTestId('sibling'));
  });

  describe('focus that leaves the host on its own', () => {
    /** The trap pulls focus back a microtask after `focusout`, once the browser has applied the new focus. */
    const focusSettles = (): Promise<void> => Promise.resolve();

    it('comes back when a click drops it on the page: the scrim takes the pointer but no focus', async () => {
      set((host) => host.isOuterOpen.set(true));
      byTestId('outer-last').focus();
      byTestId('outer-last').blur();
      await focusSettles();
      expect(document.activeElement).toBe(byTestId('outer-last'));
      // …so the next Tab is still the trap's to handle, and cannot reach the page behind the modal.
      expect(pressTab()).toBe(true);
      expect(document.activeElement).toBe(byTestId('outer-first'));
    });

    it('comes back when something outside takes it', async () => {
      set((host) => host.isOuterOpen.set(true));
      byTestId('elsewhere').focus();
      await focusSettles();
      expect(byTestId('outer').contains(document.activeElement)).toBe(true);
    });

    it('is left alone by a trap that is not on top', async () => {
      set((host) => host.isOuterOpen.set(true));
      set((host) => host.isSiblingOpen.set(true));
      expect(document.activeElement).toBe(byTestId('sibling-only'));
      byTestId('outer-first').dispatchEvent(
        new FocusEvent('focusout', { relatedTarget: byTestId('elsewhere'), bubbles: true }),
      );
      await focusSettles();
      expect(document.activeElement).toBe(byTestId('sibling-only'));
    });

    it('stays put when focus moves between two stops inside the trap', async () => {
      set((host) => host.isOuterOpen.set(true));
      byTestId('outer-last').focus();
      await focusSettles();
      expect(document.activeElement).toBe(byTestId('outer-last'));
    });
  });

  it('holds focus on the host of a trap with nothing focusable, and keeps Tab inside', () => {
    set((host) => host.isEmptyOpen.set(true));
    expect(document.activeElement).toBe(byTestId('empty'));
    expect(byTestId('empty').tabIndex).toBe(-1);
    expect(pressTab()).toBe(true);
    expect(document.activeElement).toBe(byTestId('empty'));
  });
});
