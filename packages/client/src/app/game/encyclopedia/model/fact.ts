// Facts: values bound to code (docs/architecture/encyclopedia.md §12.3). A fact names where its value comes from, a
// balance leaf, a row of the closed formula table, a catalog count or a derived link, and never holds a number.
// Every value is read from the live balance in the `FactContext`.

import type { BalanceConfig, ValueOf } from '@evolution/shared';
import type { QuantityPresentation, QuantityUnit } from '../../quantities/quantity-unit';
import type { BalancePath } from '../facts/balance-path';
import type { CatalogQuantityCall } from '../facts/catalog-quantities';
import type { DerivedLinkCall } from '../facts/derived-links';
import type { FactFormulaCall } from '../facts/formula-table';

export interface FactContext {
  /** The live balance: the room's copy in a room, `DEFAULT_BALANCE` outside one. */
  readonly balance: BalanceConfig;
}

export const FACT_SOURCE = { balance: 'balance', formula: 'formula', catalog: 'catalog', link: 'link' } as const;
export type FactSourceKind = ValueOf<typeof FACT_SOURCE>;

export type ValueFactSource =
  /** One balance leaf, shown as is: `balancePath('ecology', 'ALGAE_MASS')`. */
  | { readonly kind: typeof FACT_SOURCE.balance; readonly path: BalancePath }
  /** A row of the closed formula table with its typed, number-free argument. */
  | { readonly kind: typeof FACT_SOURCE.formula; readonly formula: FactFormulaCall }
  /** A count over structure from the closed selector set; a count that does not apply to the subject is no fact. */
  | { readonly kind: typeof FACT_SOURCE.catalog; readonly quantity: CatalogQuantityCall };

/** A link-valued fact from the closed derived-link table: one resolved fact per target, none without a target. */
export interface LinkFactSource {
  readonly kind: typeof FACT_SOURCE.link;
  readonly link: DerivedLinkCall;
}

export type FactSource = ValueFactSource | LinkFactSource;

interface FactDefinitionBase {
  /** camelCase; what prose tokens and test ids name. */
  readonly key: string;
  readonly label: string;
}

/** A number, formatted through `formatQuantity` in its unit and presentation (§12.5). */
export interface ValueFactDefinition extends FactDefinitionBase {
  readonly unit: QuantityUnit;
  readonly presentation: QuantityPresentation;
  readonly source: ValueFactSource;
}

/** A link to another entry, shown as its title: `Offered from`, `Climbs to`. */
export interface LinkFactDefinition extends FactDefinitionBase {
  readonly source: LinkFactSource;
}

export type FactDefinition = ValueFactDefinition | LinkFactDefinition;

export function isLinkFact(definition: FactDefinition): definition is LinkFactDefinition {
  return definition.source.kind === FACT_SOURCE.link;
}
