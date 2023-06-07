import { Commands, JournalEntry, JSONValue } from "../types.ts";
import { Marshaller } from "./marshaller.ts";

export class JsonMarshaller<
  M extends JSONValue,
  C extends Commands<M, CN>,
  CN extends keyof C & string,
> implements Marshaller<M, C, CN, string> {
  serializeModel(model: M): string {
    return JSON.stringify(model);
  }

  serializeJournalEntry(journalEntry: JournalEntry<M, C, CN>): string {
    return JSON.stringify(journalEntry);
  }

  deserializeModel(data: string): M {
    return JSON.parse(data);
  }

  deserializeJournalEntry(data: string): JournalEntry<M, C, CN> {
    return JSON.parse(data);
  }
}
