import { describe, expect, it } from 'vitest';
import { entityId, secondsToTicks } from '@evolution/shared';
import { AFFECTING_MASS_HISTORY_SECONDS, AFFECTING_MASS_SAMPLE_SECONDS } from '../hud/hud-constants';
import { ownMassHistoryFor, ownMassesFor, type OwnMassHistory } from './own-mass-history';

const CELL = entityId('c-1');
const OTHER_CELL = entityId('c-2');
const SAMPLE_TICKS = secondsToTicks(AFFECTING_MASS_SAMPLE_SECONDS);
const WINDOW_TICKS = secondsToTicks(AFFECTING_MASS_HISTORY_SECONDS);

/** Steps the history through `masses`, one snapshot per sample interval, from tick 0. */
function historyOver(masses: readonly number[]): OwnMassHistory | null {
  let history: OwnMassHistory | null = null;
  masses.forEach((mass, index) => {
    history = ownMassHistoryFor(history, { cellId: CELL, tick: index * SAMPLE_TICKS, mass });
  });
  return history;
}

describe('ownMassHistoryFor', () => {
  it('keeps the first snapshot of a cell, so a history exists from the moment the cell does', () => {
    const history = ownMassHistoryFor(null, { cellId: CELL, tick: 0, mass: 20 });
    expect(ownMassesFor(history, CELL)).toEqual([20]);
  });

  it('keeps one point per sample interval, not one per snapshot', () => {
    let history = ownMassHistoryFor(null, { cellId: CELL, tick: 0, mass: 20 });
    // Snapshots arrive far faster than the sparkline can draw; these all land inside one interval.
    for (let tick = 1; tick < SAMPLE_TICKS; tick += 1) {
      history = ownMassHistoryFor(history, { cellId: CELL, tick, mass: 20 + tick });
    }
    expect(ownMassesFor(history, CELL)).toEqual([20]);

    history = ownMassHistoryFor(history, { cellId: CELL, tick: SAMPLE_TICKS, mass: 96 });
    expect(ownMassesFor(history, CELL)).toEqual([20, 96]);
  });

  it('drops points older than the window, so the line is always the last AFFECTING_MASS_HISTORY_SECONDS', () => {
    let history = ownMassHistoryFor(null, { cellId: CELL, tick: 0, mass: 20 });
    history = ownMassHistoryFor(history, { cellId: CELL, tick: SAMPLE_TICKS, mass: 96 });
    // Far enough past BOTH earlier points that each is strictly older than the window: the one at SAMPLE_TICKS
    // would still be exactly the window old at WINDOW_TICKS + SAMPLE_TICKS, and the edge counts as inside it.
    history = ownMassHistoryFor(history, { cellId: CELL, tick: WINDOW_TICKS + SAMPLE_TICKS * 2, mass: 312 });
    expect(ownMassesFor(history, CELL)).toEqual([312]);
  });

  it('keeps a point exactly the window old: the edge is inside the window, not past it', () => {
    let history = ownMassHistoryFor(null, { cellId: CELL, tick: 0, mass: 20 });
    history = ownMassHistoryFor(history, { cellId: CELL, tick: WINDOW_TICKS, mass: 312 });
    expect(ownMassesFor(history, CELL)).toEqual([20, 312]);
  });

  it('bounds the history at the window over the sample interval, however long the cell lives', () => {
    let history: OwnMassHistory | null = null;
    for (let tick = 0; tick <= WINDOW_TICKS * 3; tick += SAMPLE_TICKS) {
      history = ownMassHistoryFor(history, { cellId: CELL, tick, mass: 20 });
    }
    expect(ownMassesFor(history, CELL).length).toBeLessThanOrEqual(WINDOW_TICKS / SAMPLE_TICKS + 1);
  });

  it('starts over on a new own cell, so a respawn never draws 312 falling to 20', () => {
    const grown = historyOver([20, 96, 312]);
    const respawned = ownMassHistoryFor(grown, { cellId: OTHER_CELL, tick: 99, mass: 20 });
    expect(ownMassesFor(respawned, OTHER_CELL)).toEqual([20]);
  });

  it('answers empty for a history belonging to another cell, rather than drawing that cellline', () => {
    expect(ownMassesFor(historyOver([20, 96]), OTHER_CELL)).toEqual([]);
    expect(ownMassesFor(null, CELL)).toEqual([]);
  });
});
