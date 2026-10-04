// A dive band's shader program (docs/rendering/opening-dive.md §4): one Pixi `Shader` over its GLSL with one uniform
// group holding every `vec4` (or array of them) it declares, and every sampler bound to an empty texture until its
// bakes land. The kelp band's five programs (ticket #802) and the slime band's (ticket #803) are made with it.

import { GlProgram, Shader, Texture, UniformGroup } from 'pixi.js';
import { RGBA_CHANNELS } from '../colour';

const VEC4 = 'vec4<f32>';

export interface UniformProgram {
  readonly shader: Shader;
  readonly uniforms: UniformGroup;
}

/** A `vec4` uniform, or an array of `count` of them. */
function vectors(count: number): { value: Float32Array; type: typeof VEC4; size?: number } {
  const value = new Float32Array(count * RGBA_CHANNELS);
  return count === 1 ? { value, type: VEC4 } : { value, type: VEC4, size: count };
}

/**
 * The program over `sources`: its uniform group under `groupName` holding each named `vec4` (`counts` gives how many
 * an array holds; one otherwise), and each sampler bound to `Texture.EMPTY` until a bake replaces it.
 */
export function uniformProgram(
  groupName: string,
  sources: { readonly vertex: string; readonly fragment: string },
  uniforms: { readonly names: readonly string[]; readonly counts?: Readonly<Record<string, number>> },
  samplers: readonly string[],
): UniformProgram {
  const layout: Record<string, ReturnType<typeof vectors>> = {};
  for (const name of uniforms.names) layout[name] = vectors(uniforms.counts?.[name] ?? 1);
  const group = new UniformGroup(layout);
  const resources: Record<string, unknown> = { [groupName]: group };
  for (const sampler of samplers) resources[sampler] = Texture.EMPTY.source;
  const shader = new Shader({ glProgram: new GlProgram(sources), resources });
  return { shader, uniforms: group };
}

/** A uniform's vector (or vectors) to write into. */
export function uniformVector(program: UniformProgram, name: string): Float32Array {
  return program.uniforms.uniforms[name] as Float32Array;
}

/** Binds a texture to one of the program's samplers. */
export function bindTexture(program: UniformProgram, name: string, source: unknown): void {
  (program.shader.resources as Record<string, unknown>)[name] = source;
}
