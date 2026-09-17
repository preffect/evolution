// Finding a rendered element by its `data-testid`, for component and integration specs
// (docs/testing/tiers-and-builders.md §2). Test-only, so it belongs here rather than beside any one feature: a spec
// that reaches for an id in another feature's tree gets the query without its module graph.
//
// The selector itself stays `hud/test-ids.ts`'s `testIdSelector`, which quotes the attribute so the `:` and `#` in an
// encyclopedia entry id are safe; nothing here restates it.

import { testIdSelector } from '../app/game/hud/test-ids';

/** The one element carrying `testId` under `root`, or `null`. */
export function queryByTestId(root: ParentNode, testId: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(testIdSelector(testId));
}

/** Every element carrying `testId` under `root`, in document order. */
export function queryAllByTestId(root: ParentNode, testId: string): readonly HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(testIdSelector(testId))];
}

/** The one element carrying `testId`, or a failure naming the id rather than a `null` dereference three lines later. */
export function expectTestId(root: ParentNode, testId: string): HTMLElement {
  const element = queryByTestId(root, testId);
  if (element === null) throw new Error(`no element carries data-testid="${testId}"`);
  return element;
}
