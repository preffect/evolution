// The trait pages' copy (docs/architecture/encyclopedia.md §12.6): a summary, one short clause per tier and
// hand-picked links. The title is the catalog's `name`; the tier headings and the Effects by tier table are generated
// from the live tier table, so the tier clauses carry no value of their own. No number and no arithmetic here (lint).

import type { TraitId, TraitTiers } from '@evolution/shared';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { balancePath } from '../facts/balance-path';
import { CATALOG_QUANTITY } from '../facts/catalog-quantities';
import { DERIVED_LINK } from '../facts/derived-links';
import type { EntryId } from '../model/entry-id';
import { FACT_SOURCE, type FactDefinition } from '../model/fact';
import type { ProseTemplate } from '../model/prose';

/** A tuple of the same length as `Tiers`, one template per tier (a homomorphic mapping keeps the tuple shape). */
type ProsePerTier<Tiers> = { readonly [Tier in keyof Tiers]: ProseTemplate };
/** One clause per tier of the shared tier-table shape, so a fourth tier without copy fails `typecheck`. */
export type TraitTierBodies = ProsePerTier<TraitTiers>;

export interface TraitEntryContent {
  readonly summary: ProseTemplate;
  readonly tierBodies: TraitTierBodies;
  readonly seeAlso: readonly EntryId[];
  /** Facts only this trait's page shows, after the unlock and ladder facts every trait shares. */
  readonly extraFacts?: readonly FactDefinition[];
}

/** The unlock and ladder facts every trait page shows, in table order; the first is the landing tile's headline. */
export function traitFacts(traitId: TraitId): readonly FactDefinition[] {
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
      unit: QUANTITY_UNIT.count,
      presentation: QUANTITY_PRESENTATION.plain,
      source: { kind: FACT_SOURCE.catalog, quantity: { id: CATALOG_QUANTITY.unlockCount, argument: { traitId } } },
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

/** The rows keyed by trait; a trait with two rows is refused, since one would silently hide the other. */
export function contentByTrait<Rows extends readonly TraitEntryContentRow[]>(
  rows: WithEveryTrait<Rows>,
): Readonly<Record<TraitId, TraitEntryContent>> {
  const byTrait = new Map(rows.map((row) => [row.traitId, row] as const));
  if (byTrait.size !== rows.length) throw new Error('A trait has more than one content row');
  return Object.fromEntries(byTrait) as unknown as Record<TraitId, TraitEntryContent>;
}

/** Catalog ids are snake_case, so the copy is rows rather than a record literal keyed by id. */
export const TRAIT_ENTRY_ROWS = [
  {
    traitId: 'nucleoid',
    summary:
      'A loose coil of genetic thread. Every DNA gain is bigger, and owning it makes you a [[stage:prokaryote]].',
    tierBodies: ['A loose coil forms.', 'The coil gathers more loops.', 'The coil is at its densest.'],
    seeAlso: ['trait:nuclear_envelope'],
  },
  {
    traitId: 'simple_flagellum',
    summary:
      'A whip of protein that drives the cell forward. You swim a little faster, and your sprint is faster and ready again sooner.',
    tierBodies: ['A short whip.', 'A longer whip.', 'The full whip.'],
    seeAlso: ['trait:cilia'],
  },
  {
    traitId: 'cell_wall',
    summary:
      'A rigid second rim inside the membrane. A predator must be bigger to engulf you and takes longer to absorb you, but the wall slows you down.',
    tierBodies: ['A second rim.', 'A thicker wall.', 'The thickest wall.'],
    seeAlso: ['trait:diatom_shell'],
  },
  {
    traitId: 'ribosomes',
    summary: 'Studs that build proteins from food. Every mote you eat gives you more mass.',
    tierBodies: ['A fine stipple of studs.', 'A denser stipple of studs.', 'Studs line the whole membrane.'],
    seeAlso: ['trait:food_vacuole'],
  },
  {
    traitId: 'mitochondrion',
    summary:
      'An aerobic bacterium you swallowed and kept. It burns fuel for you, so you lose mass more slowly and sprint harder. Owning it starts [[stage:endosymbiosis]].',
    tierBodies: ['One bean.', 'A second bean.', 'A third bean.'],
    seeAlso: ['trait:chloroplast'],
  },
  {
    traitId: 'chloroplast',
    summary:
      'A photosynthetic bacterium you swallowed and kept. It grows you in sunlight and slows your decay. Owning it starts [[stage:endosymbiosis]].',
    tierBodies: ['One green lens.', 'A second lens.', 'A third lens.'],
    seeAlso: ['trait:mitochondrion', 'trait:euglena_eyespot'],
  },
  {
    traitId: 'nuclear_envelope',
    summary:
      'The coil gathers into a true nucleus with its own rim. It protects your progress: part of your DNA toward the next level survives death. Owning it makes you a [[stage:eukaryote]].',
    tierBodies: ['The nucleus gains its rim.', 'A brighter rim.', 'The brightest rim.'],
    seeAlso: ['trait:nucleoid'],
  },
  {
    traitId: 'cytoskeleton',
    summary:
      'A lattice of fibres under the membrane. You turn and reach speed faster, and you struggle harder when something tries to engulf you.',
    tierBodies: ['A faint lattice.', 'A tighter lattice.', 'A taut lattice.'],
    seeAlso: ['trait:amoeba_pseudopods'],
  },
  {
    traitId: 'cilia',
    summary: 'A fringe of beating hairs. You swim faster and slip a predator’s grip more easily.',
    tierBodies: ['A ring of short hairs.', 'A fuller fringe.', 'The fullest fringe.'],
    seeAlso: ['trait:paramecium_cilia'],
  },
  {
    traitId: 'food_vacuole',
    summary: 'Digestive bubbles for prey. You absorb what you engulf faster and keep more of its mass.',
    tierBodies: ['A few digestive bubbles.', 'More bubbles.', 'Prey dissolves visibly faster.'],
    seeAlso: ['trait:ribosomes'],
  },
  {
    traitId: 'toxin_vacuole',
    summary:
      'A violet vacuole of poison. Cells touching you lose mass every second. A cell that swallows you takes a dose {swallowedDose} as strong, set by your mass, until it lets you go. The poison never kills.',
    tierBodies: ['A faint brew.', 'A stronger brew.', 'The strongest brew.'],
    seeAlso: ['trait:stentor_trumpet'],
    extraFacts: [
      {
        key: 'swallowedDose',
        label: 'Dose once swallowed',
        unit: QUANTITY_UNIT.multiplier,
        presentation: QUANTITY_PRESENTATION.plain,
        source: { kind: FACT_SOURCE.balance, path: balancePath('absorption', 'ENGULF_SWALLOWED_TOXIN_MULTIPLIER') },
      },
    ],
  },
  {
    traitId: 'amoeba_pseudopods',
    summary:
      'Your membrane flows into blunt lobes. You push through gel, wrap prey faster and hold it tighter. One form per cell.',
    tierBodies: ['Blunt lobes.', 'More lobes.', 'The full blob.'],
    seeAlso: ['trait:cytoskeleton'],
  },
  {
    traitId: 'paramecium_cilia',
    summary:
      'A slipper-shaped body covered in cilia. Its speed stacks on the [[trait:cilia]] it grows from, and it twists hard against a wrap. One form per cell.',
    tierBodies: ['A short slipper.', 'A longer slipper.', 'The longest slipper.'],
    seeAlso: ['trait:cilia'],
  },
  {
    traitId: 'euglena_eyespot',
    summary: 'A red eyespot that finds food. Motes and DNA fragments near you drift toward you. One form per cell.',
    tierBodies: ['A red eyespot.', 'A sharper eye.', 'The sharpest eye.'],
    seeAlso: ['trait:chloroplast'],
  },
  {
    traitId: 'diatom_shell',
    summary:
      'A glass shell bristling with spines. Once swallowed you take longer to absorb, the spines cut the predator, and it may spit you out. One form per cell.',
    tierBodies: ['A glass shell with spines.', 'More spines.', 'The full star.'],
    seeAlso: ['trait:cell_wall'],
  },
  {
    traitId: 'stentor_trumpet',
    summary:
      'A flared trumpet body. At higher tiers your toxin reaches small cells before they touch you, and you digest food better. One form per cell.',
    tierBodies: ['A flared trumpet.', 'A wider flare.', 'The widest flare.'],
    seeAlso: ['trait:toxin_vacuole'],
  },
] as const satisfies readonly TraitEntryContentRow[];

export const TRAIT_ENTRY_CONTENT = contentByTrait<typeof TRAIT_ENTRY_ROWS>(TRAIT_ENTRY_ROWS);
