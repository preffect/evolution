import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostSelector, styleRuleValue } from '../../testing/style-rules';
import { UiSearchFieldComponent } from './ui-search-field.component';

@Component({
  standalone: true,
  imports: [UiSearchFieldComponent],
  template: `
    <div tabindex="-1" (keydown)="keysPastTheField.push($event.key)">
      <ui-search-field testId="search" placeholder="Search" [keyHint]="keyHint()" [(query)]="query" />
    </div>
  `,
})
class SearchHostComponent {
  readonly query = signal('');
  readonly keyHint = signal<string | null>('/');
  readonly keysPastTheField: string[] = [];
}

describe('UiSearchFieldComponent', () => {
  let fixture: ComponentFixture<SearchHostComponent>;

  function input(): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[data-testid="search"]')!;
  }

  function type(text: string): void {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function pressEscape(): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    input().dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SearchHostComponent] });
    fixture = TestBed.createComponent(SearchHostComponent);
    fixture.detectChanges();
  });

  it('is a native search input named by its placeholder, carrying the feature’s test id', () => {
    expect(input().tagName).toBe('INPUT');
    expect(input().type).toBe('search');
    expect(input().getAttribute('placeholder')).toBe('Search');
    expect(input().getAttribute('aria-label')).toBe('Search');
  });

  it('shows its key hint and announces the shortcut, and neither without one', () => {
    const field = (fixture.nativeElement as HTMLElement).querySelector('ui-search-field')!;
    expect(field.querySelector('ui-key-hint')?.textContent?.trim()).toBe('/');
    expect(input().getAttribute('aria-keyshortcuts')).toBe('/');
    fixture.componentInstance.keyHint.set(null);
    fixture.detectChanges();
    expect(field.querySelector('ui-key-hint')).toBeNull();
    expect(input().hasAttribute('aria-keyshortcuts')).toBe(false);
  });

  it('typing updates the query, and a query set by the feature shows in the field', () => {
    type('mito');
    expect(fixture.componentInstance.query()).toBe('mito');
    fixture.componentInstance.query.set('cilia');
    fixture.detectChanges();
    expect(input().value).toBe('cilia');
  });

  it('Escape clears a non-empty query and stops there', () => {
    type('mito');
    const event = pressEscape();
    expect(fixture.componentInstance.query()).toBe('');
    expect(input().value).toBe('');
    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.keysPastTheField).toEqual([]);
  });

  it('Escape on an empty query passes through to whoever closes', () => {
    const event = pressEscape();
    expect(event.defaultPrevented).toBe(false);
    expect(fixture.componentInstance.keysPastTheField).toEqual(['Escape']);
  });

  it('other keys reach the page as usual', () => {
    type('mito');
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(fixture.componentInstance.keysPastTheField).toEqual(['Enter']);
    expect(fixture.componentInstance.query()).toBe('mito');
  });

  describe('the states table (docs/ui/components-and-constants.md §10.2)', () => {
    function rule(fragments: readonly string[], property: string): string | null {
      const host = (fixture.nativeElement as HTMLElement).querySelector('ui-search-field')!;
      return styleRuleValue(document, [hostSelector(host), ...fragments], property);
    }

    it('rests on the well with a panel-rim rim at the search size', () => {
      expect(rule([], 'background-color')).toBe('var(--ui-well)');
      expect(rule([], 'border')).toContain('var(--ui-panel-rim)');
      expect(rule([], 'width')).toBe('calc(var(--ui-search-width) * var(--ui-scale))');
      expect(rule([], 'height')).toBe('calc(var(--ui-search-height) * var(--ui-scale))');
      // A rule inside the field is scoped by content attribute, not by the host.
      expect(styleRuleValue(document, ['.input', '::placeholder'], 'color')).toBe('var(--ui-text-muted)');
    });

    it('hover lays the hover tint over the well', () => {
      expect(rule([':hover'], 'background-image')).toContain('var(--ui-hover)');
    });

    it('draws the unscaled ring outside the field while its input shows focus', () => {
      expect(rule([':has(.input:focus-visible)'], 'outline')).toBe('var(--ui-focus-ring) solid var(--ui-text)');
      expect(rule([':has(.input:focus-visible)'], 'outline-offset')).toBe('var(--ui-focus-ring-offset)');
      expect(styleRuleValue(document, ['.input'], 'outline')).toBe('none');
    });
  });
});
