// @vitest-environment node
// What each form's appendages add to a reach (§5.1 rule 5): the paramecium's tufts, the euglena's whip, the diatom's
// spines, nothing else.

import { describe, expect, it } from 'vitest';
import { GIANT_SPECIES } from '@evolution/shared';
import { reachWithFormAppendages } from './appendage-reach';
import { spineDrawnReachRadii } from './diatom-spines';
import { flagellumDrawnReachRadii } from './euglena-flagellum';
import { formFor } from './form-profiles';
import { reachWithCiliaTufts } from './paramecium-cilia';

/** A player's cell of the form `traitId` decides. */
const player = (traitId: Parameters<typeof formFor>[0]) => ({ form: formFor(traitId), giantSpecies: null });

describe('reachWithFormAppendages', () => {
  it('passes a reach through for a form without a drawn appendage', () => {
    expect(reachWithFormAppendages(player(null), 1.4, 1)).toBe(1.4);
    expect(reachWithFormAppendages(player('amoeba_pseudopods'), 1.4, 1)).toBe(1.4);
  });

  it('adds the paramecium’s tufts, the euglena’s whip and the diatom’s spines', () => {
    expect(reachWithFormAppendages(player('paramecium_cilia'), 1.4, 1.2)).toBe(
      reachWithCiliaTufts(player('paramecium_cilia'), 1.4, 1.2),
    );
    expect(reachWithFormAppendages(player('euglena_eyespot'), 1.4, 1.9)).toBe(
      flagellumDrawnReachRadii(formFor('euglena_eyespot'), 1.9),
    );
    expect(reachWithFormAppendages(player('diatom_shell'), 1.4, 1)).toBe(
      spineDrawnReachRadii(formFor('diatom_shell'), 1),
    );
  });

  it('adds no tufts to the giant paramecium, whose fringe is its fine cilia hairs (#828)', () => {
    const giant = { form: formFor('paramecium_cilia'), giantSpecies: GIANT_SPECIES.paramecium };
    expect(reachWithFormAppendages(giant, 1.4, 1.2)).toBe(1.4);
    expect(reachWithFormAppendages(player('paramecium_cilia'), 1.4, 1.2)).toBeGreaterThan(1.4);
  });
});
