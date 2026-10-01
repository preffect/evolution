// The face of the mockup's upper bands (`dive-mockup-bands.js`, ticket #797): what `dive-macro-band.ts` calls. The
// module is the mockup's own Canvas 2D drawing, kept as JavaScript until epic #795's follow-ups move each band onto
// the game's renderer (docs/rendering/opening-dive.md §4).

/** One coastline ring: `[longitude, latitude]` pairs in degrees, closed. */
export type MockupRing = readonly (readonly [number, number])[];

/** One band's state as the dive's band table hands it over (`dive-bands.ts`). */
export interface MockupBandState {
  readonly weight: number;
  readonly isActive: boolean;
}

export interface MockupBandStates {
  readonly planet: MockupBandState;
  readonly shore: MockupBandState;
  readonly kelp: MockupBandState;
  readonly drop: MockupBandState;
  readonly slime: MockupBandState;
  readonly dish: MockupBandState;
}

export interface MockupFrame {
  /** log10 of the view's width in metres. */
  readonly zoom: number;
  /** The ambient motion's clock (surf, drift); held still under reduced motion. */
  readonly timeSeconds: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly devicePixelRatio: number;
  /** The globe's rotation as d3 takes it: `[λ, φ]` in degrees. */
  readonly globeRotation: readonly [number, number];
  readonly bands: MockupBandStates;
}

export interface MockupBandsInput {
  readonly worldRings: readonly MockupRing[];
  readonly salishRings: readonly MockupRing[];
  /** The dive's clock in milliseconds: the bake pump's budget is measured on it. */
  readonly nowMs: () => number;
}

export interface MockupBands {
  /** The one canvas the bands draw on (kept for the page); the dive lays it under the game's canvas. */
  readonly canvas: HTMLCanvasElement;
  draw(frame: MockupFrame): void;
  /** Runs the texture bakes for about `budgetMs`; `true` when one finished, so a still view draws once more. */
  pumpBakes(budgetMs: number): boolean;
  readonly isBaked: boolean;
  /** Gives the globe's WebGL context back; the bakes are kept for the next open. */
  release(): void;
}

export function createMockupBands(input: MockupBandsInput): MockupBands;
