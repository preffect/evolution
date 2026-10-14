// The real-life note (docs/ui/encyclopedia.md §11.4): under the prose of an entry about a real organism, one true line
// about it and its real size in words, drawn as a field note so the world outside the dish stands apart from the rules.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ENCYCLOPEDIA_REAL_LIFE_LABEL, ENCYCLOPEDIA_REAL_SIZE_LABEL } from './encyclopedia-constants';
import type { RealLifeNote } from './model/entry';
import { ENCYCLOPEDIA_TEST_ID } from './test-ids';

@Component({
  selector: 'app-encyclopedia-real-life',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './encyclopedia-real-life.component.css',
  host: { '[attr.data-testid]': 'testId' },
  template: `
    <h4 class="heading">{{ realLifeLabel }}</h4>
    <p class="line">{{ note().line }}</p>
    <p class="size">
      <span class="size-label">{{ realSizeLabel }}</span>
      <span>{{ note().size }}</span>
    </p>
  `,
})
export class EncyclopediaRealLifeComponent {
  readonly note = input.required<RealLifeNote>();

  protected readonly testId = ENCYCLOPEDIA_TEST_ID.realLife;
  protected readonly realLifeLabel = ENCYCLOPEDIA_REAL_LIFE_LABEL;
  protected readonly realSizeLabel = ENCYCLOPEDIA_REAL_SIZE_LABEL;
}
