import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { SERVER_MESSAGE_TYPE } from '@evolution/shared';
import { broadcastMessage, sendMessage } from './connection.js';
import { createTestConnection } from '../testing/builders.js';

const MESSAGE = { type: SERVER_MESSAGE_TYPE.error, message: 'nope' } as const;
const ENCODED_LENGTH = JSON.stringify(MESSAGE).length;

describe('sendMessage', () => {
  it('writes the JSON frame to an open socket and reports its length', () => {
    const sent = {};
    const connection = createTestConnection({ playerId: 'p1', sent });
    expect(sendMessage(connection, MESSAGE)).toBe(ENCODED_LENGTH);
    expect(sent).toEqual({ p1: [MESSAGE] });
  });

  it('drops the frame and reports zero bytes when the socket is not open', () => {
    const sent = {};
    const connection = createTestConnection({ playerId: 'p1', readyState: WebSocket.CLOSED, sent });
    expect(sendMessage(connection, MESSAGE)).toBe(0);
    expect(sent).toEqual({ p1: [] });
  });
});

describe('broadcastMessage', () => {
  it('sends one encoding to every open socket and skips closed ones', () => {
    const sent = {};
    const open = createTestConnection({ playerId: 'open', sent });
    const closed = createTestConnection({ playerId: 'closed', readyState: WebSocket.CLOSING, sent });
    expect(broadcastMessage([open, closed], MESSAGE)).toBe(ENCODED_LENGTH);
    expect(sent).toEqual({ open: [MESSAGE], closed: [] });
  });
});
