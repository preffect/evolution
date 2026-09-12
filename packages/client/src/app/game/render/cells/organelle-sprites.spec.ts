import { describe, expect, it } from 'vitest';
import { CELL_STAGE, DEFAULT_BALANCE, createSeededRandom } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import { hexToNumber } from '../colour';
import { FOOD_VACUOLE, ORGANELLE_KIND, WHITE } from '../constants';
import { paletteFor } from '../palette';
import { buildNoiseStrip } from '../noise/noise-strip';
import { REST_DEFORMATION } from './cell-deformation';
import { cellLodFor } from './cell-lod';
import { CellRenderState, NO_CELL_CONTACTS, type CellFrameContext } from './cell-render-state';
import { OrganelleSprites, type OrganelleDraw } from './organelle-sprites';

const TEST_SEED = 7;
const textures = createTestRenderTextures({ seed: TEST_SEED });

function context(overrides: Partial<CellFrameContext> = {}): CellFrameContext {
  return {
    timeSeconds: 0,
    zoom: 1,
    balance: DEFAULT_BALANCE,
    ownCell: null,
    strip: buildNoiseStrip(createSeededRandom(TEST_SEED)),
    previewTraitId: null,
    ...NO_CELL_CONTACTS,
    ...overrides,
  };
}

/** A eukaryote with a nucleus, two mitochondria and two food vacuoles, drawn at (100, 50) r 40. */
function draw(overrides: Partial<OrganelleDraw> = {}): OrganelleDraw {
  const view = createTestCellView({
    x: 100,
    y: 50,
    radius: 40,
    avatarIndex: 1,
    stage: CELL_STAGE.eukaryote,
    traits: [
      { traitId: 'nuclear_envelope', tier: 1 },
      { traitId: 'mitochondrion', tier: 2 },
      { traitId: 'food_vacuole', tier: 1 },
    ],
  });
  const output = new CellRenderState(view.id, textures.cosmetic).update(view, context(), REST_DEFORMATION);
  return {
    instance: output.instance,
    lod: output.lod,
    organelles: output.organelles,
    palette: paletteFor(1),
    isSprinting: false,
    ...overrides,
  };
}

describe('OrganelleSprites', () => {
  it('places one pooled sprite per placement at the mapped point, sized by r, tinting the nucleus', () => {
    const sprites = new OrganelleSprites(textures.organelles);
    const cell = draw();
    expect(sprites.update([cell], 0)).toBe(cell.organelles.length);
    expect(sprites.poolSize).toBe(cell.organelles.length);
    const nucleusIndex = cell.organelles.findIndex((placement) => placement.kind === ORGANELLE_KIND.nucleus);
    const nucleus = sprites.container.children[nucleusIndex]!;
    const placement = cell.organelles[nucleusIndex]!;
    expect(nucleus.position.x).toBeCloseTo(100 + placement.point.x, 9);
    expect(nucleus.position.y).toBeCloseTo(50 + placement.point.y, 9);
    expect(nucleus.width).toBeCloseTo(textures.organelles.nucleus.widthRadii * 40, 6);
    expect((nucleus as { tint: number }).tint).toBe(hexToNumber(paletteFor(1).rim));
    const mitochondrion = sprites.container.children.find(
      (_child, index) => cell.organelles[index]?.kind === ORGANELLE_KIND.mitochondrion,
    ) as { tint: number };
    expect(mitochondrion.tint).toBe(hexToNumber(WHITE));
    sprites.destroy();
  });

  it('hides the spare pool when fewer placements come and reuses the sprites', () => {
    const sprites = new OrganelleSprites(textures.organelles);
    const cell = draw();
    sprites.update([cell], 0);
    const first = sprites.container.children[0];
    expect(sprites.update([{ ...cell, organelles: cell.organelles.slice(0, 1) }], 0)).toBe(1);
    expect(sprites.container.children[0]).toBe(first);
    expect(sprites.container.children[0]?.visible).toBe(true);
    expect(sprites.container.children[1]?.visible).toBe(false);
    expect(sprites.update([], 0)).toBe(0);
    sprites.destroy();
  });

  it('keeps the nucleus at full alpha through mid LOD while the interior organelles fade', () => {
    const sprites = new OrganelleSprites(textures.organelles);
    const cell = draw();
    const midLod = cellLodFor(10);
    expect(midLod.interiorBlend).toBe(0);
    sprites.update([{ ...cell, lod: midLod }], 0);
    cell.organelles.forEach((placement, index) => {
      const expected = placement.kind === ORGANELLE_KIND.nucleus ? 1 : 0;
      expect(sprites.container.children[index]?.alpha).toBe(expected);
    });
    sprites.destroy();
  });

  it('applies the sprite motion: a vacuole lifts with time and fades as it pops', () => {
    const sprites = new OrganelleSprites(textures.organelles);
    const cell = draw();
    const vacuoleIndex = cell.organelles.findIndex((placement) => placement.kind === ORGANELLE_KIND.foodVacuole);
    sprites.update([cell], 0);
    const restingY = sprites.container.children[vacuoleIndex]!.position.y;
    const phase = cell.organelles[vacuoleIndex]!.slot.phase;
    const popTime = FOOD_VACUOLE.cycleSeconds * (1 - phase + 1 - FOOD_VACUOLE.popShare / 2);
    sprites.update([cell], popTime);
    const popping = sprites.container.children[vacuoleIndex]!;
    expect(popping.position.y).toBeLessThan(restingY);
    expect(popping.alpha).toBeLessThan(1);
    sprites.destroy();
  });
});
