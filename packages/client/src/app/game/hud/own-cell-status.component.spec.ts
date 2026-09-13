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
import { STATUS_ANNOUNCE_DNA_STEP_PERCENT } from './hud-constants';
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

  it('keeps the unclaimed counter on a cell one endosymbiont promoted, beside the envelope ghost (#285 B)', () => {
    const nucleoidAndChloroplast = [
      { traitId: 'nucleoid', tier: 1 },
      { traitId: 'chloroplast', tier: 1 },
    ] as const;
    show(
      { stage: CELL_STAGE.endosymbiosis, traits: [...nucleoidAndChloroplast] },
      { bacteriaEatenByVariant: { ...NOTHING_EATEN, aerobic: 10 } },
    );
    expect(mirror()?.getAttribute('data-ladder')).toBe('ghost:envelope');
    expect(mirror()?.getAttribute('data-aerobic')).toBe('10/10');
    expect(mirror()?.hasAttribute('data-photosynthetic')).toBe(false);
  });

  // Documentation rather than a guard: mass is not in the sentence, so this holds whether the
  // announce rule works or not. code-qa proved it by defeating the rule and leaving the suite
  // green. The test below it is the one that fails on a broken component (#282 review).
  it('holds its sentence while only the mass drifts, so aria-live does not chatter', () => {
    show({ mass: 20 });
    const spoken = mirror()?.textContent?.trim();
    show({ mass: 320 });
    expect(mirror()?.getAttribute('data-mass')).toBe('320');
    expect(mirror()?.textContent?.trim()).toBe(spoken);
  });

  it('holds its sentence while DNA climbs inside one announce step', () => {
    // Both percents are derived from STATUS_ANNOUNCE_DNA_STEP_PERCENT rather than written out, so
    // retuning that step cannot quietly turn this into a test of nothing — which is the exact
    // failure this whole must-fix is about. The two asserts below state the premise, so a step
    // that breaks the construction fails loudly here instead of passing for the wrong reason.
    const step = STATUS_ANNOUNCE_DNA_STEP_PERCENT;
    const lowPercent = Math.floor(step / 5);
    const highPercent = step - 1;
    expect(lowPercent).not.toBe(highPercent);
    expect(Math.floor(lowPercent / step)).toBe(Math.floor(highPercent / step));

    // Half a percent past the integer, so `dnaPercentOf`'s floor lands on it whatever the float does.
    const cost = levelUpCost(1, DEFAULT_BALANCE.progression);
    const dnaFor = (percent: number): number => (cost * (percent + 0.5)) / 100;

    show({}, { level: 1, dnaTowardNextLevel: dnaFor(lowPercent) });
    const spoken = mirror()?.textContent?.trim();
    expect(spoken).toContain(`DNA ${lowPercent} %`);

    show({}, { level: 1, dnaTowardNextLevel: dnaFor(highPercent) });
    // The attribute moves every snapshot; the sentence must not, because both percents are in the
    // same STATUS_ANNOUNCE_DNA_STEP_PERCENT step and aria-live has nothing new to say.
    expect(mirror()?.getAttribute('data-dna-percent')).toBe(String(highPercent));
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
