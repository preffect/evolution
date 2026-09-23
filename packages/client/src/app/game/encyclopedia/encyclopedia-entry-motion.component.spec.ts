// The entry page under `prefers-reduced-motion` (docs/ui/encyclopedia.md §11.4): the lens holds its first frame, and
// a play and pause toggle joins the lens control — beside a trait's tier switch, in `Replay`'s place on an action.
// Both directions, and the page without the preference, which keeps playing and shows no toggle. The rest of the
// page is `encyclopedia-entry.component.spec.ts`'s.

import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BALANCE, FIRST_TIER } from '@evolution/shared';
import { recordingPreviewHost, type RecordingPreviewHost } from '../../../testing/fake-preview-handle';
import { expectTestId, queryByTestId } from '../../../testing/test-id-query';
import { REDUCED_MOTION } from '../reduced-motion';
import { ENCYCLOPEDIA_PREVIEW } from '../render/preview/preview-host';
import { GameStateService } from '../state/game-state.service';
import { EncyclopediaEntryComponent } from './encyclopedia-entry.component';
import { ENCYCLOPEDIA_LENS_MOTION, ENCYCLOPEDIA_PREVIEW_SETTLE_MS } from './encyclopedia-constants';
import { ENCYCLOPEDIA_PREVIEW_STATE, EncyclopediaPreviewService } from './encyclopedia-preview.service';
import type { EntryId } from './model/entry-id';
import { resolveEntry } from './registry';
import { ENCYCLOPEDIA_TEST_ID, encyclopediaTierTestId } from './test-ids';

const CELL_WALL = 'trait:cell_wall' as EntryId;
const SPRINT = 'action:sprint' as EntryId;

describe('EncyclopediaEntryComponent under reduced motion (docs/ui/encyclopedia.md §11.4)', () => {
  let fixture: ComponentFixture<EncyclopediaEntryComponent>;
  let previewHost: RecordingPreviewHost;
  let preview: EncyclopediaPreviewService;
  const prefersReducedMotion = signal(true);

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function motionToggle(): HTMLElement | null {
    return queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.previewMotion);
  }

  async function openOn(entryId: EntryId): Promise<void> {
    fixture.componentRef.setInput('entry', resolveEntry(entryId, { balance: DEFAULT_BALANCE }));
    fixture.detectChanges();
    vi.advanceTimersByTime(ENCYCLOPEDIA_PREVIEW_SETTLE_MS);
    await previewHost.handles[0]?.completeOpen();
    fixture.detectChanges();
  }

  function press(element: HTMLElement): void {
    element.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    prefersReducedMotion.set(true);
    previewHost = recordingPreviewHost();
    TestBed.configureTestingModule({
      imports: [EncyclopediaEntryComponent],
      providers: [
        { provide: GameStateService, useValue: { balance: signal(null), ownProgress: signal(null) } },
        { provide: ENCYCLOPEDIA_PREVIEW, useValue: previewHost.factory },
        { provide: REDUCED_MOTION, useValue: prefersReducedMotion.asReadonly() },
        EncyclopediaPreviewService,
      ],
    });
    fixture = TestBed.createComponent(EncyclopediaEntryComponent);
    preview = fixture.debugElement.injector.get(EncyclopediaPreviewService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds the lens on its first frame, and plays it on the toggle and holds it again', async () => {
    await openOn(CELL_WALL);
    expect([previewHost.handles[0]?.pauseCount, preview.state()]).toEqual([1, ENCYCLOPEDIA_PREVIEW_STATE.paused]);
    expect(motionToggle()?.dataset['motion']).toBe(ENCYCLOPEDIA_LENS_MOTION.play);

    press(motionToggle()!);
    expect([previewHost.handles[0]?.resumeCount, preview.state()]).toEqual([1, ENCYCLOPEDIA_PREVIEW_STATE.live]);
    expect(previewHost.handles[0]?.pauseCount).toBe(1);
    expect(motionToggle()?.dataset['motion']).toBe(ENCYCLOPEDIA_LENS_MOTION.pause);

    press(motionToggle()!);
    expect([previewHost.handles[0]?.pauseCount, preview.state()]).toEqual([2, ENCYCLOPEDIA_PREVIEW_STATE.paused]);
  });

  it('sets the toggle beside a trait’s tier switch, in one centred row', async () => {
    await openOn(CELL_WALL);
    const row = root().querySelector('app-encyclopedia-lens-control .row');
    expect(row?.contains(expectTestId(root(), encyclopediaTierTestId(FIRST_TIER)))).toBe(true);
    expect(row?.contains(motionToggle())).toBe(true);
  });

  it('puts the toggle in Replay’s place under an action scene', async () => {
    await openOn(SPRINT);
    expect(motionToggle()).not.toBeNull();
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.previewReplay)).toBeNull();
  });

  it('keeps playing with no toggle, and keeps Replay, when the reader has no preference', async () => {
    prefersReducedMotion.set(false);
    await openOn(SPRINT);
    expect([previewHost.handles[0]?.pauseCount, preview.state()]).toEqual([0, ENCYCLOPEDIA_PREVIEW_STATE.live]);
    expect(motionToggle()).toBeNull();
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.previewReplay)).not.toBeNull();
  });
});
