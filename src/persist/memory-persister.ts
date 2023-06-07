import { Commands, JournalEntry } from "../types.ts";
import { DELETE_ALL, LastAppliedTimestamp, Persister } from "./persister.ts";

/**
 * Stores data in memory.
 * @implements {Persister}
 * @template M The type of the model.
 */
export class MemoryPersister<
  M,
  C extends Commands<M>,
  CN extends keyof C,
> implements Persister<M, C, CN> {
  private model: M | undefined = undefined;
  private journal: JournalEntry<M, C, CN>[] = [];

  loadModel(defaultInitialModel: M): Promise<M> {
    if (this.model === undefined) {
      this.model = defaultInitialModel;
    }
    return Promise.resolve(this.model);
  }

  loadJournal(): Promise<JournalEntry<M, C, CN>[]> {
    return Promise.resolve(this.journal);
  }

  appendToJournal(journalEntry: JournalEntry<M, C, CN>): Promise<void> {
    this.journal.push(journalEntry);
    return Promise.resolve();
  }

  saveModelAndClearJournal(
    model: M,
    lastAppliedTimestamp: LastAppliedTimestamp,
  ): Promise<void> {
    this.model = model;
    this.journal = lastAppliedTimestamp === DELETE_ALL
      ? []
      : this.journal.filter((entry) => entry.timestamp > lastAppliedTimestamp);
    return Promise.resolve();
  }

  loadLastAppliedTimestamp(): Promise<number | null> {
    return Promise.resolve(
      this.journal.length === 0
        ? null
        : this.journal[this.journal.length - 1].timestamp,
    );
  }
}
