export type CommandFunction<M, A> = (
  model: M,
  args: A,
  clock: Clock,
) => void;

export type Command<M, A = unknown> = {
  execute: CommandFunction<M, A>;
  argsToString: (args: A) => string;
  stringToArgs: (argsString: string) => A;
};

export type Commands<
  M,
  CN extends Readonly<string>,
> = Record<
  CN,
  Command<M>
>;

export type JournalEntry<
  M,
  C extends Commands<M, CN>,
  CN extends CommandNames<M, C> = CommandNames<M, C>,
> = {
  timestamp: number;
  commandName: CN;
  argsString: string;
};

export type Clock = () => number;

export type CommandNames<M, C extends Commands<M, keyof C & string>> =
  & keyof C
  & string;

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
