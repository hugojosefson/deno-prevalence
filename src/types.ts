import "https://deno.land/x/websocket_broadcastchannel@0.7.0/polyfill.ts";
import { Clock, Timestamp } from "./clock.ts";
import { SerializerOptions } from "https://deno.land/x/superserial@0.3.4/mod.ts";
import { Synchronized } from "./synchronized.ts";
import { wrap, Wrapper } from "./wrapper.ts";

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
  model: Synchronized<M>;
  copy: Synchronized<Wrapper<M>>;
  lastAppliedJournalEntryId = 0n;
  /**
   * Notifies all instances that a new JournalEntry has been saved to the db.
   */
  broadcastChannel: BroadcastChannel;

  /**
   * Listens for new JournalEntries, and applies them to the model.
   */
  listeningChannel: BroadcastChannel;
  constructor(name: string, model: M) {
    this.name = name;
    this.model = new Synchronized<M>(model);
    this.copy = new Synchronized<Wrapper<M>>(wrap<M>(undefined));
    this.broadcastChannel = new BroadcastChannel(name);
    this.listeningChannel = new BroadcastChannel(name);
  }

  waitForJournalEntryApplied(id: bigint): Promise<void> {
    return new Promise((resolve) => {
      const listener = (event: Event) => {
        if (
          isMessageEvent(event) && isMessageJournalEntryApplied(event.data) &&
          event.data.id === id
        ) {
          this.listeningChannel.removeEventListener("message", listener);
          resolve();
        }
      };
      this.listeningChannel.addEventListener("message", listener);
    });
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
  id: bigint;
  timestamp: Timestamp;
  action: Action<M>;
};

export function isJournalEntry<M extends Model<M>>(
  entry: unknown,
): entry is JournalEntry<M> {
  return typeof entry === "object" &&
    entry !== null &&
    "timestamp" in entry &&
    typeof entry.timestamp === "bigint" &&
    "action" in entry &&
    isAction(entry.action);
}

export function isAction<M extends Model<M>>(
  action: unknown,
): action is Action<M> {
  return typeof action === "object" &&
    action !== null &&
    "execute" in action &&
    typeof action.execute === "function";
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

/**
 * A function that returns something.
 */
export type Returns<T> = () => T;

export function isMessageEvent(event: Event): event is MessageEvent {
  return event instanceof MessageEvent;
}

export function isMessageEventWithType<M extends Model<M>>(
  event: Event,
): event is MessageEvent & { data: MessageWithType<M> } {
  return isMessageEvent(event) &&
    isMessageWithType(event.data);
}

export const MESSAGE_TYPE = {
  JOURNAL_ENTRY_APPENDED: "JOURNAL_ENTRY_APPENDED",
  JOURNAL_ENTRY_APPLIED: "JOURNAL_ENTRY_APPLIED",
} as const;

export type MessageType = keyof typeof MESSAGE_TYPE;

export interface MessageWithType<M extends Model<M>> {
  type: MessageType;
}

export interface JournalEntryAppended<M extends Model<M>>
  extends MessageWithType<M>, JournalEntry<M> {
  type: typeof MESSAGE_TYPE.JOURNAL_ENTRY_APPENDED;
}

function isMessageWithType<M extends Model<M>>(
  data: unknown,
): data is MessageWithType<M> {
  return typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof data.type === "string" &&
    Object.values(MESSAGE_TYPE).includes(data.type as MessageType);
}

function isMessageWithSpecificType<M extends Model<M>, T extends MessageType>(
  data: unknown,
  type: T,
): data is MessageWithType<M> & { type: T } {
  return isMessageWithType(data) &&
    data.type === type;
}

export function isMessageJournalEntryAppended<M extends Model<M>>(
  data: unknown,
): data is JournalEntryAppended<M> {
  return isMessageWithSpecificType(data, MESSAGE_TYPE.JOURNAL_ENTRY_APPENDED);
}

export interface JournalEntryApplied<M extends Model<M>> {
  type: typeof MESSAGE_TYPE.JOURNAL_ENTRY_APPLIED;
  id: bigint;
}

export function isMessageJournalEntryApplied<M extends Model<M>>(
  data: unknown,
): data is JournalEntryApplied<M> {
  return isMessageWithSpecificType(data, MESSAGE_TYPE.JOURNAL_ENTRY_APPLIED);
}
