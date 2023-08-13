/**
 * Returns a range of numbers from start to end.
 * @param start
 * @param end
 * @param step
 */
export function range(start: bigint, end: bigint, step = 1n): bigint[] {
  if (start === end) {
    return [start];
  }

  if (step === 0n) {
    throw new Error("Step cannot be zero unless start === end.");
  }

  if (start > end && step > 0n) {
    step = -step;
  }

  if (start < end && step < 0n) {
    step = -step;
  }

  const result: bigint[] = [];
  for (let i = start; i <= end; i += step) {
    result.push(i);
  }
  return result;
}

/**
 * Creates a function that gets a property's value from an object.
 * @param key the name of the property to get
 * @template T the type of the object
 */
export function prop<T>(key: keyof T): (obj: T) => T[keyof T] {
  return (obj: T) => obj[key];
}

/**
 * Typed identity function, for convenient casting when mapping.
 * @param value The value to return.
 * @template R The type of the value as returned.
 * @template T The type of the value as passed in.
 * @returns R The value "as R".
 */
export function identity<R extends T, T = R>(value: T): R {
  return value as R;
}
