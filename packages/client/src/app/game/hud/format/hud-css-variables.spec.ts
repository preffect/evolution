import { describe, expect, it } from 'vitest';
import { TEXT, UI_LABEL_TRACKING_EM, UI_TYPE } from '../../render/constants';
import {
  HUD_MARGIN_PX,
  LEADERBOARD_FULL_WIDTH_PX,
  LEADERBOARD_ROW_HEIGHT_PX,
  LEADERBOARD_ROW_SLIDE_MS,
  LEADERBOARD_WIDTH_PX,
  ROUND_CLOCK_PULSE_PERIOD_MS,
} from '../hud-constants';
import { HUD_SCALE_VARIABLE, hudStyleVariables } from './hud-css-variables';

describe('hudStyleVariables', () => {
  it('publishes the scale it is given, unitless', () => {
    expect(hudStyleVariables(1.25)[HUD_SCALE_VARIABLE]).toBe('1.25');
  });

  it('carries every length at scale 1 with its unit, from the constants and never a copy', () => {
    const variables = hudStyleVariables(1);
    expect(variables['--hud-margin']).toBe(`${HUD_MARGIN_PX}px`);
    expect(variables['--hud-leaderboard-width']).toBe(`${LEADERBOARD_WIDTH_PX}px`);
    expect(variables['--hud-leaderboard-full-width']).toBe(`${LEADERBOARD_FULL_WIDTH_PX}px`);
    expect(variables['--hud-leaderboard-row-height']).toBe(`${LEADERBOARD_ROW_HEIGHT_PX}px`);
    expect(variables['--hud-row-slide-duration']).toBe(`${LEADERBOARD_ROW_SLIDE_MS}ms`);
    expect(variables['--hud-clock-pulse-duration']).toBe(`${ROUND_CLOCK_PULSE_PERIOD_MS}ms`);
  });

  it('carries the type scale and the colour roles the style guide owns', () => {
    const variables = hudStyleVariables(1);
    expect(variables['--hud-type-clock']).toBe(`${UI_TYPE.clock.px}px`);
    expect(variables['--hud-type-caption']).toBe(`${UI_TYPE.caption.px}px`);
    expect(variables['--hud-font-mono']).toBe(UI_TYPE.clock.font);
    expect(variables['--hud-label-tracking']).toBe(`${UI_LABEL_TRACKING_EM}em`);
    expect(variables['--hud-text']).toBe(TEXT);
  });

  it('names every variable with the --hud- prefix, so a stylesheet cannot read a stray one', () => {
    for (const name of Object.keys(hudStyleVariables(1))) expect(name.startsWith('--hud-')).toBe(true);
  });
});
