import { describe, expect, it } from 'vitest';
import {
  EFFECT_KIND,
  ENGULF_RELEASE_REASON,
  entityId,
  playerId,
  type CellAbsorbedEffect,
  type CellReleasedEffect,
  type EngulfReleaseReason,
} from '@evolution/shared';
import {
  ROUND_PHASE_ENDS_SECONDS,
  WILD_ROLE,
  createPredationTally,
  roundPhaseAt,
  roundPhaseMinutes,
  tallyEffects,
} from './predation-tally.js';

const ROLES: Record<string, string> = { hunterCell: 'hunter', foragerCell: 'forager', wildCell: WILD_ROLE };
const roleOf = (cellId: string): string => ROLES[cellId] ?? 'unknown';
const HUNT_SECOND = 300;

function absorbed(predator: string, prey: string, isPlayerPrey = true): CellAbsorbedEffect {
  return {
    kind: EFFECT_KIND.cellAbsorbed,
    tick: 0,
    x: 0,
    y: 0,
    cellId: entityId(prey),
    playerId: isPlayerPrey ? playerId('forager') : null,
    predatorCellId: entityId(predator),
    predatorMassGained: 0,
    predatorDnaGained: 0,
  };
}

function released(prey: string, reason: EngulfReleaseReason): CellReleasedEffect {
  return {
    kind: EFFECT_KIND.cellReleased,
    tick: 0,
    x: 0,
    y: 0,
    cellId: entityId(prey),
    predatorCellId: entityId('hunterCell'),
    reason,
  };
}

describe('predation tally', () => {
  it('places a round second in its session §5.1 phase, and none once the round is over', () => {
    expect(roundPhaseAt(0)).toBe('dawn');
    expect(roundPhaseAt(ROUND_PHASE_ENDS_SECONDS.dawn)).toBe('trip');
    expect(roundPhaseAt(HUNT_SECOND)).toBe('hunt');
    expect(roundPhaseAt(ROUND_PHASE_ENDS_SECONDS.hunt)).toBe('bloom');
    expect(roundPhaseAt(ROUND_PHASE_ENDS_SECONDS.bloom)).toBeUndefined();
  });

  it('knows each phase length in minutes: the Hunt is 4:30 to 8:00', () => {
    expect(roundPhaseMinutes('dawn')).toBe(3);
    expect(roundPhaseMinutes('hunt')).toBe(3.5);
    expect(roundPhaseMinutes('bloom')).toBe(2);
  });

  it('counts a player prey absorbed or released as a started engulf, and only an escape as escaped', () => {
    const tally = createPredationTally();
    const effects = [
      absorbed('hunterCell', 'foragerCell'),
      released('foragerCell', ENGULF_RELEASE_REASON.escaped),
      released('foragerCell', ENGULF_RELEASE_REASON.ratio),
    ];
    tallyEffects(tally, effects, HUNT_SECOND, roleOf);
    expect(tally.byPhase.hunt).toEqual({ absorbed: 1, started: 3, escaped: 1 });
    expect(tally.byPhase.dawn).toEqual({ absorbed: 0, started: 0, escaped: 0 });
    expect(tally.byRoles.get('hunter>forager')?.hunt).toEqual({ absorbed: 1, started: 3, escaped: 1 });
    expect(tally.byRoles.get('hunter>forager')?.bloom).toEqual({ absorbed: 0, started: 0, escaped: 0 });
    expect([...tally.byRoles.keys()]).toEqual(['hunter>forager']);
  });

  it('ignores a wild prey, eaten or released, and anything after the round', () => {
    const tally = createPredationTally();
    tallyEffects(
      tally,
      [absorbed('hunterCell', 'wildCell', false), released('wildCell', ENGULF_RELEASE_REASON.escaped)],
      HUNT_SECOND,
      roleOf,
    );
    tallyEffects(tally, [absorbed('hunterCell', 'foragerCell')], ROUND_PHASE_ENDS_SECONDS.bloom, roleOf);
    expect(tally.byPhase.hunt).toEqual({ absorbed: 0, started: 0, escaped: 0 });
    expect(tally.byRoles.size).toBe(0);
  });

  it('keys a wild predator of a player by its role', () => {
    const tally = createPredationTally();
    tallyEffects(tally, [absorbed('wildCell', 'hunterCell')], 0, roleOf);
    expect([...tally.byRoles.keys()]).toEqual(['wild>hunter']);
    expect(tally.byRoles.get('wild>hunter')?.dawn).toEqual({ absorbed: 1, started: 1, escaped: 0 });
    expect(tally.byPhase.dawn).toEqual({ absorbed: 1, started: 1, escaped: 0 });
  });
});
