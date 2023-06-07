import { CommandNames, Commands, JournalEntry, KvValue } from "../types.ts";
import { DELETE_ALL, LastAppliedTimestamp, Persister } from "./persister.ts";
import { Marshaller } from "../marshall/marshaller.ts";

/** Where the model is stored in the KV store. */
const MODEL_PREFIX: Deno.KvKey = ["model"];

/** Where the journal entries are stored in the KV store. */
const JOURNAL_ENTRIES_PREFIX: Deno.KvKey = ["journal", "entries"];

/** Where the journal start timestamp is stored in the KV store. Any journal entries before this timestamp are invalid, and should be deleted. */
const JOURNAL_LAST_APPLIED_TIMESTAMP_PREFIX: Deno.KvKey = [
  "journal",
  "lastAppliedTimestamp",
];

/**
 * Stores data in Deno.Kv.
 * @implements {Persister}
 * @template M The type of the model.
 * @template C The type of the commands object.
 * @template D The type of the data.
 * @template CN The type of the command names.
 */
export class KvPersister<
  M,
  C extends Commands<M, CN>,
  D extends KvValue<D>,
  CN extends CommandNames<M, C> = CommandNames<M, C>,
> implements Persister<M, C> {
  private readonly modelKey: Deno.KvKey;
  private readonly journalEntriesKey: Deno.KvKey;
  private readonly journalLastAppliedTimestampKey: Deno.KvKey;
  constructor(
    private readonly kv: Deno.Kv,
    private readonly prefix: Deno.KvKey,
    private readonly marshaller: Marshaller<M, C, D>,
  ) {
    this.modelKey = [...prefix, ...MODEL_PREFIX];
    this.journalEntriesKey = [...prefix, ...JOURNAL_ENTRIES_PREFIX];
    this.journalLastAppliedTimestampKey = [
      ...prefix,
      ...JOURNAL_LAST_APPLIED_TIMESTAMP_PREFIX,
    ];
  }

  async saveModelAndClearJournal(
    model: M,
    lastAppliedTimestamp: LastAppliedTimestamp,
  ): Promise<void> {
    const serializedModel: D = this.marshaller.serializeModel(model);
    if (lastAppliedTimestamp === DELETE_ALL) {
      await this.kv.atomic()
        .set(this.modelKey, serializedModel)
        .delete(this.journalEntriesKey)
        .delete(this.journalLastAppliedTimestampKey)
        .commit();
    } else {
      await this.kv.atomic()
        .set(this.modelKey, serializedModel)
        .set(this.journalLastAppliedTimestampKey, lastAppliedTimestamp)
        .commit();
      const journalResponse: Deno.KvListIterator<D> = await this.kv.list({
        prefix: this.journalEntriesKey,
        end: [...this.journalEntriesKey, lastAppliedTimestamp],
      });
      for await (const serializedJournalEntryResponse of journalResponse) {
        const key: Deno.KvKey = serializedJournalEntryResponse.key;
        await this.kv.delete(key);
      }
    }
  }

  async loadModel(defaultInitialModel: M): Promise<M> {
    const modelResponse: Deno.KvEntryMaybe<D> = await this.kv.get(
      this.modelKey,
    );
    if (modelResponse.value === null) {
      await this.saveModelAndClearJournal(defaultInitialModel, DELETE_ALL);
      return this.marshaller.deserializeModel(
        this.marshaller.serializeModel(defaultInitialModel),
      );
    }
    return this.marshaller.deserializeModel(modelResponse.value);
  }

  async loadJournal(): Promise<JournalEntry<M, C>[]> {
    const journalResponse: Deno.KvListIterator<D> = await this.kv.list({
      prefix: this.journalEntriesKey,
    });
    const journalEntries: JournalEntry<M, C>[] = [];
    for await (const serializedJournalEntryResponse of journalResponse) {
      const serializedJournalEntry: D = serializedJournalEntryResponse.value;
      journalEntries.push(
        this.marshaller.deserializeJournalEntry(serializedJournalEntry),
      );
    }
    return journalEntries;
  }

  async appendToJournal(journalEntry: JournalEntry<M, C>): Promise<void> {
    await this.kv.atomic()
      .check({
        key: [...this.journalEntriesKey, journalEntry.timestamp],
        versionstamp: null,
      })
      .set(
        [...this.journalEntriesKey, journalEntry.timestamp],
        this.marshaller.serializeJournalEntry(journalEntry),
      )
      .commit();
  }

  async loadLastAppliedTimestamp(): Promise<number | null> {
    const lastAppliedTimestampResponse: Deno.KvEntryMaybe<number> = await this
      .kv.get(
        this.journalLastAppliedTimestampKey,
      );
    return lastAppliedTimestampResponse.value;
  }
}
