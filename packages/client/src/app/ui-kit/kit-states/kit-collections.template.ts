// The collections sheet's template, beside its component so the component file keeps to its data and state.

export const KIT_COLLECTIONS_TEMPLATE = `
<div class="page collections" uiSurface #surface="uiSurface" [attr.data-testid]="testId.page">
  <header class="page-header">
    <h1 class="page-title">UI kit collections</h1>
    <p class="page-caption">components-and-constants.md §10.2 · every state at scale {{ surface.scale() }}</p>
  </header>

  <section class="state-grid" aria-label="Rail items and list rows in every state">
    <span></span>
    @for (row of rowStates; track row.state) {
      <span class="state-label">{{ row.label }}</span>
    }
    <span class="section-label">Rail item</span>
    @for (row of rowStates; track row.state) {
      <ui-rail class="well" [selectedId]="row.isSelected ? stateSample.category?.id ?? null : null">
        <ui-rail-item
          [itemId]="stateSample.category?.id ?? ''"
          [count]="stateSample.category?.count ?? null"
          [isDisabled]="row.isDisabled"
          [testId]="row.railTestId"
        >
          <span uiLeading class="rail-icon"></span>{{ stateSample.category?.label }}
        </ui-rail-item>
      </ui-rail>
    }
    <span class="section-label">List row</span>
    @for (row of rowStates; track row.state) {
      <ui-list [selectedId]="row.isSelected ? 'cell-wall' : null">
        <ui-list-row itemId="cell-wall" [isDisabled]="row.isDisabled" [testId]="row.listTestId">
          <ui-medallion uiLeading><span class="mote" [style.background-color]="stateSample.cellWall"></span></ui-medallion>
          Cell Wall
        </ui-list-row>
      </ui-list>
    }
  </section>

  <div class="lower">
    <section class="samples" aria-label="A horizontal rail, chips, link chips, medallions and alert pills">
      <h2 class="section-label">Horizontal rail</h2>
      <div class="sample-row">
        <ui-rail orientation="horizontal" selectedId="effects">
          @for (tab of tabs; track tab.id) {
            <ui-rail-item [itemId]="tab.id" [testId]="sampleTestId('tab', tab.id)">{{ tab.title }}</ui-rail-item>
          }
        </ui-rail>
      </div>

      <h2 class="section-label">Chips</h2>
      <div class="sample-row">
        @for (chip of chips; track chip.label) {
          <ui-chip [tone]="chip.tone" [dotColour]="chip.dotColour">{{ chip.label }}</ui-chip>
        }
      </div>

      <h2 class="section-label">Link chip: rest, hover, pressed, focus · medallions</h2>
      <div class="sample-row">
        @for (chipTestId of linkChipTestIds; track chipTestId) {
          <button uiLinkChip type="button" [testId]="chipTestId">Chloroplast</button>
        }
        <ui-medallion><span class="mote" [style.background-color]="stateSample.cellWall"></span></ui-medallion>
        <ui-medallion tone="gold">I</ui-medallion>
        <ui-medallion size="card"><span class="mote mote-card" [style.background-color]="stateSample.cellWall"></span></ui-medallion>
        <ui-medallion size="card" tone="gold">II</ui-medallion>
      </div>

      <h2 class="section-label">Alert strip</h2>
      <div class="sample-row wrap">
        @for (alert of alerts; track alert.id) {
          <button uiAlertPill type="button" [tone]="alert.tone" [figure]="alert.figure" [testId]="sampleTestId('alert', alert.id)">
            {{ alert.label }}
          </button>
        }
      </div>
    </section>

    <section class="browser" aria-label="A search field over a rail and a list, live">
      <div class="browser-header">
        <ui-search-field placeholder="Search" keyHint="/" [testId]="testId.search" [(query)]="query" />
      </div>
      <div class="browser-body">
        <ui-scroll-area class="browser-rail" label="Categories">
          <ui-rail [testId]="testId.rail" [selectedId]="railSelection()" (selectedIdChange)="showCategory($event)">
            @for (category of categories; track category.id) {
              <ui-rail-item [itemId]="category.id" [count]="category.count" [testId]="sampleTestId('category', category.id)">
                <span uiLeading class="rail-icon"></span>{{ category.label }}
              </ui-rail-item>
            }
          </ui-rail>
        </ui-scroll-area>
        <ui-scroll-area label="Entries" [testId]="testId.listScroll">
          <ui-list [testId]="testId.list" [shouldSelectionFollowFocus]="true" [(selectedId)]="selectedEntry">
            @for (section of sections(); track section.sectionId) {
              <ui-list-section [heading]="section.heading">
                @for (item of section.entries; track item.id) {
                  <ui-list-row [itemId]="item.id" [testId]="sampleTestId('entry', item.id)">
                    <ui-medallion uiLeading><span class="mote" [style.background-color]="item.colour"></span></ui-medallion>
                    {{ item.title }}
                    @if (item.isOwned) {
                      <ui-medallion uiTrailing tone="gold">I</ui-medallion>
                    }
                  </ui-list-row>
                }
              </ui-list-section>
            }
          </ui-list>
          @if (sections().length === 0) {
            <p class="no-match" [attr.data-testid]="testId.noMatch">No match for "{{ query() }}"</p>
          }
        </ui-scroll-area>
      </div>
    </section>
  </div>
</div>
`;
