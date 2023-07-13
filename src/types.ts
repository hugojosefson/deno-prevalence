import Lock from "npm:lock-queue@1.0.1";
import { Clock, Timestamp } from "./clock.ts";
import { SerializerOptions } from "https://deno.land/x/superserial@0.3.4/mod.ts";

export type { ConstructType } from "https://deno.land/x/superserial@0.3.4/mod.ts";

export type Model<M> = {
  [K in keyof M]: M[K];
};

export class ModelHolder<M extends Model<M>> {
  model: M;
  copy?: M;
  lastAppliedJournalEntryId = 0n;
  lock: typeof Lock = new Lock();
  constructor(model: M) {
    this.model = model;
  }
}
export class ShouldRetryError extends Error {}

export type SerializableClassesContainer = NonNullable<
  SerializerOptions["classes"]
>;

export interface Action<M extends Model<M>> {
  execute(model: M, clock: Clock): void;
}

/**
 * A query is just a (possibly async) function that gets passed the model and a clock, returns something.
 */
export type Query<M extends Model<M>, R> = (model: M, clock: Clock) => R;

export type JournalEntry<M extends Model<M>> = {
  timestamp: Timestamp;
  action: Action<M>;
};

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

export type Returns<T> = () => T;
