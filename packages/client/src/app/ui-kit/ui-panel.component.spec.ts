import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostSelector, styleRuleValue } from '../../testing/style-rules';
import { focusableElementsIn } from './focus-trap-stack';
import { UiFocusTrapDirective } from './ui-focus-trap.directive';
import { UiPanelSectionComponent } from './ui-panel-section.component';
import { UiScrollAreaComponent } from './ui-scroll-area.component';
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

/** jsdom lays nothing out: gives the body scroll area inside `panel` the box of an overflowing body. */
function overflowBodyOf(fixture: ComponentFixture<unknown>, panel: HTMLElement): HTMLElement {
  const area = fixture.debugElement
    .queryAll(By.directive(UiScrollAreaComponent))
    .find((found) => panel.contains(found.nativeElement as HTMLElement))!;
  const viewport = (area.nativeElement as HTMLElement).querySelector<HTMLElement>('.viewport')!;
  Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 600 });
  Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 200 });
  (area.componentInstance as UiScrollAreaComponent).measure();
  fixture.detectChanges();
  return viewport;
}

@Component({
  standalone: true,
  imports: [UiPanelComponent, UiFocusTrapDirective],
  template: `
    <ui-panel testId="trapped" title="Leave the game?" uiFocusTrap>
      <p>Your cell leaves the dish. The round goes on without you.</p>
    </ui-panel>
  `,
})
class TrappedPanelHostComponent {}

@Component({
  standalone: true,
  imports: [UiPanelComponent],
  template: `<ui-panel testId="menu" title="Menu" subtitle="The dish keeps running." />`,
})
class SubtitledPanelHostComponent {}

describe('UiPanelComponent subtitle', () => {
  it('sets one line under the title, which describes the dialog', () => {
    TestBed.configureTestingModule({ imports: [SubtitledPanelHostComponent] });
    const fixture = TestBed.createComponent(SubtitledPanelHostComponent);
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-testid="menu"]')!;
    const subtitle = panel.querySelector<HTMLElement>('.subtitle')!;
    expect(subtitle.textContent).toBe('The dish keeps running.');
    expect(panel.querySelector('.title')?.nextElementSibling).toBe(subtitle);
    expect(panel.getAttribute('aria-describedby')).toBe(subtitle.id);
  });

  it('describes nothing without one', () => {
    TestBed.configureTestingModule({ imports: [TrappedPanelHostComponent] });
    const fixture = TestBed.createComponent(TrappedPanelHostComponent);
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-testid="trapped"]')!;
    expect(panel.querySelector('.subtitle')).toBeNull();
    expect(panel.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('UiPanelComponent body, a scroll area inside a focus trap', () => {
  it('an overflowing body with no control is the trap’s one Tab stop, named by the title', () => {
    TestBed.configureTestingModule({ imports: [TrappedPanelHostComponent] });
    const fixture = TestBed.createComponent(TrappedPanelHostComponent);
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-testid="trapped"]')!;
    expect(focusableElementsIn(panel)).toEqual([]);
    const viewport = overflowBodyOf(fixture, panel);
    expect(focusableElementsIn(panel)).toEqual([viewport]);
    expect(viewport.getAttribute('role')).toBe('region');
    expect(viewport.getAttribute('aria-label')).toBe('Leave the game?');
  });
});

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

  it('scrolls its body in a kit scroll area named by the title, so an overflowing body is never an unnamed stop', () => {
    const area = byTestId('body').closest('ui-scroll-area');
    expect(area?.classList.contains('body')).toBe(true);
    set((host) => host.variant.set(UI_PANEL_VARIANT.modal));
    const viewport = overflowBodyOf(fixture, byTestId('panel'));
    expect(viewport.getAttribute('aria-label')).toBe('Menu');
  });

  it('a side panel lets the pointer through, but its overflowing body takes the wheel', () => {
    expect(styleRuleValue(document, [hostSelector(byTestId('side')), "[data-variant='side']"], 'pointer-events')).toBe(
      'none',
    );
    const viewport = overflowBodyOf(fixture, byTestId('side'));
    const area = viewport.closest('ui-scroll-area')!;
    expect(area.hasAttribute('data-overflowing')).toBe(true);
    expect(styleRuleValue(document, [hostSelector(area), '[data-overflowing]', '.viewport'], 'pointer-events')).toBe(
      'auto',
    );
  });

  describe('its look (docs/ui/components-and-constants.md §10.2)', () => {
    function rule(fragments: readonly string[], property: string, media: string | null = null): string | null {
      return styleRuleValue(document, [hostSelector(byTestId('panel')), ...fragments], property, media);
    }

    it('modal: the opaque panel gradient, the panel radius and padding, and a lit top edge', () => {
      expect(rule(["[data-variant='modal']"], 'background')).toBe(
        'linear-gradient(var(--ui-panel-top), var(--ui-panel-bottom))',
      );
      expect(rule(["[data-variant='modal']"], 'padding')).toBe('calc(var(--ui-panel-padding) * var(--ui-scale))');
      expect(rule([], 'border-radius')).toBe('calc(var(--ui-radius-panel) * var(--ui-scale))');
      expect(rule(["[data-variant='modal']", '::before'], 'background-color')).toContain('var(--ui-panel-edge-alpha)');
    });

    it('modal: enters over the panel-enter time, and appears without rising under reduced motion', () => {
      expect(rule(["[data-variant='modal']"], 'animation')).toContain('var(--ui-panel-enter)');
      expect(rule(["[data-variant='modal']"], 'animation', 'prefers-reduced-motion')).toBe('none');
    });

    it('side: its width, a translucent gradient over a blur, no motion, and the pointer only on its controls', () => {
      expect(rule(["[data-variant='side']"], 'width')).toBe('calc(var(--ui-side-panel-width) * var(--ui-scale))');
      expect(rule(["[data-variant='side']"], 'background')).toContain('var(--ui-side-panel-alpha)');
      expect(rule(["[data-variant='side']"], 'backdrop-filter')).toContain('var(--ui-side-panel-blur)');
      expect(rule(["[data-variant='side']"], 'animation')).toBeNull();
      expect(rule(["[data-variant='side']"], 'pointer-events')).toBe('none');
    });

    it('sets the body line height once, for prose, rows and a confirm', () => {
      expect(styleRuleValue(document, ['.body'], 'line-height')).toBe('var(--ui-body-line-height)');
    });

    it('hides an empty header or footer', () => {
      expect(styleRuleValue(document, ['.header', ':empty'], 'display')).toBe('none');
      expect(styleRuleValue(document, ['.footer', ':empty'], 'display')).toBe('none');
    });
  });
});
