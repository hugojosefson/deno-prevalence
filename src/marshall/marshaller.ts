import { CommandNames, Commands, JournalEntry } from "../types.ts";

export interface Marshaller<
  M,
  C extends Commands<M, CN>,
  D,
  CN extends CommandNames<M, C> = CommandNames<M, C>,
> {
  serializeModel(model: M): D;
  serializeJournalEntry(journalEntry: JournalEntry<M, C>): D;
  deserializeModel(data: D): M;
  deserializeJournalEntry(data: D): JournalEntry<M, C>;
}
