// **Activating pushes, roving replaces** (docs/ui/encyclopedia.md §11.5), and the kit reports both the same way. This
// directive is the one seam that tells them apart, worn by the rail and by the list — the two roving groups whose
// selection follows focus.
//
// The problem it solves. `UiRovingGroup.select` writes a signal, so a press or an Enter on the item that is *already*
// selected emits nothing at all, while one that moves the selection emits exactly what a rove emits. So neither
// report can be trusted on its own:
//
//   * an **activation** is handled on its own event — the item's `(click)` and its Enter/Space `(keydown)` — where the
//     feature knows which item it was without waiting for an emission that may never come;
//   * `isInFlight` then suppresses the kit's report *during* that activation, because the activation's own push is
//     the move and a replace beside it would swallow the location Back is there to return to.
//
// **The flag is ended above the group, never inside it.** Three earlier attempts got this wrong in ways only a
// browser could show (#460's R6, and two before it):
//
//   * `pointerleave` ends the press at the column's boundary rather than at the release, so a press that slips off a
//     184 px rail and comes back is cleared mid-press;
//   * `pointerup` is dispatched *before* the click, so ending there lifts the suppression before the kit reports at
//     all, and every ordinary press replaces and then pushes nothing;
//   * ending on the group's own `keydown` races the kit's handler on that same element, where nothing orders two
//     listeners on one node.
//
// `document` is always an ancestor of both, and a listener there runs **last** in the bubble — after the kit's report
// and after the feature's own handlers — for a release anywhere (`click`) and for a key anywhere (`keydown`).
// `pointercancel` covers a press the browser abandons without a click (a touch that becomes a scroll).
//
// **The one gap this leaves.** A `click` with no press behind it — `element.click()` from a script, and nothing a
// browser sends — reaches the item with the flag down, so the kit's report lands first and replaces before the
// activation pushes. Every real press has a `pointerdown`, and so does every helper in these specs; a kit `activated`
// output would remove the question rather than answer it.
//
// **Ticket #461** is the first customer for exactly that. With one, this whole file and both its callers collapse
// into reading the two reports the kit already knows apart.

import { Directive } from '@angular/core';

@Directive({
  selector: '[encyclopediaActivationPress]',
  standalone: true,
  host: {
    '(pointerdown)': 'begin()',
    '(click)': 'end()',
    '(document:click)': 'end()',
    '(document:keydown)': 'end()',
    '(document:pointercancel)': 'end()',
  },
})
export class EncyclopediaActivationPressDirective {
  private isInFlightValue = false;

  /** An activation is under way, so the kit's report beside it is that activation's and not a rove. */
  get isInFlight(): boolean {
    return this.isInFlightValue;
  }

  /**
   * Called by the group's own `(pointerdown)`, which catches a press anywhere on the column — including the strip
   * beside the items — and by an item that has just activated on Enter or Space, where no pointer press exists.
   */
  begin(): void {
    this.isInFlightValue = true;
  }

  protected end(): void {
    this.isInFlightValue = false;
  }
}
