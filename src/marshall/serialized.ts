import { Serializer } from "https://deno.land/x/superserial@0.3.4/serializer.ts";

export const SERIALIZED_STRING_PREFIX = "serialized=";
export type SerializedString<T> = `${typeof SERIALIZED_STRING_PREFIX}${string}`;

export function isAnySerializedString(
  data: unknown,
): data is SerializedString<unknown> {
  if (typeof data !== "string") {
    return false;
  }
  return data.startsWith(SERIALIZED_STRING_PREFIX);
}

export function isSerializedString<T>(
  clazzConstructor: new (...args: unknown[]) => T,
  data: unknown,
): data is SerializedString<T> {
  if (!isAnySerializedString(data)) {
    return false;
  }
  try {
    const classes = {
      [clazzConstructor.name]: clazzConstructor,
    };
    const serialized = extractSerializedData(data as SerializedString<T>);
    const serializer = new Serializer({ classes });
    const deserialized = serializer.deserialize(serialized);
    return deserialized instanceof clazzConstructor;
  } catch (_e) {
    return false;
  }
}

export function extractSerializedData<T>(data: SerializedString<T>): string {
  return data.slice(SERIALIZED_STRING_PREFIX.length);
}
