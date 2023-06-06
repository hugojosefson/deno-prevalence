import { Commands, JournalEntry, KvValue } from "../types.ts";

export interface Marshaller<
  M,
  C extends Commands<M>,
  CN extends keyof C,
  D extends KvValue<D>,
> {
  serializeModel(model: M): D;
  serializeJournalEntry(journalEntry: JournalEntry<M, C, CN>): D;
  deserializeModel(data: D): M;
  deserializeJournalEntry(data: D): JournalEntry<M, C, CN>;
}
