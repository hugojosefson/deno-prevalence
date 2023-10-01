import { Prevalence } from "../src/prevalence.ts";
import { AddPostAction } from "./add-post-action.ts";
import { AddUserAction } from "./add-user-action.ts";
import { MyModel, Post, User } from "./fixture-types.ts";

export function getFixture(): Prevalence<MyModel> {
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
