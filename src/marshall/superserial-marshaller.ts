import { Serializer } from "https://deno.land/x/superserial@0.3.4/mod.ts";
import { JournalEntry, Model } from "../types.ts";
import { Marshaller } from "./marshaller.ts";

export class SuperserialMarshaller<
  M extends Model<M>,
> implements Marshaller<M, string> {
  private readonly serializer: Serializer;

  constructor(serializer: Serializer) {
    this.serializer = serializer;
  }

  serializeModel(model: M): string {
    return this.serializer.serialize(model);
  }

  serializeJournalEntry(journalEntry: JournalEntry<M>): string {
    return this.serializer.serialize(journalEntry);
  }

  deserializeModel(data: string): M {
    return this.serializer.deserialize(data);
  }

  deserializeJournalEntry(data: string): JournalEntry<M> {
    return this.serializer.deserialize(data);
  }
}
