// The coach beats end to end (docs/ui/input-and-onboarding.md §5, ticket #388): scripted server snapshots off a real
// socket, through the multiplayer service, `GameStateService` (the mass trend) and `OnboardingService`, to the
// `hint[data-hint-id]` a player reads. The scenario is gameplay-qa's: a cell spawned in the vent, a toxic bot whose
// aura reaches it, then decay alone; and the negative rows, each asserted by the ids the pill never shows.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CELL_KIND,
  DEFAULT_BALANCE,
  SERVER_MESSAGE_TYPE,
  ZONE_ID,
  createTestPlayerProgressView,
  createTestSessionConfig,
  createTestSnapshot,
  entityId,
  gameId,
  playerId,
  secondsToTicks,
  type CellView,
  type EntityId,
  type GameSnapshot,
  type MassFlowView,
  type ServerMessage,
  type ZoneId,
} from '@evolution/shared';
import { createTestCellView, createTestEatEffect } from '../../../testing/builders';
import { FakeWebSocket } from '../../../testing/fake-websocket';
import { IdentityService } from '../../services/identity.service';
import { MultiplayerService } from '../../services/multiplayer.service';
import { WebSocketService } from '../../services/websocket.service';
import { ZONE_CUE } from '../render/constants';
import { ONBOARDING_BEAT } from './format/onboarding-beats';
import { HintComponent } from './hint.component';
import { COACH_SHRINK_HOLD_SECONDS, STEER_HINT_DISTANCE_WU } from './hud-constants';
import { HUD_TEST_ID, testIdSelector } from './test-ids';

const OWN_PLAYER_ID = playerId('player-me');
const OWN_CELL_ID = entityId('cell-me');
const RESPAWNED_CELL_ID = entityId('cell-me-respawned');
const TOXIC_CELL_ID = entityId('cell-toxic');
/** The own cell's mass: above the starting mass, so decay and the vent take something. */
const OWN_MASS = 60;
/** Snapshots go out every third tick (the 20 Hz wire). */
const SNAPSHOT_EVERY_TICKS = 3;
/** Toxin Vacuole II: a drain and an aura one radius past the rim. */
const TOXIN_VACUOLE_II = [{ traitId: 'toxin_vacuole', tier: 2 }] as CellView['traits'];
/** Decay and the vent's extra at `OWN_MASS`: a clear fall, well past the trend's threshold. */
const DECAYING: MassFlowView['ratesPerSecond'] = { decay: -0.5, vent: -0.25 };
const TOXIN_DRAIN: MassFlowView['ratesPerSecond'] = { ...DECAYING, toxin: -3 };

interface Moment {
  readonly ownCell?: Partial<CellView> | null;
  readonly others?: readonly CellView[];
  readonly zone?: ZoneId;
  readonly rates?: MassFlowView['ratesPerSecond'];
  readonly hasEaten?: boolean;
}

function ownCellAt(overrides: Partial<CellView> = {}): CellView {
  return createTestCellView({ id: OWN_CELL_ID, playerId: OWN_PLAYER_ID, mass: OWN_MASS, ...overrides });
}

/** A toxic wild bot `gapWu` past the own cell's rim: out of contact, inside Toxin Vacuole II's aura. */
function toxicBot(gapWu: number, ownCell: CellView = ownCellAt()): CellView {
  const bot = createTestCellView({ id: TOXIC_CELL_ID, kind: CELL_KIND.wild, playerId: null, traits: TOXIN_VACUOLE_II });
  return { ...bot, x: ownCell.x + ownCell.radius + bot.radius + gapWu, y: ownCell.y };
}

describe('the coach beats, end to end', () => {
  let fixture: ComponentFixture<HintComponent>;
  let tick = 0;
  let seen: string[] = [];

  function hintId(): string | null {
    const pill = (fixture.nativeElement as HTMLElement).querySelector(testIdSelector(HUD_TEST_ID.hint));
    return pill?.getAttribute('data-hint-id') ?? null;
  }

  /** The snapshot a moment describes, at the next broadcast tick. */
  function snapshotOf(moment: Moment): GameSnapshot {
    tick += SNAPSHOT_EVERY_TICKS;
    const own = moment.ownCell === null ? null : ownCellAt(moment.ownCell);
    const massFlow = { ratesPerSecond: moment.rates ?? {}, zone: moment.zone ?? ZONE_ID.openBroth };
    return createTestSnapshot({
      tick,
      cells: [...(own === null ? [] : [own]), ...(moment.others ?? [])],
      effects: moment.hasEaten === true && own !== null ? [createTestEatEffect({ cellId: own.id, tick })] : [],
      ownProgress: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, massFlow: own === null ? null : massFlow }),
    });
  }

  /** The room's opening message around its first snapshot. */
  function gameStateMessage(snapshot: GameSnapshot): ServerMessage {
    return {
      type: SERVER_MESSAGE_TYPE.gameState,
      gameId: gameId('room'),
      playerId: OWN_PLAYER_ID,
      snapshot,
      balance: DEFAULT_BALANCE,
      config: createTestSessionConfig(),
      playerIds: [OWN_PLAYER_ID],
      avatarAssignments: { [OWN_PLAYER_ID]: 0 },
    };
  }

  /** One snapshot off the socket; the pill's id is recorded each time it changes. */
  function receive(moment: Moment, isRoomOpening = false): void {
    const snapshot = snapshotOf(moment);
    const message = isRoomOpening ? gameStateMessage(snapshot) : { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot };
    FakeWebSocket.latest().receive(JSON.stringify(message));
    fixture.detectChanges();
    const id = hintId();
    if (id !== null && id !== seen.at(-1)) seen.push(id);
  }

  /** The same moment for `seconds` of snapshots. */
  function hold(seconds: number, moment: Moment): void {
    const snapshots = Math.ceil(secondsToTicks(seconds) / SNAPSHOT_EVERY_TICKS);
    for (let index = 0; index < snapshots; index += 1) receive(moment);
  }

  /** The room opens with the own cell spawned in `zone`; it swims off, eats, and the opening beats are past. */
  function openIn(zone: ZoneId): void {
    receive({ zone }, true);
    receive({ zone, ownCell: { x: STEER_HINT_DISTANCE_WU }, hasEaten: true });
  }

  beforeEach(() => {
    tick = 0;
    seen = [];
    FakeWebSocket.reset();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    TestBed.configureTestingModule({
      imports: [HintComponent],
      providers: [{ provide: IdentityService, useValue: { clientId: 'me' } }],
    });
    TestBed.inject(MultiplayerService);
    TestBed.inject(WebSocketService).connect();
    FakeWebSocket.latest().open();
    fixture = TestBed.createComponent(HintComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('teaches the vent, then the aura toxin, then decay, in that order', () => {
    openIn(ZONE_ID.warmVent);
    const placed = ownCellAt({ x: STEER_HINT_DISTANCE_WU });
    const aura = { ownCell: { x: STEER_HINT_DISTANCE_WU }, zone: ZONE_ID.warmVent, others: [toxicBot(1, placed)] };
    receive({ ...aura, rates: TOXIN_DRAIN });
    // The bot leaves; decay alone shrinks the cell long enough.
    hold(COACH_SHRINK_HOLD_SECONDS + 1, {
      ownCell: { x: STEER_HINT_DISTANCE_WU },
      zone: ZONE_ID.warmVent,
      rates: DECAYING,
    });
    expect(seen).toEqual([
      ONBOARDING_BEAT.steer,
      ONBOARDING_BEAT.zoneWarmVent,
      ONBOARDING_BEAT.toxin,
      ONBOARDING_BEAT.shrink,
    ]);
  });

  it('shows no shrink during sustained toxin contact after the toxin beat was seen', () => {
    openIn(ZONE_ID.openBroth);
    const placed = ownCellAt({ x: STEER_HINT_DISTANCE_WU });
    hold(COACH_SHRINK_HOLD_SECONDS * 3, {
      ownCell: { x: STEER_HINT_DISTANCE_WU },
      others: [toxicBot(0, placed)],
      rates: TOXIN_DRAIN,
    });
    expect(seen).toContain(ONBOARDING_BEAT.toxin);
    expect(seen).not.toContain(ONBOARDING_BEAT.shrink);
  });

  it('shows no toxin beat for the own engulf’s toxic prey during cover, nor past cover (swallowed)', () => {
    openIn(ZONE_ID.openBroth);
    const placed = ownCellAt({ x: STEER_HINT_DISTANCE_WU });
    const prey = { ...toxicBot(-placed.radius, placed), engulfedByCellId: OWN_CELL_ID };
    const engulfing = { x: STEER_HINT_DISTANCE_WU, engulfingCellId: TOXIC_CELL_ID as EntityId };
    hold(1, { ownCell: engulfing, others: [prey], rates: TOXIN_DRAIN });
    hold(1, { ownCell: engulfing, others: [prey], rates: { ...DECAYING, swallowed: -20 } });
    expect(seen).not.toContain(ONBOARDING_BEAT.toxin);
  });

  it(`shows no shrink in the ${COACH_SHRINK_HOLD_SECONDS} s after a respawn, and a respawn in the vent enters it`, () => {
    openIn(ZONE_ID.openBroth);
    hold(COACH_SHRINK_HOLD_SECONDS - 1, { ownCell: { x: STEER_HINT_DISTANCE_WU }, rates: DECAYING });
    receive({ ownCell: null });
    hold(COACH_SHRINK_HOLD_SECONDS - 1, {
      ownCell: { id: RESPAWNED_CELL_ID },
      zone: ZONE_ID.warmVent,
      rates: DECAYING,
    });
    expect(seen).toEqual([ONBOARDING_BEAT.steer, ONBOARDING_BEAT.zoneWarmVent]);
    // The zone pill's time runs out and the hold, counted from the respawn, is long past.
    hold(COACH_SHRINK_HOLD_SECONDS, { ownCell: { id: RESPAWNED_CELL_ID }, zone: ZONE_ID.warmVent, rates: DECAYING });
    expect(seen.at(-1)).toBe(ONBOARDING_BEAT.shrink);
  });

  it('wears the rim of the cue each coach beat explains', () => {
    openIn(ZONE_ID.warmVent);
    const pill = (): HTMLElement | null =>
      (fixture.nativeElement as HTMLElement).querySelector(testIdSelector(HUD_TEST_ID.hint));
    expect(pill()?.getAttribute('data-hint-id')).toBe(ONBOARDING_BEAT.zoneWarmVent);
    expect(pill()?.classList.contains('rimmed')).toBe(true);
    expect(pill()?.style.getPropertyValue('--hint-rim-colour')).toBe(ZONE_CUE[ZONE_ID.warmVent]);
  });
});
