import { describe, expect, it } from 'vitest';
import { StateHasher, StateHashError, type HashableScalar } from './state-hasher.js';

const HEX_16 = /^[0-9a-f]{16}$/;
const SAMPLE_NUMBER = 12.5;

function hashOf(feed: (hasher: StateHasher) => void): string {
  const hasher = new StateHasher();
  feed(hasher);
  return hasher.digest();
}

describe('StateHasher', () => {
  it('digests to 16 lowercase hex characters', () => {
    expect(hashOf(() => undefined)).toMatch(HEX_16);
    expect(hashOf((hasher) => hasher.hashNumber(SAMPLE_NUMBER).hashString('cell'))).toMatch(HEX_16);
  });

  it('is deterministic for the same input', () => {
    const feed = (hasher: StateHasher): void => {
      hasher.hashNumber(SAMPLE_NUMBER).hashString('cell').hashBoolean(true).hashNull();
    };
    expect(hashOf(feed)).toBe(hashOf(feed));
  });

  it('keeps the two lanes independent', () => {
    const digest = hashOf((hasher) => hasher.hashString('lanes'));
    expect(digest.slice(0, 8)).not.toBe(digest.slice(8));
  });

  it('distinguishes scalar kinds that share a byte pattern', () => {
    const digests = [
      hashOf((hasher) => hasher.hashNumber(0)),
      hashOf((hasher) => hasher.hashBoolean(false)),
      hashOf((hasher) => hasher.hashString('')),
      hashOf((hasher) => hasher.hashNull()),
      hashOf((hasher) => hasher.hashArrayLength(0)),
    ];
    expect(new Set(digests).size).toBe(digests.length);
  });

  it('hashes numbers by their IEEE-754 bits', () => {
    expect(hashOf((hasher) => hasher.hashNumber(1))).not.toBe(
      hashOf((hasher) => hasher.hashNumber(1 + Number.EPSILON)),
    );
    expect(hashOf((hasher) => hasher.hashNumber(SAMPLE_NUMBER))).not.toBe(
      hashOf((hasher) => hasher.hashNumber(-SAMPLE_NUMBER)),
    );
  });

  it('throws on NaN and infinities', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => new StateHasher().hashNumber(value)).toThrow(StateHashError);
    }
  });

  it('separates strings by length so boundaries cannot shift', () => {
    const joined = hashOf((hasher) => hasher.hashString('ab').hashString('c'));
    const shifted = hashOf((hasher) => hasher.hashString('a').hashString('bc'));
    expect(joined).not.toBe(shifted);
  });

  it('hashes strings by UTF-16 code units', () => {
    expect(hashOf((hasher) => hasher.hashString('€'))).not.toBe(hashOf((hasher) => hasher.hashString('¬')));
  });

  it('distinguishes true from false', () => {
    expect(hashOf((hasher) => hasher.hashBoolean(true))).not.toBe(hashOf((hasher) => hasher.hashBoolean(false)));
  });

  it('dispatches hashScalar by runtime type identically to the typed methods', () => {
    const scalars: HashableScalar[] = [SAMPLE_NUMBER, 'cell', true, null];
    const viaScalar = hashOf((hasher) => {
      for (const scalar of scalars) {
        hasher.hashScalar(scalar);
      }
    });
    const viaTyped = hashOf((hasher) =>
      hasher.hashNumber(SAMPLE_NUMBER).hashString('cell').hashBoolean(true).hashNull(),
    );
    expect(viaScalar).toBe(viaTyped);
  });
});
