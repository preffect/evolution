// The single-cell action scenes (docs/architecture/encyclopedia.md §12.7, §12.9, ticket #364): `eat`, `sprint`
// and `level_up`. The framing bands are `preview-framing.spec.ts` and the loop's own rules are
// `preview-loop.spec.ts`; what is here is what each scene promises that the shared machinery cannot.

import {
  DEFAULT_BALANCE,
  EFFECT_KIND,
  MILLISECONDS_PER_SECOND,
  MOTION_CLIP,
  MOTION_CLIPS,
  TICK_INTERVAL_S,
  type BalanceConfig,
} from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { PREVIEW_LEVEL_UP_LEVEL, PREVIEW_UNUSED_LEVEL } from '../../constants';
import { previewSceneFor, type PreviewScene } from '../preview-scene';
import { PREVIEW_SCENE, type PreviewSpec } from '../preview-spec';

const BALANCE = DEFAULT_BALANCE;
const EAT: PreviewSpec = { scene: PREVIEW_SCENE.eat };
const SPRINT: PreviewSpec = { scene: PREVIEW_SCENE.sprint };
const LEVEL_UP: PreviewSpec = { scene: PREVIEW_SCENE.levelUp };

/** Every whole tick of one loop, plus the loop's last fractional tick. */
function loopTicks(scene: PreviewScene, balance: BalanceConfig = BALANCE): number[] {
  const period = scene.periodTicks(balance);
  return [...Array.from({ length: Math.ceil(period) }, (_unused, tick) => tick), period];
}

/** The scene walked one tick at a time, as the session walks it: every effect of the loop, in order. */
function effectsOverOneLoop(
  scene: PreviewScene,
  balance: BalanceConfig = BALANCE,
): ReturnType<PreviewScene['frameAt']>['effects'] {
  const collected = [];
  let previousTick = 0;
  for (const tick of loopTicks(scene, balance)) {
    collected.push(...scene.frameAt(tick, previousTick, balance).effects);
    previousTick = tick;
  }
  return collected;
}

describe('every action scene', () => {
  const scenes = [
    { name: PREVIEW_SCENE.eat, spec: EAT },
    { name: PREVIEW_SCENE.sprint, spec: SPRINT },
    { name: PREVIEW_SCENE.levelUp, spec: LEVEL_UP },
  ];

  /**
   * §12.7: an action scene follows its subject as `ownPlayerId`. That is not cosmetic — the sprint ring and the
   * warning ring are own-cell indicators, and they draw for that player and for nobody else, so a scene that
   * left this `null` would render the sprint scene without the ring it exists to show.
   */
  it('names its subject as the camera’s own player, so the own-cell rings draw', () => {
    for (const { name, spec } of scenes) {
      const scene = previewSceneFor(spec);
      expect(scene.subjectPlayerId, name).not.toBeNull();
      const [cell] = scene.frameAt(0, 0, BALANCE).cells;
      expect(cell?.playerId, `${name}: the subject cell is not the player the camera follows`).toBe(
        scene.subjectPlayerId,
      );
    }
  });

  /** §12.7: effects are emitted once per loop at monotonic ticks, so a clip never restarts mid-play. */
  it('emits each of its effects exactly once a loop', () => {
    for (const { name, spec } of scenes) {
      const scene = previewSceneFor(spec);
      const first = effectsOverOneLoop(scene);
      const kinds = first.map((effect) => effect.kind);
      expect(new Set(kinds).size, `${name} emitted the same kind twice in one loop`).toBe(kinds.length);
    }
  });

  /** A scene whose frame depends on anything but its tick would draw differently on two identical opens. */
  it('draws the same frame for the same tick', () => {
    for (const { name, spec } of scenes) {
      const first = previewSceneFor(spec).frameAt(41, 40, BALANCE);
      const second = previewSceneFor(spec).frameAt(41, 40, BALANCE);
      expect(second, name).toEqual(first);
    }
  });
});

describe('the eat scene', () => {
  /**
   * The mote and its `eat` must leave together. `cellClipStarts` aims the eat clip at the **effect's** position,
   * so a mote still drawn after its own eat reads as a second mote the cell ignored, and a mote gone before it
   * leaves the clip dimpling at empty broth. This walks the loop and asserts the two change on the same tick.
   */
  it('removes the mote on exactly the tick it emits the eat', () => {
    const scene = previewSceneFor(EAT);
    let eatenAtTick: number | null = null;
    let lastTickWithMote: number | null = null;
    let previousTick = 0;
    // Ticks strictly **inside** one loop. `loopTicks` ends on the period itself, which is the same frame as tick
    // 0 of the next loop — the mote is back at its start there, and counting it would read as a mote outliving
    // its own eat.
    for (const tick of loopTicks(scene).filter((tick) => tick < scene.periodTicks(BALANCE))) {
      const frame = scene.frameAt(tick, previousTick, BALANCE);
      previousTick = tick;
      if (frame.motes.length > 0) lastTickWithMote = tick;
      if (frame.effects.some((effect) => effect.kind === EFFECT_KIND.eat)) eatenAtTick = tick;
    }
    expect(eatenAtTick, 'the eat scene emitted no eat at all').not.toBeNull();
    expect(lastTickWithMote, 'the eat scene never drew a mote').not.toBeNull();
    // The mote is drawn up to and including the tick the eat lands on — it is visible being swallowed — and
    // never after it.
    expect(lastTickWithMote!).toBe(eatenAtTick!);
  });

  /** The eat names the cell it plays on; a clip start for an unknown cell is dropped silently by the renderer. */
  it('aims its eat at the subject cell', () => {
    const scene = previewSceneFor(EAT);
    const [eat] = effectsOverOneLoop(scene).filter((effect) => effect.kind === EFFECT_KIND.eat);
    const [cell] = scene.frameAt(0, 0, BALANCE).cells;
    expect(eat && 'cellId' in eat ? eat.cellId : null).toBe(cell?.id);
  });
});

describe('the sprint scene', () => {
  /**
   * The ticket's acceptance: the sprint's pace is the **live balance's**, not a preview number. Patching either
   * span through `debug_set_balance` must retime the loop as it plays, so these two patch them and watch the
   * period and the ring follow.
   */
  it('takes its whole period from SPRINT_DURATION_SECONDS and SPRINT_COOLDOWN_SECONDS', () => {
    const scene = previewSceneFor(SPRINT);
    const sprintSeconds = BALANCE.controls.SPRINT_DURATION_SECONDS;
    const cooldownSeconds = BALANCE.controls.SPRINT_COOLDOWN_SECONDS;
    expect(scene.periodTicks(BALANCE) * TICK_INTERVAL_S).toBeCloseTo(sprintSeconds + cooldownSeconds, 9);

    const patched = withControl('SPRINT_COOLDOWN_SECONDS', cooldownSeconds * 2);
    expect(scene.periodTicks(patched) * TICK_INTERVAL_S).toBeCloseTo(sprintSeconds + cooldownSeconds * 2, 9);
  });

  /**
   * The two halves of the loop, which the ring reads: sprinting (ticks left, the ring full) and recharging (no
   * sprint, a cooldown emptying). A patched duration moves the boundary between them, which is the check that
   * separates "the ring is driven by the balance" from "the ring is driven by a constant that happens to match".
   */
  it('sprints for the balance’s duration and then recharges, and a patch moves the boundary', () => {
    const scene = previewSceneFor(SPRINT);
    const patched = withControl('SPRINT_DURATION_SECONDS', BALANCE.controls.SPRINT_DURATION_SECONDS * 2);
    const sprintingAt = (seconds: number, balance: BalanceConfig): boolean => {
      const [cell] = scene.frameAt(seconds / TICK_INTERVAL_S, 0, balance).cells;
      return (cell?.sprintRemainingTicks ?? 0) > 0;
    };
    const justPastTheDefaultSprint = BALANCE.controls.SPRINT_DURATION_SECONDS * 1.5;

    expect(sprintingAt(0, BALANCE), 'the loop does not start on the sprint').toBe(true);
    expect(sprintingAt(justPastTheDefaultSprint, BALANCE), 'the sprint outlasts its own duration').toBe(false);
    expect(sprintingAt(justPastTheDefaultSprint, patched), 'a doubled duration did not extend the sprint').toBe(true);
  });

  /** The ring shows a recharge only once the sprint is over; during the sprint it reads as full. */
  it('holds the cooldown at zero while the sprint is still running', () => {
    const scene = previewSceneFor(SPRINT);
    const [duringSprint] = scene.frameAt(0, 0, BALANCE).cells;
    expect(duringSprint?.sprintCooldownRemainingTicks).toBe(0);

    const justAfter = (BALANCE.controls.SPRINT_DURATION_SECONDS + TICK_INTERVAL_S) / TICK_INTERVAL_S;
    const [recharging] = scene.frameAt(justAfter, 0, BALANCE).cells;
    expect(recharging?.sprintRemainingTicks).toBe(0);
    expect(recharging?.sprintCooldownRemainingTicks ?? 0).toBeGreaterThan(0);
  });

  /** `sprint_ready` is a clip the own-cell ring starts, not a `GameEffect`, so this scene schedules nothing. */
  it('emits no effects', () => {
    expect(effectsOverOneLoop(previewSceneFor(SPRINT))).toEqual([]);
  });
});

describe('the level-up scene', () => {
  /**
   * The only preview that carries a real `level`. Nothing draws it today — the own-cell indicators stand down
   * under `NO_HUD_INPUTS` — but a `level_up` reporting `PREVIEW_UNUSED_LEVEL` would be saying the player reached
   * level zero, and the moment #354's indicators do draw in a preview it would show.
   */
  it('reports a real level, on the cell and in the effect', () => {
    const scene = previewSceneFor(LEVEL_UP);
    const [cell] = scene.frameAt(0, 0, BALANCE).cells;
    expect(cell?.level).toBe(PREVIEW_LEVEL_UP_LEVEL);
    expect(cell?.level).not.toBe(PREVIEW_UNUSED_LEVEL);

    const [levelUp] = effectsOverOneLoop(scene).filter((effect) => effect.kind === EFFECT_KIND.levelUp);
    expect(levelUp && 'level' in levelUp ? levelUp.level : null).toBe(PREVIEW_LEVEL_UP_LEVEL);
  });

  /**
   * The loop has to outlast the burst. `MOTION_CLIP.levelUp` is **not interruptible**, so a loop shorter than the
   * clip would emit its next `level_up` while the last one still played, the player would refuse the start, and
   * the scene would silently drop a beat — every loop after the first showing nothing.
   */
  it('runs a loop longer than the burst it plays, which cannot be interrupted', () => {
    const burstSeconds = MOTION_CLIPS[MOTION_CLIP.levelUp].duration / MILLISECONDS_PER_SECOND;
    expect(MOTION_CLIPS[MOTION_CLIP.levelUp].isInterruptible).toBe(false);
    expect(previewSceneFor(LEVEL_UP).periodTicks(BALANCE) * TICK_INTERVAL_S).toBeGreaterThan(burstSeconds);
  });
});

/**
 * The live balance with one sprint span retuned, as `debug_set_balance` would hand it over. The key is assigned
 * rather than written as an object-literal property because the lint's naming rule reads `SPRINT_*` in a literal
 * as a badly named key; it is the balance's own key, and this is the shape that says so without an exemption.
 */
function withControl(key: 'SPRINT_DURATION_SECONDS' | 'SPRINT_COOLDOWN_SECONDS', seconds: number): BalanceConfig {
  const controls = { ...BALANCE.controls };
  controls[key] = seconds;
  return { ...BALANCE, controls };
}
