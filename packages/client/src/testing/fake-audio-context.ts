// Test double (docs/TESTING.md §4): the slice of the Web Audio API `WebAudioBackend` touches.
// Install with `vi.stubGlobal('AudioContext', FakeAudioContext)`.

export class FakeAudioParameter {
  readonly scheduled: { method: string; value: number; time: number }[] = [];

  constructor(public value: number) {}

  cancelScheduledValues(time: number): void {
    this.scheduled.push({ method: 'cancel', value: this.value, time });
  }

  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.scheduled.push({ method: 'set', value, time });
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.scheduled.push({ method: 'ramp', value, time });
  }
}

export class FakeAudioNode {
  readonly connections: FakeAudioNode[] = [];
  disconnectCount = 0;

  connect(target: FakeAudioNode): void {
    this.connections.push(target);
  }

  disconnect(): void {
    this.disconnectCount += 1;
  }
}

export class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParameter(1);
}

export class FakeBufferSourceNode extends FakeAudioNode {
  buffer: { duration: number } | null = null;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- mirrors AudioBufferSourceNode.loop, the platform's name
  loop = false;
  readonly playbackRate = new FakeAudioParameter(1);
  onended: (() => void) | null = null;
  startCount = 0;
  startAt: number | null = null;
  stopAt: number | null = null;

  constructor(readonly context: FakeAudioContext) {
    super();
  }

  start(when: number): void {
    this.startCount += 1;
    this.startAt = when;
  }

  stop(when: number): void {
    this.stopAt = when;
    this.onended?.();
  }
}

export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static shouldRefuseConstruction = false;

  currentTime = 0;
  state: 'suspended' | 'running' = 'suspended';
  readonly destination = new FakeAudioNode();
  readonly gains: FakeGainNode[] = [];
  readonly sources: FakeBufferSourceNode[] = [];
  resumeCount = 0;

  constructor() {
    if (FakeAudioContext.shouldRefuseConstruction) throw new Error('no audio device');
    FakeAudioContext.instances.push(this);
  }

  static reset(): void {
    FakeAudioContext.instances = [];
    FakeAudioContext.shouldRefuseConstruction = false;
  }

  createGain(): FakeGainNode {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node;
  }

  createBufferSource(): FakeBufferSourceNode {
    const node = new FakeBufferSourceNode(this);
    this.sources.push(node);
    return node;
  }

  /** Empty bytes are "not decodable"; anything else decodes to a one-second buffer. */
  decodeAudioData(bytes: ArrayBuffer): Promise<{ duration: number }> {
    if (bytes.byteLength === 0) return Promise.reject(new Error('undecodable'));
    return Promise.resolve({ duration: 1 });
  }

  resume(): Promise<void> {
    this.resumeCount += 1;
    this.state = 'running';
    return Promise.resolve();
  }
}
