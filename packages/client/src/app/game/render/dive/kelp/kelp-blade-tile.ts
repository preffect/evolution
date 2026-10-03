// The kelp blade's grain (docs/rendering/opening-dive.md §4, ticket #802, the mockup's `BAKES.blade`): long streaks
// along the tile's x, a slow mottling and a few bright specks on the golden-olive ramp, a little translucent. Self-
// similar, so the blades, the close-up floor and the lenses draw it at two neighbouring octaves along blade 0.

import { KELP_BLADE_TILE } from '../../constants/dive-kelp-drop';
import type { ShoreCanvas } from '../shore/shore-canvas';
import { coordinateHash, square, tilePoint } from '../shore/shore-noise';
import { clampUnit, ramp3, rampOf, setColour, squarePixelBake } from '../shore/shore-pixels';
import type { TileBakeKit } from '../shore/shore-tiles-rock';

/** The tile, a few rows a step. */
export function bakeBladeTile(kit: TileBakeKit): Generator<void, ShoreCanvas> {
  const tile = KELP_BLADE_TILE;
  const [low, middle, high] = rampOf(tile.ramp);
  const streaks = { x: tile.streaks.frequencyX, y: tile.streaks.frequencyY };
  const mottle = square(tile.mottle.frequency);
  return squarePixelBake(kit.factory, tile.sizePx, (x, y, out) => {
    const point = tilePoint(x, y, tile.sizePx);
    let value =
      kit.noise.fbm(point, streaks, tile.streaks.octaves, tile.streaks.salt) * tile.streakShare +
      kit.noise.fbm(point, mottle, tile.mottle.octaves, tile.mottle.salt) * tile.mottleShare;
    if (coordinateHash(x, y, tile.speck.salt) > tile.speck.above) value += tile.speck.lift;
    setColour(out, ramp3(low, middle, high, clampUnit(value)), tile.alpha);
  });
}
