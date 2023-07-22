import Lock from "npm:lock-queue@1.0.1";

export class Synchronized<T> {
  readonly #value: T;
  readonly #lock: typeof Lock = new Lock();
  constructor(value: T) {
    this.#value = value;
  }
  async doWith<R>(fn: (value: T) => R | Promise<R>): Promise<R> {
    return await this.#lock.lock(async () => await fn(this.#value));
  }
  readOnly<R>(fn: (value: T) => R): R {
    return fn(this.#value);
  }
}
