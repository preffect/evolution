// The connection banner's state (docs/ui/overlays.md §3.6, docs/ui/layout.md §1): the socket's own flag, and whether
// the snapshots have stopped while it is up. Every snapshot, and the socket reopening, restarts the
// `SNAPSHOT_STALE_MS` wait; with the socket down, or no room to hear from (the lobby), there is nothing to wait for.
// `GameStateService.connectionState` hands this to the HUD.

import { DestroyRef, Injectable, computed, effect, inject, untracked } from '@angular/core';
import { MultiplayerService } from '../../services/multiplayer.service';
import { SCHEDULER } from '../clock-provider';
import { connectionStateFor, type ConnectionState } from './connection-state';
import { SnapshotStalenessWatch } from './snapshot-staleness';

@Injectable({ providedIn: 'root' })
export class ConnectionStateService {
  private readonly multiplayer = inject(MultiplayerService);
  private readonly staleness = new SnapshotStalenessWatch(inject(SCHEDULER));

  readonly state = computed<ConnectionState>(() =>
    connectionStateFor(this.multiplayer.connected(), this.staleness.isStale()),
  );

  constructor() {
    // A wait still pending when the injector goes (a test, an app teardown) must not fire into a dead service.
    inject(DestroyRef).onDestroy(() => this.staleness.stop());
    effect(() => {
      const isWaitingOnRoom = this.multiplayer.connected() && this.multiplayer.snapshot() !== null;
      untracked(() => (isWaitingOnRoom ? this.staleness.restart() : this.staleness.stop()));
    });
  }
}
