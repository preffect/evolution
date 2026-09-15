// The ladder stages' copy (docs/architecture/encyclopedia.md §12.6, docs/game-design/core.md §3). What a stage opens
// and the traits that reach it are derived links over the live catalog and `STAGE_GATE_TRAITS`, never lists written
// here, and the copy names no count. No number and no arithmetic (lint).

import type { CellStage } from '@evolution/shared';
import type { EntryId } from '../model/entry-id';
import type { ProseTemplate } from '../model/prose';
import { FACT_SOURCE, type FactDefinition } from '../model/fact';
import { DERIVED_LINK } from '../facts/derived-links';

export interface StageEntryContent {
  readonly title: string;
  readonly summary: ProseTemplate;
  readonly seeAlso: readonly EntryId[];
}

/** The traits a stage opens (the landing tile's headline; none for the last stage), then the traits that reach it. */
export function stageFacts(stage: CellStage): readonly FactDefinition[] {
  return [
    {
      key: 'opens',
      label: 'Opens',
      source: { kind: FACT_SOURCE.link, link: { id: DERIVED_LINK.stageTraits, argument: { stage } } },
    },
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
    summary: 'Where every cell begins: a membrane and a few granules, no nucleus. Your first traits are offered here.',
    seeAlso: ['stage:prokaryote'],
  },
  prokaryote: {
    title: 'Prokaryote',
    summary:
      'A cell with its genetic thread gathered into a coil, like a bacterium. You get here by owning {reachedBy}. It opens the first organelles; the endosymbionts among them also need the right bacteria eaten.',
    seeAlso: ['stage:protocell', 'stage:endosymbiosis'],
  },
  endosymbiosis: {
    title: 'Endosymbiosis',
    summary:
      'You swallowed a bacterium and it stayed to work for you. Owning one of {reachedBy} brings you here, and it opens the true nucleus.',
    seeAlso: ['stage:prokaryote', 'stage:eukaryote'],
  },
  eukaryote: {
    title: 'Eukaryote',
    summary:
      'A true cell with a nucleus of its own, reached by owning {reachedBy}. The richest rung: new organelles and the body forms.',
    seeAlso: ['stage:endosymbiosis', 'stage:specialised'],
  },
  specialised: {
    title: 'Specialised',
    summary:
      'You have grown a body form, one of {reachedBy}, and a cell holds only one. Nothing new opens here: later picks raise your tiers and fill in the organelles you skipped.',
    seeAlso: ['stage:eukaryote'],
  },
};
