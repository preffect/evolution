import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostSelector, styleRuleValue } from '../../testing/style-rules';
import {
  UI_FACT_MARKER_SHAPE,
  UiFactMarkerDirective,
  UiFactValueDirective,
  UiFactsTableComponent,
  type UiFactRow,
} from './ui-facts-table.component';

const MARKED_ROWS: readonly UiFactRow[] = [
  { rowId: 'food', name: 'Food', values: ['+1.1/s'], marker: { shape: UI_FACT_MARKER_SHAPE.dot, colour: '#8dff6a' } },
  {
    rowId: 'toxin',
    name: 'Toxin',
    values: ['−9.4/s'],
    marker: { shape: UI_FACT_MARKER_SHAPE.ring, colour: '#ff5470' },
  },
];

const TIER_ROWS: readonly UiFactRow[] = [
  { rowId: 'decay', name: 'Mass decay', values: ['−15 %', '−30 %', '−45 %'] },
  { rowId: 'sprint', name: 'Sprint speed', values: ['+10 %', '+20 %', '+30 %'] },
];

@Component({
  standalone: true,
  imports: [UiFactsTableComponent, UiFactMarkerDirective, UiFactValueDirective],
  template: `
    <ui-facts-table testId="marked" [rows]="markedRows" />
    <ui-facts-table
      testId="tiers"
      columnsCaption="You own I"
      [rows]="tierRows"
      [columns]="columns"
      [highlightColumn]="highlightColumn()"
    />
    <ui-facts-table testId="slotted" [rows]="tierRows">
      <ng-template uiFactMarker let-row><i class="glyph" [attr.data-for]="row.rowId"></i></ng-template>
      <ng-template uiFactValue let-row let-value="value" let-column="columnIndex">
        <a class="link" [attr.data-column]="column">{{ value }}</a>
      </ng-template>
    </ui-facts-table>
  `,
})
class FactsHostComponent {
  readonly markedRows = MARKED_ROWS;
  readonly tierRows = TIER_ROWS;
  readonly columns = ['I', 'II', 'III'];
  readonly highlightColumn = signal<number | null>(0);
}

describe('UiFactsTableComponent', () => {
  let fixture: ComponentFixture<FactsHostComponent>;

  function table(testId: string): HTMLTableElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLTableElement>(`[data-testid="${testId}"]`)!;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FactsHostComponent] });
    fixture = TestBed.createComponent(FactsHostComponent);
    fixture.detectChanges();
  });

  it('is a real table: a row per fact, its name a row header, its value beside it', () => {
    expect(table('marked').tagName).toBe('TABLE');
    const rows = table('marked').querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute('data-row-id')).toBe('food');
    const name = rows[0]?.querySelector('th');
    expect(name?.getAttribute('scope')).toBe('row');
    expect(name?.textContent?.trim()).toBe('Food');
    expect(rows[0]?.querySelector('.value')?.textContent?.trim()).toBe('+1.1/s');
    expect(table('marked').querySelector('thead')).toBeNull();
  });

  it('leads a row with its dot or ring marker in the colour given', () => {
    const marks = table('marked').querySelectorAll<HTMLElement>('.marker .mark');
    expect(marks[0]?.dataset['shape']).toBe('dot');
    expect(marks[1]?.dataset['shape']).toBe('ring');
    expect(marks[1]?.style.color).toBe('rgb(255, 84, 112)');
    expect(marks[0]?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws no marker column when no row has a marker', () => {
    expect(table('tiers').querySelector('.marker')).toBeNull();
  });

  it('with columns draws a header row and tints the highlighted column, header and cells', () => {
    const headers = Array.from(table('tiers').querySelectorAll('thead th'));
    expect(headers.map((header) => header.textContent?.trim())).toEqual(['You own I', 'I', 'II', 'III']);
    expect(headers.every((header) => header.getAttribute('scope') === 'col')).toBe(true);
    const highlighted = () =>
      Array.from(table('tiers').querySelectorAll('[data-highlighted]')).map((cell) => cell.textContent?.trim());
    expect(highlighted()).toEqual(['I', '−15 %', '+10 %']);
    fixture.componentInstance.highlightColumn.set(2);
    fixture.detectChanges();
    expect(highlighted()).toEqual(['III', '−45 %', '+30 %']);
    fixture.componentInstance.highlightColumn.set(null);
    fixture.detectChanges();
    expect(highlighted()).toEqual([]);
  });

  it('draws a feature’s marker and value templates in place of its own', () => {
    expect(table('slotted').querySelector('.marker .glyph')?.getAttribute('data-for')).toBe('decay');
    const links = Array.from(table('slotted').querySelectorAll('tbody tr:first-child .link'));
    expect(links.map((link) => [link.textContent?.trim(), link.getAttribute('data-column')])).toEqual([
      ['−15 %', '0'],
      ['−30 %', '1'],
      ['−45 %', '2'],
    ]);
  });

  describe('its stylesheet (docs/ui/components-and-constants.md §10.2)', () => {
    function rule(fragments: readonly string[], property: string): string | null {
      return styleRuleValue(document, [...fragments], property);
    }

    it('keeps the tokens’ row height and rule, names in the label colour, values in right-aligned figure', () => {
      expect(hostSelector(fixture.nativeElement.querySelector('ui-facts-table'))).toMatch(/_nghost/);
      expect(rule(['tr'], 'height')).toBe('calc(var(--ui-fact-row-height) * var(--ui-scale))');
      expect(rule(['tr'], 'border-bottom')).toContain('var(--ui-panel-rim)');
      expect(rule(['.name'], 'color')).toBe('var(--ui-text-label)');
      expect(rule(['.value'], 'font-family')).toBe('var(--ui-font-mono)');
      expect(rule(['.value'], 'text-align')).toBe('right');
    });

    it('sizes the marker column to its content with the name a small space after it', () => {
      expect(rule(['.marker'], 'width')).toBe('1%');
      expect(rule(['.marker'], 'padding-right')).toBe('calc(var(--ui-space-s) * var(--ui-scale))');
      expect(rule(['.mark'], 'width')).toBe('calc(var(--ui-row-marker) * var(--ui-scale))');
      expect(rule(['.mark', "[data-shape='ring']"], 'border')).toContain('var(--ui-row-marker-ring)');
    });

    it('inside a panel section leaves the last row unruled, since the section rule follows it', () => {
      const host = hostSelector(fixture.nativeElement.querySelector('ui-facts-table'));
      const parts = ['ui-panel-section', host, 'tbody', 'tr', ':last-child'];
      expect(styleRuleValue(document, parts, 'border-bottom-style')).toBe('none');
    });

    it('sets the caption over the names in the muted colour at normal weight, as layout B draws it', () => {
      expect(rule(['thead', '.name'], 'color')).toBe('var(--ui-text-muted)');
      expect(rule(['thead', '.name'], 'font-weight')).toBe('normal');
    });

    it('tints the highlighted column with the selected tint and its header in the accent', () => {
      expect(rule(['.value', '[data-highlighted]'], 'background-color')).toBe('var(--ui-selected)');
      expect(rule(['thead', '.value', '[data-highlighted]'], 'color')).toBe('var(--ui-accent)');
    });
  });
});
