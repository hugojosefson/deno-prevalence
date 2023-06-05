import {
  ClazzOrModelSchema,
  deserialize,
  serialize,
} from "npm:serializr@3.0.2";
import { JournalEntry } from "../types.ts";
import { Marshaller } from "./marshaller.ts";

export class SerializrMarshaller<M, Uint8Array>
  implements Marshaller<M, Uint8Array> {
  constructor(
    private readonly modelSchema: ClazzOrModelSchema<M>,
    private readonly journalEntrySchema: ClazzOrModelSchema<JournalEntry<M>>,
  ) {}
  serializeModel(model: M): Uint8Array {
    return serialize(this.modelSchema, model);
  }

  serializeJournalEntry(journalEntry: JournalEntry<M>): Uint8Array {
    return serialize(this.journalEntrySchema, journalEntry);
  }

  deserializeModel(data: Uint8Array): M {
    return deserialize(this.modelSchema, data);
  }

  deserializeJournalEntry(data: Uint8Array): JournalEntry<M> {
    return deserialize(this.journalEntrySchema, data);
  }
}
