export { Prevalence } from "./src/prevalence.ts";

export type { Marshaller } from "./src/marshall/marshaller.ts";
export { JsonMarshaller } from "./src/marshall/json-marshaller.ts";
export { SuperserialMarshaller } from "./src/marshall/superserial-marshaller.ts";

export type {
  Action,
  JournalEntry,
  JSONValue,
  KvValue,
  Model,
  SerializableClassesContainer,
} from "./src/types.ts";

export { type Logger, logger } from "./src/log.ts";
export { type Clock } from "./src/clock.ts";
