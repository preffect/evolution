// The encyclopedia panel (docs/ui/encyclopedia.md §11.3): a kit modal panel over a scrim, in the kit focus trap, with
// the header row and the three columns — rail, list, detail. Layout B, the eyepiece (decision #368).
//
// It is hosted, never self-opening: the HUD shell mounts it in a room and the lobby outside one, and each host says
// where the close goes (§11.1). The host also projects the alert strip into `[encyclopediaHeaderAlert]`, which is how
// the strip reaches the header without `game/encyclopedia/` importing `hud/` (§12.8); the lobby projects nothing, so
// the strip is simply absent there.
//
// The keyboard *model* — the `/` and `Alt+←` bindings, the Tab regions, the Escape order — is #449. What this file
// owes that slice is only that every control here is reachable and carries its test id.

import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { UiButtonComponent } from '../../ui-kit/ui-button.component';
import { UiFocusTrapDirective } from '../../ui-kit/ui-focus-trap.directive';
import { UiKeyHintComponent } from '../../ui-kit/ui-key-hint.component';
import { UiPanelComponent } from '../../ui-kit/ui-panel.component';
import { UiScrimComponent } from '../../ui-kit/ui-scrim.component';
import { UiSearchFieldComponent } from '../../ui-kit/ui-search-field.component';
import { UiSurfaceDirective } from '../../ui-kit/ui-surface.directive';
import { EncyclopediaEntryComponent } from './encyclopedia-entry.component';
import { EncyclopediaLandingComponent } from './encyclopedia-landing.component';
import { EncyclopediaListComponent } from './encyclopedia-list.component';
import { EncyclopediaRailComponent } from './encyclopedia-rail.component';
import { EncyclopediaIconComponent } from './encyclopedia-icon.component';
import { ENCYCLOPEDIA_BACK_ICON, ENCYCLOPEDIA_CLOSE_ICON } from './encyclopedia-icons';
import {
  ENCYCLOPEDIA_SCRIM_ALPHA,
  ENCYCLOPEDIA_SEARCH_PLACEHOLDER,
  ENCYCLOPEDIA_TITLE,
} from './encyclopedia-constants';
import { encyclopediaStyleVariables } from './format/encyclopedia-css-variables';
import { locationAttributeFor } from './format/panel-view';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { ENCYCLOPEDIA_TEST_ID } from './test-ids';

/** The names of the controls a screen reader meets in the header; the icons themselves are decorative. */
const BACK_LABEL = 'Back';
const CLOSE_LABEL = 'Close';

/** The keys the header shows as hints. `/` focuses the field and Escape closes the panel; both are bound by #449. */
const SEARCH_KEY_HINT = '/';
const CLOSE_KEY_HINT = 'Escape';

@Component({
  selector: 'app-encyclopedia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EncyclopediaEntryComponent,
    EncyclopediaIconComponent,
    EncyclopediaLandingComponent,
    EncyclopediaListComponent,
    EncyclopediaRailComponent,
    UiButtonComponent,
    UiFocusTrapDirective,
    UiKeyHintComponent,
    UiPanelComponent,
    UiScrimComponent,
    UiSearchFieldComponent,
    UiSurfaceDirective,
  ],
  styleUrl: './encyclopedia.component.css',
  host: { '[style]': 'styleVariables' },
  template: `
    <div class="layer" uiSurface>
      <ui-scrim [alpha]="scrimAlpha" />
      <ui-panel
        class="panel"
        variant="modal"
        uiFocusTrap
        [attr.aria-label]="panelTitle"
        [attr.data-location]="locationAttribute()"
        [testId]="testId.encyclopedia"
      >
        <div uiPanelHeader class="header">
          <button
            type="button"
            uiButton
            variant="icon"
            [attr.aria-label]="backLabel"
            [isDisabled]="!canGoBack()"
            [testId]="testId.back"
            (click)="goBack()"
          >
            <app-encyclopedia-icon class="button-icon" [icon]="backIcon" />
          </button>
          <h2 class="title">{{ panelTitle }}</h2>
          <ui-search-field
            class="search"
            [placeholder]="searchPlaceholder"
            [keyHint]="searchKeyHint"
            [testId]="testId.search"
            [query]="query()"
            (queryChange)="setQuery($event)"
          />
          <div class="header-end">
            <ng-content select="[encyclopediaHeaderAlert]" />
            <ui-key-hint [key]="closeKeyHint" />
            <button
              type="button"
              uiButton
              variant="icon"
              [attr.aria-label]="closeLabel"
              [testId]="testId.close"
              (click)="closed.emit()"
            >
              <app-encyclopedia-icon class="button-icon" [icon]="closeIcon" />
            </button>
          </div>
        </div>

        <div class="columns">
          <app-encyclopedia-rail />
          <app-encyclopedia-list />
          @if (entry(); as page) {
            <app-encyclopedia-entry [entry]="page" />
          } @else {
            <app-encyclopedia-landing />
          }
        </div>
      </ui-panel>
    </div>
  `,
})
export class EncyclopediaComponent {
  private readonly state = inject(EncyclopediaStateService);

  /** Close, or the alert strip's own press: the host decides where focus and the overlay state go (§11.1). */
  readonly closed = output<void>();

  protected readonly testId = ENCYCLOPEDIA_TEST_ID;
  protected readonly styleVariables = encyclopediaStyleVariables();
  protected readonly scrimAlpha = ENCYCLOPEDIA_SCRIM_ALPHA;
  protected readonly panelTitle = ENCYCLOPEDIA_TITLE;
  protected readonly searchPlaceholder = ENCYCLOPEDIA_SEARCH_PLACEHOLDER;
  protected readonly searchKeyHint = SEARCH_KEY_HINT;
  protected readonly closeKeyHint = CLOSE_KEY_HINT;
  protected readonly backLabel = BACK_LABEL;
  protected readonly closeLabel = CLOSE_LABEL;
  protected readonly backIcon = ENCYCLOPEDIA_BACK_ICON;
  protected readonly closeIcon = ENCYCLOPEDIA_CLOSE_ICON;

  protected readonly canGoBack = this.state.canGoBack;
  protected readonly entry = this.state.entry;
  protected readonly locationAttribute = computed(() => locationAttributeFor(this.state.location()));

  /** The kit field edits the query and nothing else; what matches is the state service's (§10.2). */
  protected readonly query = this.state.query;

  protected setQuery(query: string): void {
    this.state.setQuery(query);
  }

  protected goBack(): void {
    this.state.goBack();
  }
}
