// The entry page (docs/ui/encyclopedia.md §11.4): the frame a link steers by, the title column's chips, the two facts
// tables, the prose, See also, and what the lens column hands the preview.
//
// **jsdom has no layout, no user-agent cascade and no GL**, so nothing here claims anything about size, colour, focus
// or what the lens shows: the geometry of §11.4 and the eyepiece reading as deliberate are the rendered frames' to
// answer, and the screenshots on the PR are where they are answered. What a spec can hold is what is drawn, what it
// says, and which spec reached the preview seam.

import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BALANCE, type BalanceConfig, type OwnedTrait, type TraitTier } from '@evolution/shared';
import { recordingPreviewHost, type RecordingPreviewHost } from '../../../testing/fake-preview-handle';
import { expectTestId, queryAllByTestId, queryByTestId } from '../../../testing/test-id-query';
import { ENCYCLOPEDIA_PREVIEW } from '../render/preview/preview-host';
import type { PreviewSpec } from '../render/preview/preview-spec';
import { GameStateService } from '../state/game-state.service';
import { EncyclopediaEntryComponent } from './encyclopedia-entry.component';
import { EncyclopediaPreviewService } from './encyclopedia-preview.service';
import {
  ENCYCLOPEDIA_EFFECTS_TABLE_LABEL,
  ENCYCLOPEDIA_FACTS_TABLE_LABEL,
  ENCYCLOPEDIA_LADDER_TABLE_LABEL,
  ENCYCLOPEDIA_OWNED_CHIP_LABEL,
  ENCYCLOPEDIA_PREVIEW_SETTLE_MS,
  ENCYCLOPEDIA_SEE_ALSO_LABEL,
  ENCYCLOPEDIA_TIER_CAPTION_PREFIX,
} from './encyclopedia-constants';
import { factNameFromNoun } from './format/entry-view';
import { ENCYCLOPEDIA_CATEGORY_LABEL } from './model/categories';
import type { ResolvedEntry } from './model/entry';
import { ENTRY_SUBJECT, ENTRY_SUBJECT_LABEL, type EntryId } from './model/entry-id';
import { ENTRY_GROUP_LABEL } from './model/groups';
import { resolveEntry } from './registry';
import { ENCYCLOPEDIA_TEST_ID, encyclopediaLinkTestId, encyclopediaTierTestId } from './test-ids';

const MITOCHONDRION = 'trait:mitochondrion' as EntryId;
const PROTOCELL = 'stage:protocell' as EntryId;
const SECOND_TIER = 2 as TraitTier;

/** Only what this page reads of the game state: the balance the registry resolves over, and the round's own traits. */
const gameStateStub = {
  balance: signal<BalanceConfig | null>(null),
  ownProgress: signal<{ readonly ownedTraits: readonly OwnedTrait[] } | null>(null),
};

function resolve(entryId: EntryId): ResolvedEntry {
  return resolveEntry(entryId, { balance: DEFAULT_BALANCE });
}

describe('EncyclopediaEntryComponent (docs/ui/encyclopedia.md §11.4)', () => {
  let fixture: ComponentFixture<EncyclopediaEntryComponent>;
  let entry: ResolvedEntry;
  let previewHost: RecordingPreviewHost;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function show(shown: ResolvedEntry): void {
    entry = shown;
    fixture.componentRef.setInput('entry', shown);
    fixture.detectChanges();
  }

  /** The settle §11.4 asks for, then the first frame: what a reader has waited through before they touch anything. */
  async function openLens(): Promise<void> {
    vi.advanceTimersByTime(ENCYCLOPEDIA_PREVIEW_SETTLE_MS);
    await previewHost.handles[0]?.completeOpen();
  }

  function sectionPreviewOf(tier: TraitTier): PreviewSpec | null {
    return entry.sections.find((section) => section.key === `tier_${tier}`)?.preview ?? null;
  }

  function chipTexts(): string[] {
    return [...root().querySelectorAll('ui-chip')].map((chip) => chip.textContent?.trim() ?? '');
  }

  /** The tables in document order, each as its header and its row names. */
  function tables(): { heading: string; names: string[] }[] {
    return [...root().querySelectorAll('app-encyclopedia-facts')].map((table) => ({
      heading: table.querySelector('.heading')?.textContent?.trim() ?? '',
      names: [...table.querySelectorAll('tbody th.name')].map((cell) => cell.textContent?.trim() ?? ''),
    }));
  }

  beforeEach(() => {
    // The lens's selection settles on a timer (§11.4), so the clock is the spec's: every assertion about what
    // reached the preview advances it deliberately rather than waiting on a real 150 ms.
    vi.useFakeTimers();
    gameStateStub.ownProgress.set(null);
    previewHost = recordingPreviewHost();
    TestBed.configureTestingModule({
      imports: [EncyclopediaEntryComponent],
      providers: [
        { provide: GameStateService, useValue: gameStateStub },
        { provide: ENCYCLOPEDIA_PREVIEW, useValue: previewHost.factory },
        EncyclopediaPreviewService,
      ],
    });
    fixture = TestBed.createComponent(EncyclopediaEntryComponent);
    show(resolve(MITOCHONDRION));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('carries `encyclopedia-entry` with the entry it is showing, which is what a link steers by', () => {
    expect(root().getAttribute('data-testid')).toBe(ENCYCLOPEDIA_TEST_ID.entry);
    expect(root().getAttribute('data-entry-id')).toBe(entry.id);
  });

  it('follows the entry when the input changes rather than keeping the first one it drew', () => {
    const other = resolve(PROTOCELL);
    show(other);
    expect(root().getAttribute('data-entry-id')).toBe(other.id);
    expect(root().querySelector('.title')?.textContent?.trim()).toBe(other.title);
  });

  it('shows the title, and the category and group it lives under', () => {
    expect(root().querySelector('.title')?.textContent?.trim()).toBe(entry.title);
    const crumbs = root().querySelector('nav')?.textContent ?? '';
    expect(crumbs).toContain(ENCYCLOPEDIA_CATEGORY_LABEL[entry.category]);
    expect(entry.group).not.toBeNull();
    expect(crumbs).toContain(ENTRY_GROUP_LABEL[entry.group!]);
  });

  it('chips a trait with its rarity, tags and stage, and no owned chip outside a round', () => {
    const subject = entry.subject;
    if (subject.kind !== ENTRY_SUBJECT.trait) throw new Error('the mitochondrion entry is a trait');
    expect(chipTexts()).toContain(subject.rarity);
    expect(chipTexts()).toHaveLength(subject.dnaTags.length + 2);
    expect(chipTexts().some((text) => text.startsWith(ENCYCLOPEDIA_OWNED_CHIP_LABEL))).toBe(false);
  });

  it('adds the owned chip and tints the owned tier’s column once the round owns the trait', () => {
    const subject = entry.subject;
    if (subject.kind !== ENTRY_SUBJECT.trait) throw new Error('the mitochondrion entry is a trait');
    gameStateStub.ownProgress.set({ ownedTraits: [{ traitId: subject.traitId, tier: SECOND_TIER }] });
    fixture.detectChanges();
    expect(chipTexts().some((text) => text.startsWith(ENCYCLOPEDIA_OWNED_CHIP_LABEL))).toBe(true);
    const header = root().querySelector('thead .name')?.textContent?.trim();
    expect(header).toBe(`${ENCYCLOPEDIA_TIER_CAPTION_PREFIX}II`);
    expect(root().querySelectorAll('thead .value[data-highlighted]')).toHaveLength(1);
  });

  it('stacks the trait’s two tables under the headers §11.4 names, effects first', () => {
    const drawn = tables();
    expect(drawn.map((table) => table.heading)).toEqual([
      ENCYCLOPEDIA_EFFECTS_TABLE_LABEL,
      ENCYCLOPEDIA_LADDER_TABLE_LABEL,
    ]);
    expect(drawn[0]?.names).toEqual(entry.sections[0]?.facts.map((fact) => factNameFromNoun(fact.label)));
    expect(drawn[1]?.names.length).toBeGreaterThan(0);
  });

  it('gives an entry with no tiers one table and one kind chip, never an empty effects table', () => {
    show(resolve(PROTOCELL));
    expect(tables().map((table) => table.heading)).toEqual([ENCYCLOPEDIA_FACTS_TABLE_LABEL]);
    expect(chipTexts()).toEqual([ENTRY_SUBJECT_LABEL[ENTRY_SUBJECT.stage]]);
  });

  it('draws the summary’s prose and a See also chip per link, each carrying that entry’s link id', () => {
    const prose = root().querySelector('app-encyclopedia-prose')!;
    expect(prose.textContent).toContain('aerobic bacterium');
    expect(queryByTestId(prose, encyclopediaLinkTestId('stage:endosymbiosis' as EntryId))).not.toBeNull();
    const seeAlso = root().querySelector('.see-also');
    expect(seeAlso?.querySelector('.heading')?.textContent?.trim()).toBe(ENCYCLOPEDIA_SEE_ALSO_LABEL);
    expect(seeAlso?.querySelectorAll('[uiLinkChip]')).toHaveLength(entry.seeAlso.length);
    for (const link of entry.seeAlso) {
      expect(queryByTestId(seeAlso!, encyclopediaLinkTestId(link.entryId))).not.toBeNull();
    }
  });

  it('opens the lens on a trait’s first tier, and on a plain entry’s own preview', async () => {
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.preview)).not.toBeNull();
    await openLens();
    // A trait's lens follows its tier switch, which starts on the first tier; the entry's own spec is what an
    // entry with no tier section has, and it is a different object even where it describes the same cell.
    expect(previewHost.handles[0]?.shownSpecs).toEqual([entry.sections[0]?.preview]);

    show(resolve(PROTOCELL));
    vi.advanceTimersByTime(ENCYCLOPEDIA_PREVIEW_SETTLE_MS);
    expect(previewHost.handles[0]?.shownSpecs.at(-1)).toBe(entry.preview);
  });

  /**
   * The lens column is a trait's; an entry whose `preview` is `null` has none at all (§11.4). Nothing in the
   * registry has a null preview today, so the case is made here rather than found: the guard is the branch, not
   * the data.
   */
  it('has no lens column at all for an entry with no preview', () => {
    show({ ...resolve(PROTOCELL), preview: null });
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.preview)).toBeNull();
  });

  /**
   * §11.4's tier switch: one segment per tier section, and selecting one shows **that tier's** preview — which is
   * the whole point of the control, and the half a "the segments are drawn" guard would miss.
   */
  it('switches the lens between a trait’s tiers', async () => {
    expect(root().querySelectorAll('app-encyclopedia-lens-control button')).toHaveLength(entry.sections.length);
    await openLens();

    expectTestId(root(), encyclopediaTierTestId(SECOND_TIER)).click();
    fixture.detectChanges();
    vi.advanceTimersByTime(ENCYCLOPEDIA_PREVIEW_SETTLE_MS);
    expect(previewHost.handles[0]?.shownSpecs.at(-1)).toBe(sectionPreviewOf(SECOND_TIER));
  });

  it('starts the switch on the tier the round owns', async () => {
    const subject = entry.subject;
    if (subject.kind !== ENTRY_SUBJECT.trait) throw new Error('the mitochondrion entry is a trait');
    await openLens();

    gameStateStub.ownProgress.set({ ownedTraits: [{ traitId: subject.traitId, tier: SECOND_TIER }] });
    fixture.detectChanges();
    vi.advanceTimersByTime(ENCYCLOPEDIA_PREVIEW_SETTLE_MS);
    expect(previewHost.handles[0]?.shownSpecs.at(-1)).toBe(sectionPreviewOf(SECOND_TIER));
    expect(expectTestId(root(), encyclopediaTierTestId(SECOND_TIER)).getAttribute('aria-pressed')).toBe('true');
  });

  it('draws both facts tables under the one facts id, the first of which a test takes (§11.6)', () => {
    expect(queryAllByTestId(root(), ENCYCLOPEDIA_TEST_ID.facts)).toHaveLength(2);
  });
});
