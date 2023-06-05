import { JournalEntry } from "../types.ts";
import { Persister } from "./persister.ts";

/**
 * Stores data in memory.
 * @implements {Persister}
 * @template M The type of the model.
 */
export class MemoryPersister<M> implements Persister<M> {
  private model: M | undefined = undefined;
  private journal: JournalEntry<M>[] = [];

  loadModel(defaultInitialModel: M): Promise<M> {
    if (this.model === undefined) {
      this.model = defaultInitialModel;
    }
    return Promise.resolve(this.model);
  }

  saveModelAndClearJournal(model: M): Promise<void> {
    this.model = model;
    this.journal = [];
    return Promise.resolve();
  }

  loadJournal(): Promise<JournalEntry<M>[]> {
    return Promise.resolve(this.journal);
  }

  appendToJournal(journalEntry: JournalEntry<M>): Promise<void> {
    this.journal.push(journalEntry);
    return Promise.resolve();
  }
}
