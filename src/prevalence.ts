import {
  Action,
  isJournalEntry,
  isJournalEntryAppended,
  isMessageEventWithType,
  JournalEntry,
  JournalEntryAppended,
  MESSAGE_TYPE,
  MessageType,
  MessageWithType,
  Model,
  ModelHolder,
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
    kv: new Deno.Kv(),
  };
}

export type PrevalenceOptions<M extends Model<M>> = {
  marshaller: Marshaller<M, string>;
  classes: SerializableClassesContainer;
  clock: Clock;
  kv: Deno.Kv;
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
  private readonly kv: Deno.Kv;
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
      ...defaultPrevalenceOptions(options.classes, options.marshaller),
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
    this.kv = options.kv;

    this.modelHolder.listeningChannel.addEventListener(
      "message",
      this.routeIncomingMessage.bind(this),
    );
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

    if (isJournalEntryAppended(message)) {
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
  async checkAndApplyJournalEntries(
    message: JournalEntryAppended<M>,
  ): Promise<void> {
    await this.modelHolder.model.doWith(async (model: M) => {
      const log = log0.sub(
        Prevalence.prototype.checkAndApplyJournalEntries.name,
      );
      log("modelHolder.modelLock.lock");
      log("message =", message);
      const lastAppliedJournalEntryId: bigint =
        this.modelHolder.lastAppliedJournalEntryId;
      log("lastAppliedJournalEntryId =", lastAppliedJournalEntryId);
      const lastEntryId: bigint = message.lastEntryId;
      log("lastEntryId =", lastEntryId);
      if (lastEntryId <= lastAppliedJournalEntryId) {
        log("lastEntryId <= lastAppliedJournalEntryId");
        return;
      }
      const journalEntries: JournalEntry<M>[] = await this
        .loadJournalEntriesSince(
          lastAppliedJournalEntryId,
        );
      log("journalEntries =", journalEntries);
      for (const journalEntry of journalEntries) {
        journalEntry.action.execute(
          model,
          () => journalEntry.timestamp,
        );
      }
      this.modelHolder.lastAppliedJournalEntryId = lastEntryId;
    });
  }

  async loadJournalEntriesSince(
    sinceJournalEntryId: bigint,
  ): Promise<JournalEntry<M>[]> {
    const log = log0.sub(Prevalence.prototype.loadJournalEntriesSince.name);
    log("sinceJournalEntryId =", sinceJournalEntryId);

    const lastEntryIdResponse: Deno.KvEntryMaybe<bigint> = await this
      .getLastEntryIdResponse();

    if (typeof lastEntryIdResponse.value !== "bigint") {
      throw new Error(
        "Could not get lastEntryId from Deno.Kv",
      );
    }
    const lastEntryId: bigint = lastEntryIdResponse.value;

    if (lastEntryId < sinceJournalEntryId) {
      throw new Error(
        [
          "lastEntryId (",
          JSON.stringify(lastEntryId),
          ") < sinceJournalEntryId (",
          JSON.stringify(sinceJournalEntryId),
          ")",
        ].join(""),
      );
    }

    if (lastEntryId === sinceJournalEntryId) {
      return [];
    }

    const entryKeys: Deno.KvKey[] = range(sinceJournalEntryId + 1n, lastEntryId)
      .map(this.getEntryKey);
    log("entryKeys =", entryKeys);
    return (await this.kv.getMany(entryKeys))
      .filter((response) => isJournalEntry(response.value))
      .map((response) => response.value as JournalEntry<M>);
  }

  async testOnCopyAndAppend<A extends Action<M>>(action: A): Promise<void> {
    const timestamp: Timestamp = this.clock();
    const log = log0.sub(Prevalence.prototype.testOnCopyAndAppend.name);
    log("timestamp =", timestamp);
    log("action =", action);
    while (true) {
      try {
        await this.modelHolder.copy.doWith(async (copyWrapper: Wrapper<M>) => {
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

          const entry: JournalEntry<M> = { timestamp, action };
          const serializedEntry: string = this.marshaller.serializeJournalEntry(
            entry,
          );

          const newLastEntryId: bigint = 1n + lastEntryIdResponse.value;
          const entryKey: Deno.KvKey = this.getEntryKey(newLastEntryId);

          await this.kv.atomic()
            .check(lastEntryIdResponse)
            .check({ key: entryKey, versionstamp: null })
            .set(KEY_JOURNAL_LASTENTRYID, newLastEntryId)
            .set(entryKey, serializedEntry)
            .commit();

          // if that went well, tell everyone
          this.modelHolder.broadcastChannel.postMessage({
            type: MESSAGE_TYPE.JOURNAL_ENTRY_APPENDED,
            lastEntryId: newLastEntryId,
            action,
            timestamp,
          });
        });
        break;
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

  private getLastEntryIdResponse(): Promise<Deno.KvEntryMaybe<bigint>> {
    return this.kv.get(KEY_JOURNAL_LASTENTRYID);
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
