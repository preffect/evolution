// The slime's still pictures as Canvas 2D draws them (docs/rendering/opening-dive.md §4, ticket #803): the glass's
// lines never under 1.1 css px and its gradients the mockup's; each diatom's and each plankton body's details switched
// on at the size the mockup gave them, and their glass brighter in the dark field; the rods banded only when green;
// recorded on a fake context.

import { describe, expect, it } from 'vitest';
import { SLIME_ROD_KINDS, SLIME_MOTE_KINDS } from '../../constants/dive-slime-bacteria';
import { SLIME_LINE_MIN_PX, SLIME_PENNATE } from '../../constants/dive-slime-diatoms';
import { FakeShoreContext } from '../../../../../testing/fake-shore-canvas';
import { drawMote, drawRod } from './slime-bacteria-art';
import { drawCocconeis, drawLicmophora, drawPennate } from './slime-diatom-art';
import { bodyGradient, drawGlint, drawGlow, lineWidth, rimGradient, unitsOfPx } from './slime-glass';
import { drawCiliateBody, drawCiliateRim, drawDinoBody, drawDinoRim, drawNaupliusBody } from './slime-plankton-art';

const context = () => new FakeShoreContext(64, 64);
const count = (ops: readonly string[], name: string): number => ops.filter((entry) => entry === name).length;

describe('the glass', () => {
  it('never strokes thinner than 1.1 css px, in the object’s unit', () => {
    expect(unitsOfPx({ unitPx: 20 }, 10)).toBe(0.5);
    expect(lineWidth({ unitPx: 10 }, 0.01)).toBeCloseTo(SLIME_LINE_MIN_PX / 10, 12);
    expect(lineWidth({ unitPx: 1000 }, 0.01)).toBe(0.01);
  });

  it('lights the rim white at the top-left and the body from the top-left, at the body’s alpha', () => {
    const fake = context();
    const rim = rimGradient(fake, { x: 0, y: 0, radius: 1 }, '#ffffff', '#000000');
    const body = bodyGradient(
      fake,
      { x: 0, y: 0, radius: 1 },
      { light: '#ff0000', base: '#00ff00', dark: '#0000ff', alpha: 0.5 },
    );
    const [recordedRim, recordedBody] = fake.gradients;
    expect(recordedRim).toBe(rim);
    expect(recordedRim!.geometry).toEqual([-1, -1, 1, 1]);
    expect(recordedRim!.stops.map((stop) => stop.offset)).toEqual([0, 0.35, 0.72, 1]);
    expect(recordedBody).toBe(body);
    expect(recordedBody!.kind).toBe('radial');
    expect(recordedBody!.stops.at(-1)!.colour).toBe('rgba(0, 0, 255, 0.45)');
  });

  it('draws a glint as a disc, and a glow only when it shows', () => {
    const fake = context();
    drawGlint(fake, 0, 0, 1);
    drawGlow(fake, { x: 0, y: 0, radius: 1 }, '#ffffff', 0);
    expect(count(fake.ops, 'fill')).toBe(1);
    drawGlow(fake, { x: 0, y: 0, radius: 1 }, '#ffffff', 0.5);
    expect(count(fake.ops, 'fillRect')).toBe(1);
  });
});

describe('the diatoms', () => {
  it('scores a pennate with striae, plastids, raphe and glint only once it is big enough for each', () => {
    const small = context();
    drawPennate({ context: small, unitPx: 10 }, 0);
    const big = context();
    drawPennate({ context: big, unitPx: 400 }, 0);
    expect(count(small.ops, 'clip')).toBe(0);
    expect(count(big.ops, 'clip')).toBe(1);
    expect(count(big.ops, 'ellipse')).toBeGreaterThan(count(small.ops, 'ellipse'));
    expect(big.gradients.length).toBeGreaterThan(small.gradients.length);
  });

  it('makes a pennate’s glass show more in the dark field', () => {
    const bright = context();
    drawPennate({ context: bright, unitPx: 10 }, 0);
    const dark = context();
    drawPennate({ context: dark, unitPx: 10 }, 1);
    const fillAlpha = (fake: FakeShoreContext): string => String(fake.fillStyle);
    expect(fillAlpha(bright)).not.toBe(fillAlpha(dark));
    expect(SLIME_PENNATE.fill.darkField).toBeGreaterThan(0);
  });

  it('rays a cocconeis and fans a licmophora’s five wedges', () => {
    const cocconeis = context();
    drawCocconeis({ context: cocconeis, unitPx: 100 }, 0);
    expect(count(cocconeis.ops, 'clip')).toBe(1);
    const licmophora = context();
    drawLicmophora({ context: licmophora, unitPx: 100 });
    expect(count(licmophora.ops, 'rotate')).toBe(5);
    expect(count(licmophora.ops, 'quadraticCurveTo')).toBe(5);
  });
});

describe('the plankton’s still layers', () => {
  it('draws the larva’s body, its lipids, its eye and, once big enough, its glint', () => {
    const small = context();
    drawNaupliusBody({ context: small, unitPx: 10 }, 0);
    const big = context();
    drawNaupliusBody({ context: big, unitPx: 100 }, 0);
    expect(count(small.ops, 'bezierCurveTo')).toBe(4);
    expect(big.gradients.length).toBe(small.gradients.length + 1);
  });

  it('draws the ciliate’s macronucleus dashed, then solid again, and its rim over it', () => {
    const body = context();
    drawCiliateBody({ context: body, unitPx: 100 }, 0);
    const dashes = body.calls.filter((call) => call.name === 'setLineDash');
    expect(dashes.map((call) => call.args.length)).toEqual([2, 0]);
    const rim = context();
    drawCiliateRim({ context: rim, unitPx: 100 });
    expect(count(rim.ops, 'stroke')).toBe(1);
  });

  it('plates the dinoflagellate only once it is big enough, and girdles it always', () => {
    const small = context();
    drawDinoBody({ context: small, unitPx: 10 }, 0);
    const big = context();
    drawDinoBody({ context: big, unitPx: 100 }, 0);
    expect(count(small.ops, 'quadraticCurveTo')).toBe(1);
    expect(count(big.ops, 'stroke')).toBeGreaterThan(count(small.ops, 'stroke'));
    const rim = context();
    drawDinoRim({ context: rim, unitPx: 100 });
    expect(count(rim.ops, 'fill')).toBe(1);
  });
});

describe('the bacteria and specks', () => {
  it('bands only the green rod, and stretches its halo round it', () => {
    const plain = context();
    drawRod(plain, SLIME_ROD_KINDS[0]!);
    const green = context();
    drawRod(green, SLIME_ROD_KINDS[2]!);
    expect(count(green.ops, 'fillRect') - count(plain.ops, 'fillRect')).toBe(3);
    expect(count(plain.ops, 'scale')).toBe(1);
  });

  it('draws a lipid as a turned ellipse and algae as a disc', () => {
    const algae = context();
    drawMote(algae, SLIME_MOTE_KINDS[0]!);
    const lipid = context();
    drawMote(lipid, SLIME_MOTE_KINDS[1]!);
    expect(count(algae.ops, 'ellipse')).toBe(0);
    expect(count(lipid.ops, 'ellipse')).toBe(1);
  });
});
