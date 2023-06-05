import { JournalEntry } from "../types.ts";

export interface Marshaller<M, D> {
  serializeModel(model: M): D;
  serializeJournalEntry(journalEntry: JournalEntry<M>): D;
  deserializeModel(data: D): M;
  deserializeJournalEntry(data: D): JournalEntry<M>;
}
