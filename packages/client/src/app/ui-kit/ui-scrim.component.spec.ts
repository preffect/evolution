import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostSelector, styleRuleValue } from '../../testing/style-rules';
import { UiScrimComponent } from './ui-scrim.component';

@Component({
  standalone: true,
  imports: [UiScrimComponent],
  template: `<ui-scrim [alpha]="0.6" testId="scrim" />`,
})
class ScrimHostComponent {}

describe('UiScrimComponent', () => {
  let fixture: ComponentFixture<ScrimHostComponent>;

  function scrim(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-testid="scrim"]')!;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ScrimHostComponent] });
    fixture = TestBed.createComponent(ScrimHostComponent);
    fixture.detectChanges();
  });

  it('is the callout backing at the overlay’s own alpha', () => {
    expect(scrim().style.getPropertyValue('--ui-scrim-alpha')).toBe('0.6');
    const background = styleRuleValue(document, [hostSelector(scrim())], 'background-color');
    expect(background).toContain('var(--ui-callout-backing)');
    expect(background).toContain('var(--ui-scrim-alpha)');
  });

  it('covers its layer and takes the pointer, so a click never reaches the dish', () => {
    const host = hostSelector(scrim());
    expect(styleRuleValue(document, [host], 'inset')).toBe('0px');
    expect(styleRuleValue(document, [host], 'pointer-events')).toBe('auto');
    expect(scrim().getAttribute('aria-hidden')).toBe('true');
  });

  it('fades in with the panel, and not at all under reduced motion', () => {
    const host = hostSelector(scrim());
    expect(styleRuleValue(document, [host], 'animation')).toContain('var(--ui-panel-enter)');
    expect(styleRuleValue(document, [host], 'animation', 'prefers-reduced-motion')).toBe('none');
  });
});
