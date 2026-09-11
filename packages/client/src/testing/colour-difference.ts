// CIEDE2000, WCAG contrast and the Viénot / Brettel / Mollon (1999) dichromacy simulation, the
// arithmetic behind docs/VISUAL-STYLE.md §2's separability acceptance (render/palette.spec.ts pins
// it). Test support only, mirroring qa/evidence/34/tools/colour_separability.py; the literals are
// the standards' coefficients.

import { hexToRgb, linearToSrgb, srgbToLinear, type Rgb } from '../app/game/render/colour';

export type Lab = readonly [number, number, number];
export type RgbMatrix = readonly [Rgb, Rgb, Rgb];

const XYZ_FROM_LINEAR: RgbMatrix = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
];
const D65_WHITE: Rgb = [0.95047, 1.0, 1.08883];
const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;
const LAB_L_SCALE = 116;
const LAB_L_OFFSET = 16;
const LAB_A_SCALE = 500;
const LAB_B_SCALE = 200;
const DEGREES_PER_TURN = 360;
const HALF_TURN_DEGREES = 180;
const CHROMA_POWER = 7;
const CHROMA_REFERENCE = 25;
const CONTRAST_OFFSET = 0.05;

/** Viénot 1999 linear-RGB matrices at severity 1. */
export const PROTAN_MATRIX: RgbMatrix = [
  [0.11238, 0.88762, 0],
  [0.11238, 0.88762, 0],
  [0.00401, -0.00401, 1],
];
export const DEUTAN_MATRIX: RgbMatrix = [
  [0.29275, 0.70725, 0],
  [0.29275, 0.70725, 0],
  [-0.02234, 0.02234, 1],
];

function multiply(matrix: RgbMatrix, vector: Rgb): Rgb {
  return matrix.map((row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]) as unknown as Rgb;
}

/** The colour a dichromat sees, through a linear-RGB matrix. */
export function simulateDichromacy(rgb: Rgb, matrix: RgbMatrix): Rgb {
  const linear = rgb.map(srgbToLinear) as unknown as Rgb;
  return multiply(matrix, linear).map(linearToSrgb) as unknown as Rgb;
}

export function rgbToLab(rgb: Rgb): Lab {
  const xyz = multiply(XYZ_FROM_LINEAR, rgb.map(srgbToLinear) as unknown as Rgb);
  const scaled = xyz.map((value, index) => value / D65_WHITE[index]!);
  const fold = (ratio: number) =>
    ratio > LAB_EPSILON ? Math.cbrt(ratio) : (LAB_KAPPA * ratio + LAB_L_OFFSET) / LAB_L_SCALE;
  const [foldedX, foldedY, foldedZ] = scaled.map(fold) as unknown as Rgb;
  return [LAB_L_SCALE * foldedY - LAB_L_OFFSET, LAB_A_SCALE * (foldedX - foldedY), LAB_B_SCALE * (foldedY - foldedZ)];
}

function hueDegrees(aStar: number, bStar: number): number {
  if (aStar === 0 && bStar === 0) return 0;
  const degrees = (Math.atan2(bStar, aStar) * DEGREES_PER_TURN) / (2 * Math.PI);
  return degrees < 0 ? degrees + DEGREES_PER_TURN : degrees;
}

function radians(degrees: number): number {
  return (degrees / DEGREES_PER_TURN) * 2 * Math.PI;
}

function hueDifference(hue1: number, hue2: number, chromaProduct: number): number {
  if (chromaProduct === 0) return 0;
  const raw = hue2 - hue1;
  if (Math.abs(raw) <= HALF_TURN_DEGREES) return raw;
  return raw > HALF_TURN_DEGREES ? raw - DEGREES_PER_TURN : raw + DEGREES_PER_TURN;
}

function meanHue(hue1: number, hue2: number, chromaProduct: number): number {
  if (chromaProduct === 0) return hue1 + hue2;
  if (Math.abs(hue1 - hue2) <= HALF_TURN_DEGREES) return (hue1 + hue2) / 2;
  return hue1 + hue2 < DEGREES_PER_TURN ? (hue1 + hue2 + DEGREES_PER_TURN) / 2 : (hue1 + hue2 - DEGREES_PER_TURN) / 2;
}

/** CIEDE2000 (Sharma et al. 2005 formulation). */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const [lightness1, aStar1, bStar1] = lab1;
  const [lightness2, aStar2, bStar2] = lab2;
  const chromaMean = (Math.hypot(aStar1, bStar1) + Math.hypot(aStar2, bStar2)) / 2;
  const chromaPow = Math.pow(chromaMean, CHROMA_POWER);
  const chromaGain = 0.5 * (1 - Math.sqrt(chromaPow / (chromaPow + Math.pow(CHROMA_REFERENCE, CHROMA_POWER))));
  const aPrime1 = aStar1 * (1 + chromaGain);
  const aPrime2 = aStar2 * (1 + chromaGain);
  const chromaPrime1 = Math.hypot(aPrime1, bStar1);
  const chromaPrime2 = Math.hypot(aPrime2, bStar2);
  const huePrime1 = hueDegrees(aPrime1, bStar1);
  const huePrime2 = hueDegrees(aPrime2, bStar2);
  const chromaProduct = chromaPrime1 * chromaPrime2;
  const deltaLightness = lightness2 - lightness1;
  const deltaChroma = chromaPrime2 - chromaPrime1;
  const deltaHue =
    2 * Math.sqrt(chromaProduct) * Math.sin(radians(hueDifference(huePrime1, huePrime2, chromaProduct) / 2));
  const lightnessMean = (lightness1 + lightness2) / 2;
  const chromaPrimeMean = (chromaPrime1 + chromaPrime2) / 2;
  const hueMean = meanHue(huePrime1, huePrime2, chromaProduct);
  const hueWeight =
    1 -
    0.17 * Math.cos(radians(hueMean - 30)) +
    0.24 * Math.cos(radians(2 * hueMean)) +
    0.32 * Math.cos(radians(3 * hueMean + 6)) -
    0.2 * Math.cos(radians(4 * hueMean - 63));
  const lightnessScale =
    1 + (0.015 * Math.pow(lightnessMean - 50, 2)) / Math.sqrt(20 + Math.pow(lightnessMean - 50, 2));
  const chromaScale = 1 + 0.045 * chromaPrimeMean;
  const hueScale = 1 + 0.015 * chromaPrimeMean * hueWeight;
  const lightnessTerm = deltaLightness / lightnessScale;
  const chromaTerm = deltaChroma / chromaScale;
  const hueTerm = deltaHue / hueScale;
  const rotationTerm = rotationTermFor(hueMean, chromaPrimeMean);
  return Math.sqrt(
    lightnessTerm * lightnessTerm + chromaTerm * chromaTerm + hueTerm * hueTerm + rotationTerm * chromaTerm * hueTerm,
  );
}

/** The hue-rotation term `R_T` of CIEDE2000 from the mean hue and mean chroma. */
function rotationTermFor(hueMean: number, chromaPrimeMean: number): number {
  const rotationAngle = 30 * Math.exp(-Math.pow((hueMean - 275) / 25, 2));
  const chromaMeanPow = Math.pow(chromaPrimeMean, CHROMA_POWER);
  const rotationChroma = 2 * Math.sqrt(chromaMeanPow / (chromaMeanPow + Math.pow(CHROMA_REFERENCE, CHROMA_POWER)));
  return -Math.sin(radians(2 * rotationAngle)) * rotationChroma;
}

/** CIEDE2000 between two hex colours, optionally as a dichromat sees them. */
export function hexDeltaE(hex1: string, hex2: string, matrix: RgbMatrix | null = null): number {
  let rgb1 = hexToRgb(hex1);
  let rgb2 = hexToRgb(hex2);
  if (matrix) {
    rgb1 = simulateDichromacy(rgb1, matrix);
    rgb2 = simulateDichromacy(rgb2, matrix);
  }
  return deltaE2000(rgbToLab(rgb1), rgbToLab(rgb2));
}

export function relativeLuminance(rgb: Rgb): number {
  const [red, green, blue] = rgb.map(srgbToLinear) as unknown as Rgb;
  return XYZ_FROM_LINEAR[1][0] * red + XYZ_FROM_LINEAR[1][1] * green + XYZ_FROM_LINEAR[1][2] * blue;
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(hex1: string, hex2: string): number {
  const first = relativeLuminance(hexToRgb(hex1));
  const second = relativeLuminance(hexToRgb(hex2));
  const [light, dark] = first > second ? [first, second] : [second, first];
  return (light + CONTRAST_OFFSET) / (dark + CONTRAST_OFFSET);
}
