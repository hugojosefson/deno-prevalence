import { describe, it } from "https://deno.land/std@0.202.0/testing/bdd.ts";
import { assertEquals } from "https://deno.land/std@0.202.0/assert/assert_equals.ts";
import { using as usingResource } from "https://deno.land/x/websocket_broadcastchannel@0.7.0/src/using.ts";
import { Action, Prevalence } from "../mod.ts";
import { assertInstanceOf } from "https://deno.land/std@0.202.0/assert/assert_instance_of.ts";

class Post {
  constructor(
    readonly id: string,
    public subject: string,
  ) {}
}

class User {
  constructor(
    readonly uuid: string,
    public displayName: string,
  ) {}
}

type MyModel = {
  posts: Post[];
  users: User[];
};

function getFixture(): Prevalence<MyModel> {
  return Prevalence.create(
    "test",
    {
      posts: [
        new Post("1", "Hello"),
        new Post("2", "World"),
      ],
      users: [
        new User("1", "Alice"),
        new User("2", "Bob"),
        new User("3", "Charlie"),
        new User("4", "David"),
        new User("5", "Eve"),
        new User("6", "Frank"),
        new User("7", "Grace"),
        new User("8", "Heidi"),
        new User("9", "Ivan"),
        new User("10", "Judy"),
        new User("11", "Kevin"),
        new User("12", "Larry"),
        new User("13", "Mallory"),
        new User("14", "Nancy"),
        new User("15", "Olivia"),
        new User("16", "Peggy"),
        new User("17", "Quentin"),
        new User("18", "Rupert"),
        new User("19", "Sybil"),
        new User("20", "Trudy"),
        new User("21", "Ursula"),
        new User("22", "Victor"),
        new User("23", "Walter"),
        new User("24", "Xavier"),
        new User("25", "Yvonne"),
        new User("26", "Zed"),
      ],
    },
    {
      kv: Deno.openKv(":memory:"),
      classes: {
        Post,
        User,
        AddPostAction,
        AddUserAction,
      },
    },
  );
}

type TestCase = (system: Prevalence<MyModel>) => Promise<void> | void;
function test(name: string, testCase: TestCase): void;
function test(testCase: TestCase): void;
function test(testCaseOrName: TestCase | string, testCase?: TestCase): void {
  const hasName = typeof testCaseOrName === "string";
  const hasNameAndTestCase = hasName && testCase !== undefined;

  const name: string = hasName ? testCaseOrName : testCaseOrName.toString()
    .replace(/^\(system\)\s*=>\s*/, "")
    .replace(/^assert/, "")
    .replace(/\bsystem\./g, "");

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

class AddPostAction implements Action<MyModel> {
  constructor(public post: Post) {}
  execute(model: MyModel): void {
    model.posts.push(this.post);
  }
}

class AddUserAction implements Action<MyModel> {
  constructor(public user: User) {}
  execute(model: MyModel): void {
    model.users.push(this.user);
  }
}

describe("prevalence", () => {
  test((system) => assertEquals(system.name, "test"));
  test((system) => assertEquals(system.model.posts.length, 2));
  test((system) => assertEquals(system.model.users.length, 26));
  test((system) => assertInstanceOf(system.model.posts[0], Post));
  test((system) => assertInstanceOf(system.model.users[0], User));
  test(
    "Add a post",
    async (system) => {
      console.log("Add a post: 1");
      const post = new Post("3", "Goodbye");
      console.log("Add a post: 2");
      const action: Action<MyModel> = new AddPostAction(post);
      console.log("Add a post: 3");
      await system.execute(action);
      console.log("Add a post: 4");
      assertEquals(system.model.posts.length, 3);
      console.log("Add a post: 5");
      assertEquals(system.model.posts[2], post);
      console.log("Add a post: 6");
    },
  );
  test(
    "Add a user",
    async (system) => {
      const user = new User("27", "Zelda");
      const action: Action<MyModel> = new AddUserAction(user);
      await system.execute(action);
      assertEquals(system.model.users.length, 27);
      assertEquals(system.model.users[26], user);
    },
  );
});
