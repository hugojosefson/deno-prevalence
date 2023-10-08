import { s } from "https://deno.land/x/websocket_broadcastchannel@0.8.0/src/fn.ts";
import dayjs from "npm:dayjs@1.11.10";

const TIMESTAMP_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).(\d+)Z$/;

export type ZeroPaddedNumber = `${number | `0${number}`}`;
export type Timestamp =
  `${number}-${ZeroPaddedNumber}-${ZeroPaddedNumber}T${ZeroPaddedNumber}:${ZeroPaddedNumber}:${ZeroPaddedNumber}.${number}Z`;
export type Clock = () => Timestamp;

export function defaultClock(): Timestamp {
  const now: string = dayjs().toISOString();
  return toTimestampOrThrow(now);
}

/**
 * Type-guard for {@link Timestamp}.
 * @param timestamp Potential timestamp.
 * @returns boolean Whether the argument is a valid {@link Timestamp}.
 */
export function isTimestamp(timestamp: unknown): timestamp is Timestamp {
  return typeof timestamp === "string" &&
    TIMESTAMP_REGEX.test(timestamp);
}

/**
 * Type assertion for {@link Timestamp}.
 * @param timestamp Potential timestamp.
 * @returns {@link Timestamp} The argument, if it is a valid {@link Timestamp}.
 * @throws Error if the argument is not a valid {@link Timestamp}.
 */
export function toTimestampOrThrow(timestamp: unknown): Timestamp {
  if (!isTimestamp(timestamp)) {
    throw new Error(`Not a timestamp: ${s(timestamp)}`);
  }
  return timestamp;
}
