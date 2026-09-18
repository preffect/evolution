// The entry page's prose (docs/ui/encyclopedia.md §11.4): the three segment kinds, the paragraphs they fall into, and
// the push a link makes. The state service here is the real one — what a link does to the back stack is the point.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectTestId } from '../../../testing/test-id-query';
import { EncyclopediaProseComponent } from './encyclopedia-prose.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import type { ProseSegment } from './model/entry';
import type { EntryId } from './model/entry-id';
import { PROSE_TOKEN } from './model/prose';
import { encyclopediaLinkTestId } from './test-ids';

const CILIA = 'trait:cilia' as EntryId;
const TIER_TWO = 'tier_2';

const SEGMENTS: readonly ProseSegment[] = [
  { kind: PROSE_TOKEN.text, text: 'A first line.\n\nSpeed rises by ' },
  { kind: PROSE_TOKEN.value, factKey: 'speedMultiplier', text: '+20 %' },
  { kind: PROSE_TOKEN.text, text: ' with ' },
  { kind: PROSE_TOKEN.link, entryId: CILIA, sectionKey: TIER_TWO, text: 'a second fringe' },
];

describe('EncyclopediaProseComponent (docs/ui/encyclopedia.md §11.4)', () => {
  let fixture: ComponentFixture<EncyclopediaProseComponent>;
  let state: EncyclopediaStateService;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EncyclopediaProseComponent] });
    state = TestBed.inject(EncyclopediaStateService);
    fixture = TestBed.createComponent(EncyclopediaProseComponent);
    fixture.componentRef.setInput('segments', SEGMENTS);
    fixture.detectChanges();
  });

  it('breaks at the blank line and keeps the rest of the run in the paragraph it started', () => {
    const paragraphs = [...root().querySelectorAll('.paragraph')];
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.textContent).toBe('A first line.');
    // Exactly, with no trim or collapse: a link is `display: inline` here, so whitespace the template leaves around
    // its text is not trimmed away and `starts [[stage:endosymbiosis]].` would read `starts Endosymbiosis .`.
    expect(paragraphs[1]?.textContent).toBe('Speed rises by +20 % with a second fringe');
  });

  it('draws a value as the figure the facts table shows, and plain text as neither', () => {
    const values = [...root().querySelectorAll('.value')].map((span) => span.textContent);
    expect(values).toEqual(['+20 %']);
    expect(root().querySelectorAll('.link')).toHaveLength(1);
  });

  it('pushes the entry a link names, with the section it was anchored to, so Back returns', () => {
    expect(state.canGoBack()).toBe(false);
    expectTestId(root(), encyclopediaLinkTestId(CILIA)).click();
    expect(state.location()).toMatchObject({ entryId: CILIA, sectionKey: TIER_TWO });
    expect(state.canGoBack()).toBe(true);
  });

  it('carries no section for a link that named a whole entry, so it opens at the top', () => {
    fixture.componentRef.setInput('segments', [
      { kind: PROSE_TOKEN.link, entryId: CILIA, sectionKey: null, text: 'Cilia Fringe' },
    ]);
    fixture.detectChanges();
    expectTestId(root(), encyclopediaLinkTestId(CILIA)).click();
    expect(state.location().sectionKey).toBeNull();
  });
});
