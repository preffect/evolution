// A texture bake cut into steps small enough to run one per frame (ticket #479, docs/rendering/budget.md §7.2). A
// bundle baked in one go froze the first frame of a room for the whole bake; staged, the frame loop runs one step per
// animation frame, so the page keeps painting and taking input while the world is still being baked. The same steps
// run back to back for a caller that cannot wait (`runAll`), so a staged bake and a whole one are one code path.

/** One slice of a bake: it stores what it made for the assembly step to collect. */
export type BakeStep = () => void;

export class StagedBake<Result> {
  private nextStep = 0;
  private assembled: { readonly value: Result } | null = null;

  constructor(
    private readonly steps: readonly BakeStep[],
    private readonly assemble: () => Result,
  ) {}

  get stepCount(): number {
    return this.steps.length;
  }

  get isDone(): boolean {
    return this.nextStep >= this.steps.length;
  }

  /** Runs the next step; nothing once every step has run. */
  runNext(): void {
    const step = this.steps[this.nextStep];
    if (step === undefined) return;
    this.nextStep += 1;
    step();
  }

  /** Every step left, back to back, then the result. */
  runAll(): Result {
    while (!this.isDone) this.runNext();
    return this.result();
  }

  /** The assembled bundle, assembled once; only once every step has run. */
  result(): Result {
    if (!this.isDone) throw new Error(`A staged bake was read after ${this.nextStep} of ${this.steps.length} steps.`);
    this.assembled ??= { value: this.assemble() };
    return this.assembled.value;
  }
}

/** A value a step was meant to have made, read by the assembly: a missing one is a step-order bug, not a state. */
export function baked<Value>(value: Value | undefined, name: string): Value {
  if (value === undefined) throw new Error(`The staged bake assembled ${name} before its step ran.`);
  return value;
}
