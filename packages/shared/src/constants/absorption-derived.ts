// The engulf pace values derived from the three phase seconds (docs/ecology/absorption.md §6.1, docs/ecology/constants.md
// §7): the defaults' values, named for the docs and the ledger. They are not balance leaves, which is why they live
// outside `absorption.ts`, the module `DEFAULT_BALANCE.absorption` spreads (`DERIVED_BALANCE_CONSTANTS`, balance.ts):
// the simulation, the HUD and the renderer derive them from the room's phase seconds at read time, through the same
// functions, so a patched phase second is felt (#367).

import * as absorption from './absorption.js';
import { engulfBaseDurationSeconds, engulfSealProgress, engulfWrapStartProgress } from '../simulation/engulf-pace.js';

/** Duration at exactly the required ratio (s): the three phase seconds summed, exactly the documented 1.2. */
export const ENGULF_BASE_DURATION_SECONDS = engulfBaseDurationSeconds(absorption);
/** Progress bands: wrap starts here (1/6), the seal closes here (exactly 0.5). */
export const ENGULF_WRAP_START_PROGRESS = engulfWrapStartProgress(absorption);
export const ENGULF_SEAL_PROGRESS = engulfSealProgress(absorption);
