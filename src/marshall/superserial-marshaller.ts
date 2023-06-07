import { Serializer } from "https://deno.land/x/superserial@0.3.4/mod.ts";
import { CommandNames, Commands, JournalEntry } from "../types.ts";
import { Marshaller } from "./marshaller.ts";

export class SuperserialMarshaller<
  M,
  C extends Commands<M, CN>,
  CN extends CommandNames<M, C> = CommandNames<M, C>,
> implements Marshaller<M, C, string> {
  private readonly serializer: Serializer;

  constructor(serializer: Serializer) {
    this.serializer = serializer;
  }

  serializeModel(model: M): string {
    return this.serializer.serialize(model);
  }

  serializeJournalEntry(journalEntry: JournalEntry<M, C>): string {
    return this.serializer.serialize(journalEntry);
  }

  deserializeModel(data: string): M {
    return this.serializer.deserialize(data);
  }

  deserializeJournalEntry(data: string): JournalEntry<M, C> {
    return this.serializer.deserialize(data);
  }
}
