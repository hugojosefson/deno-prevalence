/**
 * Returns a range of numbers from start to end.
 * @param start
 * @param end
 * @param step
 */
export function range(start: bigint, end: bigint, step = 1n): bigint[] {
  if (start === end) {
    return [start];
  }

  if (step === 0n) {
    throw new Error("Step cannot be zero unless start === end.");
  }

  if (start > end && step > 0n) {
    step = -step;
  }

  if (start < end && step < 0n) {
    step = -step;
  }

  const result: bigint[] = [];
  for (let i = start; i <= end; i += step) {
    result.push(i);
  }
  return result;
}
