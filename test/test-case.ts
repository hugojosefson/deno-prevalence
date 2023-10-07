import { it } from "https://deno.land/std@0.203.0/testing/bdd.ts";
import { using as usingResource } from "https://deno.land/x/websocket_broadcastchannel@0.8.0/src/using.ts";
import { Prevalence, PrevalenceOptions } from "../src/prevalence.ts";
import { MyModel } from "./fixture-types.ts";
import { getFixtureCreator } from "./get-fixture.ts";

export type TestCase = (system: Prevalence<MyModel>) => Promise<void> | void;
export type Kv = PrevalenceOptions<MyModel>["kv"];

export function test(kv: Kv, name: string, testCase: TestCase): void;
export function test(kv: Kv, testCase: TestCase): void;
export function test(
  kv: Kv,
  testCaseOrName: TestCase | string,
  testCase?: TestCase,
): void {
  const createFixture = getFixtureCreator(kv);

  const hasName = typeof testCaseOrName === "string";
  const hasNameAndTestCase = hasName && testCase !== undefined;

  const name: string = hasName ? testCaseOrName : testCaseOrName.toString()
    .replace(
      /^\(system\)\s*=>\s*/,
      "",
    )
    .replace(
      /^(assert[A-Z])/,
      (match: string) =>
        match
          .replace(/^assert/, "")
          .toLowerCase(),
    )
    .replace(
      /\bsystem\./g,
      "",
    );

  const effectiveTestCase: TestCase = hasNameAndTestCase
    ? testCase!
    : testCaseOrName as TestCase;

  it(name, async () => {
    await usingResource(
      [createFixture],
      ([system]) => effectiveTestCase(system),
    );
  });
}
