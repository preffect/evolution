import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GLYPH_FRAME_LAYERS } from '../render/constants/trait-glyph-frame';
import { GLYPH_ROLE, type SubjectEntryId } from '../render/svg-glyph';
import { glyphMotionVariables } from './glyph-motion-variables';
import { GLYPH_LOD, type GlyphLod } from './glyph-view';
import { SubjectGlyphComponent } from './subject-glyph.component';
import { SUBJECT_GLYPHS } from './subject-glyphs';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const A_MOVING_SUBJECT: SubjectEntryId = 'world:world_clock';
const A_DETAILED_SUBJECT: SubjectEntryId = 'stage:prokaryote';

function mount(entryId: SubjectEntryId, lod: GlyphLod = GLYPH_LOD.card): SVGSVGElement {
  const fixture = TestBed.createComponent(SubjectGlyphComponent);
  fixture.componentRef.setInput('entryId', entryId);
  fixture.componentRef.setInput('lod', lod);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('svg')!;
}

describe('SubjectGlyphComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SubjectGlyphComponent] });
  });

  it('draws the frame and every layer of the subject as SVG paths, tagged with the entry', () => {
    const svg = mount('zone:warm_vent');
    const paths = [...svg.querySelectorAll('path')];
    expect(svg.parentElement?.getAttribute('data-entry-id')).toBe('zone:warm_vent');
    expect(paths).toHaveLength(GLYPH_FRAME_LAYERS.length + SUBJECT_GLYPHS['zone:warm_vent'].layers.length);
    expect(paths.every((element) => element.namespaceURI === SVG_NAMESPACE)).toBe(true);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('resolves every gradient fill to a def inside its own drawing, never another glyph’s', () => {
    const first = mount('concept:food');
    const second = mount('concept:food');
    const idsOf = (svg: SVGSVGElement): string[] =>
      [...svg.querySelectorAll('radialGradient')].map((gradient) => gradient.id);
    expect(idsOf(first).filter((id) => idsOf(second).includes(id))).toEqual([]);
    const references = [...first.querySelectorAll('path')]
      .map((element) => element.getAttribute('fill') ?? '')
      .filter((fill) => fill.startsWith('url(#'))
      .map((fill) => fill.slice('url(#'.length, -1));
    expect(references.every((id) => idsOf(first).includes(id))).toBe(true);
  });

  it('animates the moving layers with their period and pivot', () => {
    const moving = mount(A_MOVING_SUBJECT).querySelector<SVGPathElement>('path.motion-spin');
    expect(moving).not.toBeNull();
    expect(moving!.style.transformOrigin).toBe('50px 50px');
  });

  it('publishes the idle amplitudes on its host for the keyframes to read', () => {
    const host = mount('world:bloom').parentElement as HTMLElement;
    for (const [name, value] of Object.entries(glyphMotionVariables())) {
      expect(host.style.getPropertyValue(name)).toBe(value);
    }
  });

  it('drops every idle loop when still, and keeps the same drawing', () => {
    const moving = mount(A_MOVING_SUBJECT);
    const fixture = TestBed.createComponent(SubjectGlyphComponent);
    fixture.componentRef.setInput('entryId', A_MOVING_SUBJECT);
    fixture.componentRef.setInput('still', true);
    fixture.detectChanges();
    const still = (fixture.nativeElement as HTMLElement).querySelector('svg')!;
    expect(moving.querySelectorAll('path.motion').length).toBeGreaterThan(0);
    expect(still.querySelectorAll('path.motion')).toHaveLength(0);
    expect(still.getAttribute('data-still')).toBe('true');
    expect(still.querySelectorAll('path')).toHaveLength(moving.querySelectorAll('path').length);
  });

  it('draws fewer paths at the list LOD, one fewer per detail layer', () => {
    const detailCount = SUBJECT_GLYPHS[A_DETAILED_SUBJECT].layers.filter(
      (layer) => layer.role === GLYPH_ROLE.detail,
    ).length;
    expect(detailCount).toBeGreaterThan(0);
    const full = mount(A_DETAILED_SUBJECT).querySelectorAll('path').length;
    const list = mount(A_DETAILED_SUBJECT, GLYPH_LOD.list);
    expect(list.getAttribute('data-lod')).toBe('list');
    expect(list.querySelectorAll('path')).toHaveLength(full - detailCount);
  });

  it('defaults to the card LOD, the size a tile and an entry header draw at', () => {
    const fixture = TestBed.createComponent(SubjectGlyphComponent);
    fixture.componentRef.setInput('entryId', 'cell_kind:player');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('svg')!.getAttribute('data-lod')).toBe(GLYPH_LOD.card);
  });
});
