// The one preview session an open encyclopedia has (docs/ui/encyclopedia.md §11.4,
// architecture/encyclopedia.md §12.7). Every assertion here is about what the encyclopedia *asks* of a preview —
// the session's own behaviour is `preview-session.spec.ts`'s, over the fake Pixi app, because `BitmapText` crashes
// jsdom and no component spec may build one.

import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CELL_KIND, DEFAULT_BALANCE, DNA_TAG, type BalanceConfig, type OwnedTrait } from '@evolution/shared';
import { PREVIEW_MOTION, PREVIEW_SCENE, type PreviewSpec } from '../render/preview/preview-spec';
import { ENCYCLOPEDIA_PREVIEW } from '../render/preview/preview-host';
import { recordingPreviewHost, type RecordingPreviewHost } from '../../../testing/fake-preview-handle';
import { GameStateService } from '../state/game-state.service';
import { ENCYCLOPEDIA_LENS_DIAMETER_PX, ENCYCLOPEDIA_PREVIEW_SETTLE_MS } from './encyclopedia-constants';
import { ENCYCLOPEDIA_PREVIEW_STATE, EncyclopediaPreviewService } from './encyclopedia-preview.service';

const CELL_SPEC: PreviewSpec = {
  scene: PREVIEW_SCENE.cell,
  cellKind: CELL_KIND.player,
  traits: [],
  motion: PREVIEW_MOTION.swimming,
};
const FRAGMENT_SPEC: PreviewSpec = { scene: PREVIEW_SCENE.dnaFragment, tag: DNA_TAG.motile };
const ENGULF_SPEC: PreviewSpec = { scene: PREVIEW_SCENE.engulf };

/** The service is the panel's, so it is provided by a component and dies with it. */
@Component({ standalone: true, template: '', providers: [EncyclopediaPreviewService] })
class PanelStubComponent {}

const gameStateStub = {
  balance: signal<BalanceConfig | null>(null),
  ownProgress: signal<{ readonly ownedTraits: readonly OwnedTrait[] } | null>(null),
};

describe('EncyclopediaPreviewService (docs/ui/encyclopedia.md §11.4)', () => {
  let fixture: ComponentFixture<PanelStubComponent>;
  let preview: EncyclopediaPreviewService;
  let host: RecordingPreviewHost;

  /** A lens mounting: it takes the host element and says so. */
  function attachLens(): void {
    preview.attachStage();
  }

  function settleSelection(): void {
    vi.advanceTimersByTime(ENCYCLOPEDIA_PREVIEW_SETTLE_MS);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    gameStateStub.balance.set(null);
    host = recordingPreviewHost();
    TestBed.configureTestingModule({
      imports: [PanelStubComponent],
      providers: [
        { provide: ENCYCLOPEDIA_PREVIEW, useValue: host.factory },
        { provide: GameStateService, useValue: gameStateStub },
      ],
    });
    fixture = TestBed.createComponent(PanelStubComponent);
    preview = fixture.debugElement.injector.get(EncyclopediaPreviewService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in loading, with no session until a lens and a spec have both arrived', () => {
    expect(preview.state()).toBe(ENCYCLOPEDIA_PREVIEW_STATE.loading);
    preview.show(CELL_SPEC);
    settleSelection();
    expect(host.handles).toHaveLength(0);

    attachLens();
    expect(host.handles).toHaveLength(1);
  });

  /**
   * §11.4's settle. The assertion is on both sides of the wait: a spec that has not rested yet has reached nothing,
   * which is what stops an arrow held down the list restarting a scene per row.
   */
  it('waits for the selection to rest before it shows anything', () => {
    attachLens();
    preview.show(CELL_SPEC);
    vi.advanceTimersByTime(ENCYCLOPEDIA_PREVIEW_SETTLE_MS - 1);
    expect(host.handles).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(host.handles[0]?.shownSpecs).toEqual([CELL_SPEC]);
  });

  it('shows only the last of a run of selections', () => {
    attachLens();
    preview.show(CELL_SPEC);
    vi.advanceTimersByTime(ENCYCLOPEDIA_PREVIEW_SETTLE_MS - 1);
    preview.show(FRAGMENT_SPEC);
    settleSelection();
    expect(host.handles[0]?.shownSpecs).toEqual([FRAGMENT_SPEC]);
  });

  /** The bake is per session (§12.7's cost table), so a second page is a `show` and never a second handle. */
  it('opens one session and swaps scenes on it', async () => {
    attachLens();
    preview.show(CELL_SPEC);
    settleSelection();
    await host.handles[0]?.completeOpen();

    preview.show(FRAGMENT_SPEC);
    settleSelection();
    expect(host.handles).toHaveLength(1);
    expect(host.handles[0]?.shownSpecs).toEqual([CELL_SPEC, FRAGMENT_SPEC]);
  });

  /** A page turned during the bake is not lost, and `show` is never called on a session with no renderer yet. */
  it('applies a selection that arrived while the open was in flight, once it resolves', async () => {
    attachLens();
    preview.show(CELL_SPEC);
    settleSelection();
    preview.show(FRAGMENT_SPEC);
    settleSelection();
    expect(host.handles[0]?.shownSpecs).toEqual([CELL_SPEC]);

    await host.handles[0]?.completeOpen();
    expect(host.handles[0]?.shownSpecs).toEqual([CELL_SPEC, FRAGMENT_SPEC]);
  });

  it('is live once the first frame is drawn', async () => {
    attachLens();
    preview.show(CELL_SPEC);
    settleSelection();
    expect(preview.state()).toBe(ENCYCLOPEDIA_PREVIEW_STATE.loading);

    await host.handles[0]?.completeOpen();
    expect(preview.state()).toBe(ENCYCLOPEDIA_PREVIEW_STATE.live);
  });

  /** `null` is `destroy` landing first — a panel that closed, not a preview that failed. */
  it('stays in loading when the open resolves into a destroyed session', async () => {
    attachLens();
    preview.show(CELL_SPEC);
    settleSelection();
    await host.handles[0]?.completeOpen(null);
    expect(preview.state()).toBe(ENCYCLOPEDIA_PREVIEW_STATE.loading);
  });

  /**
   * §11.4 gives the failure no retry loop, and the second half is the half that matters: without it the re-apply
   * that follows every open would reopen a failed preview once per entry the reader turns to.
   */
  it('reports an unavailable preview once and never tries again', async () => {
    attachLens();
    preview.show(CELL_SPEC);
    settleSelection();
    await host.handles[0]?.failOpen();
    expect(preview.state()).toBe(ENCYCLOPEDIA_PREVIEW_STATE.unavailable);
    expect(host.handles[0]?.destroyCount).toBe(1);

    preview.show(FRAGMENT_SPEC);
    settleSelection();
    expect(host.handles).toHaveLength(1);
    expect(preview.state()).toBe(ENCYCLOPEDIA_PREVIEW_STATE.unavailable);
  });

  /** §11.4's `Replay`: the scene on the canvas starts again, and a paused lens plays so the reader sees it. */
  it('replays the scene on the canvas, and only once there is one', async () => {
    attachLens();
    preview.show(ENGULF_SPEC);
    preview.replay();
    settleSelection();
    preview.replay();
    expect(host.handles[0]?.shownSpecs).toEqual([ENGULF_SPEC]);

    await host.handles[0]?.completeOpen();
    preview.pause();
    preview.replay();
    expect(host.handles[0]?.shownSpecs).toEqual([ENGULF_SPEC, ENGULF_SPEC]);
    expect(preview.state()).toBe(ENCYCLOPEDIA_PREVIEW_STATE.live);

    preview.show(CELL_SPEC);
    preview.replay();
    expect(host.handles[0]?.shownSpecs).toEqual([ENGULF_SPEC, ENGULF_SPEC]);
  });

  it('pauses when the lens goes and plays again when the next one arrives', async () => {
    attachLens();
    preview.show(CELL_SPEC);
    settleSelection();
    await host.handles[0]?.completeOpen();

    preview.detachStage();
    expect([host.handles[0]?.pauseCount, preview.state()]).toEqual([1, ENCYCLOPEDIA_PREVIEW_STATE.paused]);

    attachLens();
    expect([host.handles[0]?.resumeCount, preview.state()]).toEqual([1, ENCYCLOPEDIA_PREVIEW_STATE.live]);
  });

  /** A reader who leaves during the bake gets a paused lens, not a live one nobody is looking at. */
  it('resolves an open that was paused mid-flight into paused', async () => {
    attachLens();
    preview.show(CELL_SPEC);
    settleSelection();
    preview.detachStage();
    await host.handles[0]?.completeOpen();
    expect(preview.state()).toBe(ENCYCLOPEDIA_PREVIEW_STATE.paused);
  });

  it('sizes the canvas at the lens diameter, and resizes it with the panel’s scale', async () => {
    const scale = 1.35;
    preview.setUiScale(scale);
    attachLens();
    preview.show(CELL_SPEC);
    settleSelection();
    const side = ENCYCLOPEDIA_LENS_DIAMETER_PX * scale;
    expect(host.options[0]?.sizePx).toEqual({ width: side, height: side });

    // A scale set while the bundle bakes has to reach the canvas once the open resolves: the session reads its size
    // as `start` is called, so the lens would otherwise keep a canvas of the size the reader has already left
    // behind. The *last* resize is what the canvas ends up at, which is the claim; how many it took is not.
    preview.setUiScale(1);
    await host.handles[0]?.completeOpen();
    expect(host.handles[0]?.resizes.at(-1)).toEqual({
      width: ENCYCLOPEDIA_LENS_DIAMETER_PX,
      height: ENCYCLOPEDIA_LENS_DIAMETER_PX,
    });

    preview.setUiScale(scale);
    expect(host.handles[0]?.resizes.at(-1)).toEqual({ width: side, height: side });
  });

  /** The lens reads the room's live balance, so a `balance_updated` retimes the scene that is playing (§12.7). */
  it('hands the preview the balance the encyclopedia is resolving over', () => {
    attachLens();
    preview.show(CELL_SPEC);
    settleSelection();
    expect(host.options[0]?.balance()).toBe(DEFAULT_BALANCE);

    const patched = { ...DEFAULT_BALANCE };
    gameStateStub.balance.set(patched);
    expect(host.options[0]?.balance()).toBe(patched);
  });

  it('destroys the session with the panel', async () => {
    attachLens();
    preview.show(CELL_SPEC);
    settleSelection();
    await host.handles[0]?.completeOpen();

    fixture.destroy();
    expect(host.handles[0]?.destroyCount).toBe(1);
  });
});
