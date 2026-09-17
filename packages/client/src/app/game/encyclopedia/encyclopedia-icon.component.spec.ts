// The rail's marks and the header's two, and the one renderer they go through (docs/ui/encyclopedia.md §11.3).

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { EncyclopediaIconComponent } from './encyclopedia-icon.component';
import {
  ENCYCLOPEDIA_BACK_ICON,
  ENCYCLOPEDIA_CATEGORY_ICON,
  ENCYCLOPEDIA_CLOSE_ICON,
  type EncyclopediaIcon,
} from './encyclopedia-icons';
import { ENCYCLOPEDIA_CATEGORY_ORDER } from './model/categories';

const EVERY_ICON: readonly (readonly [string, EncyclopediaIcon])[] = [
  ...ENCYCLOPEDIA_CATEGORY_ORDER.map((category) => [category, ENCYCLOPEDIA_CATEGORY_ICON[category]] as const),
  ['back', ENCYCLOPEDIA_BACK_ICON] as const,
  ['close', ENCYCLOPEDIA_CLOSE_ICON] as const,
];

describe('the encyclopedia icons (docs/ui/encyclopedia.md §11.3)', () => {
  let fixture: ComponentFixture<EncyclopediaIconComponent>;

  function draw(icon: EncyclopediaIcon): SVGElement {
    fixture.componentRef.setInput('icon', icon);
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
    if (svg === null) throw new Error('the icon drew no svg');
    return svg;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EncyclopediaIconComponent] });
    fixture = TestBed.createComponent(EncyclopediaIconComponent);
  });

  it('gives every category a mark, so no rail row is drawn with an empty leading slot', () => {
    expect(ENCYCLOPEDIA_CATEGORY_ORDER.every((category) => ENCYCLOPEDIA_CATEGORY_ICON[category] !== undefined)).toBe(
      true,
    );
  });

  it.each(EVERY_ICON)('draws %s as one path per shape, each with its own data', (_name, icon) => {
    const paths = [...draw(icon).querySelectorAll('path')];
    expect(paths).toHaveLength(icon.paths.length);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.map((path) => path.getAttribute('d'))).toEqual(icon.paths.map((path) => path.d));
  });

  it.each(EVERY_ICON)('draws %s in its own view box', (_name, icon) => {
    expect(draw(icon).getAttribute('viewBox')).toBe(icon.viewBox);
  });

  it('dashes only the path that asks for it, and fills only the one that does', () => {
    const icon = ENCYCLOPEDIA_CATEGORY_ICON.world;
    const paths = [...draw(icon).querySelectorAll('path')];
    expect(paths.map((path) => path.getAttribute('stroke-dasharray'))).toEqual(
      icon.paths.map((path) => path.dashArray),
    );
    expect(paths.filter((path) => path.classList.contains('filled'))).toHaveLength(0);
  });

  it('fills a dot, which a ring that small would only smudge', () => {
    const icon = ENCYCLOPEDIA_CATEGORY_ICON.basics;
    const filled = [...draw(icon).querySelectorAll('path')].filter((path) => path.classList.contains('filled'));
    expect(filled).toHaveLength(icon.paths.filter((path) => path.isFilled).length);
    expect(filled).toHaveLength(1);
  });

  it('hides itself from a screen reader: the control around it carries the name', () => {
    expect(draw(ENCYCLOPEDIA_BACK_ICON).getAttribute('aria-hidden')).toBe('true');
  });
});
