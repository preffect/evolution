// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, secondsToTicks } from '@evolution/shared';
import { sprintFillFor, type SprintFillBalance } from './sprint-fill';

const COOLDOWN_TICKS = secondsToTicks(DEFAULT_BALANCE.controls.SPRINT_COOLDOWN_SECONDS);

describe('sprintFillFor', () => {
  it('is full when nothing is on cooldown, which is what ready means', () => {
    expect(sprintFillFor({ sprintCooldownRemainingTicks: 0 }, DEFAULT_BALANCE.controls)).toBe(1);
  });

  it('is empty on the tick the cooldown starts and fills back as it drains', () => {
    expect(sprintFillFor({ sprintCooldownRemainingTicks: COOLDOWN_TICKS }, DEFAULT_BALANCE.controls)).toBe(0);
    expect(sprintFillFor({ sprintCooldownRemainingTicks: COOLDOWN_TICKS / 2 }, DEFAULT_BALANCE.controls)).toBeCloseTo(
      0.5,
    );
  });

  it('starts partly drawn when a modifier left less cooldown than the balance names', () => {
    // A trait that shortens the cooldown hands back a remaining that is already under the full
    // length; the ring shows that rather than restarting from empty (docs/ui/hud.md §3.1.2).
    const shortened = Math.floor(COOLDOWN_TICKS / 4);
    expect(sprintFillFor({ sprintCooldownRemainingTicks: shortened }, DEFAULT_BALANCE.controls)).toBeCloseTo(0.75, 1);
  });

  it('clamps rather than going negative when the remaining outlasts the balance', () => {
    expect(sprintFillFor({ sprintCooldownRemainingTicks: COOLDOWN_TICKS * 3 }, DEFAULT_BALANCE.controls)).toBe(0);
  });

  it('reads ready for a zero-length cooldown instead of dividing by it', () => {
    const noCooldown: SprintFillBalance = { ...DEFAULT_BALANCE.controls };
    noCooldown.SPRINT_COOLDOWN_SECONDS = 0;
    expect(sprintFillFor({ sprintCooldownRemainingTicks: 5 }, noCooldown)).toBe(1);
  });
});
