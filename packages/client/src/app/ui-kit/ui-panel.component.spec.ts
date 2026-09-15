import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostSelector, styleRuleValue } from '../../testing/style-rules';
import { UiPanelSectionComponent } from './ui-panel-section.component';
import { UI_PANEL_VARIANT, UiPanelComponent, type UiPanelVariant } from './ui-panel.component';

@Component({
  standalone: true,
  imports: [UiPanelComponent, UiPanelSectionComponent],
  template: `
    <ui-panel testId="panel" [variant]="variant()" [title]="title()">
      <button uiPanelHeader data-testid="header-control">Close</button>
      <p data-testid="body">Body</p>
      <button uiPanelFooter data-testid="footer-control">Done</button>
    </ui-panel>
    <ui-panel testId="side" variant="side">
      <ui-panel-section heading="Mass" testId="section-mass"><p>Food</p></ui-panel-section>
      <ui-panel-section heading="Here" testId="section-here"><p>Warm vent</p></ui-panel-section>
    </ui-panel>
  `,
})
class PanelHostComponent {
  readonly variant = signal<UiPanelVariant>(UI_PANEL_VARIANT.modal);
  readonly title = signal<string | null>('Menu');
}

describe('UiPanelComponent', () => {
  let fixture: ComponentFixture<PanelHostComponent>;

  function byTestId(testId: string): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
  }

  function set(update: (host: PanelHostComponent) => void): void {
    update(fixture.componentInstance);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PanelHostComponent] });
    fixture = TestBed.createComponent(PanelHostComponent);
    fixture.detectChanges();
  });

  it('a modal is a dialog labelled by its title', () => {
    const panel = byTestId('panel');
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    const labelId = panel.getAttribute('aria-labelledby')!;
    expect(document.getElementById(labelId)?.textContent?.trim()).toBe('Menu');
  });

  it('with no title it renders no heading and claims no label', () => {
    set((host) => host.title.set(null));
    expect(byTestId('panel').querySelector('h2')).toBeNull();
    expect(byTestId('panel').hasAttribute('aria-labelledby')).toBe(false);
  });

  it('projects the header, the body and the footer into their slots', () => {
    expect(byTestId('header-control').closest('.header')).not.toBeNull();
    expect(byTestId('body').closest('.body')).not.toBeNull();
    expect(byTestId('footer-control').closest('.footer')).not.toBeNull();
  });

  it('a side panel is a region, never modal', () => {
    expect(byTestId('side').getAttribute('role')).toBe('region');
    expect(byTestId('side').hasAttribute('aria-modal')).toBe(false);
    set((host) => host.variant.set(UI_PANEL_VARIANT.side));
    expect(byTestId('panel').getAttribute('role')).toBe('region');
  });

  it('a section is a group labelled by its label heading', () => {
    const section = byTestId('section-here');
    expect(section.getAttribute('role')).toBe('group');
    expect(document.getElementById(section.getAttribute('aria-labelledby')!)?.textContent?.trim()).toBe('Here');
    const sectionHost = hostSelector(section);
    expect(styleRuleValue(document, [sectionHost, ':not(:first-child)'], 'border-top')).toContain(
      'var(--ui-panel-rim)',
    );
  });

  describe('its look (docs/ui/components-and-constants.md §10.2)', () => {
    function rule(fragments: readonly string[], property: string, media: string | null = null): string | null {
      return styleRuleValue(document, [hostSelector(byTestId('panel')), ...fragments], property, media);
    }

    it('modal: the opaque panel gradient, the panel radius and padding, and a lit top edge', () => {
      expect(rule(['modal'], 'background')).toBe('linear-gradient(var(--ui-panel-top), var(--ui-panel-bottom))');
      expect(rule(['modal'], 'padding')).toBe('calc(var(--ui-panel-padding) * var(--ui-scale))');
      expect(rule([], 'border-radius')).toBe('calc(var(--ui-radius-panel) * var(--ui-scale))');
      expect(rule(['modal', '::before'], 'background-color')).toContain('var(--ui-panel-edge-alpha)');
    });

    it('modal: enters over the panel-enter time, and appears without rising under reduced motion', () => {
      expect(rule(['modal'], 'animation')).toContain('var(--ui-panel-enter)');
      expect(rule(['modal'], 'animation', 'prefers-reduced-motion')).toBe('none');
    });

    it('side: its width, a translucent gradient over a blur, no motion, and the pointer only on its controls', () => {
      expect(rule(['side'], 'width')).toBe('calc(var(--ui-side-panel-width) * var(--ui-scale))');
      expect(rule(['side'], 'background')).toContain('var(--ui-side-panel-alpha)');
      expect(rule(['side'], 'backdrop-filter')).toContain('var(--ui-side-panel-blur)');
      expect(rule(['side'], 'animation')).toBeNull();
      expect(rule(['side'], 'pointer-events')).toBe('none');
    });

    it('hides an empty header or footer', () => {
      expect(styleRuleValue(document, ['.header', ':empty'], 'display')).toBe('none');
      expect(styleRuleValue(document, ['.footer', ':empty'], 'display')).toBe('none');
    });
  });
});
