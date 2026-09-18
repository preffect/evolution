// The debug hook a dev route installs and takes back (docs/rendering/budget.md §7,
// docs/architecture/encyclopedia.md §12.7). Both dev routes install `window.__evolutionDebug` for their own
// session's lifetime and must remove exactly their own on teardown; holding the uninstall is the whole of it, and
// it lives here so neither route component writes the pairing again.

import { installEvolutionDebug, type EvolutionDebugApi, type EvolutionDebugHost } from './evolution-debug';

export class DebugHookHolder {
  private uninstall: (() => void) | null = null;

  /** Installs `api` on `host` in a dev build, replacing anything this holder installed before. */
  install(host: EvolutionDebugHost | null, api: EvolutionDebugApi, isDevelopmentMode: boolean): void {
    this.remove();
    if (host === null) return;
    this.uninstall = installEvolutionDebug(host, api, isDevelopmentMode);
  }

  /** Removes this holder's own install, and only it; safe to call when nothing was installed. */
  remove(): void {
    this.uninstall?.();
    this.uninstall = null;
  }
}
