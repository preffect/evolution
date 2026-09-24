// The effect mark (docs/ui/components-and-constants.md §10.2, #453): a `UI_EFFECT_MARK_PX` triangle before a trait
// modifier's value, pointing up in `GAIN` for a benefit and down in `DANGER` for a drawback. The value beside it stays
// in the text colour: a cue role colours glyphs, never text (principles-and-palette.md §2), and the shape carries the
// effect on its own, since under deuteranopia the two roles are two similar yellows. The value's words already say
// what it is to assistive technology, so the mark is hidden from it, like the mass trend's triangle. With no effect
// it draws nothing.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export const UI_EFFECT = { benefit: 'benefit', drawback: 'drawback' } as const;
export type UiEffect = (typeof UI_EFFECT)[keyof typeof UI_EFFECT];

@Component({
  selector: 'ui-effect-mark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 10 10" focusable="false"><polygon points="5,0 10,10 0,10" fill="currentColor" /></svg>
  `,
  host: { 'aria-hidden': 'true', '[attr.data-effect]': 'effect()' },
  styles: [
    `
      :host {
        display: inline-block;
        flex: none;
        width: calc(var(--ui-effect-mark) * var(--ui-scale));
        height: calc(var(--ui-effect-mark) * var(--ui-scale));
        margin-inline-end: calc(var(--ui-space-xs) * var(--ui-scale));
        color: var(--ui-gain);
      }

      svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      :host(:not([data-effect])) {
        display: none;
      }

      :host([data-effect='drawback']) {
        color: var(--ui-danger);
        transform: rotate(0.5turn);
      }
    `,
  ],
})
export class UiEffectMarkComponent {
  /** `null` draws nothing, so a caller whose value may have no effect to mark needs no branch of its own. */
  readonly effect = input.required<UiEffect | null>();
}
