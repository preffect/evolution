// The HUD's one view of the world (docs/ui/components-and-constants.md §7): derived signals only, never a second model.
// Every component reads facts from here rather than reaching into a service of its own, so what the
// chrome shows and what the wire said can never drift apart.
//
// The facts the chrome needs are the newest snapshot's and the room's, both of which
// `MultiplayerService` already mirrors as signals — `WorldStore` (`net/world-store.ts`) owns the
// *interpolated* world the renderer draws per frame, and nothing on the chrome is interpolated.
// The own-cell signals of docs/ui/components-and-constants.md §7 (`ownCell`, `ownProgress`, `ownCellIndicators`, `threats`,
// `cameraExtent`) arrive with #186/#187 and read the store through the render seam.

import { Injectable, computed, inject, linkedSignal, signal, type Signal } from '@angular/core';
import {
  PLAYER_LIFE_STATE,
  ROUND_PHASE,
  type BalanceConfig,
  type CellView,
  type GameSnapshot,
  type LeaderboardRow,
  type OwnProgressView,
  type PlayerId,
  type PlayerRosterView,
  type RoundPhase,
} from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { CONNECTION_STATE, type ConnectionState } from '../hud/format/connection-banner';
import { hasEngulfedIn } from '../hud/format/relation-labels';
import { relationCandidatesFor, relationsOnScreen, type RelationCandidate } from '../hud/format/relations-for';
import { threatsFor, type Threat } from '../hud/format/threats-for';
import { zoneEntryFor, type ZoneEntryMemory } from '../hud/format/zone-pill';
import { HudStateService } from '../hud/hud-state.service';
import { massTrendFor, type MassTrendMemory } from './mass-trend';
import { ownCellIndicatorsFor, type OwnCellIndicators } from './own-cell-indicators';
import { ownMassHistoryFor, ownMassesFor, type OwnMassHistory } from './own-mass-history';
import { foodGainPerSecondFor, recentEatsFor, type RecentEatsMemory } from './recent-eats';
import type { CameraExtent } from '../render/camera';

const NO_LEADERBOARD: readonly LeaderboardRow[] = [];
const NO_PLAYERS: Readonly<Record<string, PlayerRosterView>> = {};
const NO_CELLS: readonly CellView[] = [];
const NO_THREATS: readonly Threat[] = [];
const NO_RELATIONS: readonly RelationCandidate[] = [];
const NO_MASSES: readonly number[] = [];
const NO_FOOD_GAIN = 0;

/** Two extents that describe the same rectangle; a fresh object per frame is not a new view. */
function isSameCameraExtent(first: CameraExtent | null, second: CameraExtent | null): boolean {
  if (first === second) return true;
  if (first === null || second === null) return false;
  return (
    first.minX === second.minX && first.maxX === second.maxX && first.minY === second.minY && first.maxY === second.maxY
  );
}

/** The newest snapshot with the own cell and progress it names: what the cue memories step on. */
interface OwnSnapshot {
  readonly snapshot: GameSnapshot;
  readonly ownCell: CellView;
  readonly ownProgress: OwnProgressView;
}

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private readonly multiplayer = inject(MultiplayerService);
  private readonly hudState = inject(HudStateService);

  /** `MultiplayerService.playerId()`: who we are (docs/ui/layout.md §1's `me`), `null` before the room names us. */
  readonly ownPlayerId = computed<PlayerId | null>(() => this.multiplayer.playerId());

  /** The round's phase; `playing` until the snapshot says otherwise, so the chrome shows on join. */
  readonly roundPhase = computed<RoundPhase>(() => this.multiplayer.snapshot()?.roundPhase ?? ROUND_PHASE.playing);

  /**
   * The connection banner's state (docs/ui/overlays.md §3.6). `stale` (connected, no snapshot for
   * `SNAPSHOT_STALE_MS`) is #190's, with the clock-driven notices.
   */
  readonly connectionState = computed<ConnectionState>(() =>
    this.multiplayer.connected() ? CONNECTION_STATE.connected : CONNECTION_STATE.disconnected,
  );

  /** The server's newest `error` message, until dismissed; `null` when there is none. */
  readonly serverError = this.multiplayer.lastError.asReadonly();

  /**
   * The newest snapshot's tick: the picker counts its offer down from it (docs/ui/overlays.md §3.2). The chrome is
   * not interpolated, so this is the last tick the server named, not the renderer's smoothed estimate.
   */
  readonly serverTickEstimate = computed<number | null>(() => this.multiplayer.snapshot()?.tick ?? null);

  /** Milliseconds left in the round, or `null` before the first snapshot. */
  readonly roundTimeLeftMs = computed<number | null>(() => this.multiplayer.snapshot()?.roundTimeLeftMs ?? null);

  /** The server's ranking, newest snapshot (docs/ui/hud.md §3.1.1). */
  readonly leaderboard = computed<readonly LeaderboardRow[]>(
    () => this.multiplayer.snapshot()?.leaderboard ?? NO_LEADERBOARD,
  );

  /** Every player's roster row by id: where the leaderboard's and the threat label's names come from. */
  readonly players = computed<Readonly<Record<string, PlayerRosterView>>>(
    () => this.multiplayer.snapshot()?.players ?? NO_PLAYERS,
  );

  /** Seat index per player: the palette and the seat-mark bead count (docs/visual-style/principles-and-palette.md §2). */
  readonly avatarAssignments = this.multiplayer.avatarAssignments.asReadonly();

  /** The room's config: the round length the clock's bloom threshold is a fraction of. */
  readonly sessionConfig = this.multiplayer.sessionConfig.asReadonly();

  /** The live balance of `game_state` / `balance_updated`; `null` before the room's arrives. */
  readonly balance = computed<BalanceConfig | null>(() => this.multiplayer.balance());

  /**
   * Every cell in the newest snapshot: what `threatsFor` asks `canEngulf` about, and what the hold-Tab panel
   * (docs/ui/overlays.md §3.7) looks through to name the cell whose toxin reaches us and the prey we are swallowing.
   */
  readonly cells = computed<readonly CellView[]>(() => this.multiplayer.snapshot()?.cells ?? NO_CELLS);

  /** The newest snapshot itself: the hold-Tab panel reads its tick and round start to place the world clock. */
  readonly snapshot = computed<GameSnapshot | null>(() => this.multiplayer.snapshot());

  /**
   * Our own progress record, or `null` before the room names us (docs/ui/layout.md §1's `ownProgress`). The
   * server sends it to us alone, as the snapshot's `ownProgress` (docs/architecture/wire-contract.md §4.1).
   */
  readonly ownProgress = computed<OwnProgressView | null>(() =>
    this.ownPlayerId() === null ? null : (this.multiplayer.snapshot()?.ownProgress ?? null),
  );

  /** The cell we are steering; absent while spectating, which is what makes the mirror stand down. */
  readonly ownCell = computed<CellView | null>(() => {
    const id = this.ownPlayerId();
    if (id === null) return null;
    return this.cells().find((cell) => cell.playerId === id) ?? null;
  });

  /** The snapshot the cue memories step on; `null` whenever there is no own cell to say anything about. */
  private readonly ownSnapshot = computed<OwnSnapshot | null>(() => {
    const snapshot = this.multiplayer.snapshot();
    const ownCell = this.ownCell();
    const ownProgress = this.ownProgress();
    return snapshot === null || ownCell === null || ownProgress === null ? null : { snapshot, ownCell, ownProgress };
  });

  /**
   * The mass chip's trend (docs/ui/hud.md §3.1.5), carried from snapshot to snapshot: a trend is a question about
   * history, which a plain computed cannot answer. `massTrendFor` resets on a new own cell and ignores a tick it
   * has already seen, so a recomputation never counts a snapshot twice.
   */
  private readonly massTrend = linkedSignal<OwnSnapshot | null, MassTrendMemory | null>({
    source: () => this.ownSnapshot(),
    computation: (current, previous) =>
      current === null
        ? null
        : massTrendFor(previous?.value ?? null, {
            cellId: current.ownCell.id,
            tick: current.snapshot.tick,
            massFlow: current.ownProgress.massFlow,
            effects: current.snapshot.effects,
          }),
  });

  /** The zone pill's entries and cooldowns (docs/ui/hud.md §3.1.5), carried the same way. */
  private readonly zoneEntry = linkedSignal<OwnSnapshot | null, ZoneEntryMemory | null>({
    source: () => this.ownSnapshot(),
    computation: (current, previous) => {
      const zone = current?.ownProgress.massFlow?.zone;
      if (current === null || zone === undefined) return previous?.value ?? null;
      return zoneEntryFor(previous?.value ?? null, { cellId: current.ownCell.id, zone, tick: current.snapshot.tick });
    },
  });

  /**
   * The own cell's mass over the last `AFFECTING_MASS_HISTORY_SECONDS` (docs/ui/overlays.md §3.7), carried the same
   * way the trend and the zone entries are: the hold-Tab panel's sparkline is a question about the past.
   */
  private readonly massHistory = this.carriedMemory<OwnMassHistory>((previous, own) =>
    ownMassHistoryFor(previous, { cellId: own.ownCell.id, tick: own.snapshot.tick, mass: own.ownCell.mass }),
  );

  /** What the own cell has eaten in the last `AFFECTING_FOOD_WINDOW_SECONDS`, for that panel's `Food` row. */
  private readonly recentEats = this.carriedMemory<RecentEatsMemory>((previous, own) =>
    recentEatsFor(previous, { cellId: own.ownCell.id, tick: own.snapshot.tick, effects: own.snapshot.effects }),
  );

  /**
   * A memory carried from snapshot to snapshot: `step` folds the newest own snapshot into the last value, and the
   * whole memory is dropped whenever there is no own cell to remember anything about. The pure step functions reset
   * on a new own cell id themselves, so a respawn never reads as a fall.
   */
  private carriedMemory<TMemory>(
    step: (previous: TMemory | null, own: OwnSnapshot) => TMemory,
  ): Signal<TMemory | null> {
    return linkedSignal<OwnSnapshot | null, TMemory | null>({
      source: () => this.ownSnapshot(),
      computation: (current, previous) => (current === null ? null : step(previous?.value ?? null, current)),
    });
  }

  /** The masses the panel's sparkline draws, oldest first; empty before the own cell has a history of its own. */
  readonly ownMasses = computed<readonly number[]>(() => {
    const ownCell = this.ownCell();
    return ownCell === null ? NO_MASSES : ownMassesFor(this.massHistory(), ownCell.id);
  });

  /** The `Food` row's gain rate, mass/s; zero omits the row rather than showing `+0/s`. */
  readonly foodGainPerSecond = computed<number>(() => {
    const ownCell = this.ownCell();
    return ownCell === null ? NO_FOOD_GAIN : foodGainPerSecondFor(this.recentEats(), ownCell.id);
  });

  /**
   * By value, not by identity. `cameraExtent(...)` allocates a fresh object every frame, and the
   * render loop writes one every frame, so the default `Object.is` would notify 60 times a second
   * with a still camera — re-running `threatsFor` (a pass over every cell plus a sort), rebuilding
   * the whole record and the mirror's attributes, and dirtying the OnPush HUD each time. Before
   * this signal existed that chain ran once per snapshot, and #187 adds a second consumer of it.
   *
   * A moving camera still changes the extent every frame and still cascades; that is a real cost
   * and is #187's to measure, with the renderer's own budget in front of it.
   */
  private readonly cameraExtentValue = signal<CameraExtent | null>(null, { equal: isSameCameraExtent });

  /**
   * The camera's world rectangle, written by the render loop each frame through `game-setup.ts`
   * (docs/ui/components-and-constants.md §7). The one render-side fact the HUD consumes, and the only thing that makes
   * "on screen" mean anything to `threatsFor`.
   */
  readonly cameraExtent = this.cameraExtentValue.asReadonly();

  setCameraExtent(extent: CameraExtent): void {
    this.cameraExtentValue.set(extent);
  }

  /** On-screen cells that can engulf us, nearest first (docs/ui/hud.md §3.1.2). */
  readonly threats = computed<readonly Threat[]>(() => {
    const ownCell = this.ownCell();
    const balance = this.balance();
    if (ownCell === null || balance === null) return NO_THREATS;
    return threatsFor({
      cells: this.cells(),
      ownCell,
      cameraExtent: this.cameraExtent(),
      players: this.players(),
      balance,
    });
  });

  /** Every cell that would carry a relation ring, nearest first: the per-cell work, once per snapshot. */
  private readonly relationCandidates = computed<readonly RelationCandidate[]>(() => {
    const ownCell = this.ownCell();
    const balance = this.balance();
    if (ownCell === null || balance === null) return NO_RELATIONS;
    return relationCandidatesFor({ cells: this.cells(), ownCell, balance });
  });

  /** On-screen cells the own cell could eat or should not touch, nearest first (docs/ui/hud.md §3.1.5). */
  readonly relations = computed(() => relationsOnScreen(this.relationCandidates(), this.cameraExtent()));

  /** An engulf this session (§3.1.5's `EDIBLE` rule): latched on the own cell's first `cell_absorbed`, kept on respawn. */
  private readonly hasEngulfed = linkedSignal<OwnSnapshot | null, boolean>({
    source: () => this.ownSnapshot(),
    computation: (current, previous) =>
      (previous?.value ?? false) || (current !== null && hasEngulfedIn(current.snapshot.effects, current.ownCell.id)),
  });

  /**
   * The one truth two consumers read (docs/ui/hud.md §3.1.4): the renderer draws it and the status
   * mirror speaks it. `null` while spectating or before the first snapshot, which is exactly when
   * there is no own cell to say anything about.
   *
   * The ladder's ghost-hide rule reads the picker's previewed card (`HudStateService.previewTraitId`, #188), so
   * a highlighted rung card hides the orbit ghost it is about to replace (docs/ui/hud.md §3.1.2).
   */
  readonly ownCellIndicators = computed<OwnCellIndicators | null>(() => {
    const own = this.ownSnapshot();
    const balance = this.balance();
    if (own === null || balance === null) return null;
    // Death lands here: `lifeState` has only `alive` and `spectating`, so dying leaves `alive` and
    // the record goes `null`. The mirror then unmounts, which is silent — an `aria-live` region
    // that is removed announces nothing. Saying the death itself is #189's, which owns the death
    // overlay; this slice does not claim to, and `hud.component.ts` no longer says it does.
    if (own.ownProgress.lifeState !== PLAYER_LIFE_STATE.alive) return null;
    return ownCellIndicatorsFor({
      ownCell: own.ownCell,
      ownProgress: own.ownProgress,
      balance,
      threats: this.threats(),
      relations: this.relations(),
      hasEngulfed: this.hasEngulfed(),
      previewTraitId: this.hudState.previewTraitId(),
      tick: own.snapshot.tick,
      massTrend: this.massTrend(),
      zoneEntry: this.zoneEntry(),
    });
  });
}
