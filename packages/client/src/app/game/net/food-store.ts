// The client's mote store (docs/ARCHITECTURE.md §4): `spawned` upserts, `removedIds` deletes if
// present, `moved` patches a bacterium's position and remembers the one before it, so a frame
// between two snapshots lerps the random walk instead of stepping it. Reset on every `game_state`.

import type { EntityId, FoodDelta, FoodMoteView, MotePositionView } from '@evolution/shared';
import { interpolatePosition, interpolationWeight } from './interpolation';

interface MoteMotion {
  readonly from: MotePositionView;
  readonly fromTick: number;
  readonly to: MotePositionView;
  readonly toTick: number;
}

export class FoodStore {
  private readonly motes = new Map<EntityId, FoodMoteView>();
  private readonly motions = new Map<EntityId, MoteMotion>();

  applyDelta(delta: FoodDelta, tick: number): void {
    for (const mote of delta.spawned) {
      this.motes.set(mote.id, mote);
      // A re-spawn is a full position (docs/ARCHITECTURE.md §4): any motion in flight is stale.
      this.motions.delete(mote.id);
    }
    for (const id of delta.removedIds) {
      this.motes.delete(id);
      this.motions.delete(id);
    }
    for (const position of delta.moved) this.move(position, tick);
  }

  private move(position: MotePositionView, tick: number): void {
    const mote = this.motes.get(position.id);
    if (mote === undefined) return;
    const previous = this.motions.get(position.id);
    const from = previous === undefined ? { id: mote.id, x: mote.x, y: mote.y } : previous.to;
    const fromTick = previous === undefined ? tick : previous.toTick;
    this.motions.set(position.id, { from, fromTick, to: position, toTick: tick });
    this.motes.set(position.id, { ...mote, x: position.x, y: position.y });
  }

  /** Every mote, bacteria lerped between their last two reported positions at `renderTick`. */
  motesAt(renderTick: number): FoodMoteView[] {
    const result: FoodMoteView[] = [];
    for (const mote of this.motes.values()) {
      const motion = this.motions.get(mote.id);
      if (motion === undefined) {
        result.push(mote);
        continue;
      }
      const weight = interpolationWeight(motion.fromTick, motion.toTick, renderTick);
      const position = interpolatePosition(motion.from, motion.to, weight);
      result.push({ ...mote, x: position.x, y: position.y });
    }
    return result;
  }

  get size(): number {
    return this.motes.size;
  }

  reset(): void {
    this.motes.clear();
    this.motions.clear();
  }
}
