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

/** The shore band's coast in metres (`shore/shore-coast.ts`): the kelp band and the forest test build it per frame. */
export interface MockupCoast {
  build(view: { readonly halfWidthM: number; readonly halfHeightM: number; readonly pixelsPerMetre: number }): void;
  distance(x: number, y: number, maxM: number): number;
  readonly rings: readonly { readonly points: readonly number[] }[];
  readonly marginM: number;
}

/** A tile the shore band has baked (`shore/shore-tiles.ts`): the kelp and slime bands draw from it. */
export interface MockupTile {
  readonly canvas: CanvasImageSource & { readonly width: number; readonly height: number };
  readonly averageColour: string;
}

export interface MockupTiles {
  /** The tile, or `null` while it bakes (it then jumps the shore's queue). */
  get(name: string): MockupTile | null;
}

export interface MockupBandsInput {
  readonly coast: MockupCoast;
  readonly tiles: MockupTiles;
  /** The dive's clock in milliseconds: the bake pump's budget is measured on it. */
  readonly nowMs: () => number;
}

export interface MockupBands {
  /** The one canvas the bands draw on (kept for the page), right over the shore band's. */
  readonly canvas: HTMLCanvasElement;
  /**
   * Draws the frame; `true` when the planet (`dive-planet-band.ts`) shows: the canvas is then left clear for it, and
   * the shore band (`shore/dive-shore-band.ts`, under this canvas) leaves its forest to it.
   */
  draw(frame: MockupFrame): boolean;
  /** Runs the texture bakes for about `budgetMs`; `true` when one finished, so a still view draws once more. */
  pumpBakes(budgetMs: number): boolean;
  readonly isBaked: boolean;
  /** Shrinks the screen-sized canvases to nothing; the bakes are kept for the next open. */
  release(): void;
}

export function createMockupBands(input: MockupBandsInput): MockupBands;
