import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostSelector, styleRuleValue } from '../../testing/style-rules';
import { focusableElementsIn } from './focus-trap-stack';
import { UiListRowComponent } from './ui-list-row.component';
import { UiListSectionComponent } from './ui-list-section.component';
import { UiListComponent } from './ui-list.component';

@Component({
  standalone: true,
  imports: [UiListComponent, UiListRowComponent, UiListSectionComponent],
  template: `
    <ui-list
      testId="list"
      [shouldSelectionFollowFocus]="isFollowing()"
      [(selectedId)]="selectedId"
      (activated)="activations.push($event + '@' + selectedId())"
    >
      <ui-list-section heading="Genome" testId="genome">
        <ui-list-row itemId="nucleoid" testId="nucleoid"><i uiLeading class="medallion"></i>Nucleoid Coil</ui-list-row>
        <ui-list-row itemId="envelope" testId="envelope" [isDisabled]="isEnvelopeDisabled()">
          Nuclear Envelope
        </ui-list-row>
      </ui-list-section>
      <ui-list-section heading="Metabolism" testId="metabolism">
        <ui-list-row itemId="mitochondrion" testId="mitochondrion">
          Mitochondrion<b uiTrailing class="tier">I</b>
        </ui-list-row>
        <ui-list-row itemId="chloroplast" testId="chloroplast">Chloroplast</ui-list-row>
      </ui-list-section>
    </ui-list>
    <ui-list testId="list-with-action" [(selectedId)]="actionListSelectedId">
      <ui-list-row itemId="cilia" testId="cilia">
        Cilia Fringe<button uiTrailing type="button" data-testid="row-action">Open</button>
      </ui-list-row>
    </ui-list>
  `,
})
class ListHostComponent {
  readonly isFollowing = signal(false);
  readonly selectedId = signal<string | null>('mitochondrion');
  readonly actionListSelectedId = signal<string | null>(null);
  readonly isEnvelopeDisabled = signal(false);
  /** Every `activated`, with the selection it saw (#622). */
  readonly activations: string[] = [];
}

describe('UiListComponent', () => {
  let fixture: ComponentFixture<ListHostComponent>;

  function byTestId(testId: string): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
  }

  function set(update: (host: ListHostComponent) => void): void {
    update(fixture.componentInstance);
    fixture.detectChanges();
  }

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
    TestBed.configureTestingModule({ imports: [ListHostComponent] });
    fixture = TestBed.createComponent(ListHostComponent);
    fixture.detectChanges();
  });

  it('is a listbox of options grouped under labelled sections', () => {
    expect(byTestId('list').getAttribute('role')).toBe('listbox');
    expect(byTestId('nucleoid').getAttribute('role')).toBe('option');
    const section = byTestId('genome');
    expect(section.getAttribute('role')).toBe('group');
    const header = section.querySelector(`#${section.getAttribute('aria-labelledby')}`);
    expect(header?.textContent?.trim()).toBe('Genome');
    expect(byTestId('mitochondrion').getAttribute('aria-selected')).toBe('true');
  });

  it('projects the leading and trailing slots around the title', () => {
    expect(byTestId('nucleoid').querySelector('.leading .medallion')).not.toBeNull();
    expect(byTestId('mitochondrion').querySelector('.trailing .tier')?.textContent).toBe('I');
    expect(byTestId('mitochondrion').querySelector('.label')?.textContent?.trim()).toBe('Mitochondrion');
  });

  it('is one Tab stop across every section, on the selected row', () => {
    expect(focusableElementsIn(byTestId('list'))).toEqual([byTestId('mitochondrion')]);
    set((host) => host.selectedId.set(null));
    expect(focusableElementsIn(byTestId('list'))).toEqual([byTestId('nucleoid')]);
  });

  it('by default ↓ ↑ move focus across sections without selecting, and Enter or Space selects', () => {
    focusOn('mitochondrion');
    expect(press('ArrowUp')).toBe(true);
    expect(document.activeElement).toBe(byTestId('envelope'));
    expect(fixture.componentInstance.selectedId()).toBe('mitochondrion');
    expect(byTestId('envelope').getAttribute('tabindex')).toBe('0');
    expect(press('Enter')).toBe(true);
    expect(fixture.componentInstance.selectedId()).toBe('envelope');
    press('ArrowUp');
    expect(press(' ')).toBe(true);
    expect(fixture.componentInstance.selectedId()).toBe('nucleoid');
  });

  it('reports a click or Enter as an activation before the selection moves, and a rove that selects never (#622)', () => {
    set((host) => host.isFollowing.set(true));
    byTestId('mitochondrion').click();
    fixture.detectChanges();
    focusOn('mitochondrion');
    press('ArrowDown');
    expect(fixture.componentInstance.selectedId()).toBe('chloroplast');
    press('Enter');
    byTestId('nucleoid').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.activations).toEqual([
      'mitochondrion@mitochondrion',
      'chloroplast@chloroplast',
      'nucleoid@chloroplast',
    ]);
  });

  it('with shouldSelectionFollowFocus selects as focus moves', () => {
    set((host) => host.isFollowing.set(true));
    focusOn('mitochondrion');
    press('ArrowDown');
    expect(document.activeElement).toBe(byTestId('chloroplast'));
    expect(fixture.componentInstance.selectedId()).toBe('chloroplast');
  });

  it('Home and End jump to the first and last row of the whole list, stopping at the ends', () => {
    focusOn('mitochondrion');
    press('Home');
    expect(document.activeElement).toBe(byTestId('nucleoid'));
    expect(press('ArrowUp')).toBe(true);
    expect(document.activeElement).toBe(byTestId('nucleoid'));
    press('End');
    expect(document.activeElement).toBe(byTestId('chloroplast'));
  });

  it('leaves every key pressed on a control inside a row to that control', () => {
    const action = byTestId('row-action');
    action.focus();
    for (const key of ['Enter', ' ', 'Home', 'End', 'ArrowDown', 'ArrowUp']) {
      expect(press(key), key).toBe(false);
    }
    expect(document.activeElement).toBe(action);
    expect(fixture.componentInstance.actionListSelectedId()).toBeNull();
    focusOn('cilia');
    expect(press('Enter')).toBe(true);
    expect(fixture.componentInstance.actionListSelectedId()).toBe('cilia');
  });

  it('leaves ← →, Escape and Tab to the page', () => {
    focusOn('mitochondrion');
    expect(press('ArrowLeft')).toBe(false);
    expect(press('ArrowRight')).toBe(false);
    expect(press('Escape')).toBe(false);
    expect(press('Tab')).toBe(false);
  });

  it('a click selects the row; a disabled row says so, is skipped and ignores the click', () => {
    byTestId('chloroplast').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedId()).toBe('chloroplast');
    set((host) => host.isEnvelopeDisabled.set(true));
    expect(byTestId('envelope').getAttribute('aria-disabled')).toBe('true');
    byTestId('envelope').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedId()).toBe('chloroplast');
    focusOn('mitochondrion');
    press('ArrowUp');
    expect(document.activeElement).toBe(byTestId('nucleoid'));
  });

  describe('the states table (docs/ui/components-and-constants.md §10.2)', () => {
    function rule(fragments: readonly string[], property: string): string | null {
      return styleRuleValue(document, [hostSelector(byTestId('nucleoid')), ...fragments], property);
    }

    it('rests in the text colour at the row height, its title ending in an ellipsis', () => {
      expect(rule([], 'height')).toBe('calc(var(--ui-row-height) * var(--ui-scale))');
      expect(rule([], 'color')).toBe('var(--ui-text)');
      // A rule inside the row is scoped by content attribute, not by the host.
      expect(styleRuleValue(document, ['.label'], 'text-overflow')).toBe('ellipsis');
    });

    it('hover and pressed lay their tints, never on a disabled row', () => {
      expect(rule([':hover', ":not([aria-disabled='true'])", '::after'], 'background-color')).toBe('var(--ui-hover)');
      expect(rule([':active', ":not([aria-disabled='true'])", '::after'], 'background-color')).toBe(
        'var(--ui-pressed)',
      );
    });

    it('selected takes the selected tint, the bar and bold; focus-visible the inset ring; disabled the fade', () => {
      expect(rule(["[aria-selected='true']"], 'background-color')).toBe('var(--ui-selected)');
      expect(rule(["[aria-selected='true']"], 'font-weight')).toBe('bold');
      expect(rule(["[aria-selected='true']", '::before'], 'opacity')).toBe('1');
      expect(rule([':focus-visible'], 'outline')).toBe('var(--ui-focus-ring) solid var(--ui-text)');
      expect(rule(["[aria-disabled='true']"], 'opacity')).toBe('var(--ui-disabled-alpha)');
    });

    it('a section header is a tracked uppercase label', () => {
      const header = ['.header'];
      expect(styleRuleValue(document, header, 'font-size')).toBe('calc(var(--ui-type-label) * var(--ui-scale))');
      expect(styleRuleValue(document, header, 'text-transform')).toBe('uppercase');
      expect(styleRuleValue(document, header, 'letter-spacing')).toBe('var(--ui-label-tracking)');
    });
  });
});
