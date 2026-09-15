import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostSelector, styleRuleValue } from '../../testing/style-rules';
import { focusableElementsIn } from './focus-trap-stack';
import { UI_ALERT_TONE, UiAlertPillComponent, type UiAlertTone } from './ui-alert-pill.component';

@Component({
  standalone: true,
  imports: [UiAlertPillComponent],
  template: `
    <button
      uiAlertPill
      testId="alert"
      type="button"
      [tone]="tone()"
      [figure]="figure()"
      [keyHints]="keyHints()"
      (click)="presses = presses + 1"
    >
      Level 5 · choose a trait
    </button>
  `,
})
class AlertHostComponent {
  readonly tone = signal<UiAlertTone>(UI_ALERT_TONE.danger);
  readonly figure = signal<string | null>(null);
  readonly keyHints = signal<readonly string[]>([]);
  presses = 0;
}

describe('UiAlertPillComponent', () => {
  let fixture: ComponentFixture<AlertHostComponent>;

  function alert(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="alert"]')!;
  }

  function set(update: (host: AlertHostComponent) => void): void {
    update(fixture.componentInstance);
    fixture.detectChanges();
  }

  function rule(fragments: readonly string[], property: string): string | null {
    return styleRuleValue(document, [hostSelector(alert()), ...fragments], property);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AlertHostComponent] });
    fixture = TestBed.createComponent(AlertHostComponent);
    fixture.detectChanges();
  });

  it('is a native button, a Tab stop that presses, in its tone', () => {
    expect(alert().tagName).toBe('BUTTON');
    expect(focusableElementsIn(fixture.nativeElement as HTMLElement)).toContain(alert());
    alert().click();
    expect(fixture.componentInstance.presses).toBe(1);
    expect(alert().dataset['tone']).toBe('danger');
    set((host) => host.tone.set(UI_ALERT_TONE.gold));
    expect(alert().dataset['tone']).toBe('gold');
  });

  it('leads with its tone dot and sets a changing number apart in figure', () => {
    expect(alert().querySelector('.dot')?.getAttribute('aria-hidden')).toBe('true');
    expect(alert().querySelector('.figure')).toBeNull();
    set((host) => host.figure.set('6.5 s'));
    expect(alert().querySelector('.figure')?.textContent?.trim()).toBe('6.5 s');
    expect(alert().querySelector('.alert-label')?.textContent?.trim()).toBe('Level 5 · choose a trait');
  });

  it('trails its key hints', () => {
    set((host) => host.keyHints.set(['1', '2']));
    const hints = Array.from(alert().querySelectorAll('ui-key-hint')).map((hint) => hint.textContent?.trim());
    expect(hints).toEqual(['1', '2']);
  });

  it('is a white uppercase label pill on the callout backing, its rim and dot in the tone', () => {
    expect(rule(['[data-tone]'], 'height')).toBe('calc(var(--ui-alert-height) * var(--ui-scale))');
    expect(rule(['[data-tone]'], 'background-color')).toBe('var(--ui-callout-backing)');
    expect(rule(['[data-tone]'], 'color')).toBe('var(--ui-white)');
    expect(rule(["[data-tone='danger']"], 'border-color')).toBe('var(--ui-danger)');
    expect(rule(["[data-tone='gold']"], 'border-color')).toBe('var(--ui-level-gold)');
    // Rules inside the pill are scoped by content attribute, not by the host.
    expect(styleRuleValue(document, ['.alert-label'], 'text-transform')).toBe('uppercase');
    expect(styleRuleValue(document, ['.figure'], 'font-family')).toBe('var(--ui-font-mono)');
    expect(styleRuleValue(document, ['.dot'], 'background-color')).toBe('var(--alert-tone)');
  });

  it('wears the button’s states: hover and pressed tints and the unscaled ring', () => {
    expect(rule([':hover', ":not([aria-disabled='true'])", '::before'], 'background-color')).toBe('var(--ui-hover)');
    expect(rule([':active', ":not([aria-disabled='true'])", '::before'], 'background-color')).toBe('var(--ui-pressed)');
    expect(rule([':focus-visible'], 'outline')).toContain('var(--ui-focus-ring)');
  });
});
