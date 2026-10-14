// The upgrade popup's spec harness (docs/ui/overlays.md §3.8): an `UpgradePopupComponent` fed snapshots the way the
// client takes them, for the own seat, on a manual scheduler, shared by its content and placement specs.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  ManualScheduler,
  PLAYER_LIFE_STATE,
  createTestPlayerProgressView,
  createTestSnapshot,
  gameId,
  playerId,
  type GameSnapshot,
  type OwnedTrait,
  type PlayerLifeState,
  type TraitId,
} from '@evolution/shared';
import { SCHEDULER } from '../app/game/clock-provider';
import { UpgradePopupComponent } from '../app/game/hud/upgrade-popup.component';
import { GameEventBus } from '../app/game/state/game-event-bus';
import { SnapshotTransitionTracker } from '../app/game/state/snapshot-transitions';
import { testIdSelector } from '../app/game/test-ids/hud-test-ids';
import { MultiplayerService } from '../app/services/multiplayer.service';

export const POPUP_OWN_PLAYER_ID = playerId('player-me');
export const POPUP_OWN_AVATAR_INDEX = 3;
/** The tick of the first snapshot, which holds no traits: every trait after it is a gain. */
export const POPUP_START_TICK = 600;
/** A form: its gain raises the form popup. */
export const PARAMECIUM: OwnedTrait = { traitId: 'paramecium_cilia' as TraitId, tier: 1 };

export class UpgradePopupHarness {
  readonly scheduler = new ManualScheduler();
  readonly multiplayer: MultiplayerService;
  private readonly tracker: SnapshotTransitionTracker;
  fixture: ComponentFixture<UpgradePopupComponent>;

  /** Call in `beforeEach`: the module, the own seat, and a fixture that has taken the first, traitless snapshot. */
  constructor() {
    TestBed.configureTestingModule({
      imports: [UpgradePopupComponent],
      providers: [{ provide: SCHEDULER, useValue: this.scheduler }],
    });
    this.multiplayer = TestBed.inject(MultiplayerService);
    this.multiplayer.gameId.set(gameId('game-1'));
    this.multiplayer.playerId.set(POPUP_OWN_PLAYER_ID);
    this.multiplayer.balance.set(DEFAULT_BALANCE);
    this.multiplayer.avatarAssignments.set({ [POPUP_OWN_PLAYER_ID]: POPUP_OWN_AVATAR_INDEX });
    this.tracker = new SnapshotTransitionTracker(TestBed.inject(GameEventBus), {
      ownPlayerId: POPUP_OWN_PLAYER_ID,
      balance: DEFAULT_BALANCE,
      roundDurationSeconds: DEFAULT_BALANCE.session.ROUND_DURATION_SECONDS,
    });
    this.fixture = TestBed.createComponent(UpgradePopupComponent);
    this.receive(POPUP_START_TICK, []);
  }

  /** A fresh fixture over the same services, as a host created later in the round. */
  recreate(): void {
    this.fixture = TestBed.createComponent(UpgradePopupComponent);
  }

  /** One `game_snapshot` as the client takes it: the signal holds the newest, the bus hears every one (`render-session.ts`). */
  deliver(snapshot: GameSnapshot): void {
    this.multiplayer.snapshot.set(snapshot);
    this.tracker.observe(snapshot);
  }

  receive(tick: number, ownedTraits: OwnedTrait[], lifeState: PlayerLifeState = PLAYER_LIFE_STATE.alive): void {
    const ownProgress = createTestPlayerProgressView({
      playerId: POPUP_OWN_PLAYER_ID,
      stage: CELL_STAGE.eukaryote,
      ownedTraits,
      lifeState,
    });
    this.deliver(createTestSnapshot({ tick, ownProgress }));
    this.fixture.detectChanges();
  }

  host(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  popup(testId: string): HTMLElement | null {
    return this.host().querySelector(testIdSelector(testId));
  }
}
