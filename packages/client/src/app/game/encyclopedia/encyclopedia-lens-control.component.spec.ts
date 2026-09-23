// The lens control (docs/ui/encyclopedia.md §11.4): the tier switch under a trait's lens. What the switch *does* to
// the preview is `encyclopedia-entry.component.spec.ts`'s, where the page that owns the selection is; this spec is
// the control itself — its segments, its `Replay`, its ids, and that each one is a real button a keyboard can reach.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TraitTier } from '@evolution/shared';
import { expectTestId } from '../../../testing/test-id-query';
import { EncyclopediaLensControlComponent } from './encyclopedia-lens-control.component';
import type { EncyclopediaTierSegment } from './format/entry-view';
import { ENCYCLOPEDIA_TEST_ID, encyclopediaTierTestId } from './test-ids';

const FIRST = 1 as TraitTier;
const SECOND = 2 as TraitTier;
const REPLAY = 'Replay';

const SEGMENTS: readonly EncyclopediaTierSegment[] = [
  { tier: FIRST, numeral: 'I', preview: null },
  { tier: SECOND, numeral: 'II', preview: null },
];

describe('EncyclopediaLensControlComponent (docs/ui/encyclopedia.md §11.4)', () => {
  let fixture: ComponentFixture<EncyclopediaLensControlComponent>;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EncyclopediaLensControlComponent] });
    fixture = TestBed.createComponent(EncyclopediaLensControlComponent);
    fixture.componentRef.setInput('segments', SEGMENTS);
    fixture.componentRef.setInput('selectedTier', FIRST);
    fixture.detectChanges();
  });

  it('draws one segment per tier, labelled with its numeral and carrying its own id', () => {
    const segments = [...root().querySelectorAll('button')];
    expect(segments.map((segment) => segment.textContent?.trim())).toEqual(['I', 'II']);
    expect(segments.map((segment) => segment.dataset['testid'])).toEqual([
      encyclopediaTierTestId(FIRST),
      encyclopediaTierTestId(SECOND),
    ]);
  });

  /** Which tier the lens is on has to be legible to a screen reader, not only to the eye that sees the tint. */
  it('marks the selected segment, and only it', () => {
    expect(expectTestId(root(), encyclopediaTierTestId(FIRST)).getAttribute('aria-pressed')).toBe('true');
    expect(expectTestId(root(), encyclopediaTierTestId(SECOND)).getAttribute('aria-pressed')).toBe('false');

    fixture.componentRef.setInput('selectedTier', SECOND);
    fixture.detectChanges();
    expect(expectTestId(root(), encyclopediaTierTestId(FIRST)).getAttribute('aria-pressed')).toBe('false');
  });

  it('emits the tier a press chose', () => {
    const chosen: TraitTier[] = [];
    fixture.componentInstance.tierSelected.subscribe((tier) => chosen.push(tier));
    expectTestId(root(), encyclopediaTierTestId(SECOND)).click();
    expect(chosen).toEqual([SECOND]);
  });

  /** §11.6 gives the encyclopedia one group role here; every segment is a `<button>`, so Tab and Enter reach it. */
  it('is a named group of real buttons', () => {
    const group = root().querySelector('[role="group"]');
    expect(group?.getAttribute('aria-label')).not.toBeNull();
    expect([...root().querySelectorAll('button')].every((segment) => segment.type === 'button')).toBe(true);
  });

  it('draws no Replay under a trait, and only Replay under an action scene', () => {
    expect(root().querySelector(`[data-testid="${ENCYCLOPEDIA_TEST_ID.previewReplay}"]`)).toBeNull();

    fixture.componentRef.setInput('segments', []);
    fixture.componentRef.setInput('replayLabel', REPLAY);
    fixture.detectChanges();
    const buttons = [...root().querySelectorAll('button')];
    expect(buttons.map((button) => button.dataset['testid'])).toEqual([ENCYCLOPEDIA_TEST_ID.previewReplay]);
    expect(buttons[0]?.textContent?.trim()).toBe(REPLAY);
    expect(buttons[0]?.type).toBe('button');
  });

  it('emits a replay when Replay is pressed', () => {
    fixture.componentRef.setInput('segments', []);
    fixture.componentRef.setInput('replayLabel', REPLAY);
    fixture.detectChanges();
    let replays = 0;
    fixture.componentInstance.replayed.subscribe(() => (replays += 1));
    expectTestId(root(), ENCYCLOPEDIA_TEST_ID.previewReplay).click();
    expect(replays).toBe(1);
  });
});
