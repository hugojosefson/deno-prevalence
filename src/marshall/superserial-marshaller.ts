import { Serializer } from "https://deno.land/x/superserial@0.3.4/mod.ts";
import { Commands, JournalEntry } from "../types.ts";
import { Marshaller } from "./marshaller.ts";

export class SuperserialMarshaller<
  M,
  C extends Commands<M, CN>,
  CN extends keyof C & string,
> implements Marshaller<M, C, CN, string> {
  private readonly serializer: Serializer;

  constructor(serializer: Serializer) {
    this.serializer = serializer;
  }

  serializeModel(model: M): string {
    return this.serializer.serialize(model);
  }

  serializeJournalEntry(journalEntry: JournalEntry<M, C, CN>): string {
    return this.serializer.serialize(journalEntry);
  }

  deserializeModel(data: string): M {
    return this.serializer.deserialize(data);
  }

  deserializeJournalEntry(data: string): JournalEntry<M, C, CN> {
    return this.serializer.deserialize(data);
  }
}
