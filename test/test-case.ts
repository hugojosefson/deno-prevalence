import { it } from "https://deno.land/std@0.203.0/testing/bdd.ts";
import { using as usingResource } from "https://deno.land/x/websocket_broadcastchannel@0.8.0/src/using.ts";
import { Prevalence } from "../src/prevalence.ts";
import { MyModel } from "./fixture-types.ts";
import { getFixture } from "./get-fixture.ts";

type TestCase = (system: Prevalence<MyModel>) => Promise<void> | void;

export function test(name: string, testCase: TestCase): void;
export function test(testCase: TestCase): void;
export function test(
  testCaseOrName: TestCase | string,
  testCase?: TestCase,
): void {
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
      [getFixture],
      ([system]) => effectiveTestCase(system),
    );
  });
}
