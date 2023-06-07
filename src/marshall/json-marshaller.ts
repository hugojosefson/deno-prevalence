import { CommandNames, Commands, JournalEntry, JSONValue } from "../types.ts";
import { Marshaller } from "./marshaller.ts";

export class JsonMarshaller<
  M extends JSONValue,
  C extends Commands<M, CN>,
  CN extends CommandNames<M, C> = CommandNames<M, C>,
> implements Marshaller<M, C, string> {
  serializeModel(model: M): string {
    return JSON.stringify(model);
  }

  serializeJournalEntry(journalEntry: JournalEntry<M, C>): string {
    return JSON.stringify(journalEntry);
  }

  deserializeModel(data: string): M {
    return JSON.parse(data);
  }

  deserializeJournalEntry(data: string): JournalEntry<M, C> {
    return JSON.parse(data);
  }
}
