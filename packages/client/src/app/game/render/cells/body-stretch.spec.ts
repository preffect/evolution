// @vitest-environment node
// The stretch a body wears (#195): every form stretches with its speed and its sprint but the rigid diatom valve, which
// keeps its circle flat out and sprinting, down to the speed ratio the shader stretches by.

import { CELL_STAGE, type TraitId } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { createTestCellView } from '../../../../testing/builders';
import { SPRINT_STRETCH_SCALE, STRETCH_ALONG } from '../constants';
import { bodyStretchTerm, peakStretchRadii, stretchTerm } from './body-stretch';
import { REST_DEFORMATION } from './cell-deformation';
import { buildCellInstance } from './cell-instance-builder';
import { cellLodFor } from './cell-lod';
import { summariseCellTraits } from './cell-traits';
import { formFor } from './forms/form-profiles';
import { buildShapeTerms } from './shape-terms';
import { REST_OWN_CELL_RING } from './self-ring';
import { RELATION_RING } from '../../hud/format/relations-for';

/** A cell of one form swimming flat out in a sprint: its terms and the instance row the shader reads. */
function sprinting(traitId: TraitId) {
  const view = createTestCellView({
    radius: 40,
    stage: CELL_STAGE.specialised,
    sprintRemainingTicks: 5,
    traits: [{ traitId, tier: 1 }],
  });
  const traits = summariseCellTraits(view);
  const terms = buildShapeTerms({
    view,
    traits,
    timeSeconds: 0,
    speedRatio: 1,
    heading: 0,
    phase: 0,
    stripRow: 0,
    strip: null,
    deformation: REST_DEFORMATION,
  });
  const instance = buildCellInstance({
    view,
    traits,
    terms,
    lod: cellLodFor(view.radius),
    nucleusOffset: { x: 0, y: 0 },
    isOwn: false,
    cosmetic: { stripRow: 0, phase: 0, speckleSeed: 0 },
    alpha: 1,
    warningRingPx: 0,
    ciliaPhase: 0,
    rimDash: 0,
    ownCellRing: REST_OWN_CELL_RING,
    relationRing: RELATION_RING.none,
    wither: 0,
  });
  return { terms, instance };
}

describe('the body stretch', () => {
  it('stretches every form but a rigid one with its speed and its sprint', () => {
    expect(bodyStretchTerm(formFor('amoeba_pseudopods'), 1, true)).toEqual(stretchTerm(1, true));
    expect(bodyStretchTerm(formFor(null), 0.5, false)).toEqual(stretchTerm(0.5, false));
    expect(bodyStretchTerm(formFor('diatom_shell'), 1, true)).toEqual(stretchTerm(0, false));
    expect(peakStretchRadii(formFor('diatom_shell'), 1, true)).toBe(1);
    expect(peakStretchRadii(formFor('paramecium_cilia'), 1, true)).toBeCloseTo(
      STRETCH_ALONG * SPRINT_STRETCH_SCALE,
      12,
    );
  });

  /** The shader stretches by the instance's speed ratio and axial scales: the terms', so the valve swims unstretched. */
  it('keeps a diatom valve round flat out and sprinting, down to the instance row', () => {
    const diatom = sprinting('diatom_shell');
    expect(diatom.terms.stretch).toMatchObject({ k: 0, axialAlong: 1, axialAcross: 1 });
    expect(diatom.instance).toMatchObject({ speedRatio: 0, axialAlong: 1, axialAcross: 1 });
    const slipper = sprinting('paramecium_cilia');
    expect(slipper.terms.stretch).toMatchObject({ k: 1, axialAlong: SPRINT_STRETCH_SCALE });
    expect(slipper.instance).toMatchObject({ speedRatio: 1, axialAlong: SPRINT_STRETCH_SCALE });
  });
});
