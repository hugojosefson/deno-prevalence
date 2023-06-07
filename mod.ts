export { Prevalence } from "./src/prevalence.ts";

export type { Persister } from "./src/persist/persister.ts";
export { MemoryPersister } from "./src/persist/memory-persister.ts";
export { KvPersister } from "./src/persist/kv-persister.ts";

export type { Marshaller } from "./src/marshall/marshaller.ts";
export { JsonMarshaller } from "./src/marshall/json-marshaller.ts";
export { SuperserialMarshaller } from "./src/marshall/superserial-marshaller.ts";

export type {
  Action,
  Clock,
  JournalEntry,
  JSONValue,
  KvValue,
  Model,
  SerializableClassesContainer,
} from "./src/types.ts";

export { type Logger, logger } from "./src/log.ts";
