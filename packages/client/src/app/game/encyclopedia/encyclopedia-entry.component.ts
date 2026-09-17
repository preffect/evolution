// The entry page (docs/ui/encyclopedia.md §11.4) — in build 1, its title and breadcrumb only.
//
// **The page itself is #373**: the lens, the tier sections, the facts tables, the prose and its links all land there,
// and `encyclopedia-preview`, `encyclopedia-facts` and `encyclopedia-link-<entryId>` arrive with them. What this file
// settles now is the frame they arrive into: the element carrying `encyclopedia-entry` and its `data-entry-id`, which
// is what a link, a row and the acceptance loop all steer by.

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UiScrollAreaComponent } from '../../ui-kit/ui-scroll-area.component';
import { EncyclopediaBreadcrumbComponent } from './encyclopedia-breadcrumb.component';
import { entryBreadcrumb } from './format/landing-view';
import type { ResolvedEntry } from './model/entry';
import { ENTRY_GROUP_LABEL } from './model/groups';
import { ENCYCLOPEDIA_TEST_ID } from './test-ids';

@Component({
  selector: 'app-encyclopedia-entry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EncyclopediaBreadcrumbComponent, UiScrollAreaComponent],
  styleUrl: './encyclopedia-entry.component.css',
  host: { '[attr.data-testid]': 'testId.entry', '[attr.data-entry-id]': 'entry().id' },
  template: `
    <ui-scroll-area class="scroll" [label]="entry().title">
      <div class="page">
        <app-encyclopedia-breadcrumb [crumbs]="crumbs()" />
        <h3 class="title">{{ entry().title }}</h3>
      </div>
    </ui-scroll-area>
  `,
})
export class EncyclopediaEntryComponent {
  readonly entry = input.required<ResolvedEntry>();

  protected readonly testId = ENCYCLOPEDIA_TEST_ID;

  /** The first crumb is a link back to the category the entry lives in, which a link may have switched (§11.5). */
  protected readonly crumbs = computed(() => {
    const group = this.entry().group;
    return entryBreadcrumb(this.entry().category, group === null ? null : ENTRY_GROUP_LABEL[group]);
  });
}
