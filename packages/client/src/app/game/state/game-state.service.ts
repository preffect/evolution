// The HUD's one view of the world (docs/UI.md §7): derived signals only, never a second model.
// Every component reads facts from here rather than reaching into a service of its own, so what the
// chrome shows and what the wire said can never drift apart.
//
// The facts the chrome needs are the newest snapshot's and the room's, both of which
// `MultiplayerService` already mirrors as signals — `WorldStore` (`net/world-store.ts`) owns the
// *interpolated* world the renderer draws per frame, and nothing on the chrome is interpolated.
// The own-cell signals of docs/UI.md §7 (`ownCell`, `ownProgress`, `ownCellIndicators`, `threats`,
// `cameraExtent`) arrive with #186/#187 and read the store through the render seam.

import { Injectable, computed, inject, signal } from '@angular/core';
import {
  PLAYER_LIFE_STATE,
  ROUND_PHASE,
  type BalanceConfig,
  type CellView,
  type LeaderboardRow,
  type PlayerId,
  type PlayerProgressView,
  type RoundPhase,
  type TraitId,
} from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { threatsFor, type Threat } from '../hud/format/threats-for';
import { ownCellIndicatorsFor, type OwnCellIndicators } from './own-cell-indicators';
import type { CameraExtent } from '../render/camera';

const NO_LEADERBOARD: readonly LeaderboardRow[] = [];
const NO_PLAYERS: Readonly<Record<string, PlayerProgressView>> = {};
const NO_CELLS: readonly CellView[] = [];
const NO_THREATS: readonly Threat[] = [];
/** Until the picker lands (#188) nothing is ever previewed, so the ladder's ghost never hides. */
const NO_PREVIEWED_TRAIT: TraitId | null = null;

/** Two extents that describe the same rectangle; a fresh object per frame is not a new view. */
function isSameCameraExtent(first: CameraExtent | null, second: CameraExtent | null): boolean {
  if (first === second) return true;
  if (first === null || second === null) return false;
  return (
    first.minX === second.minX && first.maxX === second.maxX && first.minY === second.minY && first.maxY === second.maxY
  );
}

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private readonly multiplayer = inject(MultiplayerService);

  /** `MultiplayerService.playerId()`: who we are (docs/UI.md §1's `me`), `null` before the room names us. */
  readonly ownPlayerId = computed<PlayerId | null>(() => this.multiplayer.playerId());

  /** The round's phase; `playing` until the snapshot says otherwise, so the chrome shows on join. */
  readonly roundPhase = computed<RoundPhase>(() => this.multiplayer.snapshot()?.roundPhase ?? ROUND_PHASE.playing);

  /** Milliseconds left in the round, or `null` before the first snapshot. */
  readonly roundTimeLeftMs = computed<number | null>(() => this.multiplayer.snapshot()?.roundTimeLeftMs ?? null);

  /** The server's ranking, newest snapshot (docs/UI.md §3.1.1). */
  readonly leaderboard = computed<readonly LeaderboardRow[]>(
    () => this.multiplayer.snapshot()?.leaderboard ?? NO_LEADERBOARD,
  );

  /** Every player's progress by id: where the leaderboard's names come from. */
  readonly players = computed<Readonly<Record<string, PlayerProgressView>>>(
    () => this.multiplayer.snapshot()?.players ?? NO_PLAYERS,
  );

  /** Seat index per player: the palette and the seat-mark bead count (docs/VISUAL-STYLE.md §2). */
  readonly avatarAssignments = this.multiplayer.avatarAssignments.asReadonly();

  /** The room's config: the round length the clock's bloom threshold is a fraction of. */
  readonly sessionConfig = this.multiplayer.sessionConfig.asReadonly();

  /** The live balance of `game_state` / `balance_updated`; `null` before the room's arrives. */
  readonly balance = computed<BalanceConfig | null>(() => this.multiplayer.balance());

  /** Every cell in the newest snapshot: what `threatsFor` asks `canEngulf` about. */
  private readonly cells = computed<readonly CellView[]>(() => this.multiplayer.snapshot()?.cells ?? NO_CELLS);

  /** Our own progress record, or `null` before the room names us (docs/UI.md §1's `ownProgress`). */
  readonly ownProgress = computed<PlayerProgressView | null>(() => {
    const id = this.ownPlayerId();
    return id === null ? null : (this.players()[id] ?? null);
  });

  /** The cell we are steering; absent while spectating, which is what makes the mirror stand down. */
  readonly ownCell = computed<CellView | null>(() => {
    const id = this.ownPlayerId();
    if (id === null) return null;
    return this.cells().find((cell) => cell.playerId === id) ?? null;
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
   * (docs/UI.md §7). The one render-side fact the HUD consumes, and the only thing that makes
   * "on screen" mean anything to `threatsFor`.
   */
  readonly cameraExtent = this.cameraExtentValue.asReadonly();

  setCameraExtent(extent: CameraExtent): void {
    this.cameraExtentValue.set(extent);
  }

  /** On-screen cells that can engulf us, nearest first (docs/UI.md §3.1.2). */
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

  /**
   * The one truth two consumers read (docs/UI.md §3.1.4): the renderer draws it and the status
   * mirror speaks it. `null` while spectating or before the first snapshot, which is exactly when
   * there is no own cell to say anything about.
   *
   * The ladder's ghost-hide rule already takes a previewed trait, but the signal that carries one
   * is `HudStateService.previewTraitId` and belongs to the picker (#188, docs/UI.md §7). Passing
   * `null` keeps this slice honest: no dead signal here, and that slice is one argument away.
   */
  readonly ownCellIndicators = computed<OwnCellIndicators | null>(() => {
    const ownCell = this.ownCell();
    const ownProgress = this.ownProgress();
    const balance = this.balance();
    if (ownCell === null || ownProgress === null || balance === null) return null;
    // Death lands here: `lifeState` has only `alive` and `spectating`, so dying leaves `alive` and
    // the record goes `null`. The mirror then unmounts, which is silent — an `aria-live` region
    // that is removed announces nothing. Saying the death itself is #189's, which owns the death
    // overlay; this slice does not claim to, and `hud.component.ts` no longer says it does.
    if (ownProgress.lifeState !== PLAYER_LIFE_STATE.alive) return null;
    return ownCellIndicatorsFor({
      ownCell,
      ownProgress,
      balance,
      threats: this.threats(),
      previewTraitId: NO_PREVIEWED_TRAIT,
    });
  });
}
