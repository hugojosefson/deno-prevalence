import { Symbol } from "https://deno.land/x/websocket_broadcastchannel@0.7.0/src/using.ts";
import {
  isAnySerializedString,
  SerializedString,
} from "./marshall/serialized.ts";
import {
  Action,
  isJournalEntry,
  isMessageEventWithType,
  isMessageJournalEntryAppended,
  JournalEntries,
  JournalEntry,
  JournalEntryAppended,
  MESSAGE_TYPE,
  MessageType,
  MessageWithType,
  Model,
  ModelHolder,
  PromiseOr,
  resolve,
  ReturnsOr,
  SerializableClassesContainer,
  ShouldRetryError,
} from "./types.ts";
import { logger } from "./log.ts";
import { Clock, defaultClock, Timestamp } from "./clock.ts";
import { Marshaller } from "./marshall/marshaller.ts";
import { SuperserialMarshaller } from "./marshall/superserial-marshaller.ts";
import { Serializer } from "https://deno.land/x/superserial@0.3.4/serializer.ts";
import { identity, prop, range } from "./fn.ts";
import { Wrapper } from "./wrapper.ts";
import { s } from "https://deno.land/x/websocket_broadcastchannel@0.8.0/src/fn.ts";

const log0 = logger(import.meta.url);
const KEY_JOURNAL_LASTENTRYID: Deno.KvKey = [
  "journal",
  "lastEntryId",
];
const KEY_JOURNAL_ENTRIES = ["journal", "entries"];
const KEY_SNAPSHOT = ["snapshot"];

function getSnapshotKey(timestamp: Timestamp): Deno.KvKey {
  return [...KEY_SNAPSHOT, timestamp.toString()];
}

export type PrevalenceOptions<M extends Model<M>> = {
  marshaller: Marshaller<M>;
  classes: SerializableClassesContainer;
  clock: Clock;
  kv: ReturnsOr<PromiseOr<Deno.Kv>>;
};

export function defaultPrevalenceOptions<M extends Model<M>>(
  classes: SerializableClassesContainer = {},
  marshaller: Marshaller<M> = new SuperserialMarshaller(
    new Serializer({ classes }),
  ),
): PrevalenceOptions<M> {
  return {
    classes,
    marshaller,
    clock: defaultClock,
    kv: Deno.openKv.bind(Deno),
  };
}

/**
 * TypeScript implementation for Deno of the Prevalence design pattern, as
 * introduced by Klaus Wuestefeld in 1998 with Prevayler.
 *
 * Saves periodical snapshots of the model, and journal of executed actions
 * since last snapshot, to Deno.Kv.
 *
 * Uses a Marshaller to serialize/deserialize the model and the journal.
 *
 * @see https://en.wikipedia.org/wiki/System_prevalence
 * @see https://prevayler.org/
 */
export class Prevalence<M extends Model<M>> {
  private readonly modelHolder: ModelHolder<M>;
  private readonly marshaller: Marshaller<M>;
  private readonly clock: Clock;
  private readonly kvPromise: Promise<Deno.Kv>;
  get name(): string {
    return this.modelHolder.name;
  }

  static create<M extends Model<M>>(
    name: string,
    defaultInitialModel: M,
    options: Partial<PrevalenceOptions<M>>,
  ): Prevalence<M> {
    const log = log0.sub("create");
    log("name =", name);
    log("defaultInitialModel =", defaultInitialModel);
    log("options =", options);
    const effectiveOptions: PrevalenceOptions<M> = {
      ...(defaultPrevalenceOptions(options.classes, options.marshaller)),
      ...options,
    };
    log("effectiveOptions =", effectiveOptions);

    // TODO: instead, load model from snapshot + journal
    const model = defaultInitialModel;
    const modelHolder = new ModelHolder<M>(name, model);
    return new Prevalence<M>(modelHolder, effectiveOptions);
  }

  private constructor(
    modelHolder: ModelHolder<M>,
    options: PrevalenceOptions<M>,
  ) {
    this.modelHolder = modelHolder;
    this.marshaller = options.marshaller;
    this.clock = options.clock;
    this.kvPromise = resolve(options.kv);

    this.modelHolder.listeningChannel.addEventListener(
      "message",
      this.routeIncomingMessage.bind(this),
    );
  }

  /**
   * Execute an {@link Action} on the {@link Model}, and append the resulting
   * {@link JournalEntry} to the journal.
   * @param action The {@link Action} to execute.
   * @returns a `Promise` that resolves when the {@link JournalEntry} has been
   * appended to the journal, and the {@link Model} has been updated.
   */
  async execute<A extends Action<M>>(action: A): Promise<void> {
    const log = log0.sub(Prevalence.prototype.execute.name);
    log("action =", action);
    const journalEntryAppended: JournalEntryAppended<M> = await this
      .testOnCopyAndAppend(
        action,
      );
    await this.modelHolder.waitForJournalEntryApplied(journalEntryAppended.id);
  }

  get model(): M {
    return this.modelHolder.model.readOnly(identity);
  }

  /**
   * Routes an incoming {@link MessageEvent} with {@link MessageWithType} on
   * its "data" property, to the appropriate handler.
   * @param event The {@link MessageEvent} to route.
   * @returns a `Promise` that resolves when the {@link MessageEvent} has been
   * routed.
   * @throws an `Error` if the {@link Event} is a {@link MessageEvent} with a
   * {@link MessageWithType} on its "data" property, but the {@link MessageType}
   * is unknown.
   */
  async routeIncomingMessage(event: Event): Promise<void> {
    const log = log0.sub(Prevalence.prototype.routeIncomingMessage.name);
    if (!isMessageEventWithType(event)) {
      log("event is not a MessageEvent with type");
      return;
    }
    const message: MessageWithType<M> = event.data;
    const type: MessageType = message.type;
    log("type =", type);

    if (isMessageJournalEntryAppended(message)) {
      return await this.checkAndApplyJournalEntries(message);
    }
    if (type === MESSAGE_TYPE.JOURNAL_ENTRY_APPLIED) {
      return;
    }

    throw new Error(`Unknown message type: ${type}`);
  }

  /**
   * Checks that we have appended all journal entries since
   * {@link ModelHolder.lastAppliedJournalEntryId}. If not, loads them,
   * applies them to the model, and updates
   * {@link ModelHolder.lastAppliedJournalEntryId}.
   * Uses {@link Synchronized} to make sure that no other process is doing the
   * same thing at the same time.
   * @param message The {@link JournalEntryAppended} message.
   */
  private async checkAndApplyJournalEntries(
    message?: JournalEntryAppended<M>,
  ): Promise<void> {
    await this.modelHolder.model.doWith(async (model: M) => {
      const log = log0.sub(
        Prevalence.prototype.checkAndApplyJournalEntries.name,
      );
      log("modelHolder.model.doWith");
      log("message =", message);
      const lastAppliedJournalEntryId: bigint =
        this.modelHolder.lastAppliedJournalEntryId;
      log("lastAppliedJournalEntryId =", lastAppliedJournalEntryId);
      const id: undefined | bigint = message?.id ?? lastAppliedJournalEntryId;
      log("id =", id);
      if (id <= lastAppliedJournalEntryId) {
        log(
          "lastEntryId <= lastAppliedJournalEntryId, so apparently already applied.",
        );
        return;
      }
      const journalEntries: JournalEntries<M> = await this
        .loadJournalEntriesSince(
          lastAppliedJournalEntryId,
          message,
        );
      log("journalEntries =", journalEntries);
      for (const journalEntry of journalEntries) {
        journalEntry.action.execute(
          model,
          () => journalEntry.timestamp,
        );
        this.modelHolder.lastAppliedJournalEntryId = journalEntry.id;
        this.modelHolder.broadcastChannel.postMessage({
          type: MESSAGE_TYPE.JOURNAL_ENTRY_APPLIED,
          id: journalEntry.id,
        });
      }
    });
  }

  /**
   * Load all {@link JournalEntries} since the given {@link JournalEntry.id}.
   * @param sinceJournalEntryId The {@link JournalEntry.id} since which to load
   * {@link JournalEntries}.
   * @param journalEntryAppended Optionally, the {@link JournalEntryAppended}
   * message that triggered this load. May be used to avoid loading the last
   * entry if it is the one that triggered this load.
   * @returns Promise<JournalEntries> a `Promise` that resolves to an array of
   * {@link JournalEntry}.
   */
  async loadJournalEntriesSince(
    sinceJournalEntryId: bigint,
    journalEntryAppended?: JournalEntryAppended<M>,
  ): Promise<JournalEntries<M>> {
    const log = log0.sub(Prevalence.prototype.loadJournalEntriesSince.name);
    log("sinceJournalEntryId =", sinceJournalEntryId);

    // get the last journal entry id from Deno.Kv
    const lastEntryId: bigint = await this.getLastEntryId();

    // sanity check
    if (lastEntryId < sinceJournalEntryId) {
      throw new Error(
        [
          "lastEntryId (",
          s(lastEntryId),
          ") < sinceJournalEntryId (",
          s(sinceJournalEntryId),
          ")",
        ].join(""),
      );
    }

    // fast-track if there are no new entries
    if (lastEntryId === sinceJournalEntryId) {
      return [];
    }

    // fast-track if there is only one new entry, and it is the one they supplied
    if (
      lastEntryId === sinceJournalEntryId + 1n &&
      journalEntryAppended?.id === lastEntryId
    ) {
      return [
        this.marshaller.deserializeJournalEntry(
          journalEntryAppended.journalEntry,
        ),
      ];
    }

    // fetch the new entries from Deno.Kv
    const entryKeys: Deno.KvKey[] = range(sinceJournalEntryId + 1n, lastEntryId)
      .map(this.getEntryKey);
    log("entryKeys =", entryKeys);
    const kv: Deno.Kv = await this.kvPromise;
    const kvEntryMaybes: Deno.KvEntryMaybe<string>[] = await kv.getMany<
      string[]
    >(entryKeys);
    return kvEntryMaybes
      .map(prop("value"))
      .filter(isAnySerializedString)
      .map(this.marshaller.deserializeJournalEntry.bind(this.marshaller))
      .filter(isJournalEntry)
      .map(identity<JournalEntry<M>>);
  }

  /**
   * Get the `id` for the last appended {@link JournalEntry} in the journal.
   * @private
   * @returns Promise<bigint> a `Promise` that resolves to the `id` of the last
   * {@link JournalEntry} in the journal.
   */
  private async getLastEntryId(): Promise<bigint> {
    const lastEntryIdResponse: Deno.KvEntryMaybe<bigint> = await this
      .getLastEntryIdResponse();

    if (typeof lastEntryIdResponse.value !== "bigint") {
      throw new Error(
        "Could not get lastEntryId from Deno.Kv",
      );
    }

    return lastEntryIdResponse.value;
  }

  /**
   * Test an {@link Action} on a copy of the {@link Model}, and then append the
   * {@link JournalEntry} to the journal.
   *
   * @param action The {@link Action} to test, and append to the journal.
   * @returns Promise<JournalEntryAppended> a `Promise` that resolves to the
   * {@link JournalEntryAppended}, when it has been appended to the journal.
   * @throws Error if the {@link Action} throws an `Error`.
   * @throws Error if the {@link JournalEntry} cannot be appended to the
   * journal.
   * @throws Error if the {@link JournalEntry} cannot be read back from the
   * journal.
   * @throws Error if the {@link JournalEntry} cannot be applied to the
   * {@link Model}.
   * @throws Error if the {@link JournalEntry} cannot be broadcast to the
   * {@link BroadcastChannel}.
   */
  async testOnCopyAndAppend<A extends Action<M>>(
    action: A,
  ): Promise<JournalEntryAppended<M>> {
    const timestamp: Timestamp = this.clock();
    const log = log0.sub(Prevalence.prototype.testOnCopyAndAppend.name);
    log("timestamp =", timestamp);
    log("action =", action);
    while (true) {
      try {
        return await this.modelHolder.copy.doWith(
          async (copyWrapper: Wrapper<M>): Promise<JournalEntryAppended<M>> => {
            log("modelHolder.copy.doWith");

            // make sure we have a copy of the model
            if (copyWrapper.value === undefined) {
              // serialize and deserialize the model to make a copy
              copyWrapper.value = this.modelHolder.model.readOnly((model: M) =>
                this.marshaller.deserializeModel(
                  this.marshaller.serializeModel(model),
                )
              );
            }

            // mostly for typescript, to make sure copyWrapper.value is not undefined
            if (copyWrapper.value === undefined) {
              throw new Error(
                "this.modelHolder.copy.value is undefined, even after serialization and deserialization of this.modelHolder.model.#value",
              );
            }

            // execute action on the copy
            action.execute(
              copyWrapper.value,
              () => timestamp,
            );

            // if that went well, check that modelHolder is up-to-date with `lastEntryId`
            const lastEntryIdResponse: Deno.KvEntryMaybe<bigint> = await this
              .getLastEntryIdResponse();
            const lastEntryId: bigint = lastEntryIdResponse.value ?? 0n;
            if (
              lastEntryId !== this.modelHolder.lastAppliedJournalEntryId
            ) {
              throw new ShouldRetryError(
                [
                  "journal.lastEntryId (",
                  lastEntryId,
                  ") is not the same as this.modelHolder.lastAppliedJournalEntryId (",
                  this.modelHolder.lastAppliedJournalEntryId,
                  ")",
                ].join(""),
              );
            }

            const id: bigint = 1n + lastEntryId;
            const entry: JournalEntry<M> = {
              id,
              timestamp,
              action,
            };
            const serializedEntry: SerializedString<JournalEntry<M>> = this
              .marshaller
              .serializeJournalEntry(
                entry,
              );

            const entryKey: Deno.KvKey = this.getEntryKey(id);

            const kv: Deno.Kv = await this.kvPromise;
            await kv.atomic()
              .check(lastEntryIdResponse)
              .check({ key: entryKey, versionstamp: null })
              .set(KEY_JOURNAL_LASTENTRYID, id)
              .set(entryKey, serializedEntry)
              .commit();

            // if that went well, tell everyone
            const message: JournalEntryAppended<M> = {
              type: MESSAGE_TYPE.JOURNAL_ENTRY_APPENDED,
              id,
              journalEntry: serializedEntry,
            };
            this.modelHolder.broadcastChannel.postMessage(message);
            return message;
          },
        );
      } catch (error) {
        log("error =", error);
        await this.modelHolder.copy.doWith((copyWrapper: Wrapper<M>) => {
          copyWrapper.value = undefined;
        });
        if (error?.ok === false) {
          // load the journal entries that were appended since we read `KEY_JOURNAL_LASTENTRYID`,
          // apply them to the model
          await this.checkAndApplyJournalEntries();
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Generate the key for a {@link JournalEntry} with the given `id`.
   * @param entryId the `id` of the {@link JournalEntry} to generate the
   * {@link Deno.KvKey} for.
   * @private
   */
  private getEntryKey(entryId: bigint): Deno.KvKey {
    return [...KEY_JOURNAL_ENTRIES, entryId];
  }

  /**
   * Get the whole response object from Deno.Kv, for the `id` of the last
   * appended {@link JournalEntry} in the journal.
   * @private
   * @returns Promise<Deno.KvEntryMaybe<bigint>> a `Promise` that resolves to
   * the whole response from Deno.Kv for the {@link KEY_JOURNAL_LASTENTRYID}
   * key.
   */
  private async getLastEntryIdResponse(): Promise<Deno.KvEntryMaybe<bigint>> {
    const kv: Deno.Kv = await this.kvPromise;
    return kv.get(KEY_JOURNAL_LASTENTRYID);
  }

  /**
   * Save a snapshot of the {@link Model} to Deno.Kv.
   * @returns Promise<Timestamp> a `Promise` that resolves to the
   * {@link Timestamp} of the snapshot.
   */
  async snapshot(): Promise<Timestamp> {
    const timestamp: Timestamp = this.clock();
    const log = log0.sub("snapshot");
    log("timestamp =", timestamp);
    const key: Deno.KvKey = getSnapshotKey(timestamp);
    const value: string = this.marshaller.serializeModel(
      this.modelHolder.model.readOnly(identity),
    );
    const kv: Deno.Kv = await this.kvPromise;
    await kv.set(key, value);
    return timestamp;
  }

  async [Symbol.asyncDispose]() {
    this.modelHolder[Symbol.dispose]();
    (await this.kvPromise).close();
  }
}
