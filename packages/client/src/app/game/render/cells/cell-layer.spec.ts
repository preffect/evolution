import { describe, expect, it } from 'vitest';
import { CELL_STAGE, entityId } from '@evolution/shared';
import {
  TEST_OTHER_CELL_ID,
  createTestCellAbsorbedEffect,
  createTestCellView,
  createTestRenderFrame,
} from '../../../../testing/builders';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import { Graphics } from 'pixi.js';
import type { CameraExtent } from '../camera';
import { HALO_KIND } from '../constants';
import { NO_DEFORMATIONS, type CellDeformation } from './cell-deformation';
import { CONTACT_DENT_AMPLITUDE } from '../constants';
import {
  BUMP_TEXEL_START,
  CELL_INSTANCE_FLOATS,
  TEXEL_FLOATS,
  instanceFieldLocation,
  type CellInstanceScalar,
} from './cell-instance';
import { CellLayer } from './cell-layer';
import type { CellLayerFrame } from './cell-layer-frame';
import type { CellPassMesh } from './cell-mesh';
import { CELL_UNIFORM, CELL_UNIFORM_GROUP } from './cell-shader-source';

const EXTENT: CameraExtent = { minX: -100, minY: -100, maxX: 100, maxY: 100 };
/** The level carried alongside the traits: the stage is the server's `stageOf` of the traits, not of the level. */
const LEVEL_SET_WITH_TRAITS = 5;
/** One bundle for the file: the bakes are the slow part (#226). */
const textures = createTestRenderTextures({ seed: 3 });
/** The layer's child stack, in the order the first spec pins. */
const LAYER_CHILD = { flagella: 0, body: 1, organelleSprites: 2, membrane: 3 } as const;

function input(overrides: Partial<CellLayerFrame> = {}): CellLayerFrame {
  return {
    frame: createTestRenderFrame(),
    extent: EXTENT,
    zoom: 1,
    nowMs: 0,
    ownCell: null,
    previewTraitId: null,
    deformations: NO_DEFORMATIONS,
    ...overrides,
  };
}

/** The float at `field` of instance `row` in the layer's packed rows. */
function packed(subject: CellLayer, row: number, field: CellInstanceScalar): number {
  const [texel, channel] = instanceFieldLocation(field);
  return subject.instances[row * CELL_INSTANCE_FLOATS + texel * TEXEL_FLOATS + channel] ?? Number.NaN;
}

describe('CellLayer', () => {
  it('stacks the flagella, the body pass, the organelle sprites and the membrane pass in that order', () => {
    const subject = new CellLayer(textures);
    const children = subject.container.children;
    expect(children).toHaveLength(Object.keys(LAYER_CHILD).length);
    expect(children[LAYER_CHILD.flagella]).toBeInstanceOf(Graphics);
    expect(children[LAYER_CHILD.body]).not.toBe(children[LAYER_CHILD.membrane]);
    expect(children[LAYER_CHILD.organelleSprites]?.children).toEqual([]);
    subject.destroy();
  });

  it('packs one instance per visible cell, smallest first, and counts them', () => {
    const subject = new CellLayer(textures);
    const cells = [
      createTestCellView({ x: 10, y: -20, radius: 6 }),
      createTestCellView({ id: TEST_OTHER_CELL_ID, x: 30, y: 0, radius: 3 }),
      createTestCellView({ id: entityId('c-far'), x: 500, y: 0 }),
    ];
    const outputs = subject.update(input({ frame: createTestRenderFrame({ cells }) }));
    expect(outputs.visibleCells).toBe(2);
    expect(packed(subject, 0, 'radius')).toBe(3);
    expect(packed(subject, 0, 'x')).toBe(30);
    expect(packed(subject, 1, 'radius')).toBe(6);
    expect(packed(subject, 1, 'y')).toBe(-20);
    subject.destroy();
  });

  it('keeps a state for every cell of the frame, on screen or not, so a culled cell returns unchanged', () => {
    const subject = new CellLayer(textures);
    const cells = [createTestCellView({ x: 10 }), createTestCellView({ id: entityId('c-far'), x: 500, y: 0 })];
    subject.update(input({ frame: createTestRenderFrame({ cells }) }));
    expect(subject.stateCount).toBe(2);
    subject.update(input({ frame: createTestRenderFrame({ cells: [cells[0]!] }) }));
    expect(subject.stateCount).toBe(1);
    subject.destroy();
  });

  it('culls at the quad reach, not the radius, so a halo at the edge still draws', () => {
    const subject = new CellLayer(textures);
    const nearEdge = createTestCellView({ x: EXTENT.maxX + 10, y: 0, radius: 6 });
    expect(subject.update(input({ frame: createTestRenderFrame({ cells: [nearEdge] }) })).visibleCells).toBe(1);
    const past = createTestCellView({ x: EXTENT.maxX + 100, y: 0, radius: 6 });
    expect(subject.update(input({ frame: createTestRenderFrame({ cells: [past] }) })).visibleCells).toBe(0);
    subject.destroy();
  });

  it('drops the smallest cells past the capacity and keeps the largest', () => {
    const subject = new CellLayer(textures, 2);
    const cells = [
      createTestCellView({ id: entityId('c-small'), x: -10, radius: 2 }),
      createTestCellView({ id: entityId('c-mid'), x: 0, radius: 5 }),
      createTestCellView({ id: entityId('c-large'), x: 10, radius: 9 }),
    ];
    const outputs = subject.update(input({ frame: createTestRenderFrame({ cells }) }));
    expect(outputs.visibleCells).toBe(2);
    expect(packed(subject, 0, 'radius')).toBe(5);
    expect(packed(subject, 1, 'radius')).toBe(9);
    subject.destroy();
  });

  it('hands each cell its own deformation and rests the others', () => {
    const subject = new CellLayer(textures);
    const own = createTestCellView({ radius: 10 });
    const other = createTestCellView({ id: TEST_OTHER_CELL_ID, x: 30, radius: 20 });
    const pulsed: CellDeformation = { bumps: [], pulse: 1.09, alpha: 0.5 };
    const frame = createTestRenderFrame({ cells: [own, other] });
    subject.update(input({ frame, deformations: new Map([[own.id, pulsed]]) }));
    expect(packed(subject, 0, 'pulse')).toBeCloseTo(1.09, 6);
    expect(packed(subject, 0, 'alpha')).toBeCloseTo(0.5, 6);
    expect(packed(subject, 1, 'pulse')).toBe(1);
    expect(packed(subject, 1, 'alpha')).toBe(1);
    subject.destroy();
  });

  it('sets the frame uniforms, marks the own cell and places its organelle sprites', () => {
    const subject = new CellLayer(textures);
    const own = createTestCellView({
      radius: 30,
      stage: CELL_STAGE.prokaryote,
      traits: [{ traitId: 'mitochondrion', tier: 1 }],
    });
    const frame = createTestRenderFrame({ cells: [own], timeSeconds: 2.5 });
    const outputs = subject.update(input({ frame, ownCell: own, zoom: 1.8 }));
    expect(outputs.organelleSprites).toBeGreaterThan(0);
    expect(packed(subject, 0, 'isOwn')).toBe(1);
    const membrane = subject.container.children[LAYER_CHILD.membrane] as CellPassMesh;
    const uniforms = (membrane.shader?.resources[CELL_UNIFORM_GROUP] as { uniforms: Record<string, number> }).uniforms;
    expect(uniforms[CELL_UNIFORM.timeSeconds]).toBe(2.5);
    expect(uniforms[CELL_UNIFORM.zoom]).toBe(1.8);
    expect(subject.update(input({ frame, ownCell: null })).organelleSprites).toBe(outputs.organelleSprites);
    expect(packed(subject, 0, 'isOwn')).toBe(0);
    subject.destroy();
  });

  it('repacks a cell whose stage changes between frames instead of keeping its first-seen stack (#236)', () => {
    const subject = new CellLayer(textures);
    const protocell = createTestCellView({ radius: 30 });
    const before = subject.update(input({ frame: createTestRenderFrame({ cells: [protocell] }), zoom: 1.8 }));
    expect(packed(subject, 0, 'isProtocell')).toBe(1);
    expect(packed(subject, 0, 'haloKind')).toBe(HALO_KIND.protocell);
    const eukaryote = createTestCellView({
      radius: 30,
      level: LEVEL_SET_WITH_TRAITS,
      stage: CELL_STAGE.eukaryote,
      traits: [
        { traitId: 'nucleoid', tier: 1 },
        { traitId: 'ribosomes', tier: 1 },
        { traitId: 'mitochondrion', tier: 1 },
        { traitId: 'nuclear_envelope', tier: 1 },
      ],
    });
    const after = subject.update(input({ frame: createTestRenderFrame({ cells: [eukaryote] }), zoom: 1.8 }));
    expect(subject.stateCount).toBe(1);
    expect(packed(subject, 0, 'isProtocell')).toBe(0);
    expect(packed(subject, 0, 'haloKind')).toBe(HALO_KIND.default);
    expect(after.organelleSprites).not.toBe(before.organelleSprites);
    subject.destroy();
  });

  it('drops a state when its cell leaves the frame and hides the passes with no cells', () => {
    const subject = new CellLayer(textures);
    subject.update(input());
    expect(subject.stateCount).toBe(1);
    const outputs = subject.update(input({ frame: createTestRenderFrame({ cells: [] }) }));
    expect(outputs.visibleCells).toBe(0);
    expect(subject.stateCount).toBe(0);
    expect(subject.container.children[LAYER_CHILD.body]?.visible).toBe(false);
    subject.destroy();
  });

  it('packs a ghost before its predator, an orphan ghost last, and reserves ghost rows inside the capacity', () => {
    const subject = new CellLayer(textures, 3);
    const predator = createTestCellView({ id: entityId('pred'), x: 0, radius: 30 });
    const prey = createTestCellView({ id: entityId('prey'), x: 40, radius: 5 });
    const bystander = createTestCellView({ id: entityId('by'), x: -60, radius: 10 });
    const tiny = createTestCellView({ id: entityId('tiny'), x: 60, radius: 2 });
    subject.update(input({ frame: createTestRenderFrame({ cells: [predator, prey, bystander, tiny] }) }));
    const absorbed = createTestCellAbsorbedEffect({ cellId: prey.id, predatorCellId: predator.id, x: 40, y: 0 });
    const frame = createTestRenderFrame({ cells: [predator, bystander, tiny], effects: [absorbed] });
    const outputs = subject.update(input({ frame, nowMs: 100 }));
    expect(outputs).toMatchObject({ visibleCells: 2, ghosts: 1 });
    expect([0, 1, 2].map((row) => packed(subject, row, 'x'))).toEqual([-60, 40, 0]);
    const orphaned = createTestRenderFrame({ cells: [bystander, tiny] });
    subject.update(input({ frame: orphaned, nowMs: 200 }));
    expect([0, 1, 2].map((row) => packed(subject, row, 'x'))).toEqual([60, -60, 40]);
    subject.destroy();
  });

  it('places a ghost’s organelle sprites before its predator’s, fading with the ghost’s body (#243)', () => {
    const subject = new CellLayer(textures);
    const predator = createTestCellView({ id: entityId('pred'), x: 0, radius: 30 });
    const prey = createTestCellView({
      id: entityId('prey'),
      x: 40,
      radius: 20,
      stage: CELL_STAGE.eukaryote,
      level: LEVEL_SET_WITH_TRAITS,
      traits: [
        { traitId: 'nuclear_envelope', tier: 1 },
        { traitId: 'mitochondrion', tier: 2 },
      ],
    });
    const alone = subject.update(input({ frame: createTestRenderFrame({ cells: [predator] }) }));
    const both = subject.update(input({ frame: createTestRenderFrame({ cells: [predator, prey] }) }));
    const preySprites = both.organelleSprites - alone.organelleSprites;
    expect(preySprites).toBeGreaterThan(0);
    const absorbed = createTestCellAbsorbedEffect({ cellId: prey.id, predatorCellId: predator.id, x: 40, y: 0 });
    subject.update(input({ frame: createTestRenderFrame({ cells: [predator], effects: [absorbed] }), nowMs: 0 }));
    const ghosted = subject.update(input({ frame: createTestRenderFrame({ cells: [predator] }), nowMs: 200 }));
    expect(ghosted).toMatchObject({ visibleCells: 1, ghosts: 1, organelleSprites: both.organelleSprites });
    const sprites = subject.container.children[LAYER_CHILD.organelleSprites]!.children;
    expect(sprites.slice(0, preySprites).every((sprite) => sprite.alpha > 0 && sprite.alpha < 1)).toBe(true);
    expect(sprites.slice(0, preySprites).map((sprite) => sprite.alpha)).toEqual(
      Array.from({ length: preySprites }, () => packed(subject, 0, 'alpha')),
    );
    expect(packed(subject, 0, 'rimDash')).toBe(1);
    subject.destroy();
  });

  it('strokes a tail for a flagellate cell and none for a far dot', () => {
    const subject = new CellLayer(textures);
    const swimmer = createTestCellView({ radius: 10, traits: [{ traitId: 'simple_flagellum', tier: 3 }] });
    expect(subject.update(input({ frame: createTestRenderFrame({ cells: [swimmer] }) })).flagella).toBe(2);
    expect(subject.update(input({ frame: createTestRenderFrame({ cells: [swimmer] }), zoom: 0.1 })).flagella).toBe(0);
    subject.destroy();
  });

  it('dents two touching cells toward each other and leaves a lone cell round', () => {
    const subject = new CellLayer(textures);
    const left = createTestCellView({ x: 0, radius: 10 });
    const right = createTestCellView({ id: TEST_OTHER_CELL_ID, x: 15, radius: 10 });
    subject.update(input({ frame: createTestRenderFrame({ cells: [left, right] }) }));
    const bumpBase = BUMP_TEXEL_START * TEXEL_FLOATS;
    expect(subject.instances[bumpBase]).toBeCloseTo(CONTACT_DENT_AMPLITUDE, 6);
    expect(subject.instances[bumpBase + 1]).toBeCloseTo(0, 6);
    expect(subject.instances[CELL_INSTANCE_FLOATS + bumpBase]).toBeCloseTo(CONTACT_DENT_AMPLITUDE, 6);
    expect(Math.abs(subject.instances[CELL_INSTANCE_FLOATS + bumpBase + 1] ?? 0)).toBeCloseTo(Math.PI, 6);
    subject.update(input({ frame: createTestRenderFrame({ cells: [left] }) }));
    expect(subject.instances[bumpBase]).toBe(0);
    subject.destroy();
  });
});
