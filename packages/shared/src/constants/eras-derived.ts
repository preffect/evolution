// The eras' derived value (docs/game-design/phases.md §14.6.3, §14.14.1): the defaults' value, named for the docs and the
// ledger. It is not a balance leaf, which is why it lives outside `eras.ts`, the module `DEFAULT_BALANCE.eras` spreads
// (`DERIVED_BALANCE_CONSTANTS`, balance.ts): whatever reads the landmark's radius derives it from the room's
// `DISH_RADIUS` and `ERA_SCALE_STEP` through `eraLandmarkRadius`, so a patched leaf is felt.

import * as eras from './eras.js';
import * as world from './world.js';
import { eraLandmarkRadius } from '../simulation/era-scale.js';

/** The landmark rotifer's radius at the defaults (wu, pool): the footprint's, 300. */
export const ERA_LANDMARK_RADIUS = eraLandmarkRadius({ world, eras });
