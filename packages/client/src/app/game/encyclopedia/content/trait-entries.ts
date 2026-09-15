// The trait pages' copy (docs/architecture/encyclopedia.md §12.6): a summary, one body per tier and hand-picked links.
// The title is the catalog's `name`, the tier headings and tier facts are generated from the live tier table, and
// every number in the prose is a `{modifierKey}` token of that tier's facts. No number and no arithmetic here (lint).

import type { TraitId, TraitTiers } from '@evolution/shared';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { CATALOG_QUANTITY } from '../facts/catalog-quantities';
import { DERIVED_LINK } from '../facts/derived-links';
import type { EntryId } from '../model/entry-id';
import { FACT_SOURCE, type FactDefinition } from '../model/fact';
import type { ProseTemplate } from '../model/prose';

/** A tuple of the same length as `Tiers`, one template per tier (a homomorphic mapping keeps the tuple shape). */
type ProsePerTier<Tiers> = { readonly [Tier in keyof Tiers]: ProseTemplate };
/** One body per tier of the shared tier-table shape, so a fourth tier without copy fails `typecheck`. */
export type TraitTierBodies = ProsePerTier<TraitTiers>;

export interface TraitEntryContent {
  readonly summary: ProseTemplate;
  readonly tierBodies: TraitTierBodies;
  readonly seeAlso: readonly EntryId[];
}

/** The unlock and ladder facts every trait page shows, in table order; the first is the landing tile's headline. */
export function traitFacts(traitId: TraitId): readonly FactDefinition[] {
  const plainCount = { unit: QUANTITY_UNIT.count, presentation: QUANTITY_PRESENTATION.plain };
  return [
    {
      key: 'offeredFrom',
      label: 'Offered from',
      source: { kind: FACT_SOURCE.link, link: { id: DERIVED_LINK.traitStage, argument: { traitId } } },
    },
    {
      key: 'climbsTo',
      label: 'Climbs to',
      source: { kind: FACT_SOURCE.link, link: { id: DERIVED_LINK.stageNext, argument: { traitId } } },
    },
    {
      key: 'requires',
      label: 'Requires',
      source: { kind: FACT_SOURCE.link, link: { id: DERIVED_LINK.traitRequires, argument: { traitId } } },
    },
    {
      key: 'bacteriaToUnlock',
      label: 'Bacteria eaten to unlock',
      ...plainCount,
      source: { kind: FACT_SOURCE.catalog, quantity: { id: CATALOG_QUANTITY.unlockCount, argument: { traitId } } },
    },
    {
      key: 'tierCount',
      label: 'Tiers',
      ...plainCount,
      source: { kind: FACT_SOURCE.catalog, quantity: { id: CATALOG_QUANTITY.tierCount, argument: { traitId } } },
    },
  ];
}

/** A content row: the trait it writes for, then its copy. */
export interface TraitEntryContentRow extends TraitEntryContent {
  readonly traitId: TraitId;
}

/** `Rows` when it holds a row for every trait id, `never` otherwise, so a catalog trait without copy fails `typecheck`. */
type WithEveryTrait<Rows extends readonly TraitEntryContentRow[]> =
  Exclude<TraitId, Rows[number]['traitId']> extends never ? Rows : never;

function contentByTrait<Rows extends readonly TraitEntryContentRow[]>(
  rows: WithEveryTrait<Rows>,
): Readonly<Record<TraitId, TraitEntryContent>> {
  return Object.fromEntries(rows.map((row) => [row.traitId, row])) as Record<TraitId, TraitEntryContent>;
}

/** Catalog ids are snake_case, so the copy is rows rather than a record literal keyed by id. */
const TRAIT_ENTRY_ROWS = [
  {
    traitId: 'nucleoid',
    summary:
      'A loose coil of genetic thread. It turns more of what you eat into DNA, and owning it makes you a [[stage:prokaryote]].',
    tierBodies: [
      'The coil forms: DNA from every source {dnaGainMultiplier}.',
      'The coil gathers more loops: DNA from every source {dnaGainMultiplier}.',
      'The coil is at its densest: DNA from every source {dnaGainMultiplier}.',
    ],
    seeAlso: ['trait:nuclear_envelope'],
  },
  {
    traitId: 'simple_flagellum',
    summary: 'A whip of protein that drives the cell forward. It makes a sprint faster and ready again sooner.',
    tierBodies: [
      'Sprint speed {sprintSpeedMultiplierBonus}, and the sprint recharges {sprintCooldownSecondsDelta} sooner.',
      'A longer whip: sprint speed {sprintSpeedMultiplierBonus}, recharge {sprintCooldownSecondsDelta}.',
      'The full whip: sprint speed {sprintSpeedMultiplierBonus}, recharge {sprintCooldownSecondsDelta}.',
    ],
    seeAlso: ['trait:cilia'],
  },
  {
    traitId: 'cell_wall',
    summary:
      'A rigid second rim inside the membrane. Bigger cells need more mass to engulf you and take longer to absorb you, but the weight slows you down.',
    tierBodies: [
      'Harder to engulf by {membraneRatioBonus}; absorbing you takes {absorbDurationMultiplierAsPrey} longer.',
      'A thicker wall: harder to engulf by {membraneRatioBonus}, absorbing you takes {absorbDurationMultiplierAsPrey} longer.',
      'The thickest wall: harder to engulf by {membraneRatioBonus}, at a speed cost of {speedMultiplier}.',
    ],
    seeAlso: ['trait:diatom_shell'],
  },
  {
    traitId: 'ribosomes',
    summary: 'Studs that build proteins from food. Every mote you eat gives you more mass.',
    tierBodies: [
      'Food gives {digestionFactorBonus} mass.',
      'A denser stipple of studs: food gives {digestionFactorBonus} mass.',
      'Studs line the whole membrane: food gives {digestionFactorBonus} mass.',
    ],
    seeAlso: ['trait:food_vacuole'],
  },
  {
    traitId: 'mitochondrion',
    summary:
      'An aerobic bacterium you swallowed and kept. It burns fuel for you, so you lose mass more slowly and sprint harder. Owning it starts [[stage:endosymbiosis]].',
    tierBodies: [
      'Mass decay {decayMultiplier}, sprint speed {sprintSpeedMultiplierBonus}.',
      'A second bean: mass decay {decayMultiplier}, sprint speed {sprintSpeedMultiplierBonus}.',
      'A third bean: mass decay {decayMultiplier}, sprint speed {sprintSpeedMultiplierBonus}.',
    ],
    seeAlso: ['trait:chloroplast'],
  },
  {
    traitId: 'chloroplast',
    summary:
      'A photosynthetic bacterium you swallowed and kept. It grows you in sunlight and slows your decay. Owning it starts [[stage:endosymbiosis]].',
    tierBodies: [
      'In the sunlit shallows you gain {photosynthesisMassPerSecond}; mass decay {decayMultiplier}.',
      'A second lens: {photosynthesisMassPerSecond} in sunlight, mass decay {decayMultiplier}.',
      'A third lens: {photosynthesisMassPerSecond} in sunlight, mass decay {decayMultiplier}.',
    ],
    seeAlso: ['trait:mitochondrion', 'trait:euglena_eyespot'],
  },
  {
    traitId: 'nuclear_envelope',
    summary:
      'The coil gathers into a true nucleus with its own rim. It protects your progress: part of your DNA toward the next level survives death. Owning it makes you a [[stage:eukaryote]].',
    tierBodies: [
      'Keeps {dnaKeptOnDeathFraction} of your level progress on death.',
      'A brighter rim: keeps {dnaKeptOnDeathFraction} on death.',
      'The brightest rim: keeps {dnaKeptOnDeathFraction} on death.',
    ],
    seeAlso: ['trait:nucleoid'],
  },
  {
    traitId: 'cytoskeleton',
    summary:
      'A lattice of fibres under the membrane. You turn and reach speed faster, and you struggle harder when something tries to engulf you.',
    tierBodies: [
      'Acceleration {accelerationSecondsMultiplier}, struggle {struggleSlowdownBonus}.',
      'A tighter lattice: acceleration {accelerationSecondsMultiplier}, struggle {struggleSlowdownBonus}.',
      'A taut lattice: acceleration {accelerationSecondsMultiplier}, struggle {struggleSlowdownBonus}.',
    ],
    seeAlso: ['trait:amoeba_pseudopods'],
  },
  {
    traitId: 'cilia',
    summary: 'A fringe of beating hairs. You swim faster and slip a predator’s grip more easily.',
    tierBodies: [
      'Speed {speedMultiplier}, grip resistance {gripResistanceBonus}.',
      'A fuller fringe: speed {speedMultiplier}, grip resistance {gripResistanceBonus}.',
      'The fullest fringe: speed {speedMultiplier}, grip resistance {gripResistanceBonus}.',
    ],
    seeAlso: ['trait:paramecium_cilia'],
  },
  {
    traitId: 'food_vacuole',
    summary: 'Digestive bubbles for prey. You absorb what you engulf faster and keep more of its mass.',
    tierBodies: [
      'Absorb speed {absorbDurationMultiplierAsPredator}, mass from engulfs {engulfMassYieldBonus}.',
      'More bubbles: absorb speed {absorbDurationMultiplierAsPredator}, mass from engulfs {engulfMassYieldBonus}.',
      'Prey dissolves visibly: absorb speed {absorbDurationMultiplierAsPredator}, mass from engulfs {engulfMassYieldBonus}.',
    ],
    seeAlso: ['trait:ribosomes'],
  },
  {
    traitId: 'toxin_vacuole',
    summary: 'A violet vacuole of poison. Any cell touching you loses a share of its mass every second.',
    tierBodies: [
      'Touching cells lose {toxinDrainFractionPerSecond} of their mass.',
      'A stronger brew: touching cells lose {toxinDrainFractionPerSecond}.',
      'The strongest brew: touching cells lose {toxinDrainFractionPerSecond}.',
    ],
    seeAlso: ['trait:stentor_trumpet'],
  },
  {
    traitId: 'amoeba_pseudopods',
    summary:
      'Your membrane flows into blunt lobes. You push through gel, wrap prey faster and hold it tighter. One form per cell.',
    tierBodies: [
      'Gel slows you to no less than {gelSpeedFactorFloor}; wrap speed {wrapDurationMultiplierAsPredator}, grip {gripStrengthBonus}.',
      'More lobes: gel floor {gelSpeedFactorFloor}, wrap speed {wrapDurationMultiplierAsPredator}, grip {gripStrengthBonus}.',
      'The full blob: gel floor {gelSpeedFactorFloor}, wrap speed {wrapDurationMultiplierAsPredator}, grip {gripStrengthBonus}.',
    ],
    seeAlso: ['trait:cytoskeleton'],
  },
  {
    traitId: 'paramecium_cilia',
    summary: 'A slipper-shaped body covered in cilia. The fastest swimmer, and hard to hold on to. One form per cell.',
    tierBodies: [
      'Speed {speedMultiplier}, acceleration {accelerationSecondsMultiplier}, struggle {struggleSlowdownBonus}.',
      'A longer slipper: speed {speedMultiplier}, acceleration {accelerationSecondsMultiplier}, struggle {struggleSlowdownBonus}.',
      'The longest slipper: speed {speedMultiplier}, acceleration {accelerationSecondsMultiplier}, struggle {struggleSlowdownBonus}.',
    ],
    seeAlso: ['trait:cilia'],
  },
  {
    traitId: 'euglena_eyespot',
    summary: 'A red eyespot that finds food. Motes near you drift toward you on their own. One form per cell.',
    tierBodies: [
      'Pulls food from {attractRangeInRadii} at {attractSpeed}.',
      'A sharper eye: pulls food from {attractRangeInRadii} at {attractSpeed}.',
      'The sharpest eye: pulls food from {attractRangeInRadii} at {attractSpeed}.',
    ],
    seeAlso: ['trait:chloroplast'],
  },
  {
    traitId: 'diatom_shell',
    summary:
      'A glass shell bristling with spines. Whatever engulfs you takes longer, bleeds on the spines and may spit you out. One form per cell.',
    tierBodies: [
      'Absorbing you takes {absorbDurationMultiplierAsPrey} longer; spines drain {spikeDrainFractionPerSecond}, spit-out chance {spitOutChancePerSecond}.',
      'More spines: spines drain {spikeDrainFractionPerSecond}, spit-out chance {spitOutChancePerSecond}; speed {speedMultiplier}.',
      'The full star: absorbing you takes {absorbDurationMultiplierAsPrey} longer, spit-out chance {spitOutChancePerSecond}.',
    ],
    seeAlso: ['trait:cell_wall'],
  },
  {
    traitId: 'stentor_trumpet',
    summary:
      'A flared trumpet body. Your toxin reaches cells that are near you without touching, and you digest food better. One form per cell.',
    tierBodies: [
      'Toxin reaches {toxinAuraRangeInRadii}; digestion {digestionFactorBonus}.',
      'A wider flare: toxin reaches {toxinAuraRangeInRadii}, digestion {digestionFactorBonus}.',
      'The widest flare: toxin reaches {toxinAuraRangeInRadii}, digestion {digestionFactorBonus}.',
    ],
    seeAlso: ['trait:toxin_vacuole'],
  },
] as const satisfies readonly TraitEntryContentRow[];

export const TRAIT_ENTRY_CONTENT = contentByTrait<typeof TRAIT_ENTRY_ROWS>(TRAIT_ENTRY_ROWS);
