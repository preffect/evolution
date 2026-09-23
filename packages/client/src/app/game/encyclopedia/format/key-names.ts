// Key names as the action pages print them (docs/ui/input-and-onboarding.md §4): read from the input layer's own key
// codes, so a rebound key renames itself on the page and no key is typed twice. Pure.

import {
  FULL_LEADERBOARD_KEY_CODE,
  MENU_KEY_CODE,
  SPRINT_KEY_CODE,
  STEER_KEY_CODES,
  type SteerDirection,
} from '../../input/input-constants';

const LETTER_KEY_PREFIX = 'Key';
const ARROW_KEY_PREFIX = 'Arrow';
const ARROW_KEY_SUFFIX = ' arrow';
/** Each direction's first code is its letter; the arrows come after. */
const LETTER_POSITION = 0;

/** The steer keys in the order a player says them: W A S D. */
const STEER_READING_ORDER: readonly SteerDirection[] = ['up', 'left', 'down', 'right'];

/** `KeyW` → `W`, `ArrowUp` → `Up arrow`; a code that already reads as a name (`Space`, `Tab`) is kept. */
export function keyNameOf(code: string): string {
  if (code.startsWith(LETTER_KEY_PREFIX)) return code.slice(LETTER_KEY_PREFIX.length);
  if (code.startsWith(ARROW_KEY_PREFIX)) return `${code.slice(ARROW_KEY_PREFIX.length)}${ARROW_KEY_SUFFIX}`;
  return code;
}

/** Every key that steers one way, in the reading order: `W`, `A`, `S`, `D` and then their arrows. */
function steerKeyNames(position: number): string {
  return STEER_READING_ORDER.map((direction) => keyNameOf(STEER_KEY_CODES[direction][position] ?? '')).join('');
}

/** The keys an action page names. */
export const KEY_NAMES = {
  /** The letter cluster that steers: `WASD`. */
  steerLetters: steerKeyNames(LETTER_POSITION),
  sprint: keyNameOf(SPRINT_KEY_CODE),
  fullLeaderboard: keyNameOf(FULL_LEADERBOARD_KEY_CODE),
  menu: keyNameOf(MENU_KEY_CODE),
} as const;
