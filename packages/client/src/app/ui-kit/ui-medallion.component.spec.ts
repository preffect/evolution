import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostSelector, styleRuleValue } from '../../testing/style-rules';
import {
  UI_MEDALLION_SIZE,
  UI_MEDALLION_TONE,
  UiMedallionComponent,
  type UiMedallionSize,
  type UiMedallionTone,
} from './ui-medallion.component';

@Component({
  standalone: true,
  imports: [UiMedallionComponent],
  template: `<ui-medallion testId="medallion" [size]="size()" [tone]="tone()">I</ui-medallion>`,
})
class MedallionHostComponent {
  readonly size = signal<UiMedallionSize>(UI_MEDALLION_SIZE.row);
  readonly tone = signal<UiMedallionTone>(UI_MEDALLION_TONE.neutral);
}

describe('UiMedallionComponent', () => {
  let fixture: ComponentFixture<MedallionHostComponent>;

  function medallion(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-testid="medallion"]')!;
  }

  function rule(fragments: readonly string[], property: string): string | null {
    return styleRuleValue(document, [hostSelector(medallion()), ...fragments], property);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MedallionHostComponent] });
    fixture = TestBed.createComponent(MedallionHostComponent);
    fixture.detectChanges();
  });

  it('holds its mark at its size and tone, a row medallion by default', () => {
    expect(medallion().textContent).toBe('I');
    expect(medallion().dataset['size']).toBe('row');
    expect(medallion().dataset['tone']).toBe('neutral');
    fixture.componentInstance.size.set(UI_MEDALLION_SIZE.card);
    fixture.componentInstance.tone.set(UI_MEDALLION_TONE.gold);
    fixture.detectChanges();
    expect(medallion().dataset['size']).toBe('card');
    expect(medallion().dataset['tone']).toBe('gold');
  });

  it('is a round well with a panel-rim rim, 24 px in a row and 56 px on a card', () => {
    expect(rule([], 'border-radius')).toBe('50%');
    expect(rule([], 'background-color')).toBe('var(--ui-well)');
    expect(rule([], 'border')).toContain('var(--ui-panel-rim)');
    expect(rule([], 'width')).toBe('calc(var(--ui-row-medallion) * var(--ui-scale))');
    expect(rule(["[data-size='card']"], 'width')).toBe('calc(var(--ui-card-medallion) * var(--ui-scale))');
  });

  it('in gold takes the level-gold rim and mark', () => {
    expect(rule(["[data-tone='gold']"], 'border-color')).toBe('var(--ui-level-gold)');
    expect(rule(["[data-tone='gold']"], 'color')).toBe('var(--ui-level-gold)');
  });
});
