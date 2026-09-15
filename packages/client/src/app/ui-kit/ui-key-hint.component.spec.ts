import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostSelector, styleRuleValue } from '../../testing/style-rules';
import { UiKeyHintComponent } from './ui-key-hint.component';

@Component({
  standalone: true,
  imports: [UiKeyHintComponent],
  template: `<ui-key-hint [key]="key()" />`,
})
class KeyHintHostComponent {
  readonly key = signal('Escape');
}

describe('UiKeyHintComponent', () => {
  let fixture: ComponentFixture<KeyHintHostComponent>;

  function keyHint(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('ui-key-hint')!;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [KeyHintHostComponent] });
    fixture = TestBed.createComponent(KeyHintHostComponent);
    fixture.detectChanges();
  });

  it('shows the short form of the key and follows a change', () => {
    expect(keyHint().textContent?.trim()).toBe('Esc');
    fixture.componentInstance.key.set('H');
    fixture.detectChanges();
    expect(keyHint().textContent?.trim()).toBe('H');
  });

  it('is hidden from assistive technology: the control beside it carries aria-keyshortcuts', () => {
    expect(keyHint().getAttribute('aria-hidden')).toBe('true');
  });

  it('is a caption keycap, muted, on the well with a panel-rim rim, sized off the kit tokens', () => {
    const host = hostSelector(keyHint());
    expect(styleRuleValue(document, [host], 'background-color')).toBe('var(--ui-well)');
    expect(styleRuleValue(document, [host], 'color')).toBe('var(--ui-text-muted)');
    expect(styleRuleValue(document, [host], 'font-size')).toContain('var(--ui-type-caption)');
    expect(styleRuleValue(document, [host], 'height')).toBe('calc(var(--ui-key-hint-height) * var(--ui-scale))');
    expect(styleRuleValue(document, [host], 'border')).toContain('var(--ui-panel-rim)');
  });
});
