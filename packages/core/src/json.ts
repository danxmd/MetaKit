/** Data that survives a round trip through JSON text unchanged. */
export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };

const MAX_DEPTH = 64;

/** Why a value is not plain JSON data, or null if it is. Catches what `JSON.stringify` would silently change. */
export function whyNotJson(value: unknown, depth = 0): string | null {
  if (depth > MAX_DEPTH) return 'it is nested too deeply';
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return null;
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? null
      : `the number ${String(value)} is not allowed`;
  }
  if (value === undefined) return 'undefined is not allowed';
  if (
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  ) {
    return `a ${typeof value} is not allowed`;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const reason = whyNotJson(value[i], depth + 1);
      if (reason) return `item ${i}: ${reason}`;
    }
    return null;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  if (proto !== Object.prototype && proto !== null)
    return 'only plain objects are allowed';
  for (const key of Object.keys(value as object)) {
    const reason = whyNotJson(
      (value as Record<string, unknown>)[key],
      depth + 1,
    );
    if (reason) return `field "${key}": ${reason}`;
  }
  return null;
}

export function isJson(value: unknown): value is Json {
  return whyNotJson(value) === null;
}

export function assertJson(
  value: unknown,
  what: string,
): asserts value is Json {
  const reason = whyNotJson(value);
  if (reason) throw new TypeError(`${what} must be plain JSON data: ${reason}`);
}

/** A frozen deep copy, so no reference held by a caller can change what the store holds. */
export function freezeCopy<T extends Json>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  const copy: unknown = Array.isArray(value)
    ? value.map((item) => freezeCopy(item))
    : Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, freezeCopy(v)]),
      );
  return Object.freeze(copy) as T;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a !== typeof b ||
    a === null ||
    b === null ||
    typeof a !== 'object'
  )
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  return (
    ka.length === kb.length &&
    ka.every(
      (k) =>
        Object.hasOwn(b as object, k) &&
        deepEqual(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        ),
    )
  );
}
