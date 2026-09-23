// The detail column's breadcrumb (docs/ui/encyclopedia.md §11.3): `Encyclopedia › Cells & food`, and on an entry its
// title after that. The landing and the entry area both wear it, so it is one component over one pure trail.
//
// A crumb with a target is a button back to that category's landing, which §11.5 counts as a move that pushes; the
// crumb naming the page already shown is plain text, since going there would change nothing.

import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ENCYCLOPEDIA_CRUMB_SEPARATOR } from './encyclopedia-constants';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import type { EncyclopediaCrumb } from './format/landing-view';
import type { EncyclopediaCategory } from './model/categories';
import { encyclopediaCrumbTestId } from './test-ids';

@Component({
  selector: 'app-encyclopedia-breadcrumb',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './encyclopedia-breadcrumb.component.css',
  template: `
    <nav class="crumbs" aria-label="Breadcrumb">
      @for (crumb of crumbs(); track $index; let isFirst = $first) {
        @if (!isFirst) {
          <span class="separator" aria-hidden="true">{{ separator }}</span>
        }
        @if (crumb.target; as category) {
          <button type="button" class="crumb link" [attr.data-testid]="crumbTestId(category)" (click)="goTo(category)">
            {{ crumb.text }}
          </button>
        } @else {
          <span class="crumb">{{ crumb.text }}</span>
        }
      }
    </nav>
  `,
})
export class EncyclopediaBreadcrumbComponent {
  private readonly state = inject(EncyclopediaStateService);

  readonly crumbs = input.required<readonly EncyclopediaCrumb[]>();

  /** Decorative, so a screen reader reads the crumbs as a list and not as punctuation. */
  protected readonly separator = ENCYCLOPEDIA_CRUMB_SEPARATOR;
  protected readonly crumbTestId = encyclopediaCrumbTestId;

  protected goTo(category: EncyclopediaCategory): void {
    this.state.selectCategory(category);
  }
}
