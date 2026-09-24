import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostSelector, styleRuleValue } from '../../testing/style-rules';
import { UI_EFFECT, UiEffectMarkComponent, type UiEffect } from './ui-effect-mark.component';

@Component({
  standalone: true,
  imports: [UiEffectMarkComponent],
  template: `<span class="value"><ui-effect-mark [effect]="effect()" />−15 % mass decay</span>`,
})
class EffectMarkHostComponent {
  readonly effect = signal<UiEffect | null>(UI_EFFECT.benefit);
}

describe('UiEffectMarkComponent (docs/visual-style/principles-and-palette.md §2, #453)', () => {
  let fixture: ComponentFixture<EffectMarkHostComponent>;

  function mark(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('ui-effect-mark')!;
  }

  function rule(fragments: readonly string[], property: string): string | null {
    return styleRuleValue(document, [hostSelector(mark()), ...fragments], property);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EffectMarkHostComponent] });
    fixture = TestBed.createComponent(EffectMarkHostComponent);
    fixture.detectChanges();
  });

  it('publishes its effect and is a triangle hidden from assistive technology, the words beside it saying the rest', () => {
    expect(mark().dataset['effect']).toBe(UI_EFFECT.benefit);
    expect(mark().getAttribute('aria-hidden')).toBe('true');
    expect(mark().querySelector('svg polygon')).not.toBeNull();
    fixture.componentInstance.effect.set(UI_EFFECT.drawback);
    fixture.detectChanges();
    expect(mark().dataset['effect']).toBe(UI_EFFECT.drawback);
  });

  it('takes the cue roles itself, so the value beside it keeps the text colour', () => {
    expect(rule([], 'color')).toBe('var(--ui-gain)');
    expect(rule(["[data-effect='drawback']"], 'color')).toBe('var(--ui-danger)');
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.value')?.style.color).toBe('');
  });

  /** Under deuteranopia the two roles are two similar yellows, so the shape alone must tell the effects apart. */
  it('points a drawback down and a benefit up, so no effect is told by colour alone, and draws nothing without one', () => {
    expect(rule(["[data-effect='drawback']"], 'transform')).toBe('rotate(0.5turn)');
    expect(rule([], 'transform')).toBeNull();
    expect(rule([':not([data-effect])'], 'display')).toBe('none');
    fixture.componentInstance.effect.set(null);
    fixture.detectChanges();
    expect(mark().hasAttribute('data-effect')).toBe(false);
    expect(rule([], 'width')).toBe('calc(var(--ui-effect-mark) * var(--ui-scale))');
  });
});
