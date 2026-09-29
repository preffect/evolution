// Where the amoeba's fan points and how far it flanks (docs/rendering/cells.md §2.1, docs/visual-style/
// motion-and-legibility.md §5.1): the resolved heading at the speed's lean when nothing is held, and the prey's angle at
// `PSEUDOPOD_ENGULF_LEAN` at least while engulfing. The engulf grip (#768) turns it between the two over
// `PSEUDOPOD_GRIP_EASE_MS`, so at the grab, when the engulf ends and when the prey changes the whole fan swings with
// the held arm rather than re-aiming in one frame (#771).

import { PSEUDOPOD_ENGULF_LEAN, PSEUDOPOD_LEAN_GAIN } from '../../constants';
import { wrapAngle } from '../../geometry';
import { FULL_GRIP_SHARE, type ArmGrip, type CellDeformation } from '../cell-deformation';
import { flankShare, type PseudopodInput } from './amoeba-pseudopods';

export type PseudopodFan = Pick<PseudopodInput, 'aim' | 'lean' | 'grip'>;

/** The grip the deformation carries; an engulfing record without one holds fully at the prey. */
function gripOf(deformation: CellDeformation): ArmGrip | undefined {
  if (deformation.armGrip !== undefined) return deformation.armGrip;
  return deformation.preyAngle === undefined ? undefined : { angle: deformation.preyAngle, share: FULL_GRIP_SHARE };
}

/**
 * The lean whose flank share lies `share` of the way from the speed's to the engulf's: the lobes reach the flanks well
 * before the lean does, so easing the flank share rather than the lean moves them there evenly over the whole ease.
 */
function easedLean(speedRatio: number, share: number): number {
  const engulfLean = Math.max(speedRatio, PSEUDOPOD_ENGULF_LEAN);
  const from = flankShare(speedRatio);
  const flank = from + (flankShare(engulfLean) - from) * share;
  return flank >= flankShare(engulfLean) ? engulfLean : flank / PSEUDOPOD_LEAN_GAIN;
}

/** The fan's aim and lean, turned from the heading and the speed toward the engulfed prey by the grip's share. */
export function pseudopodFan(heading: number, speedRatio: number, deformation: CellDeformation): PseudopodFan {
  const grip = gripOf(deformation);
  if (grip === undefined) return { aim: heading, lean: speedRatio };
  return {
    aim: wrapAngle(heading + wrapAngle(grip.angle - heading) * grip.share),
    lean: easedLean(speedRatio, grip.share),
    grip,
  };
}
