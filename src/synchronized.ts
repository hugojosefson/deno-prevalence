import Lock from "npm:lock-queue@1.0.1";

/**
 * A wrapper around a value that can be mutated, but only by one caller at a time.
 * @template T The type of the value.
 */
export class Synchronized<T> {
  readonly #value: T;
  readonly #lock: typeof Lock = new Lock();

  /**
   * Constructs a new {@link Synchronized} wrapper around the given value.
   * @param value The value to wrap.
   */
  constructor(value: T) {
    this.#value = value;
  }

  /**
   * The caller gets to mutate the value, but must wait for the lock.
   * @param fn A function that takes the value, and possibly returns something.
   * @template R The return type of the function.
   * @returns R Whatever the function returns.
   */
  async doWith<R>(fn: (value: T) => R | Promise<R>): Promise<Readonly<R>> {
    return await this.#lock.lock(async () => await fn(this.#value));
  }

  /**
   * The caller vows to not mutate the value, and gets a faster sneak peek without having to wait for the lock.
   * @param fn A function that takes the value, and possibly returns something.
   * @template R The return type of the function.
   * @returns R Whatever the function returns.
   */
  readOnly<R>(fn: (value: Readonly<T>) => R): Readonly<R> {
    return fn(this.#value);
  }
}
