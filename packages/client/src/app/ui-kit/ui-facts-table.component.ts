// The kit's facts table (docs/ui/components-and-constants.md §10.2): a real `<table>` of named values. Each row may
// lead with a marker, a dot or ring in a colour role, or whatever a feature's `ng-template[uiFactMarker]` draws (a
// trait glyph at `TRAIT_GLYPH_LIST_PX`); the marker column is as wide as its content. With `columns` it grows a
// header row and one column may be highlighted in the accent (the owned tier). A feature's
// `ng-template[uiFactValue]` draws a value that is more than text (a link).

import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChild,
  inject,
  input,
} from '@angular/core';

export const UI_FACT_MARKER_SHAPE = { dot: 'dot', ring: 'ring' } as const;
export type UiFactMarkerShape = (typeof UI_FACT_MARKER_SHAPE)[keyof typeof UI_FACT_MARKER_SHAPE];

export interface UiFactMarker {
  readonly shape: UiFactMarkerShape;
  /** A colour role's value (`GAIN`, a zone's tint), never a literal. */
  readonly colour: string;
}

export interface UiFactRow {
  readonly rowId: string;
  readonly name: string;
  /** One value, or one per column. */
  readonly values: readonly string[];
  readonly marker?: UiFactMarker | null;
}

export interface UiFactMarkerContext {
  readonly $implicit: UiFactRow;
}

export interface UiFactValueContext {
  readonly $implicit: UiFactRow;
  readonly value: string;
  readonly columnIndex: number;
}

/** A row's marker drawn by the feature: `<ng-template uiFactMarker let-row>`. */
@Directive({ selector: 'ng-template[uiFactMarker]', standalone: true })
export class UiFactMarkerDirective {
  readonly template = inject<TemplateRef<UiFactMarkerContext>>(TemplateRef);
}

/** A value drawn by the feature: `<ng-template uiFactValue let-row let-value="value">`. */
@Directive({ selector: 'ng-template[uiFactValue]', standalone: true })
export class UiFactValueDirective {
  readonly template = inject<TemplateRef<UiFactValueContext>>(TemplateRef);
}

@Component({
  selector: 'ui-facts-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  template: `
    <table class="table" [attr.data-testid]="testId()">
      @if (hasHeader()) {
        <thead>
          <tr>
            @if (hasMarkers()) {
              <td class="marker"></td>
            }
            <th class="name" scope="col">{{ columnsCaption() }}</th>
            @for (column of columns(); track $index) {
              <th class="value" scope="col" [attr.data-highlighted]="isHighlighted($index) || null">{{ column }}</th>
            }
          </tr>
        </thead>
      }
      <tbody>
        @for (row of rows(); track row.rowId) {
          <tr [attr.data-row-id]="row.rowId">
            @if (hasMarkers()) {
              <td class="marker">
                @if (markerSlot(); as slot) {
                  <ng-container *ngTemplateOutlet="slot.template; context: { $implicit: row }" />
                } @else if (row.marker; as marker) {
                  <span
                    class="mark"
                    aria-hidden="true"
                    [attr.data-shape]="marker.shape"
                    [style.color]="marker.colour"
                  ></span>
                }
              </td>
            }
            <th class="name" scope="row">{{ row.name }}</th>
            @for (value of row.values; track $index) {
              <td class="value" [attr.data-highlighted]="isHighlighted($index) || null">
                @if (valueSlot(); as slot) {
                  <ng-container
                    *ngTemplateOutlet="slot.template; context: { $implicit: row, value: value, columnIndex: $index }"
                  />
                } @else {
                  {{ value }}
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
  styleUrl: './ui-facts-table.component.css',
})
export class UiFactsTableComponent {
  readonly rows = input.required<readonly UiFactRow[]>();
  /** The header labels of the value columns; none draws no header row. */
  readonly columns = input<readonly string[]>([]);
  /** The header cell over the names (`You own I`). */
  readonly columnsCaption = input('');
  /** The value column tinted in the accent, by index. */
  readonly highlightColumn = input<number | null>(null);
  readonly testId = input<string | null>(null);

  protected readonly markerSlot = contentChild(UiFactMarkerDirective);
  protected readonly valueSlot = contentChild(UiFactValueDirective);

  protected readonly hasHeader = computed(() => this.columns().length > 0);
  protected readonly hasMarkers = computed(
    () => this.markerSlot() !== undefined || this.rows().some((row) => row.marker),
  );

  protected isHighlighted(columnIndex: number): boolean {
    return this.highlightColumn() === columnIndex;
  }
}
