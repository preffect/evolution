// The planet shader's land (docs/rendering/opening-dive.md §4, the mockup's `20-globe.js`): the world's biomes by
// latitude and its deserts, and close in the Salish region's own relief (its lowlands, the Olympics, the Coast
// Mountains, the Cascades and their volcanoes), snow, the dry side east of the Cascades, the oak meadows round
// Victoria and a conifer canopy whose crowns are lit from the top-left and shade to the bottom-right.
// GLSL ES 3.00, as a template string. The places are real ones: each is a longitude and latitude in degrees, with
// its spread, and named where it is placed. Heights are metres.

export const DIVE_PLANET_SHADER_LAND = /* glsl */ `
const vec3 BIOME_TROPICAL = vec3(.10, .25, .10);
const vec3 BIOME_SAVANNA = vec3(.40, .38, .20);
const vec3 BIOME_TEMPERATE = vec3(.22, .31, .15);
const vec3 BIOME_BOREAL = vec3(.12, .20, .12);
const vec3 BIOME_TUNDRA = vec3(.38, .37, .30);
const vec3 BIOME_DESERT = vec3(.70, .58, .38);
const vec3 BIOME_RAINFOREST = vec3(.13, .23, .13);
const vec3 BIOME_ICE = vec3(.90, .93, .96);
const vec3 REGION_LOWLAND = vec3(.105, .19, .11);
const vec3 REGION_UPLAND = vec3(.15, .25, .135);
const vec3 REGION_ALPINE = vec3(.30, .34, .25);
const vec3 REGION_ROCK = vec3(.45, .44, .40);
const vec3 REGION_SNOW = vec3(.9, .93, .95);
const vec3 REGION_STEPPE = vec3(.50, .46, .31);
const vec3 REGION_MEADOW = vec3(.47, .43, .25);
const vec3 CROWN_FIR = vec3(.12, .27, .16);
const vec3 CROWN_CEDAR = vec3(.19, .32, .13);
const vec3 CROWN_HEMLOCK = vec3(.14, .25, .16);
const vec3 CROWN_ALDER = vec3(.27, .39, .16);
const vec3 CROWN_OAK = vec3(.32, .39, .18);
const vec3 FLOOR_MEADOW = vec3(.46, .42, .24);
const vec3 FLOOR_FOREST = vec3(.1, .14, .075);
const vec3 FLOOR_OUTCROP = vec3(.46, .45, .41);
const float KM_PER_DEGREE = 111.2;

/** smoothstep from 1 at 'from' down to 0 at 'to' (from > to): GLSL leaves smoothstep with edge0 >= edge1 undefined. */
float smoothFall(float from, float to, float x) { return 1. - smoothstep(to, from, x); }
float gaussian2(vec2 ld, vec2 centre, vec2 spread) { vec2 d = (ld - centre) / spread; return exp(-dot(d, d)); }
float softBox(vec2 ld, vec4 box, float feather) {
  return smoothstep(box.x - feather, box.x + feather, ld.x) * smoothFall(box.z + feather, box.z - feather, ld.x) *
         smoothstep(box.y - feather, box.y + feather, ld.y) * smoothFall(box.w + feather, box.w - feather, ld.y);
}
/** A volcano: (longitude, latitude, height m) and its radius in km. */
float cone(vec2 ld, vec3 peak, float radiusKm) {
  vec2 d = vec2((ld.x - peak.x) * cos(peak.y * PI / 180.) * KM_PER_DEGREE, (ld.y - peak.y) * KM_PER_DEGREE);
  float t = max(0., 1. - length(d) / radiusKm);
  return peak.z * t * t * (3. - 2. * t);
}

/** The Salish region's broad relief in metres, 'inlandKm' from the coast: the ranges the real region has. */
float massif(vec2 ld, float inlandKm) {
  float m = 1000. * smoothstep(1., 26., inlandKm);
  m *= 1. - .82 * gaussian2(ld, vec2(-123.45, 48.52), vec2(.42, .22));                    // Victoria and Saanich lowland
  m *= 1. - .85 * softBox(ld, vec4(-123.1, 46.9, -122.15, 48.35), .25);                    // Puget lowland
  m *= 1. - .85 * softBox(ld, vec4(-123.25, 48.95, -121.7, 49.22), .12);                   // Fraser lowland
  m += 1900. * gaussian2(ld, vec2(-123.6, 47.8), vec2(.55, .32)) * smoothstep(0., 5., inlandKm); // Olympic Mountains
  m += 850. * smoothstep(49.25, 49.7, ld.y) * smoothstep(-124.6, -123.9, ld.x) * smoothstep(2., 20., inlandKm); // Coast Mountains
  m += 550. * smoothstep(-122.25, -121.6, ld.x) * smoothstep(1., 12., inlandKm) * (1. - smoothstep(-120.9, -120.3, ld.x)); // Cascades
  m *= 1. - .8 * smoothstep(-121.1, -120.1, ld.x) * smoothFall(49.3, 48.9, ld.y);         // the Columbia plateau
  return m;
}
float volcanoes(vec2 ld) {
  return cone(ld, vec3(-121.813, 48.777, 3100.), 16.) + cone(ld, vec3(-121.114, 48.112, 2900.), 12.) +   // Baker, Glacier
         cone(ld, vec3(-121.760, 46.853, 4100.), 22.) + cone(ld, vec3(-122.194, 46.191, 2300.), 12.) +   // Rainier, St Helens
         cone(ld, vec3(-121.491, 46.202, 3400.), 16.) + cone(ld, vec3(-121.696, 45.373, 3200.), 14.);    // Adams, Hood
}

/** The world's deserts: Sahara, Arabia, Iran, Taklamakan, Gobi, Australia, Kalahari, Atacama, Sonora, Patagonia, Kyzylkum. */
float deserts(vec2 ld) {
  float d = gaussian2(ld, vec2(12., 23.), vec2(24., 7.)) + gaussian2(ld, vec2(46., 22.), vec2(9., 6.)) +
            gaussian2(ld, vec2(62., 29.), vec2(9., 4.)) + gaussian2(ld, vec2(84., 40.), vec2(9., 3.)) +
            gaussian2(ld, vec2(104., 42.), vec2(8., 2.5)) + gaussian2(ld, vec2(133., -25.), vec2(12., 6.)) +
            gaussian2(ld, vec2(20., -24.), vec2(6., 5.)) + gaussian2(ld, vec2(-70., -24.), vec2(2.5, 8.)) +
            gaussian2(ld, vec2(-112., 34.), vec2(6., 4.)) + gaussian2(ld, vec2(-68., -44.), vec2(3., 5.)) +
            gaussian2(ld, vec2(62., 43.), vec2(7., 3.));
  return clamp(d, 0., 1.);
}
/** The land's colour from orbit: belts by latitude, the deserts, the Pacific Northwest's rainforest, the ice. */
vec3 biome(vec2 ld, float speckle) {
  float latitude = abs(ld.y);
  vec3 c = BIOME_TROPICAL;
  c = mix(c, BIOME_SAVANNA, smoothstep(9., 17., latitude));
  c = mix(c, BIOME_TEMPERATE, smoothstep(27., 38., latitude));
  c = mix(c, BIOME_BOREAL, smoothstep(47., 56., latitude));
  c = mix(c, BIOME_TUNDRA, smoothstep(63., 69., latitude));
  c = mix(c, BIOME_DESERT, deserts(ld) * smoothstep(.25, .6, speckle + .2));
  c = mix(c, BIOME_RAINFOREST, gaussian2(ld, vec2(-126., 52.), vec2(9., 8.)));
  float ice = max(step(ld.y, -62.), step(76., ld.y));
  ice = max(ice, softBox(ld, vec4(-56., 60., -20., 84.), 2.5) * step(0., ld.y));             // Greenland
  c = mix(c, BIOME_ICE, clamp(ice, 0., 1.));
  return c * (.82 + .36 * speckle);
}

/** The relief's height in metres from one adaptive sample. */
float reliefHeight(vec2 sampleNoise, float massifM, float volcanoM, float ramp) {
  return (340. * sampleNoise.y + 60. * sampleNoise.x + massifM * (.3 + 1.1 * sampleNoise.y)) * ramp + volcanoM * (.85 + .3 * sampleNoise.x);
}

/** The Salish land at plane point 'q' (metres): relief, snow, the dry side, meadows; its meadow share and its shade. */
vec3 region(vec2 q, vec2 ld, float inlandKm, float mpp, out float meadowOut, out float shadeOut) {
  // under the canopy only the broad hills need shading: the crowns carry their own light
  float octaves = min(log2(26000. / (mpp * 2.2)), mix(16., 8.5, uCrowns));
  float sampleStepM = max(mpp * 1.3, .25);
  float massifM = massif(ld, inlandKm), volcanoM = volcanoes(ld);
  float ramp = .22 + .78 * smoothstep(0., 3.5, inlandKm);
  vec2 p = q / 26000.;
  vec2 f0 = adaptiveFractal(p, octaves);
  float h0 = reliefHeight(f0, massifM, volcanoM, ramp);
  float hx = reliefHeight(adaptiveFractal(p + vec2(sampleStepM / 26000., 0.), octaves), massifM, volcanoM, ramp);
  float hy = reliefHeight(adaptiveFractal(p + vec2(0., sampleStepM / 26000.), octaves), massifM, volcanoM, ramp);
  vec2 gradient = vec2(hx - h0, hy - h0) / sampleStepM;
  float slope = length(gradient);
  vec3 normal = normalize(vec3(-gradient * uReliefExaggeration, 1.));
  float stand = .8 + .4 * (valueNoise(q / 260.) * .6 + valueNoise(mat2(.8, .6, -.6, .8) * q / 70. + 7.) * .4);
  float shade = clamp(dot(normal, uSun) / uSun.z, .2, 1.5);
  float speckle = valueNoise(q / 900.) * .6 + valueNoise(q / 180.) * .4;
  vec3 c = mix(REGION_LOWLAND, REGION_UPLAND, smoothstep(80., 900., h0) * (.6 + .4 * speckle));
  c = mix(c, REGION_ALPINE, smoothstep(1350., 1750., h0 + 250. * speckle));
  c = mix(c, REGION_ROCK, clamp(smoothstep(1650., 2100., h0) + smoothstep(1.1, 1.9, slope) * .5, 0., 1.));
  c = mix(c, REGION_SNOW, smoothstep(2150., 2500., h0 + 260. * speckle - slope * 180.) * .92);
  // the dry side: steppe east of the Cascades, oak meadows round Victoria
  c = mix(c, REGION_STEPPE, smoothstep(-121., -120.1, ld.x + .5 * valueNoise(q / 40000.)) * smoothFall(1800., 900., h0) * smoothFall(49.35, 48.85, ld.y));
  float meadow = gaussian2(ld, vec2(-123.38, 48.46), vec2(.12, .06)) * smoothFall(260., 80., h0);
  vec2 mq = mat2(.8, .6, -.6, .8) * q;
  meadow *= smoothstep(.64, .72, valueNoise(mq / 900.) * .55 + valueNoise(q / 260. + 3.1) * .3 + valueNoise(mq / 70.) * .15);
  c = mix(c, REGION_MEADOW, meadow);
  meadowOut = meadow;
  shadeOut = shade * mix(stand, 1., meadow);
  return c;
}

/** The crown colour of a tree from its hash: firs, cedars, hemlocks, a few alders. */
vec3 crownColour(float species) {
  return species < .45 ? CROWN_FIR : species < .75 ? CROWN_CEDAR : species < .92 ? CROWN_HEMLOCK : CROWN_ALDER;
}

/** The conifer canopy: a seeded crown per cell, lit from the top-left, casting shade to the bottom-right. */
vec3 canopy(vec2 q, float meadow, float mpp) {
  const float CELL_M = 6.5;
  vec2 cellIndex = floor(q / CELL_M);
  vec2 sunDirection = normalize(uSun.xy);
  float best = -1., cover = 0., shadow = 0.;
  vec3 crown = vec3(0.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cellIndex + vec2(float(i), float(j));
    vec2 r = hash22(c);
    float species = hash12(c + 17.3);
    if (r.x < meadow * .82) continue;                       // meadow: few trees
    vec2 centre = (c + .15 + .7 * r) * CELL_M;
    float oak = step(.5, meadow) * step(species, .8);
    float radius = CELL_M * (oak > .5 ? .62 + .3 * hash12(c + 5.) : .44 + .3 * hash12(c + 5.));
    vec2 d = q - centre;
    float dl = length(d);
    float angle = atan(d.y, d.x);
    float edge = radius * (oak > .5 ? .9 + .1 * valueNoise(vec2(angle * 3., species * 40.)) : .8 + .2 * abs(cos(3.5 * angle + r.y * 30.)));
    shadow = max(shadow, 1. - smoothstep(radius * .65, radius * 1.2, length(q - (centre - sunDirection * radius * 1.25))));
    float a = smoothFall(edge + mpp * .8, edge - mpp * .8, dl);
    float top = 1. - dl / edge;
    if (a > 0. && top > best) {
      best = top;
      cover = a;
      vec3 colour = oak > .5 ? CROWN_OAK : crownColour(species);
      vec3 normal = normalize(vec3(d / max(dl, 1e-3) * (oak > .5 ? 1.1 : 1.9) * (1. - top * .3), 1.));
      float lambert = clamp(dot(normal, uSun), 0., 1.);
      float grain = .8 + .4 * valueNoise(q * 2.4 + c * 7.) * valueNoise(q * .9 + c);
      crown = colour * (.45 + 1.3 * lambert) * grain;
    }
  }
  vec3 floorColour = meadow > .5 ? FLOOR_MEADOW * (.85 + .3 * valueNoise(q * .7)) : FLOOR_FOREST * (.8 + .4 * valueNoise(q * .3));
  if (meadow > .5) floorColour = mix(floorColour, FLOOR_OUTCROP, smoothstep(.62, .7, valueNoise(q / 22.) * .8 + valueNoise(q / 4.) * .2));
  floorColour *= 1. - .45 * shadow;
  crown *= 1. - .3 * shadow * (1. - best);
  return mix(floorColour, crown, cover);
}
`;
