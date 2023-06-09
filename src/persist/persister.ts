import { Action, JournalEntry, Model } from "../types.ts";

export type DELETE_ALL = "deleteAll";
export const DELETE_ALL: DELETE_ALL = "deleteAll" as DELETE_ALL;
export type LastAppliedTimestamp = number | DELETE_ALL;

export interface Persister<M extends Model<M>> {
  /**
   * Load the model from the persister.
   *
   * @param defaultInitialModel The initial model to use if there is no model in the persister.
   */
  loadModel(defaultInitialModel: M): Promise<M>;

  /**
   * Load the journal from the persister.
   */
  loadJournal(): Promise<JournalEntry<M>[]>;

  /**
   * Append an entry to the journal.
   * @param journalEntry The entry to append.
   * @returns A promise that resolves when the entry has been appended.
   */
  appendToJournal(journalEntry: JournalEntry<M>): Promise<Action<M>>;

  /**
   * Save the model to the persister, and clear the journal, atomically.
   * @param model The model to save.
   * @param lastAppliedTimestamp Timestamp of the last applied journal entry in the model, or "DELETE_ALL" to delete the entire journal. If the journal contains entries with timestamps before this timestamp, they should be deleted.
   */
  saveModelAndClearJournal(
    model: M,
    lastAppliedTimestamp: LastAppliedTimestamp,
  ): Promise<void>;

  /**
   * Load the last applied timestamp from the persister.
   * @returns A promise that resolves to the last applied timestamp, or null if there is none.
   */
  loadLastAppliedTimestamp(): Promise<number | null>;
}
