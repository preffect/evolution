// The kit's search field (docs/ui/components-and-constants.md §10.2): a native `input type="search"` on the well with
// a search icon and a key hint. Escape clears a non-empty query and stops there, so the press never also closes the
// overlay around it; on an empty query Escape passes through to whoever closes. The field only edits `query`: what
// matches is the feature's.

import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { UiKeyHintComponent } from './ui-key-hint.component';

/** The search icon's own drawing, in units of its viewBox (the CSS sizes the box): a lens and its handle. */
const SEARCH_ICON_VIEWBOX_SIZE = 16;
const SEARCH_ICON_LENS_CENTRE = 7;
const SEARCH_ICON_LENS_RADIUS = 4.5;
const SEARCH_ICON_HANDLE_START = 10.5;
const SEARCH_ICON_HANDLE_END = 14;
const SEARCH_ICON_STROKE = 1.5;

const SEARCH_ICON = {
  viewBox: `0 0 ${SEARCH_ICON_VIEWBOX_SIZE} ${SEARCH_ICON_VIEWBOX_SIZE}`,
  lensCentre: SEARCH_ICON_LENS_CENTRE,
  lensRadius: SEARCH_ICON_LENS_RADIUS,
  handle: `M${SEARCH_ICON_HANDLE_START} ${SEARCH_ICON_HANDLE_START} L${SEARCH_ICON_HANDLE_END} ${SEARCH_ICON_HANDLE_END}`,
  stroke: SEARCH_ICON_STROKE,
} as const;

@Component({
  selector: 'ui-search-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiKeyHintComponent],
  template: `
    <svg
      class="icon"
      aria-hidden="true"
      focusable="false"
      [attr.viewBox]="icon.viewBox"
      [attr.stroke-width]="icon.stroke"
    >
      <circle [attr.cx]="icon.lensCentre" [attr.cy]="icon.lensCentre" [attr.r]="icon.lensRadius" />
      <path [attr.d]="icon.handle" />
    </svg>
    <input
      class="input"
      type="search"
      autocomplete="off"
      spellcheck="false"
      [value]="query()"
      [attr.placeholder]="placeholder()"
      [attr.aria-label]="placeholder()"
      [attr.aria-keyshortcuts]="keyHint()"
      [attr.data-testid]="testId()"
      (input)="handleInput($event)"
      (keydown.escape)="handleEscape($event)"
    />
    @if (keyHint(); as key) {
      <ui-key-hint [key]="key" />
    }
  `,
  // The host is the field's box; the ring is drawn on it, outside, while the input inside shows focus.
  styles: [
    `
      :host {
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        gap: calc(var(--ui-space-s) * var(--ui-scale));
        width: calc(var(--ui-search-width) * var(--ui-scale));
        height: calc(var(--ui-search-height) * var(--ui-scale));
        padding: 0 calc(var(--ui-space-s) * var(--ui-scale));
        border: calc(var(--ui-rim) * var(--ui-scale)) solid var(--ui-panel-rim);
        border-radius: calc(var(--ui-radius-control) * var(--ui-scale));
        background-color: var(--ui-well);
        color: var(--ui-text-label);
        cursor: text;
      }

      :host(:hover) {
        background-image: linear-gradient(var(--ui-hover), var(--ui-hover));
      }

      :host(:has(.input:focus-visible)) {
        outline: var(--ui-focus-ring) solid var(--ui-text);
        outline-offset: var(--ui-focus-ring-offset);
      }

      .icon {
        flex: none;
        width: calc(var(--ui-space-l) * var(--ui-scale));
        height: calc(var(--ui-space-l) * var(--ui-scale));
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
      }

      .input {
        flex: 1 1 auto;
        min-width: 0;
        height: 100%;
        margin: 0;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--ui-text);
        font-family: var(--ui-font-sans);
        font-size: calc(var(--ui-type-body) * var(--ui-scale));
        outline: none;
        appearance: none;
      }

      .input::placeholder {
        color: var(--ui-text-muted);
      }

      .input::-webkit-search-cancel-button,
      .input::-webkit-search-decoration {
        appearance: none;
      }
    `,
  ],
})
export class UiSearchFieldComponent {
  readonly query = model('');
  readonly placeholder = input('');
  /** The key that focuses the field, named as `KeyboardEvent.key` names it; the feature binds it. */
  readonly keyHint = input<string | null>(null);
  readonly testId = input<string | null>(null);

  protected readonly icon = SEARCH_ICON;

  protected handleInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected handleEscape(event: Event): void {
    if (this.query() === '') return;
    event.preventDefault();
    event.stopPropagation();
    this.query.set('');
  }
}
