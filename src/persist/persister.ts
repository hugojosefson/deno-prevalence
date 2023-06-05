import { JournalEntry } from "../types.ts";

export interface Persister<M> {
  /**
   * Load the model from the persister.
   */
  loadModel(defaultInitialModel: M): Promise<M>;

  /**
   * Save the model to the persister, and clear the journal, atomically.
   * @param model The model to save.
   */
  saveModelAndClearJournal(model: M): Promise<void>;

  /**
   * Load the journal from the persister.
   */
  loadJournal(): Promise<JournalEntry<M>[]>;

  /**
   * Append an entry to the journal.
   * @param journalEntry The entry to append.
   * @returns A promise that resolves when the entry has been appended.
   */
  appendToJournal(journalEntry: JournalEntry<M>): Promise<void>;
}
