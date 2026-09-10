// The state hash kernel (docs/DETERMINISM.md §5): two independent 32-bit FNV-1a lanes fed the
// same canonical byte stream. Scalars carry a type tag so `0`, `false`, `"0"` and `null` never
// collide; numbers hash by their IEEE-754 bits through one shared DataView; strings by UTF-16
// code units with a length prefix. The walk order is the caller's job (state-hash.ts).

import { FNV1A_OFFSET_BASIS, fnv1aFoldByte, fnv1aFoldUint32 } from '../hashing/fnv1a.js';

/** 16 hexadecimal characters: lane A then lane B. */
export type StateHash = string & { readonly __brand: 'StateHash' };

export class StateHashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateHashError';
  }
}

/** Lane B starts from a different basis (the 32-bit golden ratio) so the lanes diverge from byte one. */
const LANE_B_OFFSET_BASIS = 0x9e3779b9;
const FLOAT64_BYTES = 8;
const HEX_RADIX = 16;
const HEX_DIGITS_PER_UINT32 = 8;
const LITTLE_ENDIAN = true;

const SCALAR_TAG = {
  number: 1,
  string: 2,
  boolean: 3,
  null: 4,
  array: 5,
} as const;

const BOOLEAN_BYTE = { false: 0, true: 1 } as const;

export type HashableScalar = number | string | boolean | null;

export class StateHasher {
  private laneA = FNV1A_OFFSET_BASIS;
  private laneB = LANE_B_OFFSET_BASIS;
  private readonly numberBytes = new DataView(new ArrayBuffer(FLOAT64_BYTES));

  hashNumber(value: number): this {
    if (!Number.isFinite(value)) {
      throw new StateHashError(`State contains a non-finite number: ${String(value)}`);
    }
    this.foldByte(SCALAR_TAG.number);
    this.numberBytes.setFloat64(0, value, LITTLE_ENDIAN);
    for (let byteIndex = 0; byteIndex < FLOAT64_BYTES; byteIndex += 1) {
      this.foldByte(this.numberBytes.getUint8(byteIndex));
    }
    return this;
  }

  hashString(value: string): this {
    this.foldByte(SCALAR_TAG.string);
    this.foldUint32(value.length);
    for (let index = 0; index < value.length; index += 1) {
      this.foldUint32(value.charCodeAt(index));
    }
    return this;
  }

  hashBoolean(value: boolean): this {
    this.foldByte(SCALAR_TAG.boolean);
    this.foldByte(value ? BOOLEAN_BYTE.true : BOOLEAN_BYTE.false);
    return this;
  }

  hashNull(): this {
    this.foldByte(SCALAR_TAG.null);
    return this;
  }

  /** A length prefix before an array's items, so `[a, b]` and `[a], [b]` differ. */
  hashArrayLength(length: number): this {
    this.foldByte(SCALAR_TAG.array);
    this.foldUint32(length);
    return this;
  }

  hashScalar(value: HashableScalar): this {
    if (value === null) {
      return this.hashNull();
    }
    if (typeof value === 'number') {
      return this.hashNumber(value);
    }
    if (typeof value === 'string') {
      return this.hashString(value);
    }
    return this.hashBoolean(value);
  }

  digest(): StateHash {
    return (toHex(this.laneA) + toHex(this.laneB)) as StateHash;
  }

  private foldByte(byte: number): void {
    this.laneA = fnv1aFoldByte(this.laneA, byte);
    this.laneB = fnv1aFoldByte(this.laneB, byte);
  }

  private foldUint32(value: number): void {
    this.laneA = fnv1aFoldUint32(this.laneA, value);
    this.laneB = fnv1aFoldUint32(this.laneB, value);
  }
}

function toHex(uint32: number): string {
  return uint32.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_UINT32, '0');
}
