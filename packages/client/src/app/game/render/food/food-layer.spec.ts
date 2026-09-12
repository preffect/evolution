import { describe, expect, it } from 'vitest';
import { entityId, type DnaFragmentView } from '@evolution/shared';
import { ParticleContainer } from 'pixi.js';
import { createTestFoodMoteView } from '../../../../testing/builders';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import { MOTE_ATLAS_PX_PER_WU, MOTE_SMALL_VARIANT_PX_PER_WU } from '../constants';
import { FoodLayer, type FoodLayerFrame } from './food-layer';

const textures = createTestRenderTextures({ seed: 9 });
const algae = createTestFoodMoteView({ id: entityId('m-a'), x: 10, y: 20 });
const rod = createTestFoodMoteView({ id: entityId('m-r'), kind: 'bacterium', bacteriumVariant: 'plain', x: 0, y: 0 });
const fragment: DnaFragmentView = { id: entityId('f-1'), x: 5, y: 6, tag: 'motile' };

function frame(overrides: Partial<FoodLayerFrame> = {}): FoodLayerFrame {
  return { motes: [algae, rod], fragments: [fragment], timeSeconds: 0, zoom: 1, ...overrides };
}

describe('FoodLayer', () => {
  it('draws every mote as a particle of one container over the atlas source and every fragment as a sprite above', () => {
    const subject = new FoodLayer(textures);
    const outputs = subject.update(frame());
    expect(outputs).toEqual({ motes: 2, fragments: 1 });
    const [particles] = subject.container.children;
    expect(particles).toBeInstanceOf(ParticleContainer);
    expect((particles as ParticleContainer).particleChildren).toHaveLength(2);
    expect(subject.moteParticles[0]).toMatchObject({ x: 10, y: 20 });
    expect(subject.moteParticles.every((particle) => particle.texture.source === textures.motes.source)).toBe(true);
    expect(subject.moteParticles[0]!.texture).toBe(textures.motes.full.algae);
    expect(subject.fragmentSprites[0]).toMatchObject({ x: 5, y: 6, visible: true });
    expect(subject.fragmentSprites[0]!.texture).toBe(textures.motes.fragments.motile);
    subject.destroy();
  });

  it('scales a sprite by its bake resolution and swaps to the small variant below the zoom threshold', () => {
    const subject = new FoodLayer(textures);
    subject.update(frame({ zoom: 1 }));
    const full = subject.moteParticles[0]!;
    expect(full.scaleX).toBeCloseTo(full.scaleY, 9);
    const fullScale = full.scaleX * MOTE_ATLAS_PX_PER_WU;
    subject.update(frame({ zoom: 0.2 }));
    expect(subject.moteParticles[0]!.texture).toBe(textures.motes.small.algae);
    expect(subject.moteParticles[0]!.scaleX * MOTE_SMALL_VARIANT_PX_PER_WU).toBeGreaterThan(fullScale);
    subject.destroy();
  });

  it('turns a rod along its walk, holds the heading when it stops, and never rotates an alga', () => {
    const subject = new FoodLayer(textures);
    subject.update(frame({ motes: [rod] }));
    subject.update(frame({ motes: [{ ...rod, x: 0, y: 10 }], timeSeconds: 0.5 }));
    const walking = subject.moteParticles[0]!.rotation;
    expect(Math.abs(walking - Math.PI / 2)).toBeLessThan(0.3);
    subject.update(frame({ motes: [{ ...rod, x: 0, y: 10 }], timeSeconds: 0.5 }));
    expect(subject.moteParticles[0]!.rotation).toBe(walking);
    subject.update(frame({ motes: [algae] }));
    expect(subject.moteParticles[0]!.rotation).toBe(0);
    subject.destroy();
  });

  it('spins a fragment with time and parks the spare particles and sprites when the counts drop', () => {
    const subject = new FoodLayer(textures);
    subject.update(frame());
    const start = subject.fragmentSprites[0]!.rotation;
    subject.update(frame({ timeSeconds: 1 }));
    expect(subject.fragmentSprites[0]!.rotation).toBeGreaterThan(start);
    const outputs = subject.update(frame({ motes: [], fragments: [] }));
    expect(outputs).toEqual({ motes: 0, fragments: 0 });
    expect(subject.moteParticles.every((particle) => particle.scaleX === 0)).toBe(true);
    expect(subject.fragmentSprites[0]!.visible).toBe(false);
    subject.destroy();
  });

  it('breathes the same mote the same way for the same seed', () => {
    const first = new FoodLayer(createTestRenderTextures({ seed: 4 }));
    const second = new FoodLayer(createTestRenderTextures({ seed: 4 }));
    first.update(frame({ timeSeconds: 0.7 }));
    second.update(frame({ timeSeconds: 0.7 }));
    expect(first.moteParticles[0]!.scaleX).toBe(second.moteParticles[0]!.scaleX);
    expect(first.moteParticles[0]!.scaleX).not.toBe(first.moteParticles[1]!.scaleX);
    first.destroy();
    second.destroy();
  });
});
