// The dev-only trait card sheet (`/?cards` in a dev build, #428): every card the catalog can deal, fresh and as an
// upgrade, drawn by the real `TraitCardComponent` under the real kit and HUD variables, so a browser spec can
// measure each one's rendered height against the card's box (`e2e/trait-card-heights.spec.ts`). It is the only
// place every catalog card is on screen at once; an offer holds three. The cards read the shipped balance's tier
// tables, since there is no room to read a live one from.

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { UiSurfaceDirective } from '../../../ui-kit/ui-surface.directive';
import { HUD_TEST_ID } from '../../test-ids/hud-test-ids';
import { catalogCards } from '../format/catalog-cards';
import { hudStyleVariables } from '../format/hud-css-variables';
import { TraitCardComponent } from '../trait-card.component';

@Component({
  selector: 'app-trait-card-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TraitCardComponent, UiSurfaceDirective],
  template: `
    <!-- The kit surface publishes the --ui-… tokens and the scale; the inner box adds the HUD's --hud-… ones. -->
    <div class="surface" uiSurface>
      <div class="cards" [style]="hudVariables" [attr.data-testid]="testId.traitCardSheet">
        @for (card of cards; track card.cardId) {
          <app-trait-card [card]="card.view" [attr.data-card-id]="card.cardId" />
        }
      </div>
    </div>
  `,
  styles: [
    `
      .surface {
        position: fixed;
        inset: 0;
        overflow: auto;
        background: var(--ui-panel-bottom);
      }

      .cards {
        display: flex;
        flex-wrap: wrap;
        gap: calc(var(--hud-picker-card-gap) * var(--ui-scale));
        padding: calc(var(--hud-picker-card-gap) * var(--ui-scale));
      }
    `,
  ],
})
export class TraitCardSheetComponent {
  protected readonly testId = HUD_TEST_ID;
  protected readonly hudVariables = hudStyleVariables();
  protected readonly cards = catalogCards(DEFAULT_BALANCE.traits);
}
