// @vitest-environment node
// The rules docs/visual-style/ui-type.md §7.2 states that a colour-name check and a layer count cannot see (#457):
// the concept and ability family marks, and — for the subjects the dish itself draws — the colours the renderer
// paints them in. Each is written so that the drawing it names failing is what turns it red: the palette pins read
// the renderer's own tables, not the palette's key list, which is how six wrong-but-named colours once passed.

import { describe, expect, it } from 'vitest';
import { BACTERIUM_VARIANT, DNA_TAG, ZONE_ID, type BacteriumVariant } from '@evolution/shared';
import { CONCEPT } from '../encyclopedia/model/concepts';
import { ABILITY } from '../encyclopedia/model/abilities';
import { DNA_STRAND, DNA_TAG_COLOR, PLAYER_PALETTE_TABLE } from '../render/constants/colours';
import { GLYPH_ROLE, type GlyphLayer, type SubjectEntryId } from '../render/svg-glyph';
import { ROD_STYLES } from '../render/textures/bacterium-bake';
import { ZONE_TINT_COLOUR } from '../render/textures/dish-texture';
import { MOTE_PAINT } from '../render/textures/mote-atlas';
import { SUBJECT_GLYPHS } from './subject-glyphs';

/** The smallest body an ability's cell is drawn at: a mote is smaller, and a mote is not the cell (§7.2). */
const ABILITY_CELL_MIN_RADIUS = 12;

function layersOf(entryId: SubjectEntryId): readonly GlyphLayer[] {
  return SUBJECT_GLYPHS[entryId].layers;
}

/** The colours a glyph fills its ramped or solid bodies with (a ramp counts by its base), glints and halos aside. */
function bodyColours(entryId: SubjectEntryId): readonly string[] {
  return layersOf(entryId).flatMap((layer) => {
    if (layer.role === GLYPH_ROLE.glint || layer.role === GLYPH_ROLE.halo || layer.fill === undefined) return [];
    return layer.fill.kind === 'ramp' ? [layer.fill.ramp.base, layer.fill.ramp.dark] : [layer.fill.colour];
  });
}

function strokeColours(entryId: SubjectEntryId): readonly string[] {
  return layersOf(entryId).flatMap((layer) => (layer.stroke === undefined ? [] : [layer.stroke.colour]));
}

function glintColours(entryId: SubjectEntryId): readonly string[] {
  return layersOf(entryId)
    .filter((layer) => layer.role === GLYPH_ROLE.glint && layer.fill?.kind === 'solid')
    .map((layer) => (layer.fill?.kind === 'solid' ? layer.fill.colour : ''));
}

/** A measuring mark: a solid (undashed) stroke with no fill, drawn as a signature — a caliper, a beam, a datum, a ring. */
function isMeasuringMark(layer: GlyphLayer): boolean {
  return (
    layer.role === GLYPH_ROLE.signature &&
    layer.fill === undefined &&
    layer.stroke !== undefined &&
    layer.stroke.dash === undefined
  );
}

describe('the concept family mark (§7.2): a relation drawn against a measuring mark', () => {
  it.each(Object.values(CONCEPT).map((concept) => `concept:${concept}` as SubjectEntryId))('%s', (entryId) => {
    expect(layersOf(entryId).some(isMeasuringMark)).toBe(true);
  });
});

describe('the ability family mark (§7.2): an organ or an effect on a cell', () => {
  it.each(Object.values(ABILITY).map((ability) => `ability:${ability}` as SubjectEntryId))(
    '%s draws the cell',
    (entryId) => {
      const cellRadii = layersOf(entryId)
        .filter((layer) => layer.fill?.kind === 'ramp' && layer.shape.kind === 'circle')
        .map((layer) => (layer.shape.kind === 'circle' ? layer.shape.r : 0));
      expect(Math.max(0, ...cellRadii)).toBeGreaterThanOrEqual(ABILITY_CELL_MIN_RADIUS);
    },
  );
});

describe('a subject the dish draws wears the renderer’s own colours', () => {
  it('the player cell is the first seat of the renderer’s palette table', () => {
    const [seat] = PLAYER_PALETTE_TABLE;
    expect(bodyColours('cell_kind:player')).toContain(seat?.base);
    expect(strokeColours('cell_kind:player')).toContain(seat?.rim);
  });

  it('algae is the mote atlas’s algae: body, darker edge and rim', () => {
    expect(bodyColours('food:algae')).toContain(MOTE_PAINT.algae.body);
    expect([...bodyColours('food:algae'), ...strokeColours('food:algae')]).toContain(MOTE_PAINT.algae.edge);
    expect(strokeColours('food:algae')).toContain(MOTE_PAINT.algae.rim);
  });

  it('detritus is the mote atlas’s lipid: body, darker centre, rim and its warm glint', () => {
    expect(bodyColours('food:detritus')).toContain(MOTE_PAINT.detritus.body);
    expect(bodyColours('food:detritus')).toContain(MOTE_PAINT.detritus.centre);
    expect(strokeColours('food:detritus')).toContain(MOTE_PAINT.detritus.rim);
    expect(glintColours('food:detritus')).toEqual([MOTE_PAINT.detritus.glint]);
  });

  it.each(Object.values(BACTERIUM_VARIANT))(
    'the %s rod is the bacterium bake’s rod: body, rim and bands',
    (variant) => {
      const entryId = `bacterium:${variant}` as SubjectEntryId;
      const style = ROD_STYLES[variant as BacteriumVariant];
      expect(bodyColours(entryId)).toContain(style.body);
      expect(strokeColours(entryId)).toContain(style.rim);
      if (style.bands !== null) expect(strokeColours(entryId)).toContain(style.bands);
    },
  );

  it('a DNA fragment is the fragment bake’s: the strand pair, with rungs in a tag’s colour', () => {
    expect(strokeColours('entity:dna_fragment')).toContain(DNA_STRAND);
    const rungColours = strokeColours('entity:dna_fragment').filter((colour) =>
      Object.values(DNA_TAG_COLOR).includes(colour as (typeof DNA_TAG_COLOR)[typeof DNA_TAG.motile]),
    );
    expect(rungColours.length).toBeGreaterThan(0);
  });

  it.each(Object.keys(ZONE_TINT_COLOUR))('the %s zone wears the dish texture’s tint', (zone) => {
    const entryId = `zone:${zone}` as SubjectEntryId;
    const tint = ZONE_TINT_COLOUR[zone as keyof typeof ZONE_TINT_COLOUR];
    const colours = layersOf(entryId).flatMap((layer) => [
      ...(layer.fill === undefined ? [] : [layer.fill.kind === 'ramp' ? layer.fill.ramp.base : layer.fill.colour]),
      ...(layer.stroke === undefined ? [] : [layer.stroke.colour]),
    ]);
    expect(colours).toContain(tint);
    expect(Object.values(ZONE_ID)).toContain(zone);
  });
});
