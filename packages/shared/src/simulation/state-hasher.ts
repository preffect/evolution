// The state hash kernel (docs/DETERMINISM.md §5): two independent 32-bit FNV-1a lanes fed the
// same canonical byte stream. Scalars carry a type tag so `0`, `false`, `"0"` and `null` never
// collide; numbers hash by their IEEE-754 bits through one shared DataView; strings by a length
// prefix then the one UTF-16 encoding `hashing/fnv1a.ts` defines (`hashLabel` shares it). The
// walk order is the caller's job (state-hash.ts).

import { FNV1A_OFFSET_BASIS, fnv1aFoldByte, fnv1aFoldString, fnv1aFoldUint32 } from '../hashing/fnv1a.js';

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
const IS_LITTLE_ENDIAN = true;

/** One byte in front of every scalar so values of different kinds never share a byte stream. */
enum ScalarTag {
  Number = 1,
  String = 2,
  Boolean = 3,
  Null = 4,
  Array = 5,
}

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
    this.foldByte(ScalarTag.Number);
    this.numberBytes.setFloat64(0, value, IS_LITTLE_ENDIAN);
    for (let byteIndex = 0; byteIndex < FLOAT64_BYTES; byteIndex += 1) {
      this.foldByte(this.numberBytes.getUint8(byteIndex));
    }
    return this;
  }

  hashString(value: string): this {
    this.foldByte(ScalarTag.String);
    this.foldUint32(value.length);
    this.laneA = fnv1aFoldString(this.laneA, value);
    this.laneB = fnv1aFoldString(this.laneB, value);
    return this;
  }

  hashBoolean(isTrue: boolean): this {
    this.foldByte(ScalarTag.Boolean);
    this.foldByte(isTrue ? BOOLEAN_BYTE.true : BOOLEAN_BYTE.false);
    return this;
  }

  hashNull(): this {
    this.foldByte(ScalarTag.Null);
    return this;
  }

  /** A length prefix before an array's items, so `[a, b]` and `[a], [b]` differ. */
  hashArrayLength(length: number): this {
    this.foldByte(ScalarTag.Array);
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
