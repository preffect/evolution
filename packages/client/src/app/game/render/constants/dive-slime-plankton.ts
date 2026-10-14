// The opening dive's plankton in the drop (docs/rendering/opening-dive.md §4, ticket #803): the mockup's `ORGS`,
// `nauplius`, `ciliate` and `dino` numbers under its own names. Places in metres round the focus; an organism's own
// numbers are in its unit (its length is 1); rates are radians a second. Kept out of the `render/constants` barrel:
// only the dive's lazily loaded slime chunk reads it.

/** The plankton's kinds (`ORGS[].kind`). */
export const SLIME_PLANKTON_KIND = {
  nauplius: 'nauplius',
  ciliate: 'ciliate',
  dino: 'dino',
  pennate: 'pennate',
} as const;
export type SlimePlanktonKind = (typeof SLIME_PLANKTON_KIND)[keyof typeof SLIME_PLANKTON_KIND];

export interface SlimeOrganism {
  readonly kind: SlimePlanktonKind;
  readonly x: number;
  readonly y: number;
  /** Its length in metres. */
  readonly lengthM: number;
  /** Its heading in radians. */
  readonly angle: number;
}

/** The plankton, placed by hand (`ORGS`), in the mockup's drawing order. */
export const SLIME_ORGANISMS: readonly SlimeOrganism[] = [
  { kind: 'nauplius', x: 5.2e-4, y: -3.1e-4, lengthM: 2.5e-4, angle: 0.5 },
  { kind: 'ciliate', x: -3.0e-4, y: 1.6e-4, lengthM: 1.0e-4, angle: -0.4 },
  { kind: 'ciliate', x: 7.0e-4, y: 4.5e-4, lengthM: 1.2e-4, angle: 2.1 },
  { kind: 'dino', x: -1.6e-4, y: -2.2e-4, lengthM: 3.5e-5, angle: 0.3 },
  { kind: 'dino', x: 2.4e-4, y: 1.9e-4, lengthM: 3.0e-5, angle: 1.2 },
  { kind: 'pennate', x: 3.8e-5, y: 1.2e-5, lengthM: 7.0e-5, angle: 1.45 },
  { kind: 'pennate', x: -5.5e-5, y: -3.0e-5, lengthM: 4.5e-5, angle: 0.3 },
];

/** An organism is drawn while it lies within this many lengths of the view (`vis(o.x, o.y, o.L × 1.2)`). */
export const SLIME_ORGANISM_VISIBLE_LENGTHS = 1.2;

/** A scattered blob's rolls (`hash(k, 1 | 2 | 3, salt)`): its x, its y and its radius. */
export const SLIME_BLOB_ROLL = { x: 1, y: 2, radius: 3 } as const;

/** A halo's colour, radius and alpha (`base + darkField × df`). */
export interface SlimeHaloLook {
  readonly colour: string;
  readonly radius: number;
  readonly base: number;
  readonly darkField: number;
}

/**
 * The copepod larva (`nauplius`): a shield of a body, three pairs of rowing limbs (`[root x, length, phase]`) beating
 * at `beat.rate`, fringed with setae from `setaeAbovePx`, a forked tail, one red eye and a glint from `glintAbovePx`.
 */
export const SLIME_NAUPLIUS = {
  hideBelowPx: 4,
  halo: { colour: '#f0d9a8', radius: 0.75, base: 0.1, darkField: 0.2 },
  limbs: [
    [0.3, 0.55, 0],
    [0.1, 0.62, 1.1],
    [-0.08, 0.5, 2.2],
  ],
  beat: { rate: 5.5, amount: 0.35, swing: 0.6, spread: 1.15, rootY: 0.22, bend: 0.3 },
  reach: { along: 0.55, back: 0.25, across: 0.7, control: 0.35, controlX: 0.02 },
  limb: { colour: 'rgba(240,226,190,.8)', width: 0.03 },
  setae: {
    abovePx: 40,
    colour: 'rgba(245,238,215,.55)',
    width: 0.006,
    count: 5,
    from: 0.55,
    step: 0.1,
    back: 0.22,
    out: 0.12,
    outStep: 0.03,
  },
  body: {
    shape: { noseX: 0.44, frontY: 0.36, backX: -0.26, backY: 0.34, tailX: -0.44, tailY: 0.06, tipX: -0.5 },
    colours: ['#fbf1d8', '#d8c090', '#8a7040'],
    radius: 0.45,
    alpha: 0.45,
    bright: 0.12,
  },
  gut: { colour: 'rgba(150,110,50,.3)', x: -0.05, radiusX: 0.28, radiusY: 0.12 },
  lipids: { count: 7, salt: 341, spreadX: 0.5, spreadY: 0.22, radius: { min: 0.02, span: 0.03 }, alpha: 0.85 },
  rim: { colours: ['#fff3d6', '#c8a868'], width: 0.012 },
  tail: {
    colour: 'rgba(245,238,215,.6)',
    width: 0.006,
    rootX: -0.47,
    rootY: 0.03,
    controlX: -0.7,
    controlY: 0.06,
    tipX: -0.9,
    tipY: 0.1,
    wave: { rate: 3, amount: 0.02 },
  },
  eye: { x: 0.33, haloColour: '#ff5a3c', haloRadius: 0.07, haloAlpha: 0.6, colour: '#c23a22', radius: 0.03 },
  glint: { abovePx: 30, x: 0.15, y: -0.18, minPx: 3, radius: 0.03 },
} as const;

/**
 * A ciliate (`ciliate`, Euplotes): drifting and turning a little, cilia beating in a travelling wave from
 * `cilia.abovePx`, the mouth's membranelles, a C-shaped macronucleus, a pulsing contractile vacuole and a glint.
 */
export const SLIME_CILIATE = {
  hideBelowPx: 4,
  drift: { rate: 0.3, phasePerMetre: 1e4, amount: 0.05 },
  wobble: { rate: 0.25, amount: 0.05 },
  width: 0.66,
  halo: { colour: '#a6f4ff', radius: 0.72, base: 0.1, darkField: 0.22 },
  cilia: {
    abovePx: 26,
    count: 72,
    waves: 6,
    rate: 7,
    lean: 0.45,
    length: 0.07,
    width: 0.004,
    base: 0.45,
    darkField: 0.2,
  },
  body: { colours: ['#eaf6f0', '#b9d7cc', '#6f9488'], alpha: 0.36, bright: 0.15 },
  nucleus: {
    colour: 'rgba(60,90,80,.45)',
    width: 0.02,
    dash: [0.012, 0.01],
    x: -0.02,
    y: -0.05,
    radiusX: 0.38,
    radiusY: 0.32,
    fromTurns: 0.75,
    toTurns: 1.75,
  },
  mouth: { colour: 'rgba(210,235,255,.55)', width: 0.05, x: 0.06, radius: 0.2, reach: 2.2 },
  organelles: {
    count: 6,
    salt: 351,
    spreadX: 0.6,
    spreadY: 0.6,
    radius: { min: 0.025, span: 0.025 },
    alpha: 0.7,
    cycle: 2,
  },
  vacuole: {
    colour: 'rgba(230,250,255,.55)',
    width: 0.006,
    x: -0.3,
    y: 0.15,
    radius: 0.05,
    pulse: { base: 0.8, amount: 0.2, rate: 1.3 },
  },
  membranelles: {
    count: 5,
    spread: 0.22,
    from: 0.45,
    to: 0.63,
    toY: 0.6,
    wave: { rate: 4, amount: 0.02 },
    width: 0.014,
  },
  membranelleAlpha: 0.7,
  rimDark: '#6f9488',
  rimWidth: 0.01,
  glint: { abovePx: 30, x: -0.2, y: -0.25, minPx: 3, radius: 0.035 },
} as const;

/**
 * A dinoflagellate (`dino`): armoured plates parted by the girdle, spinning a little; one flagellum trailing (from
 * `trailing.abovePx`) and one in the girdle (from `girdleFlagellum.abovePx`), plates from `platesAbovePx`.
 */
export const SLIME_DINO = {
  hideBelowPx: 3,
  spin: { rate: 0.9, phasePerMetre: 1e5, amount: 0.15 },
  halo: { colour: '#ffb15a', radius: 0.8, base: 0.1, darkField: 0.25 },
  trailing: { abovePx: 12, step: 0.05, fromX: -0.45, length: 1.1, waves: 12, rate: 9, amount: 0.08, width: 0.012 },
  trailingAlpha: 0.5,
  shell: {
    shape: {
      noseX: 0.5,
      frontX: 0.45,
      frontY: 0.42,
      backX: -0.3,
      backY: 0.45,
      tailX: -0.46,
      tailY: -0.05,
      tipX: -0.5,
      tipY: 0.02,
    },
    colours: ['#f3c98a', '#c08a44', '#6e4a1c'],
    alpha: 0.55,
    bright: 0.15,
  },
  platesAbovePx: 18,
  plates: { count: 7, colour: 'rgba(255,230,190,.3)', width: 0.01, inner: 0.12, outer: 0.55, twist: 0.3 },
  blots: {
    count: 5,
    salt: 361,
    spreadX: 0.6,
    spreadY: 0.5,
    radiusX: 0.08,
    radiusY: 0.05,
    colour: 'rgba(120,80,20,.5)',
  },
  girdle: { colour: 'rgba(90,60,20,.6)', width: 0.05, x: -0.05, controlX: 0.08, reach: 0.46 },
  girdleFlagellum: {
    abovePx: 14,
    step: 0.04,
    x: -0.05,
    bow: 0.07,
    bowCurve: 4,
    waves: 30,
    rate: 14,
    amount: 0.02,
    length: 0.9,
  },
  girdleFlagellumWidth: 0.008,
  girdleFlagellumAlpha: 0.6,
  trailingColour: '#a6f4ff',
  rimWidth: 0.018,
  glint: { abovePx: 16, x: -0.2, y: -0.2, minPx: 2.5, radius: 0.05 },
} as const;
