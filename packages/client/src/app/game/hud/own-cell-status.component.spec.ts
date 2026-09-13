import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  PLAYER_LIFE_STATE,
  createTestPlayerProgressView,
  createTestSnapshot,
  levelUpCost,
  playerId,
  type BacteriumVariant,
  type CellView,
  type PlayerProgressView,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { MultiplayerService } from '../../services/multiplayer.service';
import { OwnCellStatusComponent } from './own-cell-status.component';
import { HUD_TEST_ID, testIdSelector } from './test-ids';

const OWN_PLAYER_ID = playerId('player-me');
const NOTHING_EATEN: Record<BacteriumVariant, number> = { plain: 0, aerobic: 0, photosynthetic: 0 };

describe('OwnCellStatusComponent', () => {
  let fixture: ComponentFixture<OwnCellStatusComponent>;
  let multiplayer: MultiplayerService;

  function mirror(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(testIdSelector(HUD_TEST_ID.ownCell));
  }

  function show(cell: Partial<CellView> = {}, progress: Partial<PlayerProgressView> = {}): void {
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);
    multiplayer.snapshot.set(
      createTestSnapshot({
        cells: [createTestCellView({ playerId: OWN_PLAYER_ID, ...cell })],
        players: { [OWN_PLAYER_ID]: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, ...progress }) },
      }),
    );
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OwnCellStatusComponent] });
    multiplayer = TestBed.inject(MultiplayerService);
    fixture = TestBed.createComponent(OwnCellStatusComponent);
    fixture.detectChanges();
  });

  it('renders nothing before a snapshot, when there is no own cell to mirror', () => {
    expect(mirror()).toBeNull();
  });

  it('is in the accessibility tree and out of the layout, which is the whole point of it', () => {
    show();
    const element = mirror();
    expect(element?.getAttribute('role')).toBe('status');
    expect(element?.getAttribute('aria-live')).toBe('polite');
    // `hidden` or `display: none` would take it out of the tree it exists to be in.
    expect(element?.hasAttribute('hidden')).toBe(false);
    expect(element?.className).toContain('visually-hidden');
  });

  it('exposes the attributes a Playwright run reads for indicators drawn in WebGL', () => {
    show({ mass: 128 }, { level: 3 });
    const element = mirror();
    expect(element?.getAttribute('data-level')).toBe('3');
    expect(element?.getAttribute('data-mass')).toBe('128');
    expect(element?.getAttribute('data-dna-percent')).toBe('0');
    expect(element?.getAttribute('data-ladder')).toBe('ghost:nucleoid');
    expect(element?.getAttribute('data-sprint')).toBe('ready');
  });

  it('updates its attributes on every snapshot', () => {
    show({ mass: 20 });
    expect(mirror()?.getAttribute('data-mass')).toBe('20');
    show({ mass: 96 });
    expect(mirror()?.getAttribute('data-mass')).toBe('96');
  });

  it('carries a counter attribute once the cell is a prokaryote, so the tally is testable', () => {
    show({ stage: CELL_STAGE.prokaryote }, { bacteriaEatenByVariant: { ...NOTHING_EATEN, aerobic: 4 } });
    expect(mirror()?.getAttribute('data-aerobic')).toBe('4/10');
    expect(mirror()?.getAttribute('data-ladder')).toBe('counters');
  });

  it('holds its sentence while only the mass drifts, so aria-live does not chatter', () => {
    show({ mass: 20 });
    const spoken = mirror()?.textContent?.trim();
    show({ mass: 320 });
    expect(mirror()?.getAttribute('data-mass')).toBe('320');
    expect(mirror()?.textContent?.trim()).toBe(spoken);
  });

  it('rewrites its sentence when the level changes, which is worth hearing', () => {
    show({}, { level: 1 });
    expect(mirror()?.textContent).toContain('Level 1');
    show({}, { level: 2, dnaTowardNextLevel: levelUpCost(2, DEFAULT_BALANCE.progression) / 2 });
    expect(mirror()?.textContent).toContain('Level 2');
  });

  it('stands down while spectating: there is no own cell to speak for', () => {
    show();
    expect(mirror()).not.toBeNull();
    show({}, { lifeState: PLAYER_LIFE_STATE.spectating });
    expect(mirror()).toBeNull();
  });
});
