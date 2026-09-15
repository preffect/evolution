// The roving focus the rail and the list share (docs/ui/components-and-constants.md §10.2): the group is one Tab stop,
// the arrows (↑ ↓, or ← → when horizontal) move focus between its items and Home End jump, a disabled item is
// skipped, and movement stops at either end. Enter or Space selects the focused item; a group whose selection follows
// focus selects as it moves. The group listens on its own host, so `input/keyboard-input.ts` stays the one document
// keyboard handler, and keys it does not use pass through (the encyclopedia's ← → between rail and list).

import {
  Directive,
  ElementRef,
  InjectionToken,
  computed,
  forwardRef,
  inject,
  input,
  linkedSignal,
  model,
  signal,
  type OnDestroy,
  type OnInit,
  type Provider,
  type Type,
} from '@angular/core';

export const UI_ORIENTATION = { vertical: 'vertical', horizontal: 'horizontal' } as const;
export type UiOrientation = (typeof UI_ORIENTATION)[keyof typeof UI_ORIENTATION];

export const ROVING_MOVE = { previous: 'previous', next: 'next', first: 'first', last: 'last' } as const;
export type RovingMove = (typeof ROVING_MOVE)[keyof typeof ROVING_MOVE];

const SELECT_KEYS: ReadonlySet<string> = new Set(['Enter', ' ']);

/** The move `key` asks of a group laid out along `orientation`, or null for a key the group leaves alone. */
export function rovingMoveFor(key: string, orientation: UiOrientation): RovingMove | null {
  const isVertical = orientation === UI_ORIENTATION.vertical;
  if (key === (isVertical ? 'ArrowUp' : 'ArrowLeft')) return ROVING_MOVE.previous;
  if (key === (isVertical ? 'ArrowDown' : 'ArrowRight')) return ROVING_MOVE.next;
  if (key === 'Home') return ROVING_MOVE.first;
  if (key === 'End') return ROVING_MOVE.last;
  return null;
}

/**
 * The index `move` lands on from `fromIndex`, stepping over disabled items and never wrapping; null when no
 * enabled item lies that way.
 */
export function rovingTargetIndex(move: RovingMove, fromIndex: number, enabled: readonly boolean[]): number | null {
  const isBackward = move === ROVING_MOVE.previous || move === ROVING_MOVE.last;
  const step = isBackward ? -1 : 1;
  let index = fromIndex + step;
  if (move === ROVING_MOVE.first) index = 0;
  if (move === ROVING_MOVE.last) index = enabled.length - 1;
  for (; index >= 0 && index < enabled.length; index += step) {
    if (enabled[index] === true) return index;
  }
  return null;
}

/** What a group needs from one of its items. */
export interface RovingItem {
  readonly element: HTMLElement;
  itemId(): string;
  isDisabled(): boolean;
}

function inDocumentOrder(items: readonly RovingItem[]): RovingItem[] {
  return [...items].sort((first, second) =>
    first.element.compareDocumentPosition(second.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

/** The rail and the list: one Tab stop over its items, which register themselves in whatever depth they sit. */
@Directive({
  host: {
    '(keydown)': 'handleKeydown($event)',
    '[attr.aria-orientation]': 'orientation()',
    '[attr.data-testid]': 'testId()',
  },
})
export abstract class UiRovingGroup {
  readonly selectedId = model<string | null>(null);
  readonly testId = input<string | null>(null);

  private readonly items = signal<readonly RovingItem[]>([]);
  /** The item that holds the Tab stop: the selection until focus moves off it. */
  private readonly activeId = linkedSignal<string | null>(() => this.selectedId());

  readonly tabStopId = computed(() => {
    const enabled = inDocumentOrder(this.items()).filter((item) => !item.isDisabled());
    const active = enabled.find((item) => item.itemId() === this.activeId());
    return (active ?? enabled[0])?.itemId() ?? null;
  });

  /** The axis the arrows move along: vertical, unless a group (the rail) takes it as an input. */
  readonly orientation: () => UiOrientation = () => UI_ORIENTATION.vertical;
  /** Whether moving focus also selects: always for a rail, a list's `shouldSelectionFollowFocus`. */
  protected abstract readonly isSelectionFollowingFocus: () => boolean;

  register(item: RovingItem): void {
    this.items.update((items) => [...items, item]);
  }

  unregister(item: RovingItem): void {
    this.items.update((items) => items.filter((registered) => registered !== item));
  }

  select(item: RovingItem): void {
    if (item.isDisabled()) return;
    this.activeId.set(item.itemId());
    this.selectedId.set(item.itemId());
  }

  /** Focus that reached an item some other way (a click, a feature's `focus()`) takes the Tab stop with it. */
  focusReached(item: RovingItem): void {
    if (!item.isDisabled()) this.activeId.set(item.itemId());
  }

  protected handleKeydown(event: KeyboardEvent): void {
    const ordered = inDocumentOrder(this.items());
    // Only a key pressed on an item itself is the group's: a control inside a row (a trailing button) keeps its keys.
    const fromIndex = ordered.findIndex((item) => item.element === event.target);
    const focused = ordered[fromIndex];
    if (focused === undefined) return;
    if (SELECT_KEYS.has(event.key)) {
      event.preventDefault();
      this.select(focused);
      return;
    }
    const move = rovingMoveFor(event.key, this.orientation());
    if (move === null) return;
    event.preventDefault();
    const target = rovingTargetIndex(
      move,
      fromIndex,
      ordered.map((item) => !item.isDisabled()),
    );
    const item = target === null ? undefined : ordered[target];
    if (item === undefined) return;
    this.activeId.set(item.itemId());
    if (this.isSelectionFollowingFocus()) this.selectedId.set(item.itemId());
    item.element.focus();
  }
}

/** How an item finds its group without importing the concrete rail or list. */
export const UI_ROVING_GROUP = new InjectionToken<UiRovingGroup>('UiRovingGroup');

/** A group component's provider of itself as `UI_ROVING_GROUP`: `provideRovingGroup(() => UiRailComponent)`. */
export function provideRovingGroup(groupType: () => Type<UiRovingGroup>): Provider {
  return { provide: UI_ROVING_GROUP, useExisting: forwardRef(groupType) };
}

/** A rail item or a list row: its Tab stop, selection and disabled state come from its group. */
@Directive({
  host: {
    '[attr.tabindex]': 'tabIndex()',
    '[attr.aria-selected]': 'isSelected()',
    '[attr.aria-disabled]': 'ariaDisabled()',
    '[attr.data-item-id]': 'itemId()',
    '[attr.data-testid]': 'testId()',
    '(click)': 'handleClick()',
    '(focus)': 'handleFocus()',
  },
})
export abstract class UiRovingItemBase implements RovingItem, OnInit, OnDestroy {
  readonly itemId = input.required<string>();
  readonly isDisabled = input(false);
  readonly testId = input<string | null>(null);

  readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly group = inject(UI_ROVING_GROUP);

  protected readonly isSelected = computed(() => this.group.selectedId() === this.itemId());
  protected readonly tabIndex = computed(() => (this.group.tabStopId() === this.itemId() ? 0 : -1));
  protected readonly ariaDisabled = computed(() => (this.isDisabled() ? 'true' : null));

  ngOnInit(): void {
    this.group.register(this);
  }

  ngOnDestroy(): void {
    this.group.unregister(this);
  }

  protected handleClick(): void {
    this.group.select(this);
  }

  protected handleFocus(): void {
    this.group.focusReached(this);
  }
}
