import { type RandomSource } from '../ids';

/**
 * Position keys: strings that sort in drawing order, with room between any two. They are
 * fractions in base 62 written as digits, so `positionBetween` never renumbers anything.
 * Keys never end in the digit 0, which keeps every gap open.
 */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;
const SUFFIX_LENGTH = 3;

function platformRandom(): RandomSource {
  const source = (globalThis as unknown as { crypto?: RandomSource }).crypto;
  if (!source)
    throw new Error('No random source is available on this platform');
  return source;
}

function digit(char: string | undefined): number {
  return char === undefined ? 0 : DIGITS.indexOf(char);
}

/**
 * A key strictly between `a` and `b` (`a` may be '' for "before everything", `b` null for
 * "after everything"). When there is room at the first differing digit the result gets a
 * random tail, so two people inserting into the same gap get different keys.
 */
function between(a: string, b: string | null, random: RandomSource): string {
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? '0') === b[n]) n += 1;
    if (n > 0) return b.slice(0, n) + between(a.slice(n), b.slice(n), random);
  }
  const da = digit(a[0]);
  const db = b === null ? BASE : digit(b[0]);
  if (db - da > 1) {
    const bytes = random.getRandomValues(new Uint8Array(SUFFIX_LENGTH + 1));
    // A digit strictly between the two, then a random tail that cannot end in 0.
    const lead = da + 1 + (bytes[0]! % (db - da - 1));
    let tail = '';
    for (let i = 1; i <= SUFFIX_LENGTH; i++) {
      tail +=
        DIGITS[
          i === SUFFIX_LENGTH ? 1 + (bytes[i]! % (BASE - 1)) : bytes[i]! % BASE
        ];
    }
    return DIGITS[lead]! + tail;
  }
  if (b !== null && b.length > 1) {
    // Consecutive digits and b continues: stay under b by following its first digit.
    return b[0]! + between('', b.slice(1), random);
  }
  return DIGITS[da]! + between(a.slice(1), null, random);
}

/** A key that sorts strictly between `before` and `after`; either may be missing. */
export function positionBetween(
  before: string | null | undefined,
  after: string | null | undefined,
  random: RandomSource = platformRandom(),
): string {
  const a = before ?? '';
  const b = after ?? null;
  if (b !== null && a >= b)
    throw new Error(
      `Cannot place a position between "${a}" and "${b}": the first must sort before the second`,
    );
  return between(a, b, random);
}

export function isPositionKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    [...value].every((c) => DIGITS.includes(c)) &&
    !value.endsWith('0')
  );
}

/** `count` evenly usable keys for an initial list, in order. */
export function initialPositions(
  count: number,
  random: RandomSource = platformRandom(),
): string[] {
  const keys: string[] = [];
  let previous: string | null = null;
  for (let i = 0; i < count; i++) {
    previous = positionBetween(previous, null, random);
    keys.push(previous);
  }
  return keys;
}
