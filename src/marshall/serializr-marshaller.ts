import {
  ClazzOrModelSchema,
  deserialize,
  map,
  object,
  primitive,
  serialize,
} from "npm:serializr@3.0.2";
import { Context } from "npm:serializr@3.0.2/core/Context";
import { JournalEntry, Transaction } from "../types.ts";
import { Marshaller } from "./marshaller.ts";

export class SerializrMarshaller<M> implements Marshaller<M, Uint8Array> {
  private readonly transactionSchema: ClazzOrModelSchema<Transaction<M>> = {
    targetClass: Transaction<M>,
    props: {},
  };

  private readonly journalEntrySchema: ClazzOrModelSchema<JournalEntry<M>> = {
    targetClass: JournalEntry,
    props: {
      timestamp: primitive(),
      transaction: object(),
    },
    factory: (context: Context<JournalEntry<M>>) =>
      new JournalEntry(
        context.json.timestamp,
        context.json.transaction,
      ),
  };

  constructor(
    private readonly modelSchema: ClazzOrModelSchema<M>,
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
