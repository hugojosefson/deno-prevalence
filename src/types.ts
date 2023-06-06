export type Clock = () => number;

export interface Context {
  clock: Clock;
}

export interface Transaction<M> {
  execute(model: M, context: Context): void;
}

export interface JournalEntry<M> {
  readonly timestamp: number;
  readonly transaction: Transaction<M>;
}

/**
 * Things that JSON.stringify can serialize.
 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string | number]: JSONValue };

/**
 * Things that Deno.Kv can store as values.
 */
export type KvValue<T extends KvValue<T>> =
  | undefined
  | null
  | boolean
  | number
  | string
  | bigint
  | Uint8Array
  | T[]
  | Record<string | number, T>
  | Map<T, T>
  | Set<T>
  | Date
  | RegExp;
