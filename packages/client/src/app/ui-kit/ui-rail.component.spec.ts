import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostSelector, styleRuleValue } from '../../testing/style-rules';
import { focusableElementsIn } from './focus-trap-stack';
import { UI_ORIENTATION, type UiOrientation } from './roving-group';
import { UiRailItemComponent } from './ui-rail-item.component';
import { UiRailComponent } from './ui-rail.component';

@Component({
  standalone: true,
  imports: [UiRailComponent, UiRailItemComponent],
  template: `
    <ui-rail testId="rail" [orientation]="orientation()" [(selectedId)]="selectedId">
      <ui-rail-item itemId="basics" testId="basics" [count]="13"><i uiLeading class="icon"></i>Basics</ui-rail-item>
      <ui-rail-item itemId="cells" testId="cells" [isDisabled]="isCellsDisabled()">Cells &amp; food</ui-rail-item>
      <ui-rail-item itemId="evolution" testId="evolution" [count]="28">Evolution</ui-rail-item>
      <ui-rail-item itemId="world" testId="world">World</ui-rail-item>
    </ui-rail>
  `,
})
class RailHostComponent {
  readonly orientation = signal<UiOrientation>(UI_ORIENTATION.vertical);
  readonly selectedId = signal<string | null>('evolution');
  readonly isCellsDisabled = signal(false);
}

describe('UiRailComponent', () => {
  let fixture: ComponentFixture<RailHostComponent>;

  function byTestId(testId: string): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
  }

  function set(update: (host: RailHostComponent) => void): void {
    update(fixture.componentInstance);
    fixture.detectChanges();
  }

  /** Presses `key` on the focused item, as the browser would, and answers whether the rail consumed it. */
  function press(key: string): boolean {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    (document.activeElement as HTMLElement).dispatchEvent(event);
    fixture.detectChanges();
    return event.defaultPrevented;
  }

  function focusOn(testId: string): void {
    byTestId(testId).focus();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RailHostComponent] });
    fixture = TestBed.createComponent(RailHostComponent);
    fixture.detectChanges();
  });

  it('is a vertical tablist of tabs, the selected one marked', () => {
    expect(byTestId('rail').getAttribute('role')).toBe('tablist');
    expect(byTestId('rail').getAttribute('aria-orientation')).toBe('vertical');
    expect(byTestId('evolution').getAttribute('role')).toBe('tab');
    expect(byTestId('evolution').getAttribute('aria-selected')).toBe('true');
    expect(byTestId('basics').getAttribute('aria-selected')).toBe('false');
  });

  it('projects the leading icon, the label and the count', () => {
    expect(byTestId('basics').querySelector('.leading .icon')).not.toBeNull();
    expect(byTestId('basics').querySelector('.label')?.textContent?.trim()).toBe('Basics');
    expect(byTestId('basics').querySelector('.count')?.textContent?.trim()).toBe('13');
    expect(byTestId('world').querySelector('.count')).toBeNull();
  });

  it('is one Tab stop, on the selected item, or the first enabled item with no selection', () => {
    expect(focusableElementsIn(byTestId('rail'))).toEqual([byTestId('evolution')]);
    set((host) => host.selectedId.set(null));
    expect(focusableElementsIn(byTestId('rail'))).toEqual([byTestId('basics')]);
  });

  it('↓ and ↑ move focus and the selection follows it', () => {
    focusOn('evolution');
    expect(press('ArrowDown')).toBe(true);
    expect(document.activeElement).toBe(byTestId('world'));
    expect(fixture.componentInstance.selectedId()).toBe('world');
    expect(byTestId('world').getAttribute('tabindex')).toBe('0');
    expect(byTestId('evolution').getAttribute('tabindex')).toBe('-1');
    press('ArrowUp');
    expect(fixture.componentInstance.selectedId()).toBe('evolution');
  });

  it('stops at either end rather than wrapping, still consuming the arrow', () => {
    focusOn('world');
    expect(press('ArrowDown')).toBe(true);
    expect(document.activeElement).toBe(byTestId('world'));
  });

  it('Home and End jump to the first and last item', () => {
    focusOn('evolution');
    press('Home');
    expect(document.activeElement).toBe(byTestId('basics'));
    press('End');
    expect(document.activeElement).toBe(byTestId('world'));
    expect(fixture.componentInstance.selectedId()).toBe('world');
  });

  it('leaves ← → to the page when vertical, so a feature can move between columns', () => {
    focusOn('evolution');
    expect(press('ArrowLeft')).toBe(false);
    expect(press('ArrowRight')).toBe(false);
    expect(press('Escape')).toBe(false);
    expect(document.activeElement).toBe(byTestId('evolution'));
  });

  it('when horizontal moves with ← → and leaves ↑ ↓ alone', () => {
    set((host) => host.orientation.set(UI_ORIENTATION.horizontal));
    expect(byTestId('rail').getAttribute('aria-orientation')).toBe('horizontal');
    expect(byTestId('basics').dataset['orientation']).toBe('horizontal');
    focusOn('evolution');
    expect(press('ArrowDown')).toBe(false);
    press('ArrowRight');
    expect(fixture.componentInstance.selectedId()).toBe('world');
    press('ArrowLeft');
    expect(fixture.componentInstance.selectedId()).toBe('evolution');
  });

  it('Enter and Space select the focused item', () => {
    set((host) => host.selectedId.set(null));
    focusOn('basics');
    expect(press('Enter')).toBe(true);
    expect(fixture.componentInstance.selectedId()).toBe('basics');
    set((host) => host.selectedId.set(null));
    focusOn('basics');
    expect(press(' ')).toBe(true);
    expect(fixture.componentInstance.selectedId()).toBe('basics');
  });

  it('a click selects the item', () => {
    byTestId('basics').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedId()).toBe('basics');
    expect(byTestId('basics').getAttribute('tabindex')).toBe('0');
  });

  it('a disabled item says so, is skipped by the arrows, never takes the Tab stop and ignores a click', () => {
    set((host) => {
      host.isCellsDisabled.set(true);
      host.selectedId.set('basics');
    });
    expect(byTestId('cells').getAttribute('aria-disabled')).toBe('true');
    expect(byTestId('basics').hasAttribute('aria-disabled')).toBe(false);
    focusOn('basics');
    press('ArrowDown');
    expect(document.activeElement).toBe(byTestId('evolution'));
    byTestId('cells').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedId()).toBe('evolution');
    expect(byTestId('cells').getAttribute('tabindex')).toBe('-1');
  });

  it('a selection changed by the feature moves the Tab stop with it', () => {
    focusOn('evolution');
    set((host) => host.selectedId.set('basics'));
    expect(byTestId('basics').getAttribute('tabindex')).toBe('0');
    expect(byTestId('evolution').getAttribute('tabindex')).toBe('-1');
  });

  describe('the states table (docs/ui/components-and-constants.md §10.2)', () => {
    function rule(fragments: readonly string[], property: string, media: string | null = null): string | null {
      return styleRuleValue(document, [hostSelector(byTestId('basics')), ...fragments], property, media);
    }

    /** A rule on an element inside the item: Angular scopes it by content attribute, not by the host. */
    function contentRule(fragments: readonly string[], property: string): string | null {
      return styleRuleValue(document, fragments, property);
    }

    it('rests in the label colour at the rail row height, its count muted', () => {
      expect(rule([], 'height')).toBe('calc(var(--ui-rail-row-height) * var(--ui-scale))');
      expect(rule([], 'color')).toBe('var(--ui-text-label)');
      expect(contentRule(['.count'], 'color')).toBe('var(--ui-text-muted)');
      expect(contentRule(['.count'], 'font-family')).toBe('var(--ui-font-mono)');
    });

    it('hover lays the hover tint and lifts the label to the text colour, never on a disabled item', () => {
      expect(rule([':hover', ":not([aria-disabled='true'])", '::after'], 'background-color')).toBe('var(--ui-hover)');
      expect(rule([':hover', ":not([aria-disabled='true'])"], 'color')).toBe('var(--ui-text)');
      expect(rule([':hover', ":not([aria-disabled='true'])", '.count'], 'color')).toBe('var(--ui-text-label)');
    });

    it('pressed lays the pressed tint instead', () => {
      expect(rule([':active', ":not([aria-disabled='true'])", '::after'], 'background-color')).toBe(
        'var(--ui-pressed)',
      );
    });

    it('selected takes the selected tint, the accent bar, the text colour and bold, its count the label colour', () => {
      expect(rule(["[aria-selected='true']"], 'background-color')).toBe('var(--ui-selected)');
      expect(rule(["[aria-selected='true']"], 'color')).toBe('var(--ui-text)');
      expect(rule(["[aria-selected='true']"], 'font-weight')).toBe('bold');
      expect(rule(["[aria-selected='true']", '::before'], 'opacity')).toBe('1');
      expect(rule(['::before'], 'background-color')).toBe('var(--ui-accent)');
      expect(rule(["[aria-selected='true']", '.count'], 'color')).toBe('var(--ui-text-label)');
    });

    it('focus-visible alone draws the unscaled ring, inside the item where a scroll area cannot clip it', () => {
      expect(rule([':focus-visible'], 'outline')).toBe('var(--ui-focus-ring) solid var(--ui-text)');
      expect(rule([':focus-visible'], 'outline-offset')).toBe(
        'calc(-1 * (var(--ui-focus-ring) + var(--ui-focus-ring-offset)))',
      );
      expect(rule([], 'outline')).toBe('none');
    });

    it('disabled fades to the disabled alpha', () => {
      expect(rule(["[aria-disabled='true']"], 'opacity')).toBe('var(--ui-disabled-alpha)');
    });

    it('a horizontal item moves its bar to the bottom edge', () => {
      expect(rule(["[data-orientation='horizontal']", '::before'], 'height')).toBe(
        'calc(var(--ui-selection-bar) * var(--ui-scale))',
      );
      expect(rule(["[data-orientation='horizontal']", '::before'], 'top')).toBe('auto');
    });

    it('fades between states, and not at all under reduced motion', () => {
      expect(rule([], 'transition')).toContain('var(--ui-transition)');
      expect(rule([], 'transition', 'prefers-reduced-motion')).toBe('none');
    });
  });
});
