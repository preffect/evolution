// Where the amoeba's fan points and how far it flanks (docs/rendering/cells.md §2.1, docs/visual-style/
// motion-and-legibility.md §5.1): the resolved heading at the speed's lean when nothing is held, and the prey's angle at
// `PSEUDOPOD_ENGULF_LEAN` at least while engulfing. The engulf grip (#768) turns it between the two over
// `PSEUDOPOD_GRIP_EASE_MS`, so at the grab, when the engulf ends and when the prey changes the whole fan swings with
// the held arm rather than re-aiming in one frame (#771). Through an ease it keeps turning the way it started, even when
// the prey crosses the line behind the heading (`FanTurnMemory`): a prey dragged behind a swimming amoeba sits there.

import { PSEUDOPOD_ENGULF_LEAN, PSEUDOPOD_LEAN_GAIN } from '../../constants';
import { angleNear, wrapAngle } from '../../geometry';
import { FULL_GRIP_SHARE, NO_GRIP_SHARE, type ArmGrip, type CellDeformation } from '../cell-deformation';
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
  const turn = grip.turn ?? wrapAngle(grip.angle - heading);
  return {
    aim: heading + turn * grip.share,
    lean: easedLean(speedRatio, grip.share),
    grip: { angle: heading + turn, share: grip.share },
  };
}

/**
 * One cell's fan turn across frames: the short way to the prey whenever the fan is all the way on the heading or on the
 * prey, and otherwise the way round nearest the last frame's, so a heading that wobbles across the line behind the prey
 * never flips the fan a half turn mid-ease (#771).
 */
export class FanTurnMemory {
  private turn = 0;

  /** The deformation with its grip's turn from `heading` fixed; a record without a grip passes through. */
  apply(heading: number, deformation: CellDeformation): CellDeformation {
    const grip = deformation.armGrip;
    if (grip === undefined) return deformation;
    const shortWay = wrapAngle(grip.angle - heading);
    const isEasing = grip.share > NO_GRIP_SHARE && grip.share < FULL_GRIP_SHARE;
    this.turn = isEasing ? angleNear(shortWay, this.turn) : shortWay;
    return { ...deformation, armGrip: { ...grip, turn: this.turn } };
  }
}
