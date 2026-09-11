// Cooldown and priority for cues (docs/AUDIO.md §3, the #140 priority scale). Time is the injected
// `Clock`. A one-shot inside its cooldown is dropped; a loop waits it out (the service defers its
// start). Loops are not counted against the overlap cap: they have their own end conditions.

import {
  MAX_OVERLAPPING_CUES,
  SOUND_PRIORITY,
  type Clock,
  type SoundEventId,
  type SoundEventRule,
} from '@evolution/shared';
import type { AudioVoice } from './audio-backend';

export interface ActiveCue {
  id: SoundEventId;
  priority: SoundEventRule['priority'];
  voice: AudioVoice;
}

export interface Admission {
  isAdmitted: boolean;
  /** Lower cues to stop so the admitted one fits. */
  evicted: ActiveCue[];
}

const REFUSED: Admission = { isAdmitted: false, evicted: [] };

export class CueScheduler {
  private readonly lastPlayedMs = new Map<SoundEventId, number>();
  private readonly active: ActiveCue[] = [];

  constructor(private readonly clock: Clock) {}

  /** Milliseconds until the event may play again; 0 when it may play now. */
  remainingCooldownMs(id: SoundEventId, rule: SoundEventRule): number {
    const last = this.lastPlayedMs.get(id);
    if (last === undefined) return 0;
    return Math.max(0, last + rule.cooldownMs - this.clock.nowMilliseconds());
  }

  /** Records a play starting `delayMs` from now, so the next cooldown counts from the actual start. */
  recordPlay(id: SoundEventId, delayMs: number): void {
    this.lastPlayedMs.set(id, this.clock.nowMilliseconds() + delayMs);
  }

  /** Cooldown gate for one-shots: true when the event may play now, recording the play; a refused cue is dropped. */
  passesCooldown(id: SoundEventId, rule: SoundEventRule): boolean {
    if (this.remainingCooldownMs(id, rule) > 0) return false;
    this.recordPlay(id, 0);
    return true;
  }

  /**
   * Overlap gate for one-shots: `essential` always fits; otherwise the cue fits while fewer than
   * `MAX_OVERLAPPING_CUES` sound, and at capacity it may evict one cue of strictly lower priority.
   */
  admit(rule: SoundEventRule): Admission {
    if (rule.priority === SOUND_PRIORITY.essential || this.active.length < MAX_OVERLAPPING_CUES) {
      return { isAdmitted: true, evicted: [] };
    }
    const lowest = this.active.reduce((candidate, cue) => (cue.priority < candidate.priority ? cue : candidate));
    if (lowest.priority >= rule.priority) return REFUSED;
    return { isAdmitted: true, evicted: [lowest] };
  }

  track(cue: ActiveCue): void {
    this.active.push(cue);
    cue.voice.onEnded(() => this.release(cue));
  }

  release(cue: ActiveCue): void {
    const index = this.active.indexOf(cue);
    if (index >= 0) this.active.splice(index, 1);
  }

  get activeCount(): number {
    return this.active.length;
  }

  /** Stops everything sounding: the round ended or the room was left. */
  stopAll(): void {
    for (const cue of [...this.active]) cue.voice.stop();
    this.active.length = 0;
  }
}
