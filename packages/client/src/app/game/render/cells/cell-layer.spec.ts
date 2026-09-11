import { describe, expect, it } from 'vitest';
import { CELL_STAGE, entityId } from '@evolution/shared';
import { TEST_OTHER_CELL_ID, createTestCellView, createTestRenderFrame } from '../../../../testing/builders';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import type { CameraExtent } from '../camera';
import type { CellPassMesh } from './cell-mesh';
import { CELL_INSTANCE_FLOATS, instanceFieldLocation } from './cell-instance';
import { CellLayer } from './cell-layer';
import type { CellLayerFrame } from './cell-layer-frame';
import { CELL_UNIFORM, CELL_UNIFORM_GROUP } from './cell-shader-source';

const EXTENT: CameraExtent = { minX: -100, minY: -100, maxX: 100, maxY: 100 };
const TEXEL_FLOATS = 4;

function input(overrides: Partial<CellLayerFrame> = {}): CellLayerFrame {
  return {
    frame: createTestRenderFrame(),
    extent: EXTENT,
    zoom: 1,
    nowMs: 0,
    ownCell: null,
    previewTraitId: null,
    ...overrides,
  };
}

function layer(): CellLayer {
  return new CellLayer(createTestRenderTextures({ seed: 3 }));
}

/** The float at `field` of instance `row` in the layer's mesh buffer. */
function packed(subject: CellLayer, row: number, field: Parameters<typeof instanceFieldLocation>[0]): number {
  const [texel, channel] = instanceFieldLocation(field);
  const buffer = (subject as unknown as { mesh: { instances: Float32Array } }).mesh.instances;
  return buffer[row * CELL_INSTANCE_FLOATS + texel * TEXEL_FLOATS + channel] ?? Number.NaN;
}

describe('CellLayer', () => {
  it('stacks the body pass, the organelle sprites and the membrane pass in that order', () => {
    const subject = layer();
    const [body, organelles, membrane] = subject.container.children;
    expect(subject.container.children).toHaveLength(3);
    expect(body).not.toBe(membrane);
    expect(organelles?.children).toEqual([]);
    subject.destroy();
  });

  it('packs one instance per visible cell, smallest first, and counts them', () => {
    const subject = layer();
    const cells = [
      createTestCellView({ x: 10, y: -20, radius: 6 }),
      createTestCellView({ id: TEST_OTHER_CELL_ID, x: 30, y: 0, radius: 3 }),
      createTestCellView({ id: entityId('c-far'), x: 500, y: 0 }),
    ];
    const outputs = subject.update(input({ frame: createTestRenderFrame({ cells }) }));
    expect(outputs.visibleCells).toBe(2);
    expect(subject.stateCount).toBe(2);
    expect(packed(subject, 0, 'radius')).toBe(3);
    expect(packed(subject, 0, 'x')).toBe(30);
    expect(packed(subject, 1, 'radius')).toBe(6);
    expect(packed(subject, 1, 'y')).toBe(-20);
    subject.destroy();
  });

  it('culls at the quad reach, not the radius, so a halo at the edge still draws', () => {
    const subject = layer();
    const nearEdge = createTestCellView({ x: EXTENT.maxX + 10, y: 0, radius: 6 });
    expect(subject.update(input({ frame: createTestRenderFrame({ cells: [nearEdge] }) })).visibleCells).toBe(1);
    const past = createTestCellView({ x: EXTENT.maxX + 100, y: 0, radius: 6 });
    expect(subject.update(input({ frame: createTestRenderFrame({ cells: [past] }) })).visibleCells).toBe(0);
    subject.destroy();
  });

  it('sets the frame uniforms, marks the own cell and places its organelle sprites', () => {
    const subject = layer();
    const own = createTestCellView({
      radius: 30,
      stage: CELL_STAGE.prokaryote,
      traits: [{ traitId: 'mitochondrion', tier: 1 }],
    });
    const frame = createTestRenderFrame({ cells: [own], timeSeconds: 2.5 });
    const outputs = subject.update(input({ frame, ownCell: own, zoom: 1.8 }));
    expect(outputs.organelleSprites).toBeGreaterThan(0);
    expect(packed(subject, 0, 'isOwn')).toBe(1);
    const membrane = subject.container.children[2] as CellPassMesh;
    const uniforms = (membrane.shader?.resources[CELL_UNIFORM_GROUP] as { uniforms: Record<string, number> }).uniforms;
    expect(uniforms[CELL_UNIFORM.timeSeconds]).toBe(2.5);
    expect(uniforms[CELL_UNIFORM.zoom]).toBe(1.8);
    expect(subject.update(input({ frame, ownCell: null })).organelleSprites).toBe(outputs.organelleSprites);
    expect(packed(subject, 0, 'isOwn')).toBe(0);
    subject.destroy();
  });

  it('drops a state when its cell leaves the frame and hides the passes with no cells', () => {
    const subject = layer();
    subject.update(input());
    expect(subject.stateCount).toBe(1);
    const outputs = subject.update(input({ frame: createTestRenderFrame({ cells: [] }) }));
    expect(outputs.visibleCells).toBe(0);
    expect(subject.stateCount).toBe(0);
    expect(subject.container.children[0]?.visible).toBe(false);
    subject.destroy();
  });
});
