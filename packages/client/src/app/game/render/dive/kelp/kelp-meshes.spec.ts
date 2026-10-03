// The kelp band's meshes (docs/rendering/opening-dive.md §4): in the mockup's order on its root (the rock, the stipe and
// blades 4 to 1, the bulb, blade 0, the blade floor, the lenses), each hidden until its frame shows it; the ribbons
// in the mockup's drawing order; a quad round each bead and the drop last.

import { Shader, GlProgram } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { KELP_BEADS, KELP_DROP } from '../../constants/dive-kelp-drop';
import { KELP_RIBBON_KIND } from './kelp-ribbon-geometry';
import { kelpBlades, kelpStipe } from './kelp-ribbons';
import { backRibbonDraws, createKelpMeshes, frontRibbonDraws, lensGeometry } from './kelp-meshes';
import { KELP_LENS_ATTRIBUTE } from './kelp-shader-lens';

function shader(): Shader {
  return new Shader({
    glProgram: new GlProgram({ vertex: 'void main() {}', fragment: 'void main() {}' }),
    resources: {},
  });
}

describe('the kelp’s ribbons', () => {
  it('draws the stipe, then blades 4 to 1, behind the bulb; blade 0 in front of it', () => {
    const blades = kelpBlades();
    const back = backRibbonDraws();
    const order = [kelpStipe(), blades[4], blades[3], blades[2], blades[1]];
    expect(back).toHaveLength(order.length);
    back.forEach((draw, index) => expect(draw.ribbon).toBe(order[index]));
    expect(back[0]!.kind).toBe(KELP_RIBBON_KIND.stipe);
    expect(back.slice(1).map((draw) => draw.kind)).toEqual([
      KELP_RIBBON_KIND.bladeEven,
      KELP_RIBBON_KIND.bladeOdd,
      KELP_RIBBON_KIND.bladeEven,
      KELP_RIBBON_KIND.bladeOdd,
    ]);
    const front = frontRibbonDraws();
    expect(front).toHaveLength(1);
    expect(front[0]!.ribbon).toBe(blades[0]);
    for (const draw of [...back, ...front]) expect(draw.shadowOffset).not.toBeNull();
  });
});

describe('lensGeometry', () => {
  it('puts a quad round each bead, in order, and the drop last, marked', () => {
    const beads = [
      { x: 1, y: 2, radiusM: 0.5 },
      { x: -1, y: 0, radiusM: 0.25 },
    ];
    const geometry = lensGeometry(beads);
    const shapes = geometry.getAttribute(KELP_LENS_ATTRIBUTE.lens).buffer.data as Float32Array;
    const positions = geometry.getAttribute(KELP_LENS_ATTRIBUTE.position).buffer.data as Float32Array;
    expect(shapes).toHaveLength(3 * 4 * 4);
    expect([...shapes.slice(0, 4)]).toEqual([1, 2, 0.5, 0]);
    expect([...shapes.slice(16, 20)]).toEqual([-1, 0, 0.25, 0]);
    expect([...shapes.slice(32, 36)]).toEqual([
      Math.fround(KELP_DROP.x),
      Math.fround(KELP_DROP.y),
      Math.fround(KELP_DROP.radiusM),
      1,
    ]);
    const reach = 0.5 * KELP_BEADS.reachRadii;
    expect([...positions.slice(0, 2)]).toEqual([Math.fround(1 - reach), Math.fround(2 - reach)]);
    expect(geometry.indexBuffer.data).toHaveLength(3 * 6);
    expect([...geometry.indexBuffer.data.slice(6, 9)]).toEqual([4, 5, 6]);
    geometry.destroy();
  });
});

describe('createKelpMeshes', () => {
  it('lays the six meshes on its root in the mockup’s order, all hidden, the ribbons sharing one shader', () => {
    const shaders = { rock: shader(), ribbons: shader(), bulb: shader(), floor: shader(), lenses: shader() };
    const set = createKelpMeshes(shaders);
    const order = [set.rock, set.ribbonsBack, set.bulb, set.ribbonsFront, set.floor, set.lenses];
    expect(set.root.children).toHaveLength(order.length);
    order.forEach((mesh, index) => {
      expect(set.root.children[index]).toBe(mesh);
      expect(mesh.visible).toBe(false);
    });
    expect(set.ribbonsBack.shader).toBe(shaders.ribbons);
    expect(set.ribbonsFront.shader).toBe(shaders.ribbons);
    expect(set.rock.shader).toBe(shaders.rock);
    set.root.destroy({ children: true });
  });
});
