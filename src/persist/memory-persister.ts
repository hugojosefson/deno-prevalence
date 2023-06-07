import { JournalEntry, KvValue, Model } from "../types.ts";
import { DELETE_ALL, LastAppliedTimestamp, Persister } from "./persister.ts";
import { Marshaller } from "../marshall/marshaller.ts";

interface Ram<M extends Model<M>> {
  model: M | undefined;
  journal: JournalEntry<M>[];
}

/**
 * Stores data in memory.
 * @implements {Persister}
 * @template M The type of the model.
 */
export class MemoryPersister<
  M extends Model<M>,
  D extends KvValue<D>,
> implements Persister<M> {
  private readonly ram: Ram<M> = {
    model: undefined,
    journal: [],
  };

  private readonly marshaller: Marshaller<M, D>;

  constructor(marshaller: Marshaller<M, D>) {
    this.marshaller = marshaller;
  }

  loadModel(defaultInitialModel: M): Promise<M> {
    if (this.ram.model === undefined) {
      this.ram.model = this.serdeserModel(defaultInitialModel);
    }
    return Promise.resolve(this.serdeserModel(this.ram.model));
  }

  loadJournal(): Promise<JournalEntry<M>[]> {
    return Promise.resolve(this.serdeserJournal(this.ram.journal));
  }

  appendToJournal(journalEntry: JournalEntry<M>): Promise<void> {
    this.ram.journal.push(this.serdeserJournalEntry(journalEntry));
    return Promise.resolve();
  }

  saveModelAndClearJournal(
    model: M,
    lastAppliedTimestamp: LastAppliedTimestamp,
  ): Promise<void> {
    this.ram.model = this.serdeserModel(model);
    this.ram.journal = lastAppliedTimestamp === DELETE_ALL
      ? []
      : this.ram.journal.filter((entry) =>
        entry.timestamp > lastAppliedTimestamp
      );
    return Promise.resolve();
  }

  loadLastAppliedTimestamp(): Promise<number | null> {
    return Promise.resolve(
      this.ram.journal.length === 0
        ? null
        : this.ram.journal[this.ram.journal.length - 1].timestamp,
    );
  }

  private serdeserModel(model: M): M {
    return this.marshaller.deserializeModel(
      this.marshaller.serializeModel(model),
    );
  }

  private serdeserJournalEntry(journalEntry: JournalEntry<M>): JournalEntry<M> {
    return this.marshaller.deserializeJournalEntry(
      this.marshaller.serializeJournalEntry(journalEntry),
    );
  }

  private serdeserJournal(journal: JournalEntry<M>[]): JournalEntry<M>[] {
    return journal.map(this.serdeserJournalEntry.bind(this));
  }
}
