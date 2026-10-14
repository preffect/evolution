// The instance builder's input for a spec (docs/TESTING.md, the `src/testing/` builders): a 40 px prokaryote at rest
// in seat 2, every field overridable, so a spec names only what it is about.

import { CELL_STAGE } from '@evolution/shared';
import { RELATION_RING } from '../app/game/hud/format/relations-for';
import { REST_DEFORMATION } from '../app/game/render/cells/cell-deformation';
import type { CellInstanceInput } from '../app/game/render/cells/cell-instance-builder';
import { cellLodFor } from '../app/game/render/cells/cell-lod';
import { summariseCellTraits } from '../app/game/render/cells/cell-traits';
import { REST_OWN_CELL_RING } from '../app/game/render/cells/self-ring';
import { buildShapeTerms } from '../app/game/render/cells/shape-terms';
import { createTestCellView } from './builders';

export function createTestCellInstanceInput(overrides: Partial<CellInstanceInput> = {}): CellInstanceInput {
  const view = createTestCellView({ x: 5, y: 6, radius: 40, avatarIndex: 2, stage: CELL_STAGE.prokaryote });
  const traits = summariseCellTraits(view);
  const terms = buildShapeTerms({
    view,
    traits,
    timeSeconds: 0,
    speedRatio: 0,
    heading: 0,
    phase: 0,
    stripRow: 2,
    strip: null,
    deformation: REST_DEFORMATION,
    wither: 0,
  });
  return {
    view,
    traits,
    terms,
    lod: cellLodFor(40),
    nucleusOffset: { x: -0.1, y: -0.1 },
    isOwn: false,
    cosmetic: { stripRow: 2, phase: 0.25, speckleSeed: 0.6 },
    alpha: 1,
    warningRingPx: 0,
    ciliaPhase: 0.3,
    rimDash: 0,
    ownCellRing: REST_OWN_CELL_RING,
    relationRing: RELATION_RING.none,
    wither: 0,
    ...overrides,
  };
}
