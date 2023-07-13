import dayjs from "npm:dayjs@1.11.9";

export type Timestamp = string;
export type Clock = () => Timestamp;

export function defaultClock(): Timestamp {
  return dayjs().toISOString();
}
