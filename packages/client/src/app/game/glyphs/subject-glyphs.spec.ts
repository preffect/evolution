// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { BACTERIUM_VARIANT, CELL_KIND, CELL_STAGE, DNA_TAG, ENTITY_KIND, FOOD_KIND, ZONE_ID } from '@evolution/shared';
import { ABILITY } from '../encyclopedia/model/abilities';
import { ACTION } from '../encyclopedia/model/actions';
import { CONCEPT } from '../encyclopedia/model/concepts';
import { ENTRY_SUBJECT, entryIdOf, type CodeIdBySubject, type EntrySubject } from '../encyclopedia/model/entry-id';
import { WORLD_TOPIC } from '../encyclopedia/model/world-topics';
import * as COLOURS from '../render/constants/colours';
import { GLYPH_MEDALLION_REACH } from '../render/constants/subject-glyph-motifs';
import { GLYPH_MOTION, GLYPH_ROLE, type GlyphLayer, type SubjectEntryId, type SubjectGlyph } from '../render/svg-glyph';
import { GLYPH_LOD, layersAtLod } from './glyph-view';
import { layerReach } from '../../../testing/glyph-bounds';
import { SUBJECT_GLYPHS, SUBJECT_GLYPH_LIST } from './subject-glyphs';

/**
 * Every code id the encyclopedia documents outside the traits, read from the model itself: a new subject or a new
 * member of one fails this file before it can reach the encyclopedia without a glyph. The glyph tables take only the
 * id *type* from `encyclopedia/` (ui-type.md §7.2); this spec is what may read its values, because checking them is
 * the whole point of it.
 *
 * A **new subject** lands here first as a `typecheck` error — this record is mapped over `NonTraitSubject`, so the
 * missing key is named — and the fix is one row here plus its glyphs, never a row here alone: the row is what makes
 * the completeness test below ask for them. `HUD_TOPIC` (#450) is the outstanding case.
 */
type NonTraitSubject = Exclude<EntrySubject, typeof ENTRY_SUBJECT.trait>;
const CODE_IDS_BY_SUBJECT: { readonly [Subject in NonTraitSubject]: readonly CodeIdBySubject[Subject][] } = {
  [ENTRY_SUBJECT.cellKind]: Object.values(CELL_KIND),
  [ENTRY_SUBJECT.food]: Object.values(FOOD_KIND),
  [ENTRY_SUBJECT.bacterium]: Object.values(BACTERIUM_VARIANT),
  [ENTRY_SUBJECT.entity]: [ENTITY_KIND.dnaFragment],
  [ENTRY_SUBJECT.stage]: Object.values(CELL_STAGE),
  [ENTRY_SUBJECT.dnaTag]: Object.values(DNA_TAG),
  [ENTRY_SUBJECT.ability]: Object.values(ABILITY),
  [ENTRY_SUBJECT.action]: Object.values(ACTION),
  [ENTRY_SUBJECT.zone]: Object.values(ZONE_ID),
  [ENTRY_SUBJECT.world]: Object.values(WORLD_TOPIC),
  [ENTRY_SUBJECT.concept]: Object.values(CONCEPT),
};
const SUBJECT_ENTRY_IDS: readonly SubjectEntryId[] = Object.entries(CODE_IDS_BY_SUBJECT).flatMap(([subject, codeIds]) =>
  codeIds.map((codeId) => entryIdOf(subject as NonTraitSubject, codeId) as SubjectEntryId),
);

/** Every colour `colours.ts` names, the tables' values (tag colours, seat rows) included: nothing else may be painted. */
function palette(): ReadonlySet<string> {
  const found = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === 'string') found.add(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (typeof value === 'object' && value !== null) Object.values(value).forEach(walk);
  };
  walk(COLOURS);
  return found;
}
const PALETTE = palette();

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

function glyphOf(entryId: SubjectEntryId): SubjectGlyph {
  return SUBJECT_GLYPHS[entryId];
}

function coloursOf(layer: GlyphLayer): readonly string[] {
  const fill = layer.fill;
  const fillColours =
    fill === undefined ? [] : fill.kind === 'ramp' ? [fill.ramp.light, fill.ramp.base, fill.ramp.dark] : [fill.colour];
  return [...fillColours, ...(layer.stroke === undefined ? [] : [layer.stroke.colour])];
}

describe('SUBJECT_GLYPHS', () => {
  it('draws every non-trait entry id exactly once: a subject that gains members owes glyphs', () => {
    // Failing here is not a broken glyph — it is a glyph that was never drawn. `undrawn` lists the entries the
    // encyclopedia will show with nothing beside their name until someone draws them (`ui-type.md` §7.2 says how);
    // `orphaned` lists drawings whose subject has left the model and that should go with it. The known outstanding
    // case is `HUD_TOPIC` (#450): the day `hud-topics.ts` and the `hud` subject land, its seven appear in `undrawn`.
    const drawn = SUBJECT_GLYPH_LIST.map((glyph) => glyph.entryId);
    const undrawn = SUBJECT_ENTRY_IDS.filter((entryId) => !drawn.includes(entryId));
    const orphaned = drawn.filter((entryId) => !SUBJECT_ENTRY_IDS.includes(entryId));
    expect({ undrawn, orphaned }).toEqual({ undrawn: [], orphaned: [] });
    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it.each(SUBJECT_ENTRY_IDS)('%s draws the full layer stack with a ramped body', (entryId) => {
    const glyph = glyphOf(entryId);
    const roles = new Set(glyph.layers.map((layer) => layer.role));
    expect([...REQUIRED_ROLES].filter((role) => !roles.has(role))).toEqual([]);
    expect(glyph.layers.length).toBeGreaterThanOrEqual(MIN_LAYERS);
    expect(glyph.layers.some((layer) => layer.fill?.kind === 'ramp')).toBe(true);
  });

  it.each(SUBJECT_ENTRY_IDS)('%s paints only named palette colours', (entryId) => {
    const offPalette = glyphOf(entryId)
      .layers.flatMap(coloursOf)
      .filter((colour) => !PALETTE.has(colour));
    expect(offPalette).toEqual([]);
  });

  it.each(SUBJECT_ENTRY_IDS)('%s has an idle motion, and never spins a lit body or a glint', (entryId) => {
    const layers = glyphOf(entryId).layers;
    expect(layers.some((layer) => layer.motion !== undefined)).toBe(true);
    const spunLight = layers.filter(
      (layer) =>
        layer.motion?.kind === GLYPH_MOTION.spin && (layer.fill?.kind === 'ramp' || layer.role === GLYPH_ROLE.glint),
    );
    expect(spunLight).toEqual([]);
  });

  it.each(SUBJECT_ENTRY_IDS)('%s keeps its silhouette, signature and glint at the list LOD', (entryId) => {
    const roles = new Set(layersAtLod(glyphOf(entryId), GLYPH_LOD.list).map((layer) => layer.role));
    expect(roles.has(GLYPH_ROLE.detail)).toBe(false);
    expect([GLYPH_ROLE.body, GLYPH_ROLE.signature, GLYPH_ROLE.glint].every((role) => roles.has(role))).toBe(true);
  });

  it.each(SUBJECT_ENTRY_IDS)('%s draws inside the medallion, so the list LOD crops nothing it drew', (entryId) => {
    // A halo is exempt: it fades to nothing at its edge and the view builder clips it to the disc, so it cannot show
    // past the rim. Everything the eye reads — the body, the signature, the outline, the glint — has to fit.
    const cropped = glyphOf(entryId)
      .layers.filter((layer) => layer.role !== GLYPH_ROLE.halo)
      .map((layer) => ({ role: layer.role, reach: Number(layerReach(layer).toFixed(1)) }))
      .filter((layer) => layer.reach > GLYPH_MEDALLION_REACH);
    expect(cropped).toEqual([]);
  });

  it('never repeats one subject’s signature geometry in another, recoloured', () => {
    // A copy-paste-and-recolour guard, and only that. Comparing geometry with the paint stripped off is what makes
    // it one — two subjects drawn from the same shapes in different colours would pass a JSON comparison and read
    // the same at 20 px, where hue is the least reliable cue (principles-and-palette.md §1). It does **not** show
    // the set is mutually distinguishable: `ability:genome` and `ability:toxin` have different geometry and still
    // read alike at list size. Distinguishability is judged on the contact sheets, by eye.
    const signatures = SUBJECT_ENTRY_IDS.map((entryId) =>
      JSON.stringify(
        glyphOf(entryId)
          .layers.filter((layer) => layer.role === GLYPH_ROLE.signature)
          .map((layer) => ({ shape: layer.shape, offset: layer.offset })),
      ),
    );
    expect(new Set(signatures).size).toBe(SUBJECT_ENTRY_IDS.length);
  });
});
