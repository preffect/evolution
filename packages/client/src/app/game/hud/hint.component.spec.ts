import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  PLAYER_LIFE_STATE,
  ROUND_PHASE,
  createTestPlayerProgressView,
  createTestSnapshot,
  createTestTraitOfferView,
  playerId,
  type GameSnapshot,
  type OwnProgressView,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { MultiplayerService } from '../../services/multiplayer.service';
import { ONBOARDING_BEAT } from './format/onboarding-beats';
import { styleRuleValue } from '../../../testing/style-rules';
import { HintComponent } from './hint.component';
import { HUD_TEST_ID, testIdSelector } from '../test-ids/hud-test-ids';

const OWN_PLAYER_ID = playerId('player-me');

describe('HintComponent', () => {
  let fixture: ComponentFixture<HintComponent>;
  let multiplayer: MultiplayerService;

  function pill(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(testIdSelector(HUD_TEST_ID.hint));
  }

  function show(overrides: Partial<GameSnapshot> = {}, progress: Partial<OwnProgressView> = {}): void {
    multiplayer.snapshot.set(
      createTestSnapshot({
        cells: [createTestCellView({ playerId: OWN_PLAYER_ID })],
        ownProgress: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, ...progress }),
        ...overrides,
      }),
    );
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HintComponent] });
    multiplayer = TestBed.inject(MultiplayerService);
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);
    fixture = TestBed.createComponent(HintComponent);
    fixture.detectChanges();
  });

  it('shows nothing before the first snapshot', () => {
    expect(pill()).toBeNull();
  });

  it('shows the steer beat on the first alive snapshot, with its id and words, inside a polite live region', () => {
    show();
    expect(pill()?.getAttribute('data-hint-id')).toBe(ONBOARDING_BEAT.steer);
    expect(pill()?.textContent?.trim()).toBe('Move the pointer · your cell follows');
    expect(pill()?.classList.contains('rimmed')).toBe(false);
    expect(pill()?.parentElement?.getAttribute('aria-live')).toBe('polite');
  });

  it('stands down while the picker is open, while spectating and between rounds', () => {
    show({}, { offer: createTestTraitOfferView() });
    expect(pill()).toBeNull();
    show({ tick: 1, cells: [] }, { lifeState: PLAYER_LIFE_STATE.spectating });
    expect(pill()).toBeNull();
    show({ tick: 2, roundPhase: ROUND_PHASE.results });
    expect(pill()).toBeNull();
  });

  it('caps the width at the full host less its margins, and lets the pill fill that cap', () => {
    show();
    expect(styleRuleValue(document, ['.live'], 'max-width')).toBe(
      'calc(100% - 2 * var(--hud-margin) * var(--hud-scale))',
    );
    expect(styleRuleValue(document, ['.pill'], 'max-width')).toBe('100%');
    expect(styleRuleValue(document, ['.pill'], 'white-space')).toBeNull();
    expect(styleRuleValue(document, ['.pill'], 'height')).toBeNull();
  });
});
