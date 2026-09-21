// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TRAIT_CATALOG, type TraitId } from '@evolution/shared';
import * as COLOURS from '../render/constants/colours';
import { GLYPH_MOTION, GLYPH_ROLE, type GlyphLayer, type TraitGlyph } from '../render/svg-glyph';
import { GLYPH_LOD, layersAtLod } from './glyph-view';
import { TRAIT_GLYPHS } from './trait-glyphs';

const PALETTE = new Set<string>(
  Object.values(COLOURS as Readonly<Record<string, unknown>>).filter(
    (value): value is string => typeof value === 'string',
  ),
);
const CATALOG_IDS = TRAIT_CATALOG.map((trait) => trait.id);
/** ASSET-GENERATION §6: halo, shadow pool, ramped body, signature feature, outline and glint on every glyph. */
const REQUIRED_ROLES = [
  GLYPH_ROLE.halo,
  GLYPH_ROLE.pool,
  GLYPH_ROLE.outline,
  GLYPH_ROLE.body,
  GLYPH_ROLE.signature,
  GLYPH_ROLE.glint,
];
const MIN_LAYERS = 5;

function glyphOf(traitId: TraitId): TraitGlyph {
  return TRAIT_GLYPHS[traitId];
}

function coloursOf(layer: GlyphLayer): readonly string[] {
  const fill = layer.fill;
  const fillColours =
    fill === undefined ? [] : fill.kind === 'ramp' ? [fill.ramp.light, fill.ramp.base, fill.ramp.dark] : [fill.colour];
  return [...fillColours, ...(layer.stroke === undefined ? [] : [layer.stroke.colour])];
}

describe('TRAIT_GLYPHS', () => {
  it('has exactly one glyph per catalog trait, no more and no fewer', () => {
    expect(Object.keys(TRAIT_GLYPHS).sort()).toEqual([...CATALOG_IDS].sort());
  });

  it.each(CATALOG_IDS)('%s draws the full layer stack with a ramped body', (traitId) => {
    const glyph = glyphOf(traitId);
    const roles = new Set(glyph.layers.map((layer) => layer.role));
    expect([...REQUIRED_ROLES].filter((role) => !roles.has(role))).toEqual([]);
    expect(glyph.layers.length).toBeGreaterThanOrEqual(MIN_LAYERS);
    expect(glyph.layers.some((layer) => layer.fill?.kind === 'ramp')).toBe(true);
  });

  it.each(CATALOG_IDS)('%s paints only named palette colours', (traitId) => {
    const offPalette = glyphOf(traitId)
      .layers.flatMap(coloursOf)
      .filter((colour) => !PALETTE.has(colour));
    expect(offPalette).toEqual([]);
  });

  it.each(CATALOG_IDS)('%s has an idle motion, and never spins a lit body or a glint', (traitId) => {
    const layers = glyphOf(traitId).layers;
    expect(layers.some((layer) => layer.motion !== undefined)).toBe(true);
    const spunLight = layers.filter(
      (layer) =>
        layer.motion?.kind === GLYPH_MOTION.spin && (layer.fill?.kind === 'ramp' || layer.role === GLYPH_ROLE.glint),
    );
    expect(spunLight).toEqual([]);
  });

  it.each(CATALOG_IDS)('%s keeps its silhouette, signature and glint at the list LOD', (traitId) => {
    const roles = new Set(layersAtLod(glyphOf(traitId), GLYPH_LOD.list).map((layer) => layer.role));
    expect(roles.has(GLYPH_ROLE.detail)).toBe(false);
    expect([GLYPH_ROLE.body, GLYPH_ROLE.signature, GLYPH_ROLE.glint].every((role) => roles.has(role))).toBe(true);
  });

  it('gives every trait a signature drawn by no other trait', () => {
    const signatures = CATALOG_IDS.map((traitId) =>
      JSON.stringify(glyphOf(traitId).layers.filter((layer) => layer.role === GLYPH_ROLE.signature)),
    );
    expect(new Set(signatures).size).toBe(CATALOG_IDS.length);
  });
});
