// One bot over the wire (docs/TESTING.md §8.3): the lobby handshake a browser client does
// (`join_lobby`, `join_game`), then one client tick per fixed step from the injected timing
// (docs/ARCHITECTURE.md §5: exactly one `player_input` per client tick, `sequence` = tick),
// each decided by the pilot from the latest snapshot the server sent. A bot that has not seen a
// snapshot yet holds; a strategy that answers `null` holds. A close after the bot is seated
// stops the tick, marks the stats disconnected and rejects whoever is waiting on a tick or a
// snapshot, so a server that drops a bot mid-run fails the run instead of counting silent inputs.
// The session never reads the wall clock: the CLI hands it the system pair, a test a manual pair.

import {
  CLIENT_MESSAGE_TYPE,
  SERVER_MESSAGE_TYPE,
  createSimulationStepAccumulator,
  type FixedStepAccumulator,
  type GameInput,
  type GameSnapshot,
  type PlayerId,
  type ServerMessage,
} from '@evolution/shared';
import type { BotIdentity } from '../../game/bots/bot-identity.js';
import type { BotPilot, BotPilotStats } from '../../game/bots/bot-pilot.js';
import type { BotClientTiming } from './bot-timing.js';
import type { BotTransport } from './bot-transport.js';
import { BotClientError } from './errors.js';

export interface BotSessionOptions {
  readonly identity: BotIdentity;
  readonly gameId: string;
  readonly pilot: BotPilot<GameInput, GameSnapshot>;
  readonly transport: BotTransport;
  readonly timing: BotClientTiming;
}

export interface BotSessionStats extends BotPilotStats {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly strategyName: string;
  /** Client ticks stepped since `start()`. */
  readonly clientTick: number;
  readonly snapshotsReceived: number;
  readonly inputsSent: number;
  /** Ticks the accumulator dropped after a stall (docs/DETERMINISM.md §2), never made up. */
  readonly droppedTicks: number;
  readonly errorsReceived: number;
  readonly lastError: string | null;
  /** `false` once the transport closed, whether the server dropped the bot or `stop()` hung up. */
  readonly isConnected: boolean;
}

type SnapshotPredicate = (snapshot: GameSnapshot) => boolean;
/** Someone awaiting a value the session will see later: settled when `isDue`, rejected on a close. */
interface Waiter<Value> {
  readonly isDue: (value: Value) => boolean;
  readonly resolve: (value: Value) => void;
  readonly reject: (error: Error) => void;
}
interface JoinOutcome {
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
}

export class BotSession {
  readonly playerId: PlayerId;
  private readonly accumulator: FixedStepAccumulator;
  private latestSnapshot: GameSnapshot | undefined;
  private clientTick = 0;
  private snapshotsReceived = 0;
  private inputsSent = 0;
  private droppedTicks = 0;
  private errorsReceived = 0;
  private lastError: string | null = null;
  private isConnected = true;
  private joinOutcome: JoinOutcome | undefined;
  private readonly snapshotWaiters: Waiter<GameSnapshot>[] = [];
  private readonly tickWaiters: Waiter<number>[] = [];

  constructor(private readonly options: BotSessionOptions) {
    this.playerId = options.identity.playerId;
    this.accumulator = createSimulationStepAccumulator(options.timing.clock);
    options.transport.onMessage((message) => this.onServerMessage(message));
    options.transport.onClose(() => this.onTransportClosed());
  }

  /** Announces the bot in the lobby and joins the game; resolves once the server has seated it. */
  join(): Promise<void> {
    const { identity, gameId, transport } = this.options;
    return new Promise((resolve, reject) => {
      this.joinOutcome = { resolve, reject };
      transport.send({
        type: CLIENT_MESSAGE_TYPE.joinLobby,
        playerName: identity.playerName,
        avatarIndex: identity.avatarIndex,
      });
      transport.send({ type: CLIENT_MESSAGE_TYPE.joinGame, gameId });
    });
  }

  /** Starts the client tick; the time that passed before is discarded, so the first fire never bursts. */
  start(): void {
    this.accumulator.discardElapsed();
    this.options.timing.ticker.start(() => this.onTickerFire());
  }

  stop(): void {
    this.options.timing.ticker.stop();
    this.options.transport.close();
  }

  /** The latest snapshot that satisfies `predicate`, now or when it arrives; rejects once the connection is gone. */
  waitForSnapshot(predicate: SnapshotPredicate): Promise<GameSnapshot> {
    const latest = this.latestSnapshot;
    if (latest !== undefined && predicate(latest)) return Promise.resolve(latest);
    if (!this.isConnected) return Promise.reject(this.disconnectedError());
    return new Promise((resolve, reject) => this.snapshotWaiters.push({ isDue: predicate, resolve, reject }));
  }

  /** Resolves once the client tick has reached `tick`; rejects once the connection is gone. */
  waitForTick(tick: number): Promise<void> {
    if (this.clientTick >= tick) return Promise.resolve();
    if (!this.isConnected) return Promise.reject(this.disconnectedError());
    return new Promise((resolve, reject) =>
      this.tickWaiters.push({ isDue: (reached) => reached >= tick, resolve: () => resolve(), reject }),
    );
  }

  stats(): BotSessionStats {
    const { identity, pilot } = this.options;
    return {
      ...pilot.stats(),
      playerId: identity.playerId,
      playerName: identity.playerName,
      strategyName: pilot.strategyName,
      clientTick: this.clientTick,
      snapshotsReceived: this.snapshotsReceived,
      inputsSent: this.inputsSent,
      droppedTicks: this.droppedTicks,
      errorsReceived: this.errorsReceived,
      lastError: this.lastError,
      isConnected: this.isConnected,
    };
  }

  private onServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case SERVER_MESSAGE_TYPE.gameState:
        this.settleJoin();
        this.acceptSnapshot(message.snapshot);
        break;
      case SERVER_MESSAGE_TYPE.gameStarted:
        this.settleJoin();
        break;
      case SERVER_MESSAGE_TYPE.gameSnapshot:
        this.acceptSnapshot(message.snapshot);
        break;
      case SERVER_MESSAGE_TYPE.error:
        this.onServerError(message.message);
        break;
      default:
        break;
    }
  }

  private acceptSnapshot(snapshot: GameSnapshot): void {
    this.latestSnapshot = snapshot;
    this.snapshotsReceived += 1;
    settleDueWaiters(this.snapshotWaiters, snapshot);
  }

  /** The transport closed: stop ticking, fail a pending join and reject everyone still waiting. */
  private onTransportClosed(): void {
    this.isConnected = false;
    this.options.timing.ticker.stop();
    this.failJoin('the connection closed before the game seated the bot');
    rejectWaiters(this.snapshotWaiters, this.disconnectedError());
    rejectWaiters(this.tickWaiters, this.disconnectedError());
  }

  private disconnectedError(): BotClientError {
    return new BotClientError(`${this.playerId} lost its connection at client tick ${this.clientTick}`);
  }

  private onServerError(message: string): void {
    this.errorsReceived += 1;
    this.lastError = message;
    this.failJoin(message);
  }

  private settleJoin(): void {
    this.joinOutcome?.resolve();
    this.joinOutcome = undefined;
  }

  private failJoin(reason: string): void {
    this.joinOutcome?.reject(new BotClientError(`${this.playerId} could not join: ${reason}`));
    this.joinOutcome = undefined;
  }

  private onTickerFire(): void {
    const dueTicks = this.accumulator.dueTicks();
    this.droppedTicks += this.accumulator.takeDroppedTicks();
    for (let count = 0; count < dueTicks; count += 1) this.runClientTick();
  }

  private runClientTick(): void {
    this.clientTick += 1;
    const snapshot = this.latestSnapshot;
    if (snapshot !== undefined) {
      const input = this.options.pilot.decide(snapshot, this.clientTick);
      if (input !== null) {
        this.options.transport.send({ type: CLIENT_MESSAGE_TYPE.playerInput, payload: input });
        this.inputsSent += 1;
      }
    }
    settleDueWaiters(this.tickWaiters, this.clientTick);
  }
}

/** Resolves and removes every waiter `value` is due for; the rest keep waiting. */
function settleDueWaiters<Value>(waiters: Waiter<Value>[], value: Value): void {
  const due = waiters.filter((waiter) => waiter.isDue(value));
  for (const waiter of due) {
    waiters.splice(waiters.indexOf(waiter), 1);
    waiter.resolve(value);
  }
}

/** Rejects and removes every waiter: nothing they wait for can arrive any more. */
function rejectWaiters<Value>(waiters: Waiter<Value>[], error: Error): void {
  for (const waiter of waiters.splice(0)) waiter.reject(error);
}
