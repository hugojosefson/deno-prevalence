import { Commands, JournalEntry, JSONValue, KvValue } from "../types.ts";
import { Marshaller } from "./marshaller.ts";

export class JsonMarshaller<
  M extends JSONValue,
  C extends Commands<M>,
  CN extends keyof C,
  D extends KvValue<D>,
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
