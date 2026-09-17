import { describe, it } from 'vitest';
import { GLYPH_ROLE } from '../render/svg-glyph';
import { GLYPH_FRAME } from '../render/constants/trait-glyph-layers';
import { GLYPH_MEDALLION_REACH } from '../render/constants/subject-glyph-palette';
import { TRAIT_GLYPHS } from './trait-glyphs';
import { SUBJECT_GLYPH_LIST } from './subject-glyphs';
import { layerReach } from '../../../testing/glyph-bounds';
import { layersAtLod, GLYPH_LOD } from './glyph-view';

describe('probe2', () => {
  it('trait glyph reach vs the new medallion clip', () => {
    const rows = Object.entries(TRAIT_GLYPHS).map(([id, g]) => {
      const list = layersAtLod(g, GLYPH_LOD.list).filter((l) => l.role !== GLYPH_ROLE.halo);
      const worst = Math.max(0, ...list.map((l) => layerReach(l)));
      return { id, worst: Number(worst.toFixed(1)) };
    });
    const overMedallion = rows.filter((r) => r.worst > GLYPH_MEDALLION_REACH);
    const clippedAtFrame = rows.filter((r) => r.worst * 1.2 > GLYPH_FRAME.radius);
    // eslint-disable-next-line no-console
    console.log('FRAME_RADIUS:' + GLYPH_FRAME.radius + ' MEDALLION:' + GLYPH_MEDALLION_REACH);
    // eslint-disable-next-line no-console
    console.log('TRAITS_OVER_MEDALLION:' + JSON.stringify(overMedallion));
    // eslint-disable-next-line no-console
    console.log('TRAITS_CLIPPED_AT_LIST:' + JSON.stringify(clippedAtFrame));
    // cross-system signature collision, geometry only
    const key = (ls: readonly { shape: unknown; offset?: unknown }[]) =>
      JSON.stringify(ls.map((l) => ({ shape: l.shape, offset: l.offset })));
    const map = new Map<string, string[]>();
    for (const [id, g] of Object.entries(TRAIT_GLYPHS))
      map.set(key(g.layers.filter((l) => l.role === GLYPH_ROLE.signature)), [
        ...(map.get(key(g.layers.filter((l) => l.role === GLYPH_ROLE.signature))) ?? []),
        'trait:' + id,
      ]);
    for (const g of SUBJECT_GLYPH_LIST) {
      const k = key(g.layers.filter((l) => l.role === GLYPH_ROLE.signature));
      map.set(k, [...(map.get(k) ?? []), g.entryId]);
    }
    // eslint-disable-next-line no-console
    console.log('CROSS_COLLISIONS:' + JSON.stringify([...map.values()].filter((v) => v.length > 1)));
  });
});
