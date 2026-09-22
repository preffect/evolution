// The two-cell action scenes (docs/architecture/encyclopedia.md §12.7, §12.9, ticket #364): `engulf` and
// `escape`. The framing bands are `preview-framing.spec.ts` and the loop's own rules `preview-loop.spec.ts`; what
// is here is what the pair promises that the shared machinery cannot — that its phases are the balance's, that
// its effects land where the server's do and on the tick the bodies change, and that the escape is an escape.

import {
  CELL_STATE,
  DEFAULT_BALANCE,
  EFFECT_KIND,
  ENGULF_PHASE,
  ENGULF_RELEASE_REASON,
  MILLISECONDS_PER_SECOND,
  MOTION_CLIP,
  MOTION_CLIPS,
  TICK_INTERVAL_S,
  canEngulf,
  engulfBaseRatePerTick,
  engulfPhaseOf,
  engulfPhaseSpanSeconds,
  type BalanceConfig,
  type CellView,
  type GameEffect,
} from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { previewSceneFor, type PreviewScene, type PreviewSceneFrame } from '../preview-scene';
import { PREVIEW_SCENE, type PreviewSpec } from '../preview-spec';
import { ACTION_SUBJECT_CELL_ID } from './action-subject';
import { ENGULF_PARTNER_CELL_ID, ENGULF_PARTNER_NAME, engulfSpanSeconds } from './engulf-pair';

const BALANCE = DEFAULT_BALANCE;
const ENGULF: PreviewSpec = { scene: PREVIEW_SCENE.engulf };
const ESCAPE: PreviewSpec = { scene: PREVIEW_SCENE.escape };
const PLACEMENT_TOLERANCE = 1e-6;

/** Every whole tick strictly inside one loop, as the session walks it, with the effects of each step. */
function walkOneLoop(
  scene: PreviewScene,
  balance: BalanceConfig = BALANCE,
): { tick: number; frame: PreviewSceneFrame }[] {
  const period = scene.periodTicks(balance);
  const frames = [];
  let previousTick = 0;
  for (let tick = 0; tick < period; tick += 1) {
    frames.push({ tick, frame: scene.frameAt(tick, previousTick, balance) });
    previousTick = tick;
  }
  return frames;
}

function cellIn(frame: PreviewSceneFrame, id: string): CellView | undefined {
  return frame.cells.find((cell) => cell.id === id);
}

/** How far an effect landed from a cell's centre; a world-level effect has no position to measure. */
function distanceFromEffect(effect: GameEffect, cell: CellView): number {
  if (!('x' in effect)) throw new Error(`${effect.kind} carries no position`);
  return Math.hypot(effect.x - cell.x, effect.y - cell.y);
}

function firstEffectOf(scene: PreviewScene, kind: GameEffect['kind'], balance: BalanceConfig = BALANCE) {
  for (const { tick, frame } of walkOneLoop(scene, balance)) {
    const effect = frame.effects.find((one) => one.kind === kind);
    if (effect !== undefined) return { tick, effect };
  }
  return null;
}

/** The first tick at which the prey reads as held, and the prey's progress at every tick after it. */
function contactTickOf(scene: PreviewScene, preyId: string, balance: BalanceConfig = BALANCE): number {
  const first = walkOneLoop(scene, balance).find(
    ({ frame }) => cellIn(frame, preyId)?.states.includes(CELL_STATE.beingEngulfed) === true,
  );
  expect(first, 'the pair never made contact').toBeDefined();
  return first!.tick;
}

/** One absorption row retuned as `debug_set_balance` hands it over; assigned, since the naming lint reads `ENGULF_*` literal keys as misnamed. */
function withAbsorption(key: 'ENGULF_BASE_DURATION_SECONDS' | 'ENGULF_SEAL_PROGRESS', value: number): BalanceConfig {
  const absorption = { ...BALANCE.absorption };
  absorption[key] = value;
  return { ...BALANCE, absorption };
}

describe('both two-cell scenes', () => {
  const scenes = [
    { name: PREVIEW_SCENE.engulf, spec: ENGULF, predatorId: ACTION_SUBJECT_CELL_ID, preyId: ENGULF_PARTNER_CELL_ID },
    { name: PREVIEW_SCENE.escape, spec: ESCAPE, predatorId: ENGULF_PARTNER_CELL_ID, preyId: ACTION_SUBJECT_CELL_ID },
  ];

  /**
   * Staged so the shared `canEngulf` — the server's, the HUD chip's and the warning ring's — says yes and no
   * further: at exactly the required ratio `engulfMassFactor` is 1, so the phase spans are the simulation's own.
   */
  it('stages a pair the shared predicate lets engulf, at exactly the required ratio', () => {
    for (const { name, spec, predatorId, preyId } of scenes) {
      const frame = previewSceneFor(spec).frameAt(0, 0, BALANCE);
      const predator = cellIn(frame, predatorId);
      const prey = cellIn(frame, preyId);
      expect(predator, `${name}: no predator`).toBeDefined();
      expect(prey, `${name}: no prey`).toBeDefined();
      expect(canEngulf(predator!, prey!, BALANCE.absorption), `${name}: the predator cannot engulf`).toBe(true);
      expect(canEngulf(prey!, predator!, BALANCE.absorption), `${name}: the prey could engulf back`).toBe(false);
      // The scene's pace, contact to payout, is exactly what the simulation's rate gives this pair.
      const payoutTicks = engulfSpanSeconds(BALANCE) / TICK_INTERVAL_S;
      expect(engulfBaseRatePerTick(predator!.mass, prey!.mass, BALANCE.absorption) * payoutTicks).toBeCloseTo(1, 9);
    }
  });

  /** §12.7: the camera follows the subject, and the subject is a different side of the engulf in each scene. */
  it('follows its subject, the predator in engulf and the prey in escape', () => {
    for (const { name, spec, predatorId, preyId } of scenes) {
      const scene = previewSceneFor(spec);
      const frame = scene.frameAt(0, 0, BALANCE);
      const subjectId = name === PREVIEW_SCENE.engulf ? predatorId : preyId;
      expect(cellIn(frame, subjectId)?.playerId, name).toBe(scene.subjectPlayerId);
    }
  });

  /**
   * The ticket's acceptance: contact to the seal takes exactly the cover and wrap spans, and a patched base duration
   * or seal moves that boundary — which separates "follows the balance" from "a constant happens to agree".
   */
  it('reaches the seal exactly the cover and wrap spans after contact, and follows a patched base and seal', () => {
    const balances = [
      BALANCE,
      withAbsorption('ENGULF_BASE_DURATION_SECONDS', BALANCE.absorption.ENGULF_BASE_DURATION_SECONDS * 1.5),
      withAbsorption('ENGULF_SEAL_PROGRESS', 0.75),
    ];
    for (const { name, spec, preyId } of scenes) {
      for (const balance of balances) {
        const scene = previewSceneFor(spec);
        const contactTick = contactTickOf(scene, preyId, balance);
        const sealSeconds =
          engulfPhaseSpanSeconds(ENGULF_PHASE.cover, balance.absorption) +
          engulfPhaseSpanSeconds(ENGULF_PHASE.wrap, balance.absorption);
        const phaseAt = (secondsAfterContact: number) => {
          const frame = scene.frameAt(contactTick + secondsAfterContact / TICK_INTERVAL_S, 0, balance);
          const prey = cellIn(frame, preyId);
          expect(prey?.states, `${name}: the prey is not held ${secondsAfterContact} s after contact`).toContain(
            CELL_STATE.beingEngulfed,
          );
          return engulfPhaseOf(prey!.engulfProgress, balance.absorption);
        };
        expect(phaseAt(0), `${name}: contact is not cover`).toBe(ENGULF_PHASE.cover);
        const wrapStartSeconds = engulfPhaseSpanSeconds(ENGULF_PHASE.cover, balance.absorption);
        expect(phaseAt(wrapStartSeconds - TICK_INTERVAL_S), `${name}: wrap came early`).toBe(ENGULF_PHASE.cover);
        expect(phaseAt(wrapStartSeconds), `${name}: wrap came late`).toBe(ENGULF_PHASE.wrap);
        // The escape lets go halfway through the wrap, so only the engulf reaches the seal.
        if (name === PREVIEW_SCENE.engulf) {
          expect(phaseAt(sealSeconds - TICK_INTERVAL_S), `${name}: sealed early`).toBe(ENGULF_PHASE.wrap);
          expect(phaseAt(sealSeconds), `${name}: sealed late`).toBe(ENGULF_PHASE.absorb);
        }
      }
    }
  });
});

describe('the engulf scene', () => {
  /**
   * The payout at the prey (`engulf-payout.ts`), the prey drawn through that tick and gone after it: the ghost is
   * built from its last drawn frame, so gone early there is nothing to dissolve and late it is drawn twice.
   */
  it('emits cell_absorbed at the prey on the last tick the prey is drawn', () => {
    const scene = previewSceneFor(ENGULF);
    const absorbed = firstEffectOf(scene, EFFECT_KIND.cellAbsorbed);
    expect(absorbed).not.toBeNull();
    const { tick, effect } = absorbed!;
    const lastAlive = cellIn(scene.frameAt(tick, tick - 1, BALANCE), ENGULF_PARTNER_CELL_ID);
    expect(lastAlive, 'the prey was gone before its payout').toBeDefined();
    expect(distanceFromEffect(effect, lastAlive!)).toBeLessThan(PLACEMENT_TOLERANCE);
    expect(lastAlive!.engulfProgress).toBeCloseTo(1, 9);
    expect(
      cellIn(scene.frameAt(tick + 1, tick, BALANCE), ENGULF_PARTNER_CELL_ID),
      'the prey outlived its payout',
    ).toBeUndefined();
    expect(effect.kind === EFFECT_KIND.cellAbsorbed && effect.predatorCellId).toBe(
      cellIn(scene.frameAt(0, 0, BALANCE), ACTION_SUBJECT_CELL_ID)?.id,
    );
  });

  /**
   * §12.7: the prey reappears **with the same id** after a `respawn`, once the `absorbed` clip has ended, so its
   * look is identical every loop — and the respawn clip has a cell to play on the frame its effect arrives.
   */
  it('respawns the prey with its id, at the respawn effect, once the absorbed clip has ended', () => {
    const scene = previewSceneFor(ENGULF);
    const absorbed = firstEffectOf(scene, EFFECT_KIND.cellAbsorbed)!;
    const respawn = firstEffectOf(scene, EFFECT_KIND.respawn);
    expect(respawn).not.toBeNull();
    const ghostTicks = MOTION_CLIPS[MOTION_CLIP.absorbed].duration / MILLISECONDS_PER_SECOND / TICK_INTERVAL_S;
    expect(respawn!.tick - absorbed.tick).toBeGreaterThanOrEqual(ghostTicks);
    expect(
      cellIn(scene.frameAt(respawn!.tick - 1, respawn!.tick - 2, BALANCE), ENGULF_PARTNER_CELL_ID),
    ).toBeUndefined();
    const returned = cellIn(scene.frameAt(respawn!.tick, respawn!.tick - 1, BALANCE), ENGULF_PARTNER_CELL_ID);
    expect(returned, 'the prey did not return on its respawn tick').toBeDefined();
    expect(returned!.states).toEqual([CELL_STATE.free]);
    expect(respawn!.effect.kind === EFFECT_KIND.respawn && respawn!.effect.cellId).toBe(returned!.id);
    expect(distanceFromEffect(respawn!.effect, returned!)).toBeLessThan(PLACEMENT_TOLERANCE);
    // The loop must outlast the respawn clip, which is not interruptible.
    const respawnTicks = MOTION_CLIPS[MOTION_CLIP.respawn].duration / MILLISECONDS_PER_SECOND / TICK_INTERVAL_S;
    expect(MOTION_CLIPS[MOTION_CLIP.respawn].isInterruptible).toBe(false);
    expect(scene.periodTicks(BALANCE)).toBeGreaterThan(respawn!.tick + respawnTicks);
  });

  /** The two halves name each other while held, and neither names anyone once the prey is gone. */
  it('links predator and prey while the engulf runs, and frees the predator at the payout', () => {
    const scene = previewSceneFor(ENGULF);
    const contactTick = contactTickOf(scene, ENGULF_PARTNER_CELL_ID);
    const held = scene.frameAt(contactTick + 1, contactTick, BALANCE);
    expect(cellIn(held, ACTION_SUBJECT_CELL_ID)?.engulfingCellId).toBe(cellIn(held, ENGULF_PARTNER_CELL_ID)?.id);
    expect(cellIn(held, ENGULF_PARTNER_CELL_ID)?.engulfedByCellId).toBe(cellIn(held, ACTION_SUBJECT_CELL_ID)?.id);
    const absorbed = firstEffectOf(scene, EFFECT_KIND.cellAbsorbed)!;
    const after = cellIn(scene.frameAt(absorbed.tick + 1, absorbed.tick, BALANCE), ACTION_SUBJECT_CELL_ID);
    expect(after?.states).toEqual([CELL_STATE.free]);
    expect(after?.engulfingCellId).toBeNull();
  });
});

describe('the escape scene', () => {
  /** `cell_released`, reason `escaped`, at the prey (`engulf-state.ts`), out of the wrap band and never the seal. */
  it('releases the prey as escaped, at the prey, before the seal', () => {
    const scene = previewSceneFor(ESCAPE);
    const released = firstEffectOf(scene, EFFECT_KIND.cellReleased);
    expect(released).not.toBeNull();
    const { tick, effect } = released!;
    expect(effect.kind === EFFECT_KIND.cellReleased && effect.reason).toBe(ENGULF_RELEASE_REASON.escaped);
    const preyBefore = cellIn(scene.frameAt(tick - 1, tick - 2, BALANCE), ACTION_SUBJECT_CELL_ID)!;
    expect(preyBefore.states).toContain(CELL_STATE.beingEngulfed);
    expect(engulfPhaseOf(preyBefore.engulfProgress, BALANCE.absorption)).toBe(ENGULF_PHASE.wrap);
    const preyAfter = cellIn(scene.frameAt(tick, tick - 1, BALANCE), ACTION_SUBJECT_CELL_ID)!;
    expect(preyAfter.states).toEqual([CELL_STATE.free]);
    expect(distanceFromEffect(effect, preyAfter)).toBeLessThan(PLACEMENT_TOLERANCE);
    for (const { frame } of walkOneLoop(scene)) {
      const prey = cellIn(frame, ACTION_SUBJECT_CELL_ID)!;
      expect(engulfPhaseOf(prey.engulfProgress, BALANCE.absorption), 'the escape reached the seal').not.toBe(
        ENGULF_PHASE.absorb,
      );
    }
    expect(firstEffectOf(scene, EFFECT_KIND.cellAbsorbed), 'an escape must not pay out').toBeNull();
  });

  /** The decay is the simulation's: progress falls while the prey sprints, and the arms play backwards with it. */
  it('sprints out of the wrap and lets progress decay to the release', () => {
    const scene = previewSceneFor(ESCAPE);
    const released = firstEffectOf(scene, EFFECT_KIND.cellReleased)!;
    const frames = walkOneLoop(scene).filter(({ tick }) => tick < released.tick);
    const sprinting = frames.filter(
      ({ frame }) => (cellIn(frame, ACTION_SUBJECT_CELL_ID)?.sprintRemainingTicks ?? 0) > 0,
    );
    expect(sprinting.length, 'the prey never sprinted').toBeGreaterThan(0);
    const progressWhileSprinting = sprinting.map(({ frame }) => cellIn(frame, ACTION_SUBJECT_CELL_ID)!.engulfProgress);
    for (let index = 1; index < progressWhileSprinting.length; index += 1) {
      expect(progressWhileSprinting[index]!, `tick ${sprinting[index]!.tick}`).toBeLessThan(
        progressWhileSprinting[index - 1]!,
      );
    }
    // The pair parts: the predator is further from the prey at the release than when the sprint began.
    const distanceAt = (tick: number) => {
      const frame = scene.frameAt(tick, tick - 1, BALANCE);
      const prey = cellIn(frame, ACTION_SUBJECT_CELL_ID)!;
      const predator = cellIn(frame, ENGULF_PARTNER_CELL_ID)!;
      return Math.hypot(predator.x - prey.x, predator.y - prey.y);
    };
    expect(distanceAt(released.tick)).toBeGreaterThan(distanceAt(sprinting[0]!.tick));
    // And it closes its loop: the predator is back where it started before the next approach.
    expect(distanceAt(scene.periodTicks(BALANCE))).toBeCloseTo(distanceAt(0), 6);
  });

  /**
   * The record, not the view (PR #500 review): before contact the predator is the nearest threat under the HUD's
   * own predicate; while held the record swaps the label for the escape window, draining toward the seal.
   */
  it('supplies the HUD record: the predator as the threat, then the escape window', () => {
    const scene = previewSceneFor(ESCAPE);
    const approaching = scene.frameAt(0, 0, BALANCE);
    const before = scene.ownCellIndicators(approaching, BALANCE);
    expect(before).not.toBeNull();
    expect(before!.escape).toBeNull();
    expect(before!.nearestThreat?.cellId).toBe(cellIn(approaching, ENGULF_PARTNER_CELL_ID)?.id);
    expect(before!.nearestThreat?.label).toBe(`${ENGULF_PARTNER_NAME} can engulf you`);

    const contactTick = contactTickOf(scene, ACTION_SUBJECT_CELL_ID);
    const held = scene.frameAt(contactTick + 1, contactTick, BALANCE);
    const during = scene.ownCellIndicators(held, BALANCE)!;
    expect(during.nearestThreat).toBeNull();
    expect(during.escape?.predatorCellId).toBe(cellIn(held, ENGULF_PARTNER_CELL_ID)?.id);
    expect(during.escape?.phase).toBe(ENGULF_PHASE.cover);
    expect(during.escape?.fill).toBeLessThan(1);
    expect(during.escape?.fill).toBeGreaterThan(0);
  });
});
