export type CommandFunction<M, A extends unknown[]> = (
  model: M,
  args: A,
  clock: Clock,
) => void;

export type Command<M, A extends unknown[]> = {
  execute: CommandFunction<M, A>;
  argsToString: (args: A) => string;
  stringToArgs: (argsString: string) => A;
};

export type Commands<M> = {
  [commandName: string]: Command<M, unknown[]>;
};

export type JournalEntry<
  M,
  C extends Commands<M>,
  CN extends keyof C,
> = {
  timestamp: number;
  commandName: CN;
  argsString: string;
};

export type Clock = () => number;

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
