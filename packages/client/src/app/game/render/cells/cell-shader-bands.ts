// Pass A of the cell shader (docs/RENDERING.md §2.2, back → front): the halo, the far dot, the
// body ramp in the undeformed frame, the light and dark pools, the cytoplasm noise in world
// units, the ribosome speckle and the cytoskeleton filaments. Everything under the organelle
// sprites. Interior bands fade with `lodBlend`.

import {
  BODY_RAMP_ALPHAS,
  BODY_RAMP_CENTRE_ANGLE_DEG,
  BODY_RAMP_CENTRE_OFFSET_RADII,
  BODY_RAMP_RADIUS_RADII,
  BODY_RAMP_STOPS,
  CELL_FAR_DOT_MIN_PX,
  CYTO_NOISE_COARSE,
  CYTO_NOISE_FINE,
  CYTO_NOISE_MAX_RADII,
  DARK_POOL,
  FAR_DOT_HALO_RADII,
  FILAMENT_ALPHA,
  FILAMENT_MASK_PX,
  HALO_BLUR_RADII,
  HALO_FLAT_STOP,
  HALO_KIND,
  HALO_OUTER_RADII,
  HALO_PEAK_ALPHA,
  LIGHT_POOL,
  NOISE_TILE_WU,
  POOL_BLUR_RADII,
  PROTOCELL_BODY_ALPHAS,
  PROTOCELL_HALO_OUTER_RADII,
  PROTOCELL_HALO_PEAK_ALPHA,
  RIBOSOME_ALPHA_MAX,
  RIBOSOME_ALPHA_MIN,
  RIBOSOME_BAND_MAX_RADII,
  RIBOSOME_BAND_MIN_RADII,
  RIBOSOME_MIN_PX,
  RIBOSOME_RADIUS_RADII_MAX,
  RIBOSOME_RADIUS_RADII_MIN,
  TRAIT_HALO_FLAT_STOP,
  TRAIT_HALO_OUTER_RADII,
  TRAIT_HALO_PEAK_ALPHA,
} from '../constants';
import { degreesToRadians } from '../geometry';
import { glslFloat } from './cell-shader-source';

const RAMP_CENTRE = degreesToRadians(BODY_RAMP_CENTRE_ANGLE_DEG);

export const CELL_SHADER_BANDS = /* glsl */ `
uniform vec3 uWhite;
uniform vec3 uRibosome;
uniform vec3 uCytoskeleton;
uniform vec3 uChloroLight;
uniform vec3 uToxinGlow;

/** The one halo shape: flat under the body to the peak stop, then a soft ramp to 0 at 'outer' (in undeformed radii). */
float haloAlpha(float rhoU, float outer, float flatStop, float peak) {
  float ramp = (outer - rhoU) / (outer * (1.0 - flatStop));
  float blur = ${glslFloat(HALO_BLUR_RADII)} / (outer * (1.0 - flatStop));
  return peak * smoothstep(0.0, 1.0, ramp / (1.0 + blur));
}

vec4 haloBand(Instance inst, Frame frame, vec4 acc) {
  float scale = inst.haloRadiiScale;
  if (inst.isFarDot > 0.5) {
    return over(acc, rimColour(inst), haloAlpha(frame.rhoU, ${glslFloat(FAR_DOT_HALO_RADII)}, ${glslFloat(HALO_FLAT_STOP)}, ${glslFloat(HALO_PEAK_ALPHA)}));
  }
  if (inst.haloKind == ${glslFloat(HALO_KIND.protocell)}) {
    return over(acc, rimColour(inst), haloAlpha(frame.rhoU, ${glslFloat(PROTOCELL_HALO_OUTER_RADII)} * scale, ${glslFloat(HALO_FLAT_STOP)}, ${glslFloat(PROTOCELL_HALO_PEAK_ALPHA)}));
  }
  if (inst.haloKind == ${glslFloat(HALO_KIND.chloroplast)} || inst.haloKind == ${glslFloat(HALO_KIND.toxin)}) {
    vec3 colour = inst.haloKind == ${glslFloat(HALO_KIND.chloroplast)} ? uChloroLight : uToxinGlow;
    float alpha = haloAlpha(frame.rhoU, ${glslFloat(TRAIT_HALO_OUTER_RADII)} * scale, ${glslFloat(TRAIT_HALO_FLAT_STOP)}, ${glslFloat(TRAIT_HALO_PEAK_ALPHA)});
    float body = haloAlpha(frame.rhoU, ${glslFloat(HALO_OUTER_RADII)} * scale, ${glslFloat(HALO_FLAT_STOP)}, ${glslFloat(HALO_PEAK_ALPHA)});
    return over(acc, colour, mix(body, alpha, inst.lodBlend > 0.0 ? 1.0 : 1.0));
  }
  return over(acc, rimColour(inst), haloAlpha(frame.rhoU, ${glslFloat(HALO_OUTER_RADII)} * scale, ${glslFloat(HALO_FLAT_STOP)}, ${glslFloat(HALO_PEAK_ALPHA)}));
}

/** The far dot: a rim-colour disc with a px floor; nothing else is drawn at that LOD. */
vec4 farDot(Instance inst, Frame frame, vec4 acc) {
  float radiusWu = max(inst.r, ${glslFloat(CELL_FAR_DOT_MIN_PX)} / uZoom);
  float alpha = 1.0 - smoothstep(radiusWu - frame.aa, radiusWu + frame.aa, frame.len);
  return over(acc, rimColour(inst), alpha);
}

/** Four-stop ramp in the undeformed frame from a centre 0.30 r toward the light, radius 1.36 r (sheet 01 panel A). */
vec4 bodyRamp(Instance inst, Frame frame, float inside, vec4 acc) {
  vec2 centre = vec2(cos(${glslFloat(RAMP_CENTRE)}), sin(${glslFloat(RAMP_CENTRE)})) * ${glslFloat(BODY_RAMP_CENTRE_OFFSET_RADII)};
  vec2 q = frame.p / (inst.r * inst.pulse) - centre;
  float t = length(q) / ${glslFloat(BODY_RAMP_RADIUS_RADII)};
  bool proto = inst.isProtocell > 0.5;
  vec4 stops[4];
  stops[0] = vec4(shade(inst, SHADE_CYTO_LIGHT), proto ? ${glslFloat(PROTOCELL_BODY_ALPHAS[0])} : ${glslFloat(BODY_RAMP_ALPHAS[0])});
  stops[1] = vec4(shade(inst, SHADE_CYTO_DARK), proto ? ${glslFloat(PROTOCELL_BODY_ALPHAS[1])} : ${glslFloat(BODY_RAMP_ALPHAS[1])});
  stops[2] = vec4(baseColour(inst), proto ? ${glslFloat(PROTOCELL_BODY_ALPHAS[2])} : ${glslFloat(BODY_RAMP_ALPHAS[2])});
  stops[3] = vec4(rimColour(inst), proto ? ${glslFloat(PROTOCELL_BODY_ALPHAS[3])} : ${glslFloat(BODY_RAMP_ALPHAS[3])});
  float positions[4] = float[4](${BODY_RAMP_STOPS.map(glslFloat).join(', ')});
  vec4 colour = stops[0];
  for (int stop = 1; stop < 4; stop++) {
    float share = smoothstep(positions[stop - 1], positions[stop], t);
    colour = mix(colour, stops[stop], share);
  }
  return over(acc, colour.rgb, colour.a * inside);
}

float poolMask(Frame frame, Instance inst, float offset, float angle, float radiusX, float radiusY) {
  vec2 centre = vec2(cos(angle), sin(angle)) * offset;
  vec2 q = (frame.p / (inst.r * inst.pulse) - centre) / vec2(radiusX, radiusY);
  float blur = ${glslFloat(POOL_BLUR_RADII)} / min(radiusX, radiusY);
  return 1.0 - smoothstep(1.0 - blur, 1.0 + blur, length(q));
}

/** The light pool at the top-left and the dark pool at the bottom-right that give the body volume. */
vec4 bodyPools(Instance inst, Frame frame, float inside, vec4 acc) {
  float light = poolMask(frame, inst, ${glslFloat(LIGHT_POOL.offset)}, ${glslFloat(degreesToRadians(LIGHT_POOL.angleDeg))}, ${glslFloat(LIGHT_POOL.radiusX)}, ${glslFloat(LIGHT_POOL.radiusY)});
  float dark = poolMask(frame, inst, ${glslFloat(DARK_POOL.offset)}, ${glslFloat(degreesToRadians(DARK_POOL.angleDeg))}, ${glslFloat(DARK_POOL.radiusX)}, ${glslFloat(DARK_POOL.radiusY)});
  float fade = inside * inst.lodBlend;
  acc = over(acc, rimColour(inst), light * ${glslFloat(LIGHT_POOL.alpha)} * fade);
  return over(acc, shade(inst, SHADE_CYTO_DARK), dark * ${glslFloat(DARK_POOL.alpha)} * fade);
}

/** The two-channel tile in world units: a lightening overlay that translates with the cell and never scales. */
vec4 cytoplasmNoise(Instance inst, Frame frame, vec4 acc) {
  vec2 uv = (inst.centre + frame.p) / ${glslFloat(NOISE_TILE_WU)};
  vec2 noise = texture(uTile, uv).rg;
  float band = (1.0 - smoothstep(${glslFloat(CYTO_NOISE_MAX_RADII)} - 0.05, ${glslFloat(CYTO_NOISE_MAX_RADII)}, frame.rho)) * inst.lodBlend;
  float coarse = clamp(${glslFloat(CYTO_NOISE_COARSE.alphaGain)} * noise.r + ${glslFloat(CYTO_NOISE_COARSE.alphaBias)}, 0.0, 1.0) * ${glslFloat(CYTO_NOISE_COARSE.alpha)};
  float fine = clamp(${glslFloat(CYTO_NOISE_FINE.alphaGain)} * noise.g + ${glslFloat(CYTO_NOISE_FINE.alphaBias)}, 0.0, 1.0) * ${glslFloat(CYTO_NOISE_FINE.alpha)};
  acc = over(acc, mix(uWhite, rimColour(inst), 0.5), coarse * band);
  return over(acc, uWhite, fine * band);
}

/** Hashed dots on a grid in the undeformed frame between 0.55 and 0.89 r (VISUAL-STYLE §4). */
vec4 ribosomeSpeckle(Instance inst, Frame frame, vec4 acc) {
  if (inst.speckleDensity <= 0.0 || inst.lodBlend <= 0.0) return acc;
  float inner = ${glslFloat(RIBOSOME_BAND_MIN_RADII)};
  float outer = ${glslFloat(RIBOSOME_BAND_MAX_RADII)};
  float annulus = 3.14159265 * (outer * outer - inner * inner);
  float pitch = sqrt(annulus / inst.speckleDensity);
  vec2 q = frame.p / (inst.r * inst.pulse);
  vec2 cell = floor(q / pitch);
  float seed = hash21(cell + inst.palette * 7.0 + inst.stripRow * 13.0);
  float radius = max(mix(${glslFloat(RIBOSOME_RADIUS_RADII_MIN)}, ${glslFloat(RIBOSOME_RADIUS_RADII_MAX)}, seed), ${glslFloat(RIBOSOME_MIN_PX)} / frame.rPx);
  vec2 offset = (vec2(hash21(cell + 1.7), hash21(cell + 9.3)) - 0.5) * (pitch - 2.0 * radius);
  vec2 dotCentre = (cell + 0.5) * pitch + offset;
  float dist = length(q - dotCentre);
  float inBand = step(inner, length(dotCentre)) * step(length(dotCentre), outer);
  float feather = frame.aa / (inst.r * inst.pulse);
  float dot = (1.0 - smoothstep(radius - feather, radius + feather, dist)) * inBand;
  float alpha = mix(${glslFloat(RIBOSOME_ALPHA_MIN)}, ${glslFloat(RIBOSOME_ALPHA_MAX)}, hash21(cell + 4.1));
  return over(acc, uRibosome, dot * alpha * inst.lodBlend);
}

/** N filaments from the nucleus centre to 0.89 r as a screen-px mask around each spoke. */
vec4 cytoskeletonFilaments(Instance inst, Frame frame, vec4 acc) {
  if (inst.filamentCount <= 0.0 || inst.lodBlend <= 0.0) return acc;
  vec2 fromNucleus = frame.p / inst.r - inst.nucleus;
  float thetaN = atan(fromNucleus.y, fromNucleus.x);
  float rhoN = length(fromNucleus);
  float spoke = abs(fract(inst.filamentCount * thetaN / TAU) - 0.5) * TAU * rhoN * frame.rPx / inst.filamentCount;
  float mask = 1.0 - smoothstep(${glslFloat(FILAMENT_MASK_PX)}, ${glslFloat(FILAMENT_MASK_PX)} + 1.0, spoke);
  float reach = 1.0 - smoothstep(${glslFloat(CYTO_NOISE_MAX_RADII)} - 0.04, ${glslFloat(CYTO_NOISE_MAX_RADII)}, frame.rho);
  return over(acc, uCytoskeleton, mask * reach * ${glslFloat(FILAMENT_ALPHA)} * inst.lodBlend);
}

vec4 bodyPass(Instance inst, Frame frame) {
  vec4 acc = vec4(0.0);
  acc = haloBand(inst, frame, acc);
  if (inst.isFarDot > 0.5) return farDot(inst, frame, acc);
  float inside = 1.0 - smoothstep(-frame.aa, frame.aa, frame.d);
  acc = bodyRamp(inst, frame, inside, acc);
  acc = bodyPools(inst, frame, inside, acc);
  acc = cytoplasmNoise(inst, frame, acc);
  acc = ribosomeSpeckle(inst, frame, acc);
  acc = cytoskeletonFilaments(inst, frame, acc);
  return acc;
}
`;
