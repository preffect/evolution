// Test doubles for the bots (docs/TESTING.md §4, §8.4): the strategy contexts and world views
// the strategy tests decide over, a fake transport the session tests speak through and a fake
// socket the `ws` transport test frames over. Builder defaults are the only tolerated inline
// test numbers.
import { createSeededRandom, playerId as brandPlayerId } from '@evolution/shared';
import type { ClientMessage, PlayerId, ServerMessage } from '@evolution/shared';
import { createManualRoomTiming, type ManualRoomTiming } from './builders.js';
import type { BotIdentity } from './bot-client/bot-identity.js';
import type { BotTransport } from './bot-client/bot-transport.js';
import type { SocketLike } from './bot-client/web-socket-transport.js';
import type { ScriptContext } from './gameplay/scripts.js';
import type { BotCellView, BotMoteView, BotPerception } from './gameplay/strategies/perception.js';

// ---- strategies ------------------------------------------------------------------------

export const TEST_SEED = 42;
export const TEST_PLAYER_ID: PlayerId = brandPlayerId('player_0');

/** A `ScriptContext` for a strategy test: tick 0, player 0, no cell, a fresh stream from `TEST_SEED`. */
export function createTestScriptContext<Snapshot = null>(
  overrides: Partial<ScriptContext<Snapshot>> & { snapshot?: Snapshot } = {},
): ScriptContext<Snapshot> {
  const seed = overrides.seed ?? TEST_SEED;
  return {
    tick: 0,
    stepTick: 1,
    playerIndex: 0,
    playerId: TEST_PLAYER_ID,
    snapshot: null as Snapshot,
    cell: undefined,
    seed,
    random: createSeededRandom(seed),
    ...overrides,
  };
}

export function createTestBotCell(overrides: Partial<BotCellView> = {}): BotCellView {
  return {
    id: 'cell_0',
    playerId: TEST_PLAYER_ID,
    x: 0,
    y: 0,
    mass: 100,
    radius: 10,
    membraneRatioBonus: 0,
    ...overrides,
  };
}

/** A world the strategies can see: the snapshot IS the list of cells and motes. */
export interface TestWorldView {
  readonly cells: readonly BotCellView[];
  readonly motes: readonly BotMoteView[];
}

export function createTestWorldView(overrides: Partial<TestWorldView> = {}): TestWorldView {
  return { cells: [], motes: [], ...overrides };
}

/** A perception over `TestWorldView` whose engulf rule is a plain mass ratio (the shared predicate's shape). */
export function createTestPerception(engulfMassRatio = 1.25): BotPerception<TestWorldView> {
  return {
    cellsOf: (snapshot) => snapshot.cells,
    motesOf: (snapshot) => snapshot.motes,
    canEngulf: (predator, prey) => predator.mass >= prey.mass * (engulfMassRatio + prey.membraneRatioBonus),
  };
}

// ---- the bot client --------------------------------------------------------------------

export function createTestBotIdentity(overrides: Partial<BotIdentity> = {}): BotIdentity {
  return { playerId: brandPlayerId('bot_42_0'), playerName: 'Bot 0', avatarIndex: 0, ...overrides };
}

/** A transport with no wire: records what the bot sent, lets the test play the server. */
export interface FakeBotTransport extends BotTransport {
  readonly sent: ClientMessage[];
  /** A frame from the server, delivered to every listener now. */
  receive(message: ServerMessage): void;
  /** The server closed the socket. */
  disconnect(): void;
  isClosed(): boolean;
}

export interface FakeBotTransportOptions {
  /** Runs on every frame the bot sends: a fake server replying in the same turn. */
  readonly onSend?: (message: ClientMessage, transport: FakeBotTransport) => void;
}

export function createFakeBotTransport(options: FakeBotTransportOptions = {}): FakeBotTransport {
  const sent: ClientMessage[] = [];
  const messageListeners: ((message: ServerMessage) => void)[] = [];
  const closeListeners: (() => void)[] = [];
  let isClosed = false;
  const transport: FakeBotTransport = {
    sent,
    send: (message) => {
      sent.push(message);
      options.onSend?.(message, transport);
    },
    onMessage: (listener) => messageListeners.push(listener),
    onClose: (listener) => closeListeners.push(listener),
    close: () => {
      isClosed = true;
    },
    receive: (message) => {
      for (const listener of messageListeners) listener(message);
    },
    disconnect: () => {
      for (const listener of closeListeners) listener();
    },
    isClosed: () => isClosed,
  };
  return transport;
}

/** A `ws`-shaped socket the test opens, feeds and closes by hand. */
export interface FakeSocket extends SocketLike {
  readonly url: string;
  readonly sentFrames: string[];
  emitOpen(): void;
  emitMessage(frame: string): void;
  emitClose(): void;
  emitError(error: Error): void;
  isClosed(): boolean;
}

export function createFakeSocket(url = 'ws://fake/ws'): FakeSocket {
  const listeners = new Map<string, ((argument?: unknown) => void)[]>();
  const emit = (event: string, argument?: unknown): void => {
    for (const listener of listeners.get(event) ?? []) listener(argument);
  };
  const sentFrames: string[] = [];
  let isClosed = false;
  return {
    url,
    sentFrames,
    on: (event: string, listener: (...eventArguments: never[]) => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener as (argument?: unknown) => void]);
    },
    send: (data) => sentFrames.push(data),
    close: () => {
      isClosed = true;
    },
    emitOpen: () => emit('open'),
    emitMessage: (frame) => emit('message', Buffer.from(frame)),
    emitClose: () => emit('close'),
    emitError: (error) => emit('error', error),
    isClosed: () => isClosed,
  };
}

/** A manual timing pair the test advances and fires, as `createTiming` hands each bot one. */
export function captureManualTimings(): { timings: ManualRoomTiming[]; createTiming: () => ManualRoomTiming } {
  const timings: ManualRoomTiming[] = [];
  return {
    timings,
    createTiming: () => {
      const timing = createManualRoomTiming();
      timings.push(timing);
      return timing;
    },
  };
}
