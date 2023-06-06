export { Prevalence } from "./src/prevalence.ts";
export type { Clock, KvValue, Transaction } from "./src/types.ts";
export { JournalEntry } from "./src/types.ts";

export type { Persister } from "./src/persist/persister.ts";
export { MemoryPersister } from "./src/persist/memory-persister.ts";
export { KvPersister } from "./src/persist/kv-persister.ts";

export type { Marshaller } from "./src/marshall/marshaller.ts";
export { JsonMarshaller } from "./src/marshall/json-marshaller.ts";
export { SerializrMarshaller } from "./src/marshall/serializr-marshaller.ts";
