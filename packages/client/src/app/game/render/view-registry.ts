// Entity id → view, created and destroyed on the snapshot diff (docs/ARCHITECTURE.md §6). Views
// are dumb; the registry only knows ids. Generic, framework-free.

export interface ViewRegistrySync<Item, View> {
  readonly created: readonly View[];
  readonly kept: readonly View[];
  readonly removed: readonly View[];
  /** Every present item paired with its view, in the items' order. */
  readonly pairs: readonly (readonly [Item, View])[];
}

export interface ViewRegistryOptions<Item extends { readonly id: string }, View> {
  create(item: Item): View;
  destroy(view: View): void;
}

export class ViewRegistry<Item extends { readonly id: string }, View> {
  private readonly views = new Map<string, View>();

  constructor(private readonly options: ViewRegistryOptions<Item, View>) {}

  /** Creates a view for every new id, keeps the rest and destroys the views whose id is gone. */
  sync(items: readonly Item[]): ViewRegistrySync<Item, View> {
    const created: View[] = [];
    const kept: View[] = [];
    const pairs: (readonly [Item, View])[] = [];
    const present = new Set<string>();
    for (const item of items) {
      present.add(item.id);
      const existing = this.views.get(item.id);
      if (existing === undefined) {
        const view = this.options.create(item);
        this.views.set(item.id, view);
        created.push(view);
        pairs.push([item, view]);
      } else {
        kept.push(existing);
        pairs.push([item, existing]);
      }
    }
    const removed = this.removeMissing(present);
    return { created, kept, removed, pairs };
  }

  private removeMissing(present: ReadonlySet<string>): View[] {
    const removed: View[] = [];
    for (const [id, view] of this.views) {
      if (present.has(id)) continue;
      this.views.delete(id);
      this.options.destroy(view);
      removed.push(view);
    }
    return removed;
  }

  get(id: string): View | undefined {
    return this.views.get(id);
  }

  get size(): number {
    return this.views.size;
  }

  values(): IterableIterator<View> {
    return this.views.values();
  }

  clear(): void {
    for (const view of this.views.values()) this.options.destroy(view);
    this.views.clear();
  }
}
