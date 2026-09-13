import { describe, expect, it } from 'vitest';
import { yieldToEventLoop } from './event-loop.js';

describe('yieldToEventLoop', () => {
  it('lets an I/O callback that was already queued run before it resolves', async () => {
    const order: string[] = [];
    setImmediate(() => order.push('queued callback'));
    await yieldToEventLoop();
    order.push('after the yield');
    expect(order).toEqual(['queued callback', 'after the yield']);
  });
});
