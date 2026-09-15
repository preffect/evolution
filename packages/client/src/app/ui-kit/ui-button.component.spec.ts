import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostSelector, styleRuleValue } from '../../testing/style-rules';
import { focusableElementsIn } from './focus-trap-stack';
import {
  UI_BUTTON_SIZE,
  UI_BUTTON_VARIANT,
  UiButtonComponent,
  type UiButtonSize,
  type UiButtonVariant,
} from './ui-button.component';

@Component({
  standalone: true,
  imports: [UiButtonComponent],
  template: `
    <button
      uiButton
      testId="kit-button"
      [variant]="variant()"
      [size]="size()"
      [keyHint]="keyHint()"
      [isDisabled]="isDisabled()"
      (click)="presses = presses + 1"
    >
      Return
    </button>
  `,
})
class ButtonHostComponent {
  readonly variant = signal<UiButtonVariant>(UI_BUTTON_VARIANT.primary);
  readonly size = signal<UiButtonSize>(UI_BUTTON_SIZE.regular);
  readonly keyHint = signal<string | null>(null);
  readonly isDisabled = signal(false);
  presses = 0;
}

describe('UiButtonComponent', () => {
  let fixture: ComponentFixture<ButtonHostComponent>;

  function button(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="kit-button"]')!;
  }

  function set(update: (host: ButtonHostComponent) => void): void {
    update(fixture.componentInstance);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ButtonHostComponent] });
    fixture = TestBed.createComponent(ButtonHostComponent);
    fixture.detectChanges();
  });

  it('renders the feature’s test id, variant and size on the native button', () => {
    expect(button().tagName).toBe('BUTTON');
    expect(button().dataset['variant']).toBe('primary');
    expect(button().dataset['size']).toBe('regular');
    set((host) => {
      host.variant.set(UI_BUTTON_VARIANT.danger);
      host.size.set(UI_BUTTON_SIZE.compact);
    });
    expect(button().dataset['variant']).toBe('danger');
    expect(button().dataset['size']).toBe('compact');
  });

  it('shows a key hint and announces the shortcut only when given one', () => {
    expect(button().querySelector('ui-key-hint')).toBeNull();
    expect(button().hasAttribute('aria-keyshortcuts')).toBe(false);
    set((host) => host.keyHint.set('Escape'));
    expect(button().querySelector('ui-key-hint')?.textContent?.trim()).toBe('Esc');
    expect(button().getAttribute('aria-keyshortcuts')).toBe('Escape');
  });

  it('is a Tab stop that takes focus and presses', () => {
    expect(focusableElementsIn(fixture.nativeElement as HTMLElement)).toContain(button());
    button().focus();
    expect(document.activeElement).toBe(button());
    button().click();
    expect(fixture.componentInstance.presses).toBe(1);
  });

  it('when disabled keeps its Tab stop and focus, says so, and swallows presses', () => {
    set((host) => host.isDisabled.set(true));
    expect(button().getAttribute('aria-disabled')).toBe('true');
    expect(button().disabled).toBe(false);
    expect(focusableElementsIn(fixture.nativeElement as HTMLElement)).toContain(button());
    button().focus();
    expect(document.activeElement).toBe(button());
    button().click();
    expect(fixture.componentInstance.presses).toBe(0);
    set((host) => host.isDisabled.set(false));
    expect(button().hasAttribute('aria-disabled')).toBe(false);
    button().click();
    expect(fixture.componentInstance.presses).toBe(1);
  });

  describe('the states table (docs/ui/components-and-constants.md §10.2)', () => {
    function rule(fragments: readonly string[], property: string, media: string | null = null): string | null {
      return styleRuleValue(document, [hostSelector(button()), ...fragments], property, media);
    }

    it('hover lays the hover tint over the fill, never on a disabled button', () => {
      expect(rule([':hover', ":not([aria-disabled='true'])", '::before'], 'background-color')).toBe('var(--ui-hover)');
    });

    it('pressed lays the pressed tint instead, never on a disabled button', () => {
      expect(rule([':active', ":not([aria-disabled='true'])", '::before'], 'background-color')).toBe(
        'var(--ui-pressed)',
      );
    });

    it('a pressed quiet or icon label takes the text colour, which clears 4.5:1 over the pressed tint', () => {
      expect(rule(["[data-variant='quiet']", ':active', ":not([aria-disabled='true'])"], 'color')).toBe(
        'var(--ui-text)',
      );
      expect(rule(["[data-variant='icon']", ':active', ":not([aria-disabled='true'])"], 'color')).toBe(
        'var(--ui-text)',
      );
    });

    it('focus-visible alone draws the ring in the text colour at its offset, unscaled', () => {
      const outline = rule([':focus-visible'], 'outline');
      expect(outline).toContain('var(--ui-focus-ring)');
      expect(outline).toContain('var(--ui-text)');
      expect(outline).not.toContain('--ui-scale');
      expect(rule([':focus-visible'], 'outline-offset')).toBe('var(--ui-focus-ring-offset)');
      expect(rule([], 'outline')).toBe('none');
    });

    it('disabled fades to the disabled alpha', () => {
      expect(rule(["[aria-disabled='true']"], 'opacity')).toBe('var(--ui-disabled-alpha)');
    });

    it('fades between states over the transition, and not at all under reduced motion', () => {
      expect(rule([], 'transition')).toContain('var(--ui-transition)');
      expect(rule([], 'transition', 'prefers-reduced-motion')).toBe('none');
    });

    it('draws each variant from its tone: primary accent and bold, danger a danger rim, quiet the label colour', () => {
      expect(rule(["[data-variant='primary']"], 'background-color')).toContain('var(--ui-primary-fill-alpha)');
      expect(rule(["[data-variant='primary']"], 'border-color')).toContain('var(--ui-primary-rim-alpha)');
      expect(rule(["[data-variant='primary']"], 'font-weight')).toBe('bold');
      expect(rule(["[data-variant='secondary']"], 'border-color')).toBe('var(--ui-panel-rim)');
      expect(rule(["[data-variant='danger']"], 'border-color')).toContain('var(--ui-danger-rim-alpha)');
      expect(rule(["[data-variant='quiet']"], 'color')).toBe('var(--ui-text-label)');
      expect(rule(["[data-size='compact']", "[data-variant='icon']"], 'width')).toBe(
        'calc(var(--ui-button-compact-height) * var(--ui-scale))',
      );
    });
  });
});
