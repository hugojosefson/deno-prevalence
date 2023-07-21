import {
  Action,
  Model,
  ModelHolder,
  Query,
  SerializableClassesContainer,
  ShouldRetryError,
} from "./types.ts";
import { logger } from "./log.ts";
import { Clock, defaultClock, Timestamp } from "./clock.ts";
import { Marshaller } from "./marshall/marshaller.ts";
import { SuperserialMarshaller } from "./marshall/superserial-marshaller.ts";
import { Serializer } from "https://deno.land/x/superserial@0.3.4/serializer.ts";

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

    this.modelHolder.broadcastChannel.addEventListener(
      "message",
      this.checkAndApplyJournalEntries.bind(this),
    );
  }

  async checkAndApplyJournalEntries(_event: Event): Promise<void> {
  }

  async execute<A extends Action<M>>(action: A): Promise<void> {
    const timestamp: Timestamp = this.clock();
    const log = log0.sub("execute");
    log("timestamp =", timestamp);
    log("action =", action);
    while (true) {
      try {
        await this.modelHolder.lock.lock(async () => {
          log("modelHolder.lock.lock");

          // make sure we have a copy of the model
          if (this.modelHolder.copy === undefined) {
            // serialize and deserialize the model to make a copy
            this.modelHolder.copy = this.marshaller.deserializeModel(
              this.marshaller.serializeModel(this.modelHolder.model),
            );
          }

          // mostly for typescript, to make sure this.modelHolder.copy is not undefined
          if (this.modelHolder.copy === undefined) {
            throw new Error(
              "this.modelHolder.copy is undefined, even after serialization and deserialization of this.modelHolder.model",
            );
          }

          // execute action on the copy
          action.execute(
            this.modelHolder.copy,
            () => timestamp,
          );

          // if that went well, check that the current model is up-to-date with `lastEntryId`
          const lastEntryIdResponse = await this.kv.get(
            KEY_JOURNAL_LASTENTRYID,
          );
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

          const newLastEntryId: bigint = 1n + lastEntryIdResponse.value;
          const serializedEntry: string = this.marshaller.serializeJournalEntry(
            {
              timestamp,
              action,
            },
          );
          const entryKey: Deno.KvKey = [...KEY_JOURNAL_ENTRIES, newLastEntryId];
          await this.kv.atomic()
            .check(lastEntryIdResponse)
            .check({ key: entryKey, versionstamp: null })
            .set(KEY_JOURNAL_LASTENTRYID, newLastEntryId)
            .set(entryKey, serializedEntry)
            .commit();

          // if that went well, tell everyone
          this.modelHolder.broadcastChannel.postMessage({
            type: "journalEntryAppended",
            lastEntryId: newLastEntryId,
            action,
            timestamp,
          });

          // TODO: only apply actions to the model via this.modelHolder.listeningChannel:
          // TODO: (but how do we await here for the action to be applied?)
          // solution: when each action is applied, it should post a message to a local channel
          // solution: and we should await for that message here. the message should contain the entryId
          // solution: of the action that was just applied. then we can await for that entryId to be applied.

          // apply the action to our model
          action.execute(
            this.modelHolder.model,
            () => timestamp,
          );

          // Update the model with the `lastAppliedJournalEntryId` from the latest journal entry we just applied.
          this.modelHolder.lastAppliedJournalEntryId = newLastEntryId;
        });
        break;
      } catch (error) {
        log("error =", error);
        this.modelHolder.copy = undefined;
        if (error?.ok === false) {
          // TODO: load the journal entries that were appended since we read `KEY_JOURNAL_LASTENTRYID`,
          // TODO: apply them to the model
          continue;
        }
        throw error;
      }
    }
  }

  async query<Q extends Query<M, R>, R>(query: Q): Promise<R> {
    const timestamp: Timestamp = this.clock();
    const log = log0.sub("query");
    log("timestamp =", timestamp);
    log("query =", query);
    return await new Promise<R>((resolve, reject) => {
      this.modelHolder.lock.run(async () => {
        log("modelHolder.lock.run");
        try {
          const result: Awaited<R> = await query(
            this.modelHolder.model,
            this.clock,
          );
          log("result =", result);
          resolve(result);
        } catch (error) {
          log("error =", error);
          reject(error);
        }
      });
    });
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
