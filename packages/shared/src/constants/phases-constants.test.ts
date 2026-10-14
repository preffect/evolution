// docs/game-design/phases.md §14.14.1: the stage 1 constants (the pool) carry the table's defaults, read from the table
// itself so a number moved on one side fails here; the `eras`, `pool` and `poolCreatures` balance domains carry every
// constant of their files; and the shipping game stays the dish alone (§14.2.4).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from './balance.js';
import * as eras from './eras.js';
import * as erasDerived from './eras-derived.js';
import * as pool from './pool.js';
import * as poolCreatures from './pool-creatures.js';
import { DISH_RADIUS } from './world.js';
import { markdownSection, tableRows } from '../testing/markdown-document.js';
import { GAME_ERA } from '../types/game.js';
import { isErasInPlayList } from '../types/game-guards.js';
import { eraLandmarkRadius } from '../simulation/era-scale.js';

const PHASES_DOC = new URL('../../../../docs/game-design/phases.md', import.meta.url);
const STAGE_ONE_HEADING = '#### 14.14.1 Stage 1 constants table';
/** The rows whose default is not one number: pinned below by value. */
const STRUCTURED_ROWS: readonly string[] = ['ERA_START_SECONDS', 'ERAS_IN_PLAY'];
/** `1 400`, `3 (plus the landmark, §14.6.3)`, `1.0`: a number written with thin groups, then anything. */
const LEADING_NUMBER_PATTERN = /^(\d[\d ]*(?:\.\d+)?)/;
const BACKTICKED_NAME_PATTERN = /^`([A-Z][A-Z0-9_]*)`$/;
const DIGIT_GROUP_SEPARATOR = / /g;

const STAGE_ONE_CONSTANTS: Readonly<Record<string, unknown>> = { ...eras, ...erasDerived, ...pool, ...poolCreatures };

/** Each row of the table as its constant's name and the number its default cell opens with. */
function numericRows(): [string, number][] {
  const markdown = readFileSync(PHASES_DOC, 'utf8');
  return tableRows(markdownSection(markdown, STAGE_ONE_HEADING)).flatMap(([nameCell, defaultCell]) => {
    const name = BACKTICKED_NAME_PATTERN.exec(nameCell ?? '')?.[1];
    if (name === undefined || STRUCTURED_ROWS.includes(name)) return [];
    const written = LEADING_NUMBER_PATTERN.exec(defaultCell ?? '')?.[1];
    return [[name, Number(written?.replace(DIGIT_GROUP_SEPARATOR, ''))] as [string, number]];
  });
}

describe('the stage 1 constants table (phases.md §14.14.1)', () => {
  const rows = numericRows();

  it('reads every numeric row of the table', () => {
    // 59 rows less the two structured ones: a parser that stopped seeing rows would pass the cases below vacuously.
    expect(rows).toHaveLength(57);
  });

  it.each(rows)('%s ships at the table’s %s', (name, tableDefault) => {
    expect(Number.isFinite(tableDefault)).toBe(true);
    expect(STAGE_ONE_CONSTANTS[name]).toBe(tableDefault);
  });

  it('starts the eras at 0:00, 10:00 and 17:00', () => {
    expect(eras.ERA_START_SECONDS).toEqual({ [GAME_ERA.dish]: 0, [GAME_ERA.pool]: 600, [GAME_ERA.colonies]: 1020 });
  });

  it('ships the dish alone, a list the era-list kind accepts, so the default game plays as before the eras', () => {
    expect(eras.ERAS_IN_PLAY).toEqual([GAME_ERA.dish]);
    expect(isErasInPlayList(eras.ERAS_IN_PLAY)).toBe(true);
  });

  it('derives the landmark from the footprint: the dish’s radius over the scale step, patched leaves included (§14.6.3)', () => {
    expect(erasDerived.ERA_LANDMARK_RADIUS).toBe(DISH_RADIUS / eras.ERA_SCALE_STEP);
    expect(eraLandmarkRadius(DEFAULT_BALANCE)).toBe(erasDerived.ERA_LANDMARK_RADIUS);
    const doubledStep = { ...DEFAULT_BALANCE.eras };
    doubledStep.ERA_SCALE_STEP *= 2;
    expect(eraLandmarkRadius({ ...DEFAULT_BALANCE, eras: doubledStep })).toBe(erasDerived.ERA_LANDMARK_RADIUS / 2);
  });
});

describe('the stage 1 balance domains', () => {
  it.each([
    ['eras', DEFAULT_BALANCE.eras, eras],
    ['pool', DEFAULT_BALANCE.pool, pool],
    ['poolCreatures', DEFAULT_BALANCE.poolCreatures, poolCreatures],
  ])('%s carries every constant of its file as a leaf', (_domain, carried, domainModule) => {
    expect(carried).toEqual({ ...domainModule });
  });
});
