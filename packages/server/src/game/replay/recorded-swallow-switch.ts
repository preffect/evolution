// Recordings made under ticket #907's stage switch (docs/game-design/early-life.md §15.10, docs/determinism/
// replay-tests-and-traps.md §6): between tickets #907 and #948 the swallow switch was `absorption.SWALLOW_FROM_STAGE`, a
// stage id, where it is now `SWALLOW_GATE_TRAITS`, a trait-id list. `protocell` let every cell swallow, which is the
// empty gate, so a recording under it maps to `[]` and replays to its `finalHash`; any other stage ran a game the trait
// switch cannot reproduce, so the recording is refused by name before the replay starts. The same holds for a recorded
// `set_balance` patch that names the old leaf: it is mapped before the replay starts and never reaches
// `applyBalancePatch`, which would refuse the undeclared leaf mid-way.

import { CELL_STAGE, type BalanceConfig, type TraitId } from '@evolution/shared';
import type { BalancePatch } from '../debug/simulation-debug-handle.js';
import { DEBUG_PATCH_KIND, REPLAY_EVENT_KIND, type ReplayEvent } from './replay-format.js';

/** The domain both switches live in, typed so a renamed domain fails to compile here. */
const SWITCH_DOMAIN: keyof BalanceConfig = 'absorption';
/** The trait switch, typed so a renamed leaf fails to compile here. */
const TRAIT_SWITCH_LEAF: keyof BalanceConfig['absorption'] = 'SWALLOW_GATE_TRAITS';
/** Ticket #907's leaf, which no balance type names any more. */
const STAGE_SWITCH_LEAF = 'SWALLOW_FROM_STAGE';
/** The one stage the trait switch can replay: it let every cell swallow. */
const EVERY_CELL_SWALLOWS_STAGE = CELL_STAGE.protocell;
/** The trait switch that plays the same game: no gate. */
const EVERY_CELL_SWALLOWS_GATE: readonly TraitId[] = [];

/** A recording made under a stage switch other than `protocell`: the trait switch cannot replay it. */
export class ReplayStageSwitchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayStageSwitchError';
  }
}

type SwitchDomain = { readonly [key: string]: unknown };

function isPlainRecord(value: unknown): value is SwitchDomain {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `domain` with the stage leaf replaced by the trait switch it maps to, or `domain` itself when it carries no stage
 * leaf; `source` names where the switch was recorded, for the refusal.
 */
function underTraitSwitch<Domain extends SwitchDomain>(domain: Domain, source: string): Domain {
  if (!(STAGE_SWITCH_LEAF in domain)) return domain;
  const { [STAGE_SWITCH_LEAF]: recordedStage, ...otherLeaves } = domain;
  if (recordedStage !== EVERY_CELL_SWALLOWS_STAGE) {
    throw new ReplayStageSwitchError(
      `recorded under the stage switch at ${JSON.stringify(recordedStage)} (${source}), which the trait switch cannot replay`,
    );
  }
  return { ...otherLeaves, [TRAIT_SWITCH_LEAF]: [...EVERY_CELL_SWALLOWS_GATE] } as unknown as Domain;
}

/** The recorded balance with a `protocell` stage switch mapped to the empty gate; refuses any other stage by name. */
export function recordedBalanceUnderTraitSwitch(recorded: BalanceConfig): BalanceConfig {
  const domain: unknown = recorded[SWITCH_DOMAIN];
  if (!isPlainRecord(domain)) return recorded;
  const mapped = underTraitSwitch(domain, 'its balance');
  return mapped === domain ? recorded : { ...recorded, [SWITCH_DOMAIN]: mapped };
}

/** One recorded event with a `set_balance` patch's stage switch mapped; every other event as recorded. */
function eventUnderTraitSwitch(event: ReplayEvent): ReplayEvent {
  if (event.kind !== REPLAY_EVENT_KIND.debugPatch || event.patch.kind !== DEBUG_PATCH_KIND.setBalance) return event;
  const domain: unknown = event.patch.patch[SWITCH_DOMAIN];
  if (!isPlainRecord(domain)) return event;
  const mapped = underTraitSwitch(domain, `a set_balance patch at tick ${event.tick}`);
  if (mapped === domain) return event;
  const patch: BalancePatch = { ...event.patch.patch, [SWITCH_DOMAIN]: mapped as BalancePatch };
  return { ...event, patch: { ...event.patch, patch } };
}

/** The recorded log with every stage switch patch mapped, refused as a whole when one names another stage. */
export function recordedEventsUnderTraitSwitch(events: readonly ReplayEvent[]): readonly ReplayEvent[] {
  return events.map(eventUnderTraitSwitch);
}
