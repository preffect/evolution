import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { VIRTUAL_CURSOR_HALO_STROKE_PX, VIRTUAL_CURSOR_RING_RADIUS_PX } from './hud-constants';
import { MouseLockService } from './mouse-lock.service';
import { VirtualCursorComponent } from './virtual-cursor.component';
import { HUD_TEST_ID, testIdSelector } from '../test-ids/hud-test-ids';

describe('VirtualCursorComponent', () => {
  function mount(): HTMLElement {
    const fixture = TestBed.createComponent(VirtualCursorComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws nothing while the pointer is free', () => {
    const element = mount();
    expect(element.querySelector(testIdSelector(HUD_TEST_ID.virtualCursor))).toBeNull();
  });

  it('centres the cursor on the virtual pointer and follows it, taking no events', () => {
    const element = mount();
    const mouseLock = TestBed.inject(MouseLockService);
    const half = VIRTUAL_CURSOR_RING_RADIUS_PX + VIRTUAL_CURSOR_HALO_STROKE_PX;
    mouseLock.setCursorPoint({ x: 300, y: 200 });
    TestBed.tick();
    const cursor = element.querySelector<SVGElement>(testIdSelector(HUD_TEST_ID.virtualCursor))!;
    expect(cursor.style.transform).toBe(`translate(${300 - half}px, ${200 - half}px)`);
    expect(cursor.getAttribute('aria-hidden')).toBe('true');

    mouseLock.setCursorPoint(null);
    TestBed.tick();
    expect(element.querySelector(testIdSelector(HUD_TEST_ID.virtualCursor))).toBeNull();
  });
});
