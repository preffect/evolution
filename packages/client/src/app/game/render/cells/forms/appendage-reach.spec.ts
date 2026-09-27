// @vitest-environment node
// What each form's appendages add to a reach (§5.1 rule 5): the paramecium's tufts, the euglena's whip, nothing else.

import { describe, expect, it } from 'vitest';
import { reachWithFormAppendages } from './appendage-reach';
import { flagellumDrawnReachRadii } from './euglena-flagellum';
import { formFor } from './form-profiles';
import { reachWithCiliaTufts } from './paramecium-cilia';

describe('reachWithFormAppendages', () => {
  it('passes a reach through for a form without a drawn appendage', () => {
    expect(reachWithFormAppendages(formFor(null), 1.4, 1)).toBe(1.4);
    expect(reachWithFormAppendages(formFor('diatom_shell'), 1.4, 1)).toBe(1.4);
  });

  it('adds the paramecium’s tufts and the euglena’s whip', () => {
    expect(reachWithFormAppendages(formFor('paramecium_cilia'), 1.4, 1.2)).toBe(
      reachWithCiliaTufts(formFor('paramecium_cilia'), 1.4, 1.2),
    );
    expect(reachWithFormAppendages(formFor('euglena_eyespot'), 1.4, 1.9)).toBe(
      flagellumDrawnReachRadii(formFor('euglena_eyespot'), 1.9),
    );
  });
});
