import { JournalEntry, KvValue } from "../types.ts";
import { Persister } from "./persister.ts";
import { Marshaller } from "../marshall/marshaller.ts";

const MODEL_PREFIX: Deno.KvKey = ["model"];
const JOURNAL_PREFIX: Deno.KvKey = ["journal"];

/**
 * Stores data in Deno.Kv.
 * @implements {Persister}
 * @template M The type of the model.
 * @template D The type of the data.
 */
export class KvPersister<M, D extends KvValue<D>> implements Persister<M> {
  private readonly modelKey: Deno.KvKey;
  private readonly journalKey: Deno.KvKey;
  constructor(
    private readonly kv: Deno.Kv,
    private readonly prefix: Deno.KvKey,
    private readonly marshaller: Marshaller<M, D>,
  ) {
    this.modelKey = [...prefix, ...MODEL_PREFIX];
    this.journalKey = [...prefix, ...JOURNAL_PREFIX];
  }

  async saveModelAndClearJournal(model: M): Promise<void> {
    await this.kv.atomic()
      .set(this.modelKey, this.marshaller.serializeModel(model))
      .delete(this.journalKey)
      .commit();
  }

  async loadModel(defaultInitialModel: M): Promise<M> {
    const modelResponse: Deno.KvEntryMaybe<D> = await this.kv.get(
      this.modelKey,
    );
    if (modelResponse.value === null) {
      await this.saveModelAndClearJournal(defaultInitialModel);
      return this.marshaller.deserializeModel(
        this.marshaller.serializeModel(defaultInitialModel),
      );
    }
    return this.marshaller.deserializeModel(modelResponse.value);
  }

  async appendToJournal(journalEntry: JournalEntry<M>): Promise<void> {
    await this.kv.atomic()
      .check({
        key: [...this.journalKey, journalEntry.timestamp],
        versionstamp: null,
      })
      .set(
        [...this.journalKey, journalEntry.timestamp],
        this.marshaller.serializeJournalEntry(journalEntry),
      )
      .commit();
  }

  async loadJournal(): Promise<JournalEntry<M>[]> {
    const journalResponse: Deno.KvListIterator<D> = await this.kv.list({
      prefix: this.journalKey,
    });
    const journalEntries: JournalEntry<M>[] = [];
    for await (const serializedJournalEntryResponse of journalResponse) {
      const serializedJournalEntry: D = serializedJournalEntryResponse.value;
      journalEntries.push(
        this.marshaller.deserializeJournalEntry(serializedJournalEntry),
      );
    }
    return journalEntries;
  }
}
