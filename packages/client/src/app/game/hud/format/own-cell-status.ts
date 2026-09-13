// The status mirror's content (docs/UI.md §3.1.4): the `data-*` attributes Playwright reads and
// the sentence assistive technology hears. Pure and DOM-free — the component binds what this
// answers and owns no rule of its own.
//
// The split matters and is the whole design of the mirror. **Attributes** are rewritten every
// snapshot, because a test wants the current value and reading an attribute announces nothing.
// **Text** is rewritten only when something a player would want told about changes, because the
// element is `aria-live="polite"` and a 60 Hz stream of sentences is unusable. `shouldAnnounce`
// is that rule, and it is pinned rather than left to a component's discretion.

import { BACTERIUM_VARIANT, TRAIT_CATALOG, type BacteriumVariant, type OwnedTrait } from '@evolution/shared';
import { ENGULF_PHASE } from '@evolution/shared';
import { STATUS_ANNOUNCE_DNA_STEP_PERCENT } from '../hud-constants';
import { LADDER_KIND, type LadderCounter, type OwnCellIndicators } from '../../state/own-cell-indicators';

const PERCENT = 100;

/** The sprint ring's three readings, as one word each (docs/UI.md §3.1.4). */
export const SPRINT_STATUS = { ready: 'ready', cooling: 'cooling', sprinting: 'sprinting' } as const;

/** `ghost:<silhouette>`, `counters` or `none`: what the ladder orbit is showing. */
export const LADDER_STATUS_NONE = 'none';

/** The counters the mirror exposes by name, so a test can read `data-aerobic` without a lookup. */
export const COUNTER_ATTRIBUTE_BY_VARIANT: Readonly<Record<BacteriumVariant, string>> = {
  [BACTERIUM_VARIANT.plain]: 'data-plain',
  [BACTERIUM_VARIANT.aerobic]: 'data-aerobic',
  [BACTERIUM_VARIANT.photosynthetic]: 'data-photosynthetic',
};

/** Every attribute the mirror carries; an absent value means the attribute is not written at all. */
export interface OwnCellStatusAttributes {
  readonly [attribute: string]: string | null;
}

export interface OwnCellStatus {
  readonly attributes: OwnCellStatusAttributes;
  /** The sentence; only spoken when `shouldAnnounce` says this one differs in a way worth hearing. */
  readonly text: string;
  /** What `shouldAnnounce` compares: the facts a player would want told, not the raw record. */
  readonly announceKey: string;
}

/** `62` from 0.62: floored, so the mirror never claims a percent the ring has not filled. */
export function dnaPercentOf(dnaFraction: number): number {
  return Math.floor(dnaFraction * PERCENT);
}

function sprintStatusOf(indicators: OwnCellIndicators): string {
  if (indicators.isSprinting) return SPRINT_STATUS.sprinting;
  return indicators.sprintFill >= 1 ? SPRINT_STATUS.ready : SPRINT_STATUS.cooling;
}

function ladderStatusOf(indicators: OwnCellIndicators): string {
  const { ladder } = indicators;
  if (ladder.kind === LADDER_KIND.ghost) return `ghost:${ladder.silhouette}`;
  if (ladder.kind === LADDER_KIND.counters) return LADDER_KIND.counters;
  return LADDER_STATUS_NONE;
}

/** The counters on the ladder right now, by variant; a hidden counter has no attribute (§3.1.4). */
function visibleCounters(indicators: OwnCellIndicators): readonly LadderCounter[] {
  return indicators.ladder.kind === LADDER_KIND.counters ? indicators.ladder.counters : [];
}

/** `nucleoid:1 flagellum:2` in catalog order, so two equal loadouts always read the same. */
export function formatTraits(traits: readonly OwnedTrait[]): string {
  const tierById = new Map(traits.map((owned) => [owned.traitId, owned.tier]));
  return TRAIT_CATALOG.filter((trait) => tierById.has(trait.id))
    .map((trait) => `${trait.id}:${tierById.get(trait.id)}`)
    .join(' ');
}

function counterAttributes(indicators: OwnCellIndicators): OwnCellStatusAttributes {
  const attributes: Record<string, string> = {};
  for (const counter of visibleCounters(indicators)) {
    const name = COUNTER_ATTRIBUTE_BY_VARIANT[counter.variant];
    attributes[name] = `${counter.eaten}/${counter.required}`;
  }
  return attributes;
}

/** The sentence, in the order §3.1.4 sets: level, DNA, the counters, then sprint. */
function statusTextOf(indicators: OwnCellIndicators): string {
  const parts = [`Level ${indicators.level}`, `DNA ${dnaPercentOf(indicators.dnaFraction)} %`];
  for (const counter of visibleCounters(indicators)) {
    const name = `${counter.variant.charAt(0).toUpperCase()}${counter.variant.slice(1)}`;
    parts.push(`${name} ${counter.eaten} of ${counter.required}`);
  }
  if (indicators.escape !== null) {
    parts.push(indicators.escape.phase === ENGULF_PHASE.absorb ? 'Sealed' : 'Engulfed · sprint to escape');
  } else if (indicators.nearestThreat !== null) {
    parts.push(indicators.nearestThreat.label);
  }
  parts.push(`Sprint ${sprintStatusOf(indicators)}`);
  return parts.join(' · ');
}

/**
 * What a change has to move before the mirror speaks again (docs/UI.md §3.1.4): the level, the DNA
 * percent **quantised to `STATUS_ANNOUNCE_DNA_STEP_PERCENT`**, each counter, the sprint word, the
 * engulf phase and whether a threat is present. Mass and the raw percent are deliberately absent:
 * they move every snapshot, and announcing them would drown everything worth hearing.
 */
function announceKeyOf(indicators: OwnCellIndicators): string {
  const dnaStep = Math.floor(dnaPercentOf(indicators.dnaFraction) / STATUS_ANNOUNCE_DNA_STEP_PERCENT);
  const counters = visibleCounters(indicators)
    .map((counter) => `${counter.variant}:${counter.eaten}`)
    .join(',');
  return [
    indicators.level,
    dnaStep,
    counters,
    sprintStatusOf(indicators),
    indicators.escape?.phase ?? '',
    indicators.nearestThreat === null ? '' : 'threat',
  ].join('|');
}

/** The mirror's whole content for one snapshot. */
export function formatOwnCellStatus(indicators: OwnCellIndicators): OwnCellStatus {
  return {
    attributes: {
      'data-level': String(indicators.level),
      'data-max-level': String(indicators.isMaxLevel),
      'data-dna-percent': String(dnaPercentOf(indicators.dnaFraction)),
      'data-ladder': ladderStatusOf(indicators),
      'data-sprint': sprintStatusOf(indicators),
      'data-mass': String(Math.round(indicators.mass)),
      'data-traits': formatTraits(indicators.traits),
      'data-engulfed': indicators.escape === null ? null : String(Math.round(indicators.escape.progress * PERCENT)),
      'data-engulf-phase': indicators.escape?.phase ?? null,
      'data-threat': indicators.nearestThreat?.cellId ?? null,
      ...counterAttributes(indicators),
    },
    text: statusTextOf(indicators),
    announceKey: announceKeyOf(indicators),
  };
}

/** Whether this snapshot's status is worth speaking, given what was last spoken. */
export function shouldAnnounce(previousAnnounceKey: string | null, status: OwnCellStatus): boolean {
  return previousAnnounceKey !== status.announceKey;
}
