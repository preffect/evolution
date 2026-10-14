// The opening dive panel's `data-testid`s (docs/rendering/opening-dive.md §5): the panel renders these values, and its
// spec and the lobby's Playwright layout check (`e2e/lobby-dive-layout.spec.ts`) query them, so no id literal is typed
// twice. Kept apart from the component so a Playwright spec can import them without Angular.

export const DIVE_PANEL_TEST_ID = {
  panel: 'dive-panel',
  stage: 'dive-stage',
  pause: 'dive-pause',
  slider: 'dive-zoom',
  phaseButton: 'dive-phase-',
  readoutFieldOfView: 'dive-readout-fov',
  readoutPower: 'dive-readout-power',
  readoutWhat: 'dive-readout-what',
  flag: 'dive-phase-flag',
  label: 'dive-label',
  scaleBar: 'dive-scale-bar',
  unavailable: 'dive-unavailable',
} as const;
