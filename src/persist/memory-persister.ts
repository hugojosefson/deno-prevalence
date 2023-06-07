import { CommandNames, Commands, JournalEntry } from "../types.ts";
import { DELETE_ALL, LastAppliedTimestamp, Persister } from "./persister.ts";

/**
 * Stores data in memory.
 * @implements {Persister}
 * @template M The type of the model.
 * @template C The type of the commands object.
 * @template CN The type of the command names.
 */
export class MemoryPersister<
  M,
  C extends Commands<M, CN>,
  CN extends CommandNames<M, C> = CommandNames<M, C>,
> implements Persister<M, C> {
  private model: M | undefined = undefined;
  private journal: JournalEntry<M, C>[] = [];

  loadModel(defaultInitialModel: M): Promise<M> {
    if (this.model === undefined) {
      this.model = defaultInitialModel;
    }
    return Promise.resolve(this.model);
  }

  loadJournal(): Promise<JournalEntry<M, C>[]> {
    return Promise.resolve(this.journal);
  }

  appendToJournal(journalEntry: JournalEntry<M, C>): Promise<void> {
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
