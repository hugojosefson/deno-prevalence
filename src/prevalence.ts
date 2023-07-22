import {
  Action,
  isJournalEntry,
  isMessageEventWithType,
  isMessageJournalEntryAppended,
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
import { range } from "./fn.ts";
import { Wrapper } from "./wrapper.ts";
import { s } from "https://deno.land/x/websocket_broadcastchannel@0.7.0/src/fn.ts";

const log0 = logger(import.meta.url);
const KEY_JOURNAL_LASTENTRYID: Deno.KvKey = [
  "journal",
  "lastEntryId",
];
const KEY_JOURNAL_ENTRIES = ["journal", "entries"];

export function defaultPrevalenceOptions<M extends Model<M>>(
  classes: SerializableClassesContainer = {},
  marshaller: Marshaller<M, string> = new SuperserialMarshaller(
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

export type PrevalenceOptions<M extends Model<M>> = {
  marshaller: Marshaller<M, string>;
  classes: SerializableClassesContainer;
  clock: Clock;
  kv: ReturnsOr<PromiseOr<Deno.Kv>>;
};

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
  private readonly marshaller: Marshaller<M, string>;
  private readonly classes: SerializableClassesContainer;
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
    this.classes = options.classes;
    this.marshaller = options.marshaller;
    this.clock = options.clock;
    this.kvPromise = resolve(options.kv);

    this.modelHolder.listeningChannel.addEventListener(
      "message",
      this.routeIncomingMessage.bind(this),
    );
  }

  async execute<A extends Action<M>>(action: A): Promise<void> {
    const log = log0.sub(Prevalence.prototype.execute.name);
    log("action =", action);
    const journalEntry: JournalEntry<M> = await this.testOnCopyAndAppend(
      action,
    );
    await this.modelHolder.waitForJournalEntryApplied(journalEntry.id);
  }

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

    throw new Error(`Unknown message type: ${type}`);
  }

  /**
   * Checks that we have appended all journal entries since {@link this.modelHolder.lastAppliedJournalEntryId}.
   * If not, loads them, applies them to the model, and updates {@link this.modelHolder.lastAppliedJournalEntryId}.
   * Uses {@link this.modelHolder.modelLock} to make sure that no other process is doing the same thing at the same time.
   * @param message
   */
  private async checkAndApplyJournalEntries(
    message: JournalEntryAppended<M>,
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
      const id: undefined | bigint = message.id;
      log("id =", id);
      if (id <= lastAppliedJournalEntryId) {
        log("lastEntryId <= lastAppliedJournalEntryId");
        return;
      }
      const journalEntries: JournalEntry<M>[] = await this
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

  async loadJournalEntriesSince(
    sinceJournalEntryId: bigint,
    journalEntryAppended?: JournalEntryAppended<M>,
  ): Promise<JournalEntry<M>[]> {
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
      return [journalEntryAppended];
    }

    // fetch the new entries from Deno.Kv
    const entryKeys: Deno.KvKey[] = range(sinceJournalEntryId + 1n, lastEntryId)
      .map(this.getEntryKey);
    log("entryKeys =", entryKeys);
    const kv: Deno.Kv = await this.kvPromise;
    return (await kv.getMany(entryKeys))
      .filter((response) => isJournalEntry(response.value))
      .map((response) => response.value as JournalEntry<M>);
  }

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
            if (
              lastEntryIdResponse.value !==
                this.modelHolder.lastAppliedJournalEntryId
            ) {
              throw new ShouldRetryError(
                [
                  "journal.lastEntryId (",
                  JSON.stringify(lastEntryIdResponse.value),
                  ") is not the same as this.modelHolder.lastAppliedJournalEntryId (",
                  JSON.stringify(this.modelHolder.lastAppliedJournalEntryId),
                  ")",
                ].join(""),
              );
            }

            const id: bigint = 1n + lastEntryIdResponse.value;
            const entry: JournalEntry<M> = { id, timestamp, action };
            const serializedEntry: string = this.marshaller
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
              action,
              timestamp,
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
          // TODO: load the journal entries that were appended since we read `KEY_JOURNAL_LASTENTRYID`,
          // TODO: apply them to the model
          continue;
        }
        throw error;
      }
    }
  }

  private getEntryKey(newLastEntryId: bigint): Deno.KvKey {
    return [...KEY_JOURNAL_ENTRIES, newLastEntryId];
  }

  private async getLastEntryIdResponse(): Promise<Deno.KvEntryMaybe<bigint>> {
    const kv: Deno.Kv = await this.kvPromise;
    return kv.get(KEY_JOURNAL_LASTENTRYID);
  }

  async snapshot(): Promise<void> {
    const timestamp: Timestamp = this.clock();
    const log = log0.sub("snapshot");
    log("timestamp =", timestamp);
    await new Promise((r) => {
      setTimeout(r, 0);
    });
  }
}
