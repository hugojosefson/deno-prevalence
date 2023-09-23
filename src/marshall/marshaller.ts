import { JournalEntry, Model } from "../types.ts";
import { SerializedString } from "./serialized.ts";

export interface Marshaller<M extends Model<M>> {
  serializeModel(model: M): SerializedString<M>;
  serializeJournalEntry(
    journalEntry: JournalEntry<M>,
  ): SerializedString<JournalEntry<M>>;
  deserializeModel(data: SerializedString<M>): M;
  deserializeJournalEntry(
    data: SerializedString<JournalEntry<M>>,
  ): JournalEntry<M>;
}
