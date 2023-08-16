import { describe, it } from "https://deno.land/std@0.198.0/testing/bdd.ts";
import { assertEquals } from "https://deno.land/std@0.198.0/assert/assert_equals.ts";
import { using } from "https://deno.land/x/websocket_broadcastchannel@0.7.0/src/using.ts";
import { Prevalence } from "../mod.ts";

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

describe("prevalence", () => {
  it("create", async () => {
    await using(
      [
        () =>
          Prevalence.create(
            "test",
            {
              posts: [],
              users: [],
            },
            {
              kv: Deno.openKv(":memory:"),
              classes: {
                Post,
                User,
              },
            },
          ),
      ],
      (resources) => {
        const system = resources[0];
        assertEquals(system.model.posts.length, 0);
      },
    );
  });
});
