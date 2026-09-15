import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UI_ACCENT } from '../game/render/constants/colours';
import { UI_SCALE_VARIABLE } from './format/ui-css-variables';
import { UI_REFERENCE_VIEWPORT_HEIGHT_PX, UI_REFERENCE_VIEWPORT_WIDTH_PX, UI_SCALE_MIN } from './ui-kit-constants';
import { UiSurfaceDirective } from './ui-surface.directive';

@Component({
  standalone: true,
  imports: [UiSurfaceDirective],
  template: `<div uiSurface data-testid="surface"></div>`,
})
class SurfaceHostComponent {}

/** jsdom lays nothing out, so the host's box is stubbed before the directive's first read. */
function stubBox(element: HTMLElement, widthPx: number, heightPx: number): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, widthPx, heightPx));
}

describe('UiSurfaceDirective', () => {
  let fixture: ComponentFixture<SurfaceHostComponent>;

  function surface(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-testid="surface"]')!;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SurfaceHostComponent] });
    fixture = TestBed.createComponent(SurfaceHostComponent);
  });

  afterEach(() => vi.restoreAllMocks());

  it('sets --ui-scale 1 on a reference-viewport host and spreads every --ui- token', () => {
    stubBox(surface(), UI_REFERENCE_VIEWPORT_WIDTH_PX, UI_REFERENCE_VIEWPORT_HEIGHT_PX);
    fixture.detectChanges();
    expect(surface().style.getPropertyValue(UI_SCALE_VARIABLE)).toBe('1');
    expect(surface().style.getPropertyValue('--ui-accent')).toBe(UI_ACCENT);
    expect(surface().style.getPropertyValue('--ui-button-height')).toBe('40px');
  });

  it('pins the scale on a 1920 × 1080 viewport-sized host: its height ratio wins', () => {
    stubBox(surface(), 1920, 1080);
    fixture.detectChanges();
    expect(surface().style.getPropertyValue(UI_SCALE_VARIABLE)).toBe('1.35');
  });

  it('clamps the scale on a small viewport', () => {
    stubBox(surface(), 400, 300);
    fixture.detectChanges();
    expect(surface().style.getPropertyValue(UI_SCALE_VARIABLE)).toBe(String(UI_SCALE_MIN));
  });

  it('stops observing when the layer goes away', () => {
    stubBox(surface(), UI_REFERENCE_VIEWPORT_WIDTH_PX, UI_REFERENCE_VIEWPORT_HEIGHT_PX);
    fixture.detectChanges();
    expect(() => fixture.destroy()).not.toThrow();
  });
});
