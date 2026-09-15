import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostSelector, styleRuleValue } from '../../testing/style-rules';
import { focusableElementsIn } from './focus-trap-stack';
import { UI_CHIP_TONE, UiChipComponent, UiLinkChipComponent, type UiChipTone } from './ui-chip.component';

@Component({
  standalone: true,
  imports: [UiChipComponent, UiLinkChipComponent],
  template: `
    <ui-chip testId="chip" [tone]="tone()" [dotColour]="dotColour()">Metabolic</ui-chip>
    <button uiLinkChip testId="link-button" type="button" (click)="presses = presses + 1">Chloroplast</button>
    <a uiLinkChip testId="link-anchor" href="#chloroplast">Chloroplast</a>
  `,
})
class ChipHostComponent {
  readonly tone = signal<UiChipTone>(UI_CHIP_TONE.neutral);
  readonly dotColour = signal<string | null>(null);
  presses = 0;
}

describe('UiChipComponent', () => {
  let fixture: ComponentFixture<ChipHostComponent>;

  function byTestId(testId: string): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
  }

  function set(update: (host: ChipHostComponent) => void): void {
    update(fixture.componentInstance);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ChipHostComponent] });
    fixture = TestBed.createComponent(ChipHostComponent);
    fixture.detectChanges();
  });

  it('is a static pill in its tone, neutral by default, and no Tab stop', () => {
    expect(byTestId('chip').dataset['tone']).toBe('neutral');
    expect(byTestId('chip').textContent?.trim()).toBe('Metabolic');
    set((host) => host.tone.set(UI_CHIP_TONE.dna));
    expect(byTestId('chip').dataset['tone']).toBe('dna');
    expect(focusableElementsIn(fixture.nativeElement as HTMLElement)).not.toContain(byTestId('chip'));
  });

  it('leads with a decorative dot only when given a colour', () => {
    expect(byTestId('chip').querySelector('.dot')).toBeNull();
    set((host) => host.dotColour.set('#ffb15a'));
    const dot = byTestId('chip').querySelector<HTMLElement>('.dot');
    expect(dot?.style.backgroundColor).toBe('rgb(255, 177, 90)');
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
  });

  describe('its tones (docs/visual-style/principles-and-palette.md §2, UI kit roles)', () => {
    function rule(fragments: readonly string[], property: string): string | null {
      return styleRuleValue(document, [hostSelector(byTestId('chip')), ...fragments], property);
    }

    it('is a label pill: its text plus the chip inset, never a fixed width', () => {
      expect(rule([], 'height')).toBe('calc(var(--ui-chip-height) * var(--ui-scale))');
      expect(rule([], 'padding')).toBe('0 calc(var(--ui-chip-padding-inline) * var(--ui-scale))');
      expect(rule([], 'font-size')).toBe('calc(var(--ui-type-label) * var(--ui-scale))');
      expect(rule([], 'text-transform')).toBe('uppercase');
      expect(rule([], 'width')).toBeNull();
    });

    it('draws each tone’s rim and text from the palette roles', () => {
      expect(rule([], 'border')).toContain('var(--ui-panel-rim)');
      expect(rule([], 'color')).toBe('var(--ui-text-label)');
      expect(rule(["[data-tone='muted']"], 'border-color')).toBe('var(--ui-text-muted)');
      expect(rule(["[data-tone='muted']"], 'color')).toBe('var(--ui-text-muted)');
      expect(rule(["[data-tone='strong']"], 'border-color')).toBe('var(--ui-text-label)');
      expect(rule(["[data-tone='strong']"], 'color')).toBe('var(--ui-text)');
      expect(rule(["[data-tone='dna']"], 'color')).toBe('var(--ui-dna)');
      expect(rule(["[data-tone='gold']"], 'border-color')).toBe('var(--ui-level-gold)');
      expect(rule(["[data-tone='accent']"], 'border-color')).toBe('var(--ui-accent)');
      expect(rule(["[data-tone='danger']"], 'border-color')).toBe('var(--ui-danger)');
      expect(rule(["[data-tone='danger']"], 'color')).toBe('var(--ui-text)');
    });
  });
});

describe('UiLinkChipComponent', () => {
  let fixture: ComponentFixture<ChipHostComponent>;

  function byTestId(testId: string): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
  }

  function rule(fragments: readonly string[], property: string): string | null {
    return styleRuleValue(document, [hostSelector(byTestId('link-button')), ...fragments], property);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ChipHostComponent] });
    fixture = TestBed.createComponent(ChipHostComponent);
    fixture.detectChanges();
  });

  it('goes on a button or an anchor, both Tab stops, as a compact secondary control', () => {
    const focusable = focusableElementsIn(fixture.nativeElement as HTMLElement);
    for (const testId of ['link-button', 'link-anchor']) {
      expect(focusable).toContain(byTestId(testId));
      expect(byTestId(testId).dataset['variant']).toBe('secondary');
      expect(byTestId(testId).dataset['size']).toBe('compact');
    }
    byTestId('link-button').click();
    expect(fixture.componentInstance.presses).toBe(1);
  });

  it('sets its title in the link colour, undecorated', () => {
    expect(rule(["[data-variant='secondary']", "[data-size='compact']"], 'color')).toBe('var(--ui-link)');
    expect(rule(["[data-variant='secondary']", "[data-size='compact']"], 'text-decoration')).toBe('none');
  });

  it('wears the button’s states: hover and pressed tints, the unscaled ring outside', () => {
    expect(rule([':hover', ":not([aria-disabled='true'])", '::before'], 'background-color')).toBe('var(--ui-hover)');
    expect(rule([':active', ":not([aria-disabled='true'])", '::before'], 'background-color')).toBe('var(--ui-pressed)');
    expect(rule([':focus-visible'], 'outline-offset')).toBe('var(--ui-focus-ring-offset)');
    expect(rule(["[data-size='compact']"], 'height')).toBe('calc(var(--ui-button-compact-height) * var(--ui-scale))');
  });
});
