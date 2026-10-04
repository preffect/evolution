// The plankton on the dive's stage (docs/rendering/opening-dive.md §4, ticket #803): each organism where the mockup
// drew it (in view, big enough, moving its own way), its halo, strokes and still layers from the rung of its ladder for
// its size, the pennates' outline until their ladders bake; and none but the pennates ever in view in the dark field,
// so only they need a dark-field picture.

import { Container, Mesh, State, Texture, type Sprite } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { SLIME_ORGANISMS, SLIME_ORGANISM_VISIBLE_LENGTHS } from '../../constants/dive-slime-plankton';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { SLIME_BAND_TEST_TIMEOUT_MS, quickSlimeBake, runBake } from '../../../../../testing/slime-builder';
import { diveViewAt } from '../dive-view';
import { slimeFrameOf } from './slime-frame';
import { unitQuadGeometry } from './slime-meshes';
import { SlimeOrganisms, organismPlacement, rungTextureFor, type PlanktonTextures } from './slime-organisms';
import { SLIME_PLANKTON_LOOKS } from './slime-plankton-looks';
import { createSlimePrograms, uniformVector } from './slime-programs';
import { SLIME_PENNATE_UNIFORM } from './slime-shader-pennate';
import { slimeTextures } from './slime-textures';

const STAGE = { width: 830, height: 467 };
const frameAt = (zoom: number, timeSeconds = 0, viewport = STAGE) =>
  slimeFrameOf(diveViewAt({ zoom, viewport, timeSeconds, isMoving: false, globeIdleSpinDegrees: 0 }));
const [larva, ciliate, , dino, , pennate] = SLIME_ORGANISMS;

function organisms() {
  const programs = createSlimePrograms();
  const quad = unitQuadGeometry();
  const pennates = programs.pennates.map((program) => ({
    mesh: new Mesh({ geometry: quad, shader: program.shader, state: State.for2d() }),
    program,
  }));
  const subject = new SlimeOrganisms(programs.strokes, pennates, Texture.WHITE);
  return { subject, pennates };
}

function quickTextures(): PlanktonTextures {
  const baked = runBake(quickSlimeBake()({ factory: createFakeShoreCanvasFactory(), devicePixelRatio: 1 })).result;
  return slimeTextures(baked).plankton;
}

describe('organismPlacement', () => {
  it('places an organism in view at its own place on the stage, at its length’s px to its unit', () => {
    const frame = frameAt(-3);
    const placement = organismPlacement(larva!, frame, SLIME_PLANKTON_LOOKS.nauplius);
    expect(placement.isShown).toBe(true);
    if (!placement.isShown) return;
    expect(placement.x).toBeCloseTo(STAGE.width / 2 + larva!.x * frame.pixelsPerMetre, 9);
    expect(placement.unitPx).toBeCloseTo(larva!.lengthM * frame.pixelsPerMetre, 9);
    expect(placement.angle).toBe(larva!.angle);
  });

  it('hides one out of view, one too small, and every one past the slime', () => {
    expect(organismPlacement(larva!, frameAt(-3.5), SLIME_PLANKTON_LOOKS.nauplius).isShown).toBe(false);
    expect(organismPlacement(dino!, frameAt(-1.96), SLIME_PLANKTON_LOOKS.dino).isShown).toBe(false);
    expect(organismPlacement(pennate!, frameAt(-4.75), SLIME_PLANKTON_LOOKS.pennate).isShown).toBe(false);
  });

  it('drifts the ciliate along x and turns it a little on the clock', () => {
    const still = organismPlacement(ciliate!, frameAt(-3, 0), SLIME_PLANKTON_LOOKS.ciliate);
    const later = organismPlacement(ciliate!, frameAt(-3, 7), SLIME_PLANKTON_LOOKS.ciliate);
    if (!still.isShown || !later.isShown) throw new Error('the ciliate should show at −3');
    expect(later.x).not.toBeCloseTo(still.x, 3);
    expect(later.y).toBeCloseTo(still.y, 9);
    expect(later.angle).not.toBe(still.angle);
  });

  it('shows nothing but the pennates once the dark field has begun, on any stage', () => {
    for (const viewport of [STAGE, { width: 390, height: 600 }, { width: 400, height: 1600 }]) {
      const frame = frameAt(-3.71, 0, viewport);
      expect(frame.darkField).toBeGreaterThan(0);
      for (const organism of SLIME_ORGANISMS) {
        const placement = organismPlacement(organism, frame, SLIME_PLANKTON_LOOKS[organism.kind]);
        expect(placement.isShown, organism.kind).toBe(organism.kind === 'pennate');
      }
    }
    // the guard is the view's half width, 10^zoom / 2 whatever the stage: none of them reaches it from its place
    for (const organism of SLIME_ORGANISMS.filter((one) => one.kind !== 'pennate')) {
      expect(Math.abs(organism.x) - organism.lengthM * SLIME_ORGANISM_VISIBLE_LENGTHS).toBeGreaterThan(10 ** -3.7 / 2);
    }
  });
});

describe('rungTextureFor', () => {
  it('takes the smallest rung at least as big as the organism, or the top one', () => {
    const rungs = quickTextures().nauplius;
    expect(rungTextureFor(rungs, 1)).toBe(rungs[0]);
    expect(rungTextureFor(rungs, 100)).toBe(rungs[1]);
    expect(rungTextureFor(rungs, 1e6)).toBe(rungs[1]);
  });
});

describe('SlimeOrganisms', { timeout: SLIME_BAND_TEST_TIMEOUT_MS }, () => {
  it('lays halos, strokes under, bodies, strokes over and rims in that order, and shows each organism in view', () => {
    const { subject } = organisms();
    const [halos, under, bodies, over, rims] = subject.view.children as Container[];
    expect([halos, bodies, rims].every((layer) => layer instanceof Container)).toBe(true);
    expect(under).toBeInstanceOf(Mesh);
    expect(over).toBeInstanceOf(Mesh);
    expect(subject.update(frameAt(-3))).toBe(true);
    const shownHalos = (halos!.children as Sprite[]).filter((halo) => halo.visible);
    expect(shownHalos.length).toBeGreaterThan(1);
    expect(subject.update(frameAt(-1.9))).toBe(false);
    subject.destroy();
  });

  it('draws the bodies only once the ladders are bound, from the rung for their size', () => {
    const { subject } = organisms();
    const bodies = subject.view.children[2] as Container;
    subject.update(frameAt(-3));
    const larvaBody = bodies.children[0] as Sprite;
    expect(larvaBody.visible).toBe(false);
    const textures = quickTextures();
    subject.bind(textures);
    subject.update(frameAt(-3));
    expect(larvaBody.visible).toBe(true);
    expect(larvaBody.texture).toBe(textures.nauplius[1]!.texture);
    subject.destroy();
  });

  it('draws a pennate’s outline until its pictures are bound, then mixes its bright and dark ones', () => {
    const { subject, pennates } = organisms();
    const [first] = pennates;
    subject.update(frameAt(-4));
    expect(first!.mesh.visible).toBe(true);
    expect(uniformVector(first!.program, SLIME_PENNATE_UNIFORM.reach)[1]).toBe(0);
    const textures = quickTextures();
    subject.bind(textures);
    subject.update(frameAt(-4));
    expect(uniformVector(first!.program, SLIME_PENNATE_UNIFORM.reach)[1]).toBe(1);
    expect(first!.program.shader.resources[SLIME_PENNATE_UNIFORM.dark]).toBe(textures.pennateDark[1]!.texture.source);
    subject.destroy();
  });
});
