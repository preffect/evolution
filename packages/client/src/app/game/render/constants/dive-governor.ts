// The opening dive's resolution governor (docs/rendering/opening-dive.md §6, tickets #804 and #816): the frame it aims at, how
// it judges frames and how far it steps the dive's canvas resolution. Re-exported by `render/constants`.

/** The frame the dive aims at: one display frame at 60 Hz (the epic's 60 fps on a laptop's integrated GPU). */
export const DIVE_TARGET_FRAME_MS = 1000 / 60;

/**
 * How the governor (`dive/dive-resolution-governor.ts`) steps the dive canvas's device px per css px:
 * - `windowFrames`: it judges the median gap of this many drawn frames in a row, so one long task (a bake landing, a
 *   texture upload) never moves it; or of `minWindowFrames` once they span `windowMs`, so software GL's frames,
 *   seconds apart, are judged within a second or two. Every change starts the window again.
 * - `slowFrameRatio`: a median over the target times this is over budget (the mockup's 21 ms governor at 60 Hz). It
 *   steps down only when the window is over budget throughout: at most `sustainedFastFrames` of its frames on time. A
 *   GPU behind misses every vsync; a busy page misses some (a 33 ms gap among 16.7 ms ones), and fewer pixels would not
 *   help it. And it must stay so for `sustainedMs` of windows in a row: a burst of a busy page's work is shorter.
 * - `stepRatio`: one notch of resolution, about 0.7× the pixels. Over budget it steps down one notch; a median past
 *   `leapRatio` times the target, which no page's own work explains, steps as many notches as the pixels must shrink
 *   by for the GPU's share of the frame to fit (the cost of a fragment-bound frame scales with its pixels). A full
 *   window spanning `windowMs` (its mean a sixth of a second or more) is far behind, software GL's bursts of a wait of
 *   seconds and a few frames a vsync apart, and is judged by its mean, over budget throughout (ticket #814). A step its
 *   mean alone decided (its median on budget) with no bake slice in the window is undone if the next window is no
 *   quicker, as a one-notch step is: a page's own stalls among quick frames are no quicker with fewer pixels.
 * - `floorResolution`: never fewer device px per css px than this (an 830 css px stage stays 290 px wide).
 * - `spanMs`, `slightlySlowRatio`: it also judges the mean gap of the frames over each `spanMs` (gaps past the leap
 *   left out, the window's to judge). A mean over the target times `slightlySlowRatio` (about 55 fps) is a little too
 *   slow: a GPU at 40–55 fps mixes quick and late frames as a busy page does, so its windows are never over budget
 *   throughout (ticket #816). That span tries one notch down, only when the page's own work averages under
 *   `trialCpuShare` of the target (a page busy half the frame misses its vsyncs itself), and checks it by the next span.
 * - `stepUpAfterMs`: on budget this long in a row, it tries one notch up. A step down within `probeFailMs` of a step
 *   up means that notch did not fit: the wait before the next try grows by `backoffFactor`, up to `maxStepUpAfterMs`;
 *   a notch up that holds puts the wait back. So it never pumps: a level that fits stays, and the one above is tried
 *   ever more rarely. `probeFailMs` covers a span's trial after the step up: a GPU's frames come at 60 fps for about
 *   2 s after the canvas grows (measured on the evidence box, ticket #816), and the span after them steps down 4 s on.
 * - `helpRatio`: a one-notch step down must bring the next window's median gap under the last one's times this (a
 *   span's trial: the next span's mean under its own times this, or no longer a little too slow). One that does not
 *   was not the GPU's to fix (the page's own work, layout, a slow CPU): it is undone, and no step down is tried for
 *   `uselessStepHoldMs`, doubled for each in a row, up to `maxStepUpAfterMs`. A leap is never undone: the
 *   camera moves through bands of different cost while software GL's slow frames fill a window.
 * - `maxGapMs`: a longer gap is not a frame (the ticker stopped off screen, the tab hidden) and starts the window
 *   again; software GL's slowest frames (up to about 13 s at DPR 2 on the evidence box) still count.
 */
export const DIVE_RESOLUTION_GOVERNOR = {
  windowFrames: 6,
  minWindowFrames: 3,
  windowMs: 1000,
  slowFrameRatio: 1.3,
  sustainedFastFrames: 1,
  sustainedMs: 500,
  leapRatio: 3,
  stepRatio: 0.84,
  floorResolution: 0.35,
  spanMs: 2000,
  slightlySlowRatio: 1.1,
  trialCpuShare: 0.5,
  stepUpAfterMs: 3000,
  probeFailMs: 10_000,
  maxStepUpAfterMs: 48_000,
  backoffFactor: 2,
  helpRatio: 0.9,
  uselessStepHoldMs: 6000,
  maxGapMs: 15_000,
} as const;
