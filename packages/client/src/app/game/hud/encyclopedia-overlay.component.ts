// The encyclopedia as a room sees it (docs/ui/encyclopedia.md §11.1): the HUD shell's host for the panel.
//
// It is the seam that keeps `game/encyclopedia/` free of `hud/` (§12.8). Three things cross it, all in this
// direction: the entry the menu asked for, the alert strip **projected** into the panel's header slot, and the close,
// which is the HUD's own topmost-overlay order (`pressMenuKey`) — back to the menu when the menu opened it, else to
// the game. The panel itself knows none of that.

import { ChangeDetectionStrategy, Component, inject, type OnDestroy, type OnInit } from '@angular/core';
import { EncyclopediaComponent } from '../encyclopedia/encyclopedia.component';
import { EncyclopediaStateService } from '../encyclopedia/encyclopedia-state.service';
import { entryIdFrom } from '../encyclopedia/registry';
import { ENCYCLOPEDIA_TEST_ID } from '../encyclopedia/test-ids';
import { HudStateService } from './hud-state.service';
import { OverlayAlertComponent } from './overlay-alert.component';

@Component({
  selector: 'app-encyclopedia-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EncyclopediaComponent, OverlayAlertComponent],
  template: `
    <app-encyclopedia (closed)="close()">
      <app-overlay-alert encyclopediaHeaderAlert class="alert" [testId]="encyclopediaTestId.alert" />
    </app-encyclopedia>
  `,
  styles: [
    `
      /* The strip gives way with an ellipsis before the keys and the close do (§10.2), so it is the header's
         shrinking item. */
      .alert {
        flex: 0 1 auto;
        min-width: 0;
      }
    `,
  ],
})
export class EncyclopediaOverlayComponent implements OnInit, OnDestroy {
  private readonly hudState = inject(HudStateService);
  private readonly encyclopedia = inject(EncyclopediaStateService);

  protected readonly encyclopediaTestId = ENCYCLOPEDIA_TEST_ID;

  /** Opening at the menu's entry, or at the last location this session; either way the query starts blank (§11.5). */
  ngOnInit(): void {
    this.encyclopedia.openAt(entryIdFrom(this.hudState.encyclopediaEntryId()));
  }

  /** The location is the session's reading position and stays; the query does not (§11.5). */
  ngOnDestroy(): void {
    this.encyclopedia.close();
  }

  /** Close is Escape's own order: the menu if the menu opened it, else the game (§11.1). */
  protected close(): void {
    this.hudState.pressMenuKey();
  }
}
