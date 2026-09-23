// @vitest-environment node
// The fixture frame (docs/architecture/encyclopedia.md §12.7, §12.9). The point of this seam is that a preview
// cannot lie about a cell: its `radius` and its `stage` come from the shared formulas over the **live** balance,
// so a trait preview's silhouette is exactly the ladder's and a balance patch moves the preview with the game.

import { describe, expect, it } from 'vitest';
import {
  CELL_KIND,
  CELL_STAGE,
  CELL_STATE,
  DEFAULT_BALANCE,
  TICK_INTERVAL_S,
  entityId,
  playerId,
  radiusForMass,
  stageOf,
  type BalanceConfig,
} from '@evolution/shared';
import { BENCH_STAGE_TRAITS } from '../bench/bench-traits';
import { PREVIEW_GEL_PATCHES, PREVIEW_SEED } from '../constants';
import { previewCellView, previewRenderFrame, type PreviewCellSpec } from './preview-frame';

const BALANCE = DEFAULT_BALANCE;
const SUBJECT_PLAYER_ID = playerId('preview-subject');
const SUBJECT_MASS = 100;

function cellSpec(overrides: Partial<PreviewCellSpec> = {}): PreviewCellSpec {
  return {
    id: 'preview-cell',
    kind: CELL_KIND.player,
    playerId: SUBJECT_PLAYER_ID,
    avatarIndex: 0,
    mass: SUBJECT_MASS,
    traits: BENCH_STAGE_TRAITS[CELL_STAGE.eukaryote],
    x: 10,
    y: -20,
    velocityX: 3,
    velocityY: 4,
    ...overrides,
  };
}

const RADIUS_SCALE_KEY = 'CELL_RADIUS_SCALE';
const PATCH_FACTOR = 2;

/** The shipped balance with a doubled radius scale: a patch a preview must follow, not ignore. */
const PATCHED_BALANCE: BalanceConfig = {
  ...BALANCE,
  growth: { ...BALANCE.growth, [RADIUS_SCALE_KEY]: BALANCE.growth.CELL_RADIUS_SCALE * PATCH_FACTOR },
};

describe('previewCellView', () => {
  it('takes the radius from radiusForMass over the live balance', () => {
    const spec = cellSpec();
    expect(previewCellView(spec, BALANCE).radius).toBe(radiusForMass(SUBJECT_MASS, BALANCE.growth));
    expect(previewCellView(spec, PATCHED_BALANCE).radius).toBe(radiusForMass(SUBJECT_MASS, PATCHED_BALANCE.growth));
    expect(previewCellView(spec, PATCHED_BALANCE).radius).not.toBe(previewCellView(spec, BALANCE).radius);
  });

  it('takes the stage from stageOf over the owned traits, for every stage the ladder has', () => {
    for (const stage of Object.values(CELL_STAGE)) {
      const traits = BENCH_STAGE_TRAITS[stage];
      const view = previewCellView(cellSpec({ traits }), BALANCE);
      expect(view.stage, stage).toBe(
        stageOf(
          traits.map((owned) => owned.traitId),
          BALANCE.ladder,
        ),
      );
      expect(
        view.traits.map((owned) => owned.traitId),
        stage,
      ).toEqual(traits.map((owned) => owned.traitId));
    }
  });

  it('gives a wild cell the world organism id and a player cell its own', () => {
    const wild = previewCellView(cellSpec({ kind: CELL_KIND.wild, playerId: null }), BALANCE);
    expect(wild.organismId).toBe(wild.id);
    expect(wild.playerId).toBeNull();
    const own = previewCellView(cellSpec(), BALANCE);
    expect(own.organismId).toBe(entityId('preview-cell'));
  });

  it('rests by default: free, not engulfing, not sprinting', () => {
    const view = previewCellView(cellSpec(), BALANCE);
    expect(view.states).toEqual([CELL_STATE.free]);
    expect(view.engulfingCellId).toBeNull();
    expect(view.engulfedByCellId).toBeNull();
    expect(view.engulfProgress).toBe(0);
    expect(view.sprintRemainingTicks).toBe(0);
    expect(view.sprintCooldownRemainingTicks).toBe(0);
  });
});

describe('previewRenderFrame', () => {
  const fractionalTick = 12.5;
  const frame = previewRenderFrame({
    renderTick: fractionalTick,
    scene: { cells: [previewCellView(cellSpec(), BALANCE)], motes: [], fragments: [], effects: [] },
    balance: BALANCE,
  });

  it('derives timeSeconds from the fractional render tick, the only time the renderer sees', () => {
    expect(frame.renderTick).toBe(fractionalTick);
    expect(frame.timeSeconds).toBeCloseTo(fractionalTick * TICK_INTERVAL_S, 9);
  });

  it('carries a fixture snapshot at the preview seed, with the bundle’s gel patches', () => {
    expect(frame.latest.seed).toBe(PREVIEW_SEED);
    expect(frame.latest.tick).toBe(Math.floor(fractionalTick));
    expect(frame.latest.gelPatches).toEqual(PREVIEW_GEL_PATCHES);
    expect(frame.latest.ownProgress).toBeNull();
    expect(frame.latest.cells).toEqual(frame.cells);
  });

  it('puts the live balance on the frame, so speedRatio and canEngulf read the patched one', () => {
    const patched = previewRenderFrame({
      renderTick: 0,
      scene: { cells: [], motes: [], fragments: [], effects: [] },
      balance: PATCHED_BALANCE,
    });
    expect(patched.balance).toBe(PATCHED_BALANCE);
    expect(frame.balance).toBe(BALANCE);
  });
});
