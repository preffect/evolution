import { describe, expect, it, vi } from 'vitest';
import { GAME_EVENT_KIND, GameEventBus, type GameEvent } from './game-event-bus';

const CLICK: GameEvent = { kind: GAME_EVENT_KIND.uiClick };
const BLOOM: GameEvent = { kind: GAME_EVENT_KIND.bloomStarted };

describe('GameEventBus', () => {
  it('delivers an event to every subscriber in subscription order', () => {
    const bus = new GameEventBus();
    const order: string[] = [];
    bus.subscribe(() => order.push('first'));
    bus.subscribe(() => order.push('second'));
    bus.emit(CLICK);
    expect(order).toEqual(['first', 'second']);
  });

  it('stops delivering after unsubscribe and reports the listener count', () => {
    const bus = new GameEventBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribe(listener);
    expect(bus.listenerCount).toBe(1);
    unsubscribe();
    bus.emit(CLICK);
    expect(listener).not.toHaveBeenCalled();
    expect(bus.listenerCount).toBe(0);
  });

  it('emits a batch in order', () => {
    const bus = new GameEventBus();
    const seen: GameEvent[] = [];
    bus.subscribe((event) => seen.push(event));
    bus.emitAll([CLICK, BLOOM]);
    expect(seen).toEqual([CLICK, BLOOM]);
  });

  it('lets a listener unsubscribe itself during delivery without skipping the others', () => {
    const bus = new GameEventBus();
    const later = vi.fn();
    const unsubscribe = bus.subscribe(() => unsubscribe());
    bus.subscribe(later);
    bus.emit(CLICK);
    expect(later).toHaveBeenCalledTimes(1);
    expect(bus.listenerCount).toBe(1);
  });
});
