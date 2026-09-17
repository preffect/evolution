import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TraitId } from '@evolution/shared';
import { GLYPH_FRAME_LAYERS } from '../render/constants/trait-glyph-frame';
import { GLYPH_ROLE } from '../render/svg-glyph';
import { glyphMotionVariables } from './glyph-motion-variables';
import { GLYPH_LOD, type GlyphLod } from './glyph-view';
import { TraitGlyphComponent } from './trait-glyph.component';
import { TRAIT_GLYPHS } from './trait-glyphs';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function mount(traitId: TraitId, lod: GlyphLod = GLYPH_LOD.card): SVGSVGElement {
  const fixture = TestBed.createComponent(TraitGlyphComponent);
  fixture.componentRef.setInput('traitId', traitId);
  fixture.componentRef.setInput('lod', lod);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('svg')!;
}

describe('TraitGlyphComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TraitGlyphComponent] });
  });

  it('draws the frame and every layer of the trait as SVG paths, tagged with the trait', () => {
    const svg = mount('diatom_shell');
    const paths = [...svg.querySelectorAll('path')];
    expect(svg.parentElement?.getAttribute('data-trait-id')).toBe('diatom_shell');
    expect(paths).toHaveLength(GLYPH_FRAME_LAYERS.length + TRAIT_GLYPHS.diatom_shell.layers.length);
    expect(paths.every((element) => element.namespaceURI === SVG_NAMESPACE)).toBe(true);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('resolves every gradient fill to a def inside its own drawing, never another glyph’s', () => {
    const first = mount('toxin_vacuole');
    const second = mount('toxin_vacuole');
    const idsOf = (svg: SVGSVGElement): string[] =>
      [...svg.querySelectorAll('radialGradient')].map((gradient) => gradient.id);
    expect(idsOf(first).filter((id) => idsOf(second).includes(id))).toEqual([]);
    const references = [...first.querySelectorAll('path')]
      .map((element) => element.getAttribute('fill') ?? '')
      .filter((fill) => fill.startsWith('url(#'))
      .map((fill) => fill.slice('url(#'.length, -1));
    expect(references.every((id) => idsOf(first).includes(id))).toBe(true);
  });

  it('clips each drawing to its own medallion, with a clip id no other drawing on the page shares', () => {
    const clipIdsOf = (svg: SVGSVGElement): string[] => [...svg.querySelectorAll('clipPath')].map((clip) => clip.id);
    const first = mount('toxin_vacuole');
    const second = mount('toxin_vacuole');
    expect(clipIdsOf(first)).toHaveLength(1);
    expect(clipIdsOf(first).filter((id) => clipIdsOf(second).includes(id))).toEqual([]);
    const clipped = [...first.querySelectorAll('g[clip-path]')];
    expect(clipped.length).toBeGreaterThan(0);
    expect(clipped.every((group) => group.getAttribute('clip-path') === `url(#${clipIdsOf(first)[0]})`)).toBe(true);
    // Only the halos: clipping a drawn layer would crop the artwork it was meant to protect.
    expect(clipped.length).toBeLessThan(first.querySelectorAll('path').length);
  });

  it('animates the moving layers with their period and pivot', () => {
    const moving = mount('simple_flagellum').querySelector<SVGPathElement>('path.motion-sway');
    expect(moving).not.toBeNull();
    expect(moving!.style.transformOrigin).toBe('54px 52px');
  });

  it('publishes the idle amplitudes on its host for the keyframes to read', () => {
    const host = mount('mitochondrion').parentElement as HTMLElement;
    for (const [name, value] of Object.entries(glyphMotionVariables())) {
      expect(host.style.getPropertyValue(name)).toBe(value);
    }
  });

  it('drops every idle loop when still, and keeps the same drawing', () => {
    const moving = mount('simple_flagellum');
    const fixture = TestBed.createComponent(TraitGlyphComponent);
    fixture.componentRef.setInput('traitId', 'simple_flagellum');
    fixture.componentRef.setInput('still', true);
    fixture.detectChanges();
    const still = (fixture.nativeElement as HTMLElement).querySelector('svg')!;
    expect(moving.querySelectorAll('path.motion').length).toBeGreaterThan(0);
    expect(still.querySelectorAll('path.motion')).toHaveLength(0);
    expect(still.getAttribute('data-still')).toBe('true');
    expect(still.querySelectorAll('path')).toHaveLength(moving.querySelectorAll('path').length);
  });

  it('draws fewer paths at the list LOD, one fewer per detail layer', () => {
    const detailCount = TRAIT_GLYPHS.ribosomes.layers.filter((layer) => layer.role === GLYPH_ROLE.detail).length;
    const full = mount('ribosomes').querySelectorAll('path').length;
    const list = mount('ribosomes', GLYPH_LOD.list);
    expect(list.getAttribute('data-lod')).toBe('list');
    expect(list.querySelectorAll('path')).toHaveLength(full - detailCount);
  });
});
