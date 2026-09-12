// The client input layer's constants (docs/CODE-STANDARDS.md §2, docs/UI.md §4): the key codes,
// the direction vectors and the DOM selectors the hotkey rules read. Gameplay numbers — the steer
// dead zone, the sprint tunables — are the shared `constants/controls.ts`, reached through the
// live `game_state.balance`; nothing here is a copy of one.

import { TRAIT_DRAFT_SIZE, type Vec2 } from '@evolution/shared';

/** The four steer directions (docs/GAME-DESIGN.md §6), in a fixed order so a test can walk them. */
export const STEER_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
export type SteerDirection = (typeof STEER_DIRECTIONS)[number];

/** `KeyboardEvent.code` per direction: WASD and the arrows both steer. */
export const STEER_KEY_CODES: Readonly<Record<SteerDirection, readonly string[]>> = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

/** World-space unit vectors: the camera maps world +y to screen down, so `up` is −y. */
export const STEER_VECTORS: Readonly<Record<SteerDirection, Vec2>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const SPRINT_KEY_CODE = 'Space';
export const FULL_LEADERBOARD_KEY_CODE = 'Tab';
export const MENU_KEY_CODE = 'Escape';

/** `Digit1 … Digit<TRAIT_DRAFT_SIZE>`: a code's position in this array is its card index (docs/UI.md §4). */
export const TRAIT_CARD_KEY_CODES: readonly string[] = Array.from(
  { length: TRAIT_DRAFT_SIZE },
  (_unusedValue, cardIndex) => `Digit${cardIndex + 1}`,
);

/** Focus in one of these swallows every hotkey: a player typing is not steering (docs/UI.md §4). */
export const TEXT_ENTRY_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/** The trait picker's container: Space with focus inside it picks and never sprints (docs/UI.md §3.2, §4). */
export const TRAIT_OFFER_TEST_ID = 'trait-offer';
/** The Escape menu's panel (docs/UI.md §3.5): while it is open only the trait keys and Escape act. */
export const MENU_OVERLAY_TEST_ID = 'menu-overlay';
/** The results panel (docs/UI.md §3.4). */
export const RESULTS_OVERLAY_TEST_ID = 'results-overlay';

/** Overlays with focusable controls: Tab stays native while one of them is open (docs/UI.md §4). */
export const FOCUSABLE_OVERLAY_TEST_IDS: readonly string[] = [
  TRAIT_OFFER_TEST_ID,
  MENU_OVERLAY_TEST_ID,
  RESULTS_OVERLAY_TEST_ID,
];

/** The only pointer button that sprints: a left click or a tap (docs/UI.md §4). */
export const PRIMARY_POINTER_BUTTON = 0;

/** The dish centre: where a target points before there is an own cell or a camera to read. */
export const DISH_CENTRE_POINT: Vec2 = { x: 0, y: 0 };

/** `[data-testid="…"]`, the one place the attribute name is spelled. */
export function testIdSelector(testId: string): string {
  return `[data-testid="${testId}"]`;
}
