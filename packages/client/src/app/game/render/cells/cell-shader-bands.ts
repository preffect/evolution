// Pass A of the cell shader (docs/RENDERING.md §2.2, back → front): the halo (flat under the
// body, "lit from inside"; the chloroplast / toxin trait halo replaces it), the far dot, the
// four-stop body ramp and the two pools in the undeformed frame, the cytoplasm noise in world
// units, the ribosome speckle on a hashed grid and the cytoskeleton filaments from the nucleus.
// Everything under the organelle sprites. The pools, the noise and the interior tells fade with
// `lodBlend`; the trait halo does not (it is the mid-LOD tell, VISUAL-STYLE §4).

import {
  BODY_RAMP_ALPHAS,
  BODY_RAMP_CENTRE_ANGLE_DEG,
  BODY_RAMP_CENTRE_OFFSET_RADII,
  BODY_RAMP_RADIUS_RADII,
  BODY_RAMP_STOPS,
  CELL_FAR_DOT_MIN_PX,
  CYTO_NOISE_COARSE,
  CYTO_NOISE_EDGE_BLUR_RADII,
  CYTO_NOISE_FINE,
  CYTO_NOISE_MAX_RADII,
  DARK_POOL,
  FAR_DOT_HALO_RADII,
  FILAMENT_ALPHA,
  FILAMENT_MASK_PX,
  FILAMENT_REACH_BLUR_RADII,
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
  RIBOSOME_JITTER_SHARE,
  RIBOSOME_MIN_PX,
  RIBOSOME_RADIUS_RADII_MAX,
  RIBOSOME_RADIUS_RADII_MIN,
  SPECKLE_HASH_SALT,
  TRAIT_HALO_FLAT_STOP,
  TRAIT_HALO_OUTER_RADII,
  TRAIT_HALO_PEAK_ALPHA,
} from '../constants';
import { degreesToRadians } from '../geometry';
import { glslFloat } from './cell-shader-source';

const RAMP_CENTRE = degreesToRadians(BODY_RAMP_CENTRE_ANGLE_DEG);
const LIGHT_POOL_ANGLE = degreesToRadians(LIGHT_POOL.angleDeg);
const DARK_POOL_ANGLE = degreesToRadians(DARK_POOL.angleDeg);
const NOISE_EDGE_START = CYTO_NOISE_MAX_RADII - CYTO_NOISE_EDGE_BLUR_RADII;
const FILAMENT_REACH_START = CYTO_NOISE_MAX_RADII - FILAMENT_REACH_BLUR_RADII;
/** The speckle annulus's area in r², so `pitch = sqrt(area / density)`. */
const SPECKLE_ANNULUS_AREA =
  Math.PI * (RIBOSOME_BAND_MAX_RADII * RIBOSOME_BAND_MAX_RADII - RIBOSOME_BAND_MIN_RADII * RIBOSOME_BAND_MIN_RADII);

export const CELL_SHADER_BANDS = /* glsl */ `
/** The one halo shape: flat under the body to the peak stop, a soft ramp to 0 at 'outer' (undeformed radii). */
float haloAlpha(float rhoU, float outer, float flatStop, float peak) {
  float rampSpan = outer * (1.0 - flatStop);
  float ramp = (outer - rhoU) / rampSpan;
  float blur = ${glslFloat(HALO_BLUR_RADII)} / rampSpan;
  return peak * smoothstep(0.0, 1.0, ramp / (1.0 + blur));
}

vec4 haloBand(Instance inst, Frame frame, vec4 acc) {
  if (inst.isFarDot > HALF) {
    return over(acc, rimColour(inst), haloAlpha(frame.rhoU, ${glslFloat(FAR_DOT_HALO_RADII)}, ${glslFloat(HALO_FLAT_STOP)}, ${glslFloat(HALO_PEAK_ALPHA)}));
  }
  if (inst.haloKind == ${glslFloat(HALO_KIND.protocell)}) {
    return over(acc, rimColour(inst), haloAlpha(frame.rhoU, ${glslFloat(PROTOCELL_HALO_OUTER_RADII)}, ${glslFloat(HALO_FLAT_STOP)}, ${glslFloat(PROTOCELL_HALO_PEAK_ALPHA)}));
  }
  if (inst.haloKind == ${glslFloat(HALO_KIND.chloroplast)} || inst.haloKind == ${glslFloat(HALO_KIND.toxin)}) {
    vec3 glow = inst.haloKind == ${glslFloat(HALO_KIND.chloroplast)} ? uChloroLight : uToxinGlow;
    return over(acc, glow, haloAlpha(frame.rhoU, ${glslFloat(TRAIT_HALO_OUTER_RADII)}, ${glslFloat(TRAIT_HALO_FLAT_STOP)}, ${glslFloat(TRAIT_HALO_PEAK_ALPHA)}));
  }
  return over(acc, rimColour(inst), haloAlpha(frame.rhoU, ${glslFloat(HALO_OUTER_RADII)}, ${glslFloat(HALO_FLAT_STOP)}, ${glslFloat(HALO_PEAK_ALPHA)}));
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
  bool proto = inst.isProtocell > HALF;
  vec4 stops[4];
  stops[0] = vec4(shade(inst, SHADE_CYTO_LIGHT), proto ? ${glslFloat(PROTOCELL_BODY_ALPHAS[0])} : ${glslFloat(BODY_RAMP_ALPHAS[0])});
  stops[1] = vec4(shade(inst, SHADE_CYTO_DARK), proto ? ${glslFloat(PROTOCELL_BODY_ALPHAS[1])} : ${glslFloat(BODY_RAMP_ALPHAS[1])});
  stops[2] = vec4(baseColour(inst), proto ? ${glslFloat(PROTOCELL_BODY_ALPHAS[2])} : ${glslFloat(BODY_RAMP_ALPHAS[2])});
  stops[3] = vec4(rimColour(inst), proto ? ${glslFloat(PROTOCELL_BODY_ALPHAS[3])} : ${glslFloat(BODY_RAMP_ALPHAS[3])});
  float positions[4] = float[4](${BODY_RAMP_STOPS.map(glslFloat).join(', ')});
  vec4 colour = rampFour(stops, positions, t);
  return over(acc, colour.rgb, colour.a * inside);
}

/** 1 inside a soft ellipse of 'radiusX' × 'radiusY' r at 'offset' r along 'angle', undeformed frame. */
float poolMask(Frame frame, Instance inst, vec2 centre, vec2 radii) {
  vec2 q = (frame.p / (inst.r * inst.pulse) - centre) / radii;
  float blur = ${glslFloat(POOL_BLUR_RADII)} / min(radii.x, radii.y);
  return 1.0 - smoothstep(1.0 - blur, 1.0 + blur, length(q));
}

/** The light pool toward the light and the dark pool away from it give the body its volume. */
vec4 bodyPools(Instance inst, Frame frame, float inside, vec4 acc) {
  vec2 lightCentre = vec2(cos(${glslFloat(LIGHT_POOL_ANGLE)}), sin(${glslFloat(LIGHT_POOL_ANGLE)})) * ${glslFloat(LIGHT_POOL.offset)};
  vec2 darkCentre = vec2(cos(${glslFloat(DARK_POOL_ANGLE)}), sin(${glslFloat(DARK_POOL_ANGLE)})) * ${glslFloat(DARK_POOL.offset)};
  float light = poolMask(frame, inst, lightCentre, vec2(${glslFloat(LIGHT_POOL.radiusX)}, ${glslFloat(LIGHT_POOL.radiusY)}));
  float dark = poolMask(frame, inst, darkCentre, vec2(${glslFloat(DARK_POOL.radiusX)}, ${glslFloat(DARK_POOL.radiusY)}));
  float fade = inside * inst.lodBlend;
  acc = over(acc, rimColour(inst), light * ${glslFloat(LIGHT_POOL.alpha)} * fade);
  return over(acc, shade(inst, SHADE_CYTO_DARK), dark * ${glslFloat(DARK_POOL.alpha)} * fade);
}

/** The two-channel tile in world units: a lightening overlay that translates with the cell and never scales. */
vec4 cytoplasmNoise(Instance inst, Frame frame, vec4 acc) {
  vec2 uv = (inst.centre + frame.p) / ${glslFloat(NOISE_TILE_WU)};
  vec2 noise = texture(uTile, uv).rg;
  float bandMask = (1.0 - smoothstep(${glslFloat(NOISE_EDGE_START)}, ${glslFloat(CYTO_NOISE_MAX_RADII)}, frame.rho)) * inst.lodBlend;
  float coarse = clamp(${glslFloat(CYTO_NOISE_COARSE.alphaGain)} * noise.r + ${glslFloat(CYTO_NOISE_COARSE.alphaBias)}, 0.0, 1.0) * ${glslFloat(CYTO_NOISE_COARSE.alpha)};
  float fine = clamp(${glslFloat(CYTO_NOISE_FINE.alphaGain)} * noise.g + ${glslFloat(CYTO_NOISE_FINE.alphaBias)}, 0.0, 1.0) * ${glslFloat(CYTO_NOISE_FINE.alpha)};
  acc = over(acc, mix(uWhite, rimColour(inst), ${glslFloat(CYTO_NOISE_COARSE.rimMix)}), coarse * bandMask);
  return over(acc, uWhite, fine * bandMask);
}

/** One dot per grid cell of pitch sqrt(annulus / density): hashed radius (diameter floored in px), offset across the cell independent of the radius, and alpha; undeformed frame. */
vec4 ribosomeSpeckle(Instance inst, Frame frame, vec4 acc) {
  if (inst.speckleDensity <= 0.0 || inst.lodBlend <= 0.0) return acc;
  float pitch = sqrt(${glslFloat(SPECKLE_ANNULUS_AREA)} / inst.speckleDensity);
  vec2 q = frame.p / (inst.r * inst.pulse);
  vec2 cell = floor(q / pitch);
  vec2 salt = cell + inst.palette * ${glslFloat(SPECKLE_HASH_SALT.palette)} + inst.stripRow * ${glslFloat(SPECKLE_HASH_SALT.row)};
  float radius = max(mix(${glslFloat(RIBOSOME_RADIUS_RADII_MIN)}, ${glslFloat(RIBOSOME_RADIUS_RADII_MAX)}, hash21(salt)), ${glslFloat(RIBOSOME_MIN_PX)} * HALF / frame.rPx);
  vec2 offset = (vec2(hash21(salt + ${glslFloat(SPECKLE_HASH_SALT.offsetX)}), hash21(salt + ${glslFloat(SPECKLE_HASH_SALT.offsetY)})) - HALF) * pitch * ${glslFloat(RIBOSOME_JITTER_SHARE)};
  vec2 dotCentre = (cell + HALF) * pitch + offset;
  float ring = length(dotCentre);
  float inBand = step(${glslFloat(RIBOSOME_BAND_MIN_RADII)}, ring) * step(ring, ${glslFloat(RIBOSOME_BAND_MAX_RADII)});
  float feather = frame.aa / (inst.r * inst.pulse);
  float dotMask = (1.0 - smoothstep(radius - feather, radius + feather, length(q - dotCentre))) * inBand;
  float alpha = mix(${glslFloat(RIBOSOME_ALPHA_MIN)}, ${glslFloat(RIBOSOME_ALPHA_MAX)}, hash21(salt + ${glslFloat(SPECKLE_HASH_SALT.alpha)}));
  return over(acc, uRibosome, dotMask * alpha * inst.lodBlend);
}

/** N filaments from the nucleus centre to 0.89 r as a screen-px mask around each spoke (a θ-fraction mask fans out). */
vec4 cytoskeletonFilaments(Instance inst, Frame frame, vec4 acc) {
  if (inst.filamentCount <= 0.0 || inst.lodBlend <= 0.0) return acc;
  vec2 fromNucleus = frame.p / inst.r - inst.nucleus;
  float thetaN = atan(fromNucleus.y, fromNucleus.x);
  float rhoN = length(fromNucleus);
  float spokePx = spokeDistancePx(inst.filamentCount, thetaN, rhoN * frame.rPx);
  float mask = 1.0 - smoothstep(${glslFloat(FILAMENT_MASK_PX)}, ${glslFloat(FILAMENT_MASK_PX)} + 1.0, spokePx);
  float reach = 1.0 - smoothstep(${glslFloat(FILAMENT_REACH_START)}, ${glslFloat(CYTO_NOISE_MAX_RADII)}, frame.rho);
  return over(acc, uCytoskeleton, mask * reach * ${glslFloat(FILAMENT_ALPHA)} * inst.lodBlend);
}

vec4 bodyPass(Instance inst, Frame frame) {
  vec4 acc = vec4(0.0);
  acc = haloBand(inst, frame, acc);
  if (inst.isFarDot > HALF) return farDot(inst, frame, acc);
  float inside = 1.0 - smoothstep(-frame.aa, frame.aa, frame.d);
  acc = bodyRamp(inst, frame, inside, acc);
  acc = bodyPools(inst, frame, inside, acc);
  acc = cytoplasmNoise(inst, frame, acc);
  acc = ribosomeSpeckle(inst, frame, acc);
  return cytoskeletonFilaments(inst, frame, acc);
}
`;
