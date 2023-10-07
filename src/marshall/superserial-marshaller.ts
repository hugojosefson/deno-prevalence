import {
  Serializer,
  toDeserialize,
  toSerialize,
} from "https://deno.land/x/superserial@0.3.4/mod.ts";
import { JournalEntry, Model } from "../types.ts";
import { Marshaller } from "./marshaller.ts";
import {
  extractSerializedData,
  SERIALIZED_STRING_PREFIX,
  SerializedString,
} from "./serialized.ts";

export { toDeserialize, toSerialize };

export class SuperserialMarshaller<
  M extends Model<M>,
> implements Marshaller<M> {
  private readonly serializer: Serializer;

  constructor(serializer: Serializer) {
    this.serializer = serializer;
  }

  serializeModel(model: M): SerializedString<M> {
    return `${SERIALIZED_STRING_PREFIX}${this.serializer.serialize(model)}`;
  }

  serializeJournalEntry(
    journalEntry: JournalEntry<M>,
  ): SerializedString<JournalEntry<M>> {
    return `${SERIALIZED_STRING_PREFIX}${
      this.serializer.serialize(journalEntry)
    }`;
  }

  deserializeModel(data: SerializedString<M>): M {
    return this.serializer.deserialize(extractSerializedData(data));
  }

  deserializeJournalEntry(
    data: SerializedString<JournalEntry<M>>,
  ): JournalEntry<M> {
    return this.serializer.deserialize(extractSerializedData(data));
  }
}
