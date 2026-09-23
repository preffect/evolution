// How far a toxic cell's toxin reaches (docs/ecology/mass-and-movement.md §4.1, docs/traits/model.md §2, #424): contact,
// plus the aura beyond the rim. The server's metabolism drains by it and the client's toxin coach beat reads it
// (docs/ui/input-and-onboarding.md §5), so both sides share one rule.

import type { EntityId } from '../types/common.js';
import type { CellModifiers } from '../types/traits.js';
import { distanceBetween } from './vector-math.js';

/** What the toxin reach reads of a cell: its centre, a radius and its modifiers. */
export interface ToxinReachView {
  readonly id: EntityId;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly modifiers: CellModifiers;
}

/**
 * The farthest centre distance at which a toxic cell's toxin reaches a target of `targetRadius`: contact, plus
 * `toxinAuraRangeInRadii` of the toxic cell's radii measured from its rim (docs/traits/model.md §2, #424). Without an
 * aura this is exactly the contact distance.
 */
export function toxinReachDistance(targetRadius: number, toxic: Pick<ToxinReachView, 'radius' | 'modifiers'>): number {
  return targetRadius + toxic.radius * (1 + toxic.modifiers.toxinAuraRangeInRadii);
}

/** A toxic cell reaches another by overlap, or without contact within its aura beyond the rim. */
export function isReachedByToxin(
  target: Pick<ToxinReachView, 'x' | 'y' | 'radius'>,
  toxic: Pick<ToxinReachView, 'x' | 'y' | 'radius' | 'modifiers'>,
): boolean {
  return distanceBetween(target, toxic) <= toxinReachDistance(target.radius, toxic);
}
