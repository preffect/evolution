// The hold-Tab "affecting you" panel (docs/ui/overlays.md §3.7, decision #324): everything acting on the own cell
// at once, top-left, while the full leaderboard is open and the player is alive. It opens and closes with the
// board, so there is no second key and no second `openOverlay` value; while spectating only the board opens,
// because there is no cell to describe.
//
// It decides nothing: `affectingRowsFor` builds every row and `sparklinePointsFor` the one line, both pure. The
// panel is the kit's `<ui-panel variant="side">` (components-and-constants.md §10.2), so it and the ESC menu are
// one family and no second panel style exists; its rows are kit facts tables.
//
// Not interactive: `role="region"` with a label, nothing focusable, no focus trap. Tab is being held, so focus
// stays where it was. Its facts reach assistive technology through the status mirror (docs/ui/hud.md §3.1.4),
// which already carries the mass, its trend and rate, the causes, the zone and the traits.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { TraitId } from '@evolution/shared';
import { TraitGlyphComponent } from '../glyphs/trait-glyph.component';
import { TRAIT_GLYPH_LOD } from '../glyphs/trait-glyph-view';
import { GameStateService } from '../state/game-state.service';
import { UiFactMarkerDirective, UiFactsTableComponent, type UiFactRow } from '../../ui-kit/ui-facts-table.component';
import { UiPanelComponent } from '../../ui-kit/ui-panel.component';
import { UiPanelSectionComponent } from '../../ui-kit/ui-panel-section.component';
import { AFFECTING_SPARKLINE_HEIGHT_PX, AFFECTING_SPARKLINE_WIDTH_PX } from './hud-constants';
import { HudStateService } from './hud-state.service';
import { HUD_TEST_ID } from './test-ids';
import { affectingRowsFor, type AffectingRow, type AffectingSection } from './format/affecting-rows';
import { roundClockStateFor } from './format/round-clock';
import { sparklinePointsFor } from './format/sparkline';

/** The region's name, the one piece of text the panel itself owns (§3.7). */
const PANEL_LABEL = 'Affecting you';

@Component({
  selector: 'app-affecting-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TraitGlyphComponent,
    UiFactMarkerDirective,
    UiFactsTableComponent,
    UiPanelComponent,
    UiPanelSectionComponent,
  ],
  template: `
    @if (panel(); as affecting) {
      <ui-panel variant="side" [testId]="testId.affectingPanel" [attr.aria-label]="panelLabel">
        <!-- The one row the kit has no shape for: the mass numeral, its trend glyph, the rate and the line. -->
        <div class="mass" [attr.data-testid]="testId.affectingMass" [attr.data-trend]="affecting.mass.trend">
          <span class="figure">{{ affecting.mass.massText }}</span>
          @if (affecting.mass.rateText; as rate) {
            <!-- A triangle, so the direction is geometry and not colour alone (docs/ui/hud.md §3.1.5). -->
            <svg class="trend" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
              <polygon points="5,0 10,10 0,10" fill="currentColor" />
            </svg>
            <span class="rate">{{ rate }}</span>
          }
          @if (sparklinePoints(); as points) {
            <svg class="sparkline" [attr.viewBox]="sparklineViewBox" aria-hidden="true" focusable="false">
              <polyline [attr.points]="points" fill="none" stroke="currentColor" />
            </svg>
          }
        </div>
        @for (section of affecting.sections; track section.sectionId) {
          <ui-panel-section [heading]="section.heading">
            <!-- The trait rows come first and wear their #312 glyph; the plain rows follow (§3.7's row order). -->
            @if (traitRowsOf(section); as traitRows) {
              @if (traitRows.length > 0) {
                <ui-facts-table [rows]="traitRows">
                  <ng-template uiFactMarker let-row>
                    @if (traitIdOf(row); as traitId) {
                      <app-trait-glyph [traitId]="traitId" [lod]="listLod" still />
                    }
                  </ng-template>
                </ui-facts-table>
              }
            }
            @if (plainRowsOf(section); as plainRows) {
              @if (plainRows.length > 0) {
                <ui-facts-table [rows]="plainRows" />
              }
            }
          </ui-panel-section>
        }
      </ui-panel>
    }
  `,
  styleUrl: './affecting-panel.component.css',
})
export class AffectingPanelComponent {
  // What the template draws with, before what it draws from.
  protected readonly testId = HUD_TEST_ID;
  protected readonly panelLabel = PANEL_LABEL;
  protected readonly listLod = TRAIT_GLYPH_LOD.list;
  protected readonly sparklineViewBox = `0 0 ${AFFECTING_SPARKLINE_WIDTH_PX} ${AFFECTING_SPARKLINE_HEIGHT_PX}`;

  private readonly gameState = inject(GameStateService);
  private readonly hudState = inject(HudStateService);

  /**
   * The whole panel, or `null` when there is nothing to describe: the board is not open, or the player is
   * spectating and `ownCellIndicators` has already gone `null` for exactly that reason.
   */
  protected readonly panel = computed(() => {
    const indicators = this.gameState.ownCellIndicators();
    const ownCell = this.gameState.ownCell();
    const ownProgress = this.gameState.ownProgress();
    const balance = this.gameState.balance();
    const snapshot = this.gameState.snapshot();
    // The world row needs the round's length to place the world clock, so the panel waits for the room's config
    // rather than guessing one: a few frames without it is better than a standing that is quietly wrong.
    const roundDurationSeconds = this.gameState.sessionConfig()?.roundDurationSeconds ?? null;
    if (!this.hudState.isFullLeaderboardOpen()) return null;
    if (indicators === null || ownCell === null || ownProgress === null || balance === null) return null;
    if (snapshot === null || roundDurationSeconds === null) return null;
    return affectingRowsFor({
      ownCell,
      ownProgress,
      indicators,
      balance,
      cells: this.gameState.cells(),
      players: this.gameState.players(),
      roundClock: roundClockStateFor({
        timeLeftMs: this.gameState.roundTimeLeftMs(),
        roundPhase: this.gameState.roundPhase(),
        roundDurationSeconds,
        bloomStartFraction: balance.session.ROUND_BLOOM_START_FRACTION,
        foodBloomMultiplier: balance.ecology.FOOD_BLOOM_SPAWN_MULTIPLIER,
        dnaFragmentBloomMultiplier: balance.ecology.DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER,
      }),
      tick: snapshot.tick,
      roundStartTick: snapshot.roundStartTick,
      roundDurationSeconds,
      masses: this.gameState.ownMasses(),
      foodGainPerSecond: this.gameState.foodGainPerSecond(),
    });
  });

  protected readonly sparklinePoints = computed(() => {
    const mass = this.panel()?.mass;
    if (mass === undefined) return null;
    return sparklinePointsFor(mass.masses, AFFECTING_SPARKLINE_WIDTH_PX, AFFECTING_SPARKLINE_HEIGHT_PX);
  });

  /** The owned-trait rows, which the glyph slot marks. */
  protected traitRowsOf(section: AffectingSection): readonly AffectingRow[] {
    return section.rows.filter((row) => row.traitId !== null);
  }

  /** Every other row, which the kit marks with its own dot or ring. */
  protected plainRowsOf(section: AffectingSection): readonly AffectingRow[] {
    return section.rows.filter((row) => row.traitId === null);
  }

  /** The trait a marker slot draws; the rows handed to that table always carry one. */
  protected traitIdOf(row: UiFactRow): TraitId | null {
    return (row as AffectingRow).traitId;
  }
}
