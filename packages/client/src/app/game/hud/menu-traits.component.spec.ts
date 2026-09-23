import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TRAIT_CATALOG } from '@evolution/shared';
import { traitEntryId, type MenuTraitRow } from './format/menu-traits';
import { MENU_TRAITS_VISIBLE_ROWS, MENU_TRAIT_LINE_HEIGHT_PX, MENU_TRAIT_ROW_HEIGHT_PX } from './hud-constants';
import { MenuTraitsComponent } from './menu-traits.component';

/** A row as drawn with one effect line, and one whose effects wrap onto a second line. */
const ONE_LINE_PX = MENU_TRAIT_ROW_HEIGHT_PX;
const TWO_LINES_PX = MENU_TRAIT_ROW_HEIGHT_PX + MENU_TRAIT_LINE_HEIGHT_PX;

/** Real catalog traits, so each row draws its glyph the way the menu does. */
function rowsFor(count: number): MenuTraitRow[] {
  return TRAIT_CATALOG.slice(0, count).map((trait) => ({
    traitId: trait.id,
    name: `${trait.name} I`,
    effects: ['+5 % speed'],
    effectTones: ['benefit'],
    entryId: traitEntryId(trait.id),
  }));
}

describe('MenuTraitsComponent, the list cap (docs/ui/overlays.md §3.5)', () => {
  let fixture: ComponentFixture<MenuTraitsComponent>;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function scrollAreaMaxHeight(): string {
    return root().querySelector<HTMLElement>('ui-scroll-area')?.style.maxHeight ?? '';
  }

  /** jsdom lays nothing out: gives each row the height it would be drawn with, then re-measures. */
  function drawRowsAt(heightsPx: readonly number[]): void {
    const rows = [...root().querySelectorAll<HTMLElement>('ui-list-row')];
    rows.forEach((row, index) => {
      Object.defineProperty(row, 'offsetHeight', { configurable: true, value: heightsPx[index] ?? ONE_LINE_PX });
    });
    fixture.componentInstance.measure();
    fixture.detectChanges();
  }

  function show(rows: MenuTraitRow[]): void {
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MenuTraitsComponent] });
    fixture = TestBed.createComponent(MenuTraitsComponent);
    fixture.componentRef.setInput('rows', []);
    fixture.detectChanges();
  });

  it('caps nothing while the list fits, however tall its rows are drawn', () => {
    show(rowsFor(MENU_TRAITS_VISIBLE_ROWS));
    drawRowsAt(Array<number>(MENU_TRAITS_VISIBLE_ROWS).fill(TWO_LINES_PX));
    expect(scrollAreaMaxHeight()).toBe('');
  });

  it('caps a longer list at the first five rows as drawn, so a two-line row is never sliced', () => {
    show(rowsFor(MENU_TRAITS_VISIBLE_ROWS + 2));
    // Two of the five rows carry a second effect line, as Simple Flagellum I and Cell Wall II do.
    drawRowsAt([ONE_LINE_PX, TWO_LINES_PX, ONE_LINE_PX, TWO_LINES_PX, ONE_LINE_PX, ONE_LINE_PX, ONE_LINE_PX]);

    const expectedPx = ONE_LINE_PX * 3 + TWO_LINES_PX * 2;
    expect(scrollAreaMaxHeight()).toBe(`${expectedPx}px`);
    // The fixed rows × row-height cap this replaces would have been shorter, and cut the fifth row through its text.
    expect(expectedPx).toBeGreaterThan(MENU_TRAITS_VISIBLE_ROWS * MENU_TRAIT_ROW_HEIGHT_PX);
  });

  it('has nothing to cap before the first pick', () => {
    expect(root().querySelector('ui-scroll-area')).toBeNull();
    expect(root().textContent).toContain('No traits yet');
  });
});
