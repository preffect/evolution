// The ladder stages' copy (docs/architecture/encyclopedia.md §12.6, docs/game-design/core.md §3). The gate traits are
// a derived link over the live `STAGE_GATE_TRAITS`, never a list written here. No number and no arithmetic (lint).

import type { CellStage } from '@evolution/shared';
import { DERIVED_LINK } from '../facts/derived-links';
import type { EntryId } from '../model/entry-id';
import { FACT_SOURCE, type FactDefinition } from '../model/fact';
import type { ProseTemplate } from '../model/prose';

export interface StageEntryContent {
  readonly title: string;
  readonly summary: ProseTemplate;
  readonly seeAlso: readonly EntryId[];
}

/** The facts every stage page shows: the traits that reach it (none for the starting stage). */
export function stageFacts(stage: CellStage): readonly FactDefinition[] {
  return [
    {
      key: 'reachedBy',
      label: 'Reached by',
      source: { kind: FACT_SOURCE.link, link: { id: DERIVED_LINK.stageGateTraits, argument: { stage } } },
    },
  ];
}

export const STAGE_ENTRY_CONTENT: Readonly<Record<CellStage, StageEntryContent>> = {
  protocell: {
    title: 'Protocell',
    summary:
      'Where every cell begins, and where you begin again after a respawn: a membrane and a few granules. Your first traits are offered here.',
    seeAlso: ['stage:prokaryote'],
  },
  prokaryote: {
    title: 'Prokaryote',
    summary:
      'A cell with its genetic thread gathered into a coil, like a bacterium. You get here by owning {reachedBy}. It opens the organelles, including the two you can only earn by eating the right bacteria.',
    seeAlso: ['stage:protocell', 'stage:endosymbiosis'],
  },
  endosymbiosis: {
    title: 'Endosymbiosis',
    summary:
      'You swallowed a bacterium and it stayed to work for you. Owning either {reachedBy} reaches this stage, and it opens the true nucleus.',
    seeAlso: ['stage:prokaryote', 'stage:eukaryote'],
  },
  eukaryote: {
    title: 'Eukaryote',
    summary:
      'A true cell with a nucleus of its own, reached by owning {reachedBy}. The richest rung: new organelles and the five body forms.',
    seeAlso: ['stage:endosymbiosis', 'stage:specialised'],
  },
  specialised: {
    title: 'Specialised',
    summary:
      'You have committed to a body form, one of {reachedBy}. A cell holds only one form. Nothing new opens here; your remaining picks deepen the traits you own.',
    seeAlso: ['stage:eukaryote'],
  },
};
