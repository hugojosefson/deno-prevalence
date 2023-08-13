/**
 * Wrapper for a value.
 * @template T The type of the value.
 */
export interface Wrapper<T> {
  value?: T;
}

/**
 * Wraps a value.
 * @param value The value to wrap.
 * @template T The type of the value.
 * @returns Wrapper<T> The wrapped value.
 */
export function wrap<T>(value?: T): Wrapper<T> {
  return { value };
}
