export interface Wrapper<T> {
  value?: T;
}

export function wrap<T>(value?: T): Wrapper<T> {
  return { value };
}
