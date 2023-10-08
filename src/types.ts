import { WebSocketBroadcastChannel } from "https://deno.land/x/websocket_broadcastchannel@0.8.0/mod.ts";
import { Symbol } from "https://deno.land/x/websocket_broadcastchannel@0.8.0/src/using.ts";
import { Clock, Timestamp } from "./clock.ts";
import { SerializerOptions } from "https://deno.land/x/superserial@0.3.4/mod.ts";
import { SerializedString } from "./marshall/serialized.ts";
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
 * Keeps track of a {@link Model} and its copy, and the last applied
 * {@link JournalEntry.id}.
 */
export class ModelHolder<M extends Model<M>> {
  name: string;
  model: Synchronized<M>;
  copy: Synchronized<Wrapper<M>>;
  lastAppliedJournalEntryId = 0n;

  /**
   * Notifies all instances that a new {@link JournalEntry} has been saved to
   * the db.
   */
  broadcastChannel: BroadcastChannel;

  /**
   * Listens for new {@link JournalEntries}, and applies them to the
   * {@link Model}.
   */
  listeningChannel: BroadcastChannel;

  /**
   * @param name The name of the {@link Model}.
   * @param model The {@link Model}.
   */
  constructor(name: string, model: M) {
    this.name = name;
    this.model = new Synchronized<M>(model);
    this.copy = new Synchronized<Wrapper<M>>(wrap<M>(undefined));
    this.broadcastChannel = new WebSocketBroadcastChannel(name);
    this.listeningChannel = new WebSocketBroadcastChannel(name);
  }

  /**
   * Returns a `Promise` that resolves when the {@link Model} has been updated
   * to the given `id`.
   * @param id The id of the {@link JournalEntry} to wait for.
   * @returns A `Promise` that resolves when the {@link Model} has been updated
   * to the given `id`.
   */
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

  [Symbol.dispose]() {
    this.listeningChannel.close();
    this.broadcastChannel.close();
  }
}

/**
 * @anti-pattern Throwing this error will cause the {@link Action} to be
 * retried.
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
 * Defines a mutation action that can be applied to a {@link Model}.
 *
 * The action is applied by calling {@link Action.execute}.
 *
 * @template M The type of the {@link Model}.
 */
export interface Action<M extends Model<M>> {
  /**
   * Applies the action to the {@link Model}.
   * @param model The {@link Model} to apply the action to.
   * @param clock The {@link Clock}, from which the action can get the "current" {@link Timestamp}.
   */
  execute(model: M, clock: Clock): void;
}

/**
 * A `Query` is just a (possibly async) function that gets passed the
 * {@link Model} and a {@link Clock}, returns something. Must be pure.
 */
export type Query<M extends Model<M>, R> = (
  model: Readonly<M>,
  clock: Clock,
) => Readonly<R> | Promise<Readonly<R>>;

/**
 * A `JournalEntry` is a {@link Timestamp}ed {@link Action}.
 *
 * @template M The type of the {@link Model}.
 * @param id The id of the `JournalEntry`.
 * @param timestamp The {@link Timestamp} of the `JournalEntry`.
 * @param action The {@link Action} of the `JournalEntry`.
 */
export interface JournalEntry<M extends Model<M>> {
  id: bigint;
  timestamp: Timestamp;
  action: Action<M>;
}

/**
 * Plural of {@link JournalEntry}.
 */
export type JournalEntries<M extends Model<M>> = JournalEntry<M>[];

/**
 * Type-guard for {@link JournalEntry}.
 * @param entry Potential {@link JournalEntry}.
 */
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

/**
 * Type-guard for {@link Action}.
 * @param action Potential {@link Action}.
 * @template M The type of the {@link Model}.
 * @returns voolean Whether the given object is an {@link Action}.
 */
export function isAction<M extends Model<M>>(
  action: unknown,
): action is Action<M> {
  return typeof action === "object" &&
    action !== null &&
    "execute" in action &&
    typeof action.execute === "function";
}

/**
 * Things that {@link JSON.stringify} can serialize.
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

/**
 * A `Promise` of something, or just the thing itself.
 */
export type PromiseOr<T> = T | Promise<T>;

/**
 * A function that returns something, or just the thing itself.
 */
export type ReturnsOr<T> = Returns<T> | T;

/**
 * Resolves a value, `Promise`, or getter of a value or `Promise`.
 * @param valueOrPromiseOrGetter
 */
export async function resolve<T>(
  valueOrPromiseOrGetter: ReturnsOr<PromiseOr<T>>,
): Promise<T> {
  if (valueOrPromiseOrGetter instanceof Promise) {
    return await valueOrPromiseOrGetter;
  }
  // if callable, call it
  if (typeof valueOrPromiseOrGetter === "function") {
    return await resolve(await (valueOrPromiseOrGetter as CallableFunction)());
  }
  // otherwise, just return it
  return valueOrPromiseOrGetter;
}

/**
 * Type-guard for {@link MessageEvent}.
 * @param event Potential {@link MessageEvent}.
 */
export function isMessageEvent(event: Event): event is MessageEvent {
  return event instanceof MessageEvent;
}

/**
 * Type-guard for {@link MessageEvent} with a {@link MessageWithType} in its
 * {@link MessageEvent.data} property.
 * @param event Potential {@link MessageEvent}.
 * @template M The type of the {@link Model}.
 * @returns Whether the given object is a {@link MessageEvent} with a
 * {@link MessageWithType} in its {@link MessageEvent.data} property.
 */
export function isMessageEventWithType<M extends Model<M>>(
  event: Event,
): event is MessageEvent & { data: MessageWithType<M> } {
  return isMessageEvent(event) &&
    isMessageWithType(event.data);
}

/**
 * The valid values for the a {@link MessageType}.
 */
export const MESSAGE_TYPE = {
  BOOTED: "BOOTED",
  JOURNAL_ENTRY_APPENDED: "JOURNAL_ENTRY_APPENDED",
  JOURNAL_ENTRY_APPLIED: "JOURNAL_ENTRY_APPLIED",
} as const;

/**
 * The "type" property of a {@link MessageWithType}.
 */
export type MessageType = keyof typeof MESSAGE_TYPE;

/**
 * Has a "type" property, that is a {@link MessageType}.
 */
export interface MessageWithType<M extends Model<M>> {
  type: MessageType;
}

/**
 * A {@link JournalEntry} that has been appended to the journal,
 * but not necessarily been applied to the {@link Model}.
 */
export interface JournalEntryAppended<M extends Model<M>>
  extends MessageWithType<M> {
  type: typeof MESSAGE_TYPE.JOURNAL_ENTRY_APPENDED;
  id: JournalEntry<M>["id"];
  journalEntry: SerializedString<JournalEntry<M>>;
}

export interface Booted<M extends Model<M>> extends MessageWithType<M> {
  type: typeof MESSAGE_TYPE.BOOTED;
}

/**
 * Type-guard for {@link MessageWithType}.
 * @param data Potential {@link MessageWithType}.
 */
function isMessageWithType<M extends Model<M>>(
  data: unknown,
): data is MessageWithType<M> {
  return typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof data.type === "string" &&
    Object.values(MESSAGE_TYPE).includes(data.type as MessageType);
}

/**
 * Type-guard for {@link MessageWithType} with a specific {@link MessageType}.
 * @param data Potential {@link MessageWithType}.
 * @param type The {@link MessageType} to check for.
 */
function isMessageWithSpecificType<M extends Model<M>, T extends MessageType>(
  data: unknown,
  type: T,
): data is MessageWithType<M> & { type: T } {
  return isMessageWithType(data) &&
    data.type === type;
}

/**
 * Type-guard for {@link JournalEntryAppended}.
 * @param data Potential {@link JournalEntryAppended}.
 */
export function isMessageJournalEntryAppended<M extends Model<M>>(
  data: unknown,
): data is JournalEntryAppended<M> {
  return isMessageWithSpecificType(data, MESSAGE_TYPE.JOURNAL_ENTRY_APPENDED);
}

/**
 * Type-guard for {@link Booted}.
 * @param data Potential {@link Booted}.
 */
export function isMessageBooted<M extends Model<M>>(
  data: unknown,
): data is Booted<M> {
  return isMessageWithSpecificType(data, MESSAGE_TYPE.BOOTED);
}

/**
 * A {@link JournalEntry} that has been applied to the {@link Model}.
 */
export interface JournalEntryApplied<M extends Model<M>> {
  type: typeof MESSAGE_TYPE.JOURNAL_ENTRY_APPLIED;
  id: bigint;
}

/**
 * Type-guard for {@link JournalEntryApplied}.
 * @param data Potential {@link JournalEntryApplied}.
 */
export function isMessageJournalEntryApplied<M extends Model<M>>(
  data: unknown,
): data is JournalEntryApplied<M> {
  return isMessageWithSpecificType(data, MESSAGE_TYPE.JOURNAL_ENTRY_APPLIED);
}
