import "https://deno.land/x/websocket_broadcastchannel@0.7.0/polyfill.ts";
import Lock from "npm:lock-queue@1.0.1";
import { Clock, Timestamp } from "./clock.ts";
import { SerializerOptions } from "https://deno.land/x/superserial@0.3.4/mod.ts";

export type { ConstructType } from "https://deno.land/x/superserial@0.3.4/mod.ts";

/**
 * Just a plain object.
 */
export type Model<M> = {
  [K in keyof M]: M[K];
};

/**
 * Keeps track of a model and its copy, and the last applied journal entry id.
 */
export class ModelHolder<M extends Model<M>> {
  name: string;
  model: M;
  copy?: M;
  lastAppliedJournalEntryId = 0n;
  lock: typeof Lock = new Lock();
  /**
   * Notifies all instances that a new JournalEntry has been saved.
   */
  broadcastChannel: BroadcastChannel;
  constructor(name: string, model: M) {
    this.name = name;
    this.model = model;
    this.broadcastChannel = new BroadcastChannel(name);
  }
}

/**
 * @anti-pattern Throwing this error will cause the action to be retried.
 */
export class ShouldRetryError extends Error {
  readonly ok = false;
}

/**
 * The "classes" property of {@link SerializerOptions}.
 */
export type SerializableClassesContainer = NonNullable<
  SerializerOptions["classes"]
>;

/**
 * Defines a mutation action that can be applied to a model.
 *
 * The action is applied by calling {@link Action.execute}.
 *
 * @param M The model type.
 */
export interface Action<M extends Model<M>> {
  /**
   * Applies the action to the model.
   * @param model The model to apply the action to.
   * @param clock The clock, from which the action can get the "current" timestamp.
   */
  execute(model: M, clock: Clock): void;
}

/**
 * A query is just a (possibly async) function that gets passed the model and a clock, returns something. Must be pure.
 */
export type Query<M extends Model<M>, R> = (model: M, clock: Clock) => R;

/**
 * A journal entry is a timestamped action.
 */
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

/**
 * A function that returns something.
 */
export type Returns<T> = () => T;
