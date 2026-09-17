// The encyclopedia panel (docs/ui/encyclopedia.md §11.3): a kit modal panel over a scrim, in the kit focus trap, with
// the header row and the three columns — rail, list, detail. Layout B, the eyepiece (decision #368).
//
// It is hosted, never self-opening: the HUD shell mounts it in a room and the lobby outside one, and each host says
// where the close goes (§11.1). The host also projects the alert strip into `[encyclopediaHeaderAlert]`, which is how
// the strip reaches the header without `game/encyclopedia/` importing `hud/` (§12.8); the lobby projects nothing, so
// the strip is simply absent there.
//
// The keyboard model §11.5 asks for is split in two. The **roving** half is the kit's, inside the rail and the list;
// the **panel** half is here, as one `keydown` on the layer, because `/`, Back and the move between the two columns
// all have to work wherever focus sits inside the panel. The rules themselves are pure (`format/panel-keys.ts`);
// this file only gathers the two DOM facts they read — is focus in a text field, which column holds it — and runs
// the answer.
//
// **Escape is not among them**, and deliberately so: it has one owner per press (input-and-onboarding.md §4). The kit
// search field consumes it while a query is up (`preventDefault`, `stopPropagation`), and an unconsumed one closes —
// in a room through the HUD's topmost order, in the lobby through the host's own listener. A branch here would be a
// second owner of the same press.

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  viewChild,
  type Signal,
} from '@angular/core';
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
  ENCYCLOPEDIA_LOBBY_SCRIM_ALPHA,
  ENCYCLOPEDIA_SCRIM_ALPHA,
  ENCYCLOPEDIA_SEARCH_PLACEHOLDER,
  ENCYCLOPEDIA_TITLE,
} from './encyclopedia-constants';
import { encyclopediaStyleVariables } from './format/encyclopedia-css-variables';
import { locationAttributeFor } from './format/panel-view';
import {
  ENCYCLOPEDIA_COLUMN,
  ENCYCLOPEDIA_KEY_ACTION,
  encyclopediaKeyAction,
  type EncyclopediaColumn,
  type EncyclopediaKeyAction,
} from './format/panel-keys';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { ENCYCLOPEDIA_TEST_ID } from './test-ids';

/** The names of the controls a screen reader meets in the header; the icons themselves are decorative. */
const BACK_LABEL = 'Back';
const CLOSE_LABEL = 'Close';

/** The keys the header shows as hints: `/` focuses the field, Escape closes the panel. */
const SEARCH_KEY_HINT = '/';
const CLOSE_KEY_HINT = 'Escape';

/** The item a kit roving group currently lends its one Tab stop to (`ui-kit/roving-group.ts`). */
const ROVING_TAB_STOP_SELECTOR = '[tabindex="0"]';

/**
 * The type a template reference read as `ElementRef` comes back as. `viewChild` takes both of its type arguments
 * explicitly below — Angular's compiler requires the call itself in a class member's initializer, so it cannot be
 * wrapped in a helper — and the first, the locator's own type, a string reference leaves open.
 */
type ElementChild = Signal<ElementRef<HTMLElement>>;

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
  host: { '[style]': 'styleVariables', '(keydown)': 'handleKeydown($event)' },
  template: `
    <div class="layer" uiSurface>
      <ui-scrim [alpha]="scrimAlpha()" />
      <ui-panel
        class="panel"
        variant="modal"
        uiFocusTrap
        [restoreTo]="restoreFocusTo()"
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
            #searchField
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
          <app-encyclopedia-rail #railColumn />
          <app-encyclopedia-list #listColumn />
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

  /**
   * Whether a running dish is behind the panel. The room's host leaves it as it is and the scrim keeps the dish
   * faintly visible; the lobby's host says no, and the scrim covers completely (§11.7). The panel cannot tell on its
   * own — it is hosted, and knowing would mean reading the HUD it must not import (§12.8).
   */
  readonly isOverDish = input(true);

  /**
   * Where focus goes when the panel closes (§11.1's last column). `null` leaves it to the kit trap, which restores
   * whatever had focus when the panel opened — right for the lobby, whose button opened it. A room host passes the
   * canvas host for a close **to the game**, because there the element that had focus may be gone (the Start button
   * that unmounted at round start) or may never have existed, and §11.1 states that return unconditionally.
   */
  readonly restoreFocusTo = input<HTMLElement | null>(null);

  protected readonly testId = ENCYCLOPEDIA_TEST_ID;
  protected readonly styleVariables = encyclopediaStyleVariables();
  protected readonly scrimAlpha = computed(() =>
    this.isOverDish() ? ENCYCLOPEDIA_SCRIM_ALPHA : ENCYCLOPEDIA_LOBBY_SCRIM_ALPHA,
  );
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

  // What the keyboard model needs of the rail, the list and the field is where focus is and where to put it, which
  // is a DOM question rather than a component one — so each is read as its element.
  private readonly railElement: ElementChild = viewChild.required('railColumn', { read: ElementRef });
  private readonly listElement: ElementChild = viewChild.required('listColumn', { read: ElementRef });
  private readonly searchElement: ElementChild = viewChild.required('searchField', { read: ElementRef });

  constructor() {
    // After the trap's own initial focus, which lands on the first focusable — the header's Back, and Back is
    // disabled on an open with nothing pushed yet (§11.5). The reader's first keystroke would hit a dead control, so
    // the panel takes focus to the rail's selected row instead: a live control, marking where they already are, from
    // which every key of §11.5 works at once.
    afterNextRender(() => this.focusRovingTabStopIn(this.railElement()));
  }

  protected setQuery(query: string): void {
    this.state.setQuery(query);
  }

  protected goBack(): void {
    this.state.goBack();
  }

  /** §11.5's panel keys. A press the rules claim is always suppressed: `/` must not type and Backspace must not navigate. */
  protected handleKeydown(event: KeyboardEvent): void {
    const target = event.target instanceof Node ? event.target : null;
    const action = encyclopediaKeyAction({
      code: event.code,
      isAltKeyHeld: event.altKey,
      isTextEntryFocused: this.isSearchFieldFocused(target),
      focusedColumn: this.columnHolding(target),
    });
    if (action === ENCYCLOPEDIA_KEY_ACTION.none) return;
    event.preventDefault();
    this.runKeyAction(action);
  }

  private runKeyAction(action: EncyclopediaKeyAction): void {
    if (action === ENCYCLOPEDIA_KEY_ACTION.goBack) return this.state.goBack();
    if (action === ENCYCLOPEDIA_KEY_ACTION.focusSearch) return this.focusFirstFocusableIn(this.searchElement());
    if (action === ENCYCLOPEDIA_KEY_ACTION.openFirstResult) return this.openFirstResult();
    const column = action === ENCYCLOPEDIA_KEY_ACTION.focusRail ? this.railElement() : this.listElement();
    this.focusRovingTabStopIn(column);
  }

  /**
   * Enter in the search field (§11.5): the strongest match, which the core guarantees is both `results[0]` and the
   * row the list draws first, so nothing here re-derives that order. It is an **activation** — the reader chose this
   * page — so it pushes; with no query, and with a query that matched nothing, there is nothing to open.
   */
  private openFirstResult(): void {
    const first = this.state.results()[0];
    if (first !== undefined) this.state.openEntry(first.entryId);
  }

  /**
   * The only text field the panel holds is the kit search field, so this is §11.5's "but a text field" in full. An
   * entry page that ever grows one would widen the question, and this is where it would be answered.
   */
  private isSearchFieldFocused(target: Node | null): boolean {
    return target !== null && this.searchElement().nativeElement.contains(target);
  }

  private columnHolding(target: Node | null): EncyclopediaColumn | null {
    if (target === null) return null;
    if (this.railElement().nativeElement.contains(target)) return ENCYCLOPEDIA_COLUMN.rail;
    if (this.listElement().nativeElement.contains(target)) return ENCYCLOPEDIA_COLUMN.list;
    return null;
  }

  /** A column is one Tab stop, so arriving from the other one lands on whichever item currently holds it. */
  private focusRovingTabStopIn(column: ElementRef<HTMLElement>): void {
    column.nativeElement.querySelector<HTMLElement>(ROVING_TAB_STOP_SELECTOR)?.focus();
  }

  /** The kit search field draws its ring on its own box, so `/` has to reach the `<input>` inside it. */
  private focusFirstFocusableIn(field: ElementRef<HTMLElement>): void {
    field.nativeElement.querySelector('input')?.focus();
  }
}
