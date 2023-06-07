import { JournalEntry, JSONValue, Model } from "../types.ts";
import { Marshaller } from "./marshaller.ts";

export class JsonMarshaller<
  M extends Model<M> & JSONValue,
> implements Marshaller<M, string> {
  serializeModel(model: M): string {
    return JSON.stringify(model);
  }

  serializeJournalEntry(journalEntry: JournalEntry<M>): string {
    return JSON.stringify(journalEntry);
  }

  deserializeModel(data: string): M {
    return JSON.parse(data);
  }

  deserializeJournalEntry(data: string): JournalEntry<M> {
    return JSON.parse(data);
  }
}
