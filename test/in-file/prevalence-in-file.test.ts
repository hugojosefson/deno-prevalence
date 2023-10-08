import { assertEquals } from "https://deno.land/std@0.203.0/assert/assert_equals.ts";
import { assertInstanceOf } from "https://deno.land/std@0.203.0/assert/assert_instance_of.ts";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "https://deno.land/std@0.203.0/testing/bdd.ts";
import { Action, Prevalence } from "../../mod.ts";
import { AddPostAction } from "../add-post-action.ts";
import { AddUserAction } from "../add-user-action.ts";
import { MyModel, Post, User } from "../fixture-types.ts";
import { getFixtureCreator } from "../get-fixture.ts";
import { test } from "../test-case.ts";
import { using as usingResource } from "https://deno.land/x/websocket_broadcastchannel@0.8.0/src/using.ts";
import { sleep } from "https://deno.land/x/websocket_broadcastchannel@0.8.0/src/fn.ts";

const FILE_NAME = "test.db";
const kv = () => Deno.openKv(FILE_NAME);

async function deleteFile() {
  try {
    console.error(`Deleting ${FILE_NAME}...`);
    await Deno.remove(FILE_NAME);
    console.error(`Deleted ${FILE_NAME}.`);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      // ignore
      console.error(`No ${FILE_NAME} to delete.`);
      return;
    }
    throw e;
  }
}
describe(`prevalence in new ${FILE_NAME}`, () => {
  beforeEach(deleteFile);
  afterAll(deleteFile);

  test(kv, (system) => assertEquals(system.name, "test"));
  test(kv, (system) => assertEquals(system.model.posts.length, 2));
  test(kv, (system) => assertEquals(system.model.users.length, 26));
  test(kv, (system) => assertInstanceOf(system.model.posts[0], Post));
  test(kv, (system) => assertInstanceOf(system.model.users[0], User));
  test(kv, "Add a post", async (system) => {
    const post = new Post("3", "Goodbye");
    const action: Action<MyModel> = new AddPostAction(post);
    await system.execute(action);
    assertEquals(system.model.posts.length, 3);
    assertEquals(system.model.posts[2], post);
  });
  test(kv, "Add a user", async (system) => {
    const user = new User("27", "Zelda");
    const action: Action<MyModel> = new AddUserAction(user);
    await system.execute(action);
    assertEquals(system.model.users.length, 27);
    assertEquals(system.model.users[26], user);
  });
});

describe.only(`journal loading from existing ${FILE_NAME}`, () => {
  beforeAll(deleteFile);
  afterAll(deleteFile);

  it(`should create ${FILE_NAME}, and then load from it`, async () => {
    await usingResource(
      [getFixtureCreator(kv)],
      async ([system]: [Prevalence<MyModel>]) => {
        assertEquals(system.model.posts.length, 2);
        assertEquals(system.model.users.length, 26);
        console.error("A: It has indeed 2 posts and 26 users.");
        await system.execute(new AddPostAction(new Post("3", "Goodbye")));
        await system.execute(new AddUserAction(new User("27", "Zelda")));

        assertEquals(system.model.posts.length, 3);
        assertEquals(system.model.users.length, 27);
        console.error("A: It has indeed 3 posts and 27 users.");

        await system.snapshot();
      },
    );

    console.error(
      `BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB`,
    );
    console.error(
      `BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB`,
    );
    console.error(
      `BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB`,
    );
    await usingResource(
      [getFixtureCreator(kv)],
      async ([system]: [Prevalence<MyModel>]) => {
        await sleep(1000);
        assertEquals(system.model.posts.length, 3);
        assertEquals(system.model.users.length, 27);
        console.error("B: It has indeed 3 posts and 27 users.");
      },
    );
  });
});
