import { assertEquals } from "https://deno.land/std@0.202.0/assert/assert_equals.ts";
import { assertInstanceOf } from "https://deno.land/std@0.202.0/assert/assert_instance_of.ts";
import { describe } from "https://deno.land/std@0.202.0/testing/bdd.ts";
import { Action } from "../mod.ts";
import { AddPostAction } from "./add-post-action.ts";
import { AddUserAction } from "./add-user-action.ts";
import { MyModel, Post, User } from "./fixture-types.ts";
import { test } from "./test-case.ts";

describe("prevalence", () => {
  test((system) => assertEquals(system.name, "test"));
  test((system) => assertEquals(system.model.posts.length, 2));
  test((system) => assertEquals(system.model.users.length, 26));
  test((system) => assertInstanceOf(system.model.posts[0], Post));
  test((system) => assertInstanceOf(system.model.users[0], User));
  test(
    "Add a post",
    async (system) => {
      const post = new Post("3", "Goodbye");
      const action: Action<MyModel> = new AddPostAction(post);
      await system.execute(action);
      assertEquals(system.model.posts.length, 3);
      assertEquals(system.model.posts[2], post);
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
