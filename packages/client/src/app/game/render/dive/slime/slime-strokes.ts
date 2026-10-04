// A mesh of the plankton's moving strokes (docs/rendering/opening-dive.md §4, ticket #803): room for a fixed number of
// straight pieces, each a quad (`slime-shader-strokes.ts`), rewritten every frame from the organisms' strokes placed
// on the stage. Pieces past the frame's last are laid flat at the origin with no width, so they cover nothing.

import { Geometry, Mesh, State, type Buffer, type Shader } from 'pixi.js';
import { CELL_QUAD_INDICES, CELL_QUAD_POSITIONS } from '../../constants';
import { HALF } from '../../geometry';
import { POINT_STRIDE } from '../shore/shore-points';
import type { PlanktonStroke } from './slime-plankton-strokes';
import { SLIME_CORNER_ATTRIBUTE } from './slime-shader-common';
import { SLIME_STROKE_ATTRIBUTE } from './slime-shader-strokes';

const QUAD_CORNERS = CELL_QUAD_POSITIONS.length / POINT_STRIDE;
const VECTOR = 4;
const ALPHA_LANE = 3;

/** Where a stroke in an organism's unit lands on the stage: its centre (css px), heading, and css px to the unit. */
export interface StrokePlacement {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly unitPx: number;
}

export class SlimeStrokes {
  readonly mesh: Mesh<Geometry, Shader>;
  private readonly pieces: Float32Array;
  private readonly styles: Float32Array;
  private readonly colours: Float32Array;
  private count = 0;

  constructor(
    shader: Shader,
    private readonly capacity: number,
  ) {
    const vertices = capacity * QUAD_CORNERS * VECTOR;
    this.pieces = new Float32Array(vertices);
    this.styles = new Float32Array(vertices);
    this.colours = new Float32Array(vertices);
    const corners = new Float32Array(capacity * CELL_QUAD_POSITIONS.length);
    const indices = new Uint32Array(capacity * CELL_QUAD_INDICES.length);
    for (let piece = 0; piece < capacity; piece += 1) {
      corners.set(CELL_QUAD_POSITIONS, piece * CELL_QUAD_POSITIONS.length);
      indices.set(
        CELL_QUAD_INDICES.map((corner) => corner + piece * QUAD_CORNERS),
        piece * CELL_QUAD_INDICES.length,
      );
    }
    const geometry = new Geometry({
      attributes: {
        [SLIME_CORNER_ATTRIBUTE]: { buffer: corners, format: 'float32x2' },
        [SLIME_STROKE_ATTRIBUTE.piece]: { buffer: this.pieces, format: 'float32x4' },
        [SLIME_STROKE_ATTRIBUTE.style]: { buffer: this.styles, format: 'float32x4' },
        [SLIME_STROKE_ATTRIBUTE.colour]: { buffer: this.colours, format: 'float32x4' },
      },
      indexBuffer: indices,
    });
    this.mesh = new Mesh({ geometry, shader, state: State.for2d() });
    this.mesh.visible = false;
  }

  /** How many pieces the last frame laid. */
  get pieceCount(): number {
    return this.count;
  }

  /** Starts a frame: nothing laid yet. */
  begin(): void {
    this.count = 0;
  }

  /** Lays each stroke's pieces at `placement`, as far as there is room. */
  add(strokes: readonly PlanktonStroke[], placement: StrokePlacement): void {
    const cos = Math.cos(placement.angle) * placement.unitPx;
    const sin = Math.sin(placement.angle) * placement.unitPx;
    const toStage = (x: number, y: number): [number, number] => [
      placement.x + cos * x - sin * y,
      placement.y + sin * x + cos * y,
    ];
    for (const stroke of strokes) {
      const halfWidth = stroke.width * placement.unitPx * HALF;
      const [red, green, blue, alpha] = stroke.colour;
      const colour = [red * alpha, green * alpha, blue * alpha, alpha];
      for (let point = POINT_STRIDE; point < stroke.points.length; point += POINT_STRIDE) {
        if (this.count >= this.capacity) return;
        const from = toStage(stroke.points[point - POINT_STRIDE] ?? 0, stroke.points[point - 1] ?? 0);
        const end = toStage(stroke.points[point] ?? 0, stroke.points[point + 1] ?? 0);
        this.write([...from, ...end], [halfWidth, stroke.isRound ? 1 : 0, 0, 0], colour);
      }
    }
  }

  private write(piece: readonly number[], style: readonly number[], colour: readonly number[]): void {
    for (let corner = 0; corner < QUAD_CORNERS; corner += 1) {
      const offset = (this.count * QUAD_CORNERS + corner) * VECTOR;
      this.pieces.set(piece, offset);
      this.styles.set(style, offset);
      this.colours.set(colour, offset);
    }
    this.count += 1;
  }

  /** Ends a frame: the rest laid flat, the buffers uploaded, the mesh shown while any piece was laid. */
  end(): void {
    const from = this.count * QUAD_CORNERS * VECTOR;
    this.pieces.fill(0, from);
    this.styles.fill(0, from);
    this.colours.fill(0, from);
    for (const name of [SLIME_STROKE_ATTRIBUTE.piece, SLIME_STROKE_ATTRIBUTE.style, SLIME_STROKE_ATTRIBUTE.colour]) {
      (this.mesh.geometry.getBuffer(name) as Buffer).update();
    }
    this.mesh.visible = this.count > 0;
  }

  /** The alpha of the `piece`-th piece laid this frame (for a spec). */
  alphaOf(piece: number): number {
    return this.colours[piece * QUAD_CORNERS * VECTOR + ALPHA_LANE] ?? 0;
  }

  destroy(): void {
    const geometry = this.mesh.geometry;
    this.mesh.destroy();
    geometry.destroy();
  }
}
