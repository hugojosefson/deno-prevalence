export type { ConstructType } from "https://deno.land/x/superserial@0.3.4/mod.ts";
import { SerializerOptions } from "https://deno.land/x/superserial@0.3.4/mod.ts";

export type Model<M> = {
  [K in keyof M]: M[K];
};

export type SerializableClassesContainer = NonNullable<
  SerializerOptions["classes"]
>;

export interface Action<M extends Model<M>> {
  execute(model: M, clock: Clock): void;
}

export type JournalEntry<M extends Model<M>> = {
  timestamp: number;
  action: Action<M>;
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
