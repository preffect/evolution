// The entry area in build 1 (docs/ui/encyclopedia.md §11.4): the frame #373's page arrives into — the element
// carrying `encyclopedia-entry` and its `data-entry-id`, the breadcrumb, and the title.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { queryByTestId } from '../../../testing/test-id-query';
import { EncyclopediaEntryComponent } from './encyclopedia-entry.component';
import { ENCYCLOPEDIA_CATEGORY_LABEL } from './model/categories';
import type { ResolvedEntry } from './model/entry';
import type { EntryId } from './model/entry-id';
import { ENTRY_GROUP_LABEL } from './model/groups';
import { resolveEntry } from './registry';
import { ENCYCLOPEDIA_TEST_ID } from './test-ids';

const MITOCHONDRION = 'trait:mitochondrion' as EntryId;

function resolve(entryId: EntryId): ResolvedEntry {
  return resolveEntry(entryId, { balance: DEFAULT_BALANCE });
}

describe('EncyclopediaEntryComponent (docs/ui/encyclopedia.md §11.4)', () => {
  let fixture: ComponentFixture<EncyclopediaEntryComponent>;
  let entry: ResolvedEntry;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    entry = resolve(MITOCHONDRION);
    TestBed.configureTestingModule({ imports: [EncyclopediaEntryComponent] });
    fixture = TestBed.createComponent(EncyclopediaEntryComponent);
    fixture.componentRef.setInput('entry', entry);
    fixture.detectChanges();
  });

  it('carries `encyclopedia-entry` with the entry it is showing, which is what a link steers by', () => {
    expect(root().getAttribute('data-testid')).toBe(ENCYCLOPEDIA_TEST_ID.entry);
    expect(root().getAttribute('data-entry-id')).toBe(entry.id);
  });

  it('follows the entry when the input changes rather than keeping the first one it drew', () => {
    const other = resolve('stage:protocell' as EntryId);
    fixture.componentRef.setInput('entry', other);
    fixture.detectChanges();
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

  it('draws no lens and no facts table: the page itself is #373', () => {
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.preview)).toBeNull();
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.facts)).toBeNull();
  });
});
