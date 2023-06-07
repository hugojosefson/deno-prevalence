#!/usr/bin/env -S deno run --unstable --allow-write=example-person-invoice.db --allow-read=example-person-invoice.db
import { Serializer } from "https://deno.land/x/superserial@0.3.4/serializer.ts";
import {
  Clock,
  Command,
  KvPersister,
  Marshaller,
  Persister,
  Prevalence,
  SuperserialMarshaller,
} from "../mod.ts";

class User {
  readonly uuid: number;

  displayName: string;

  constructor(uuid: number, displayName: string) {
    this.uuid = uuid;
    this.displayName = displayName;
  }
}
const alice: User = new User(1, "Alice");

type Post = {
  id: string;
  subject: string;
};

class Model {
  constructor(
    public posts: Record<string, Post>,
    public users: User[],
  ) {}
}

abstract class ModelCommand<A> implements Command<Model, A> {
  abstract execute(model: Model, args: A, clock: Clock): void;
  argsToString(args: A): string {
    return JSON.stringify(args);
  }
  stringToArgs(argsString: string): A {
    return JSON.parse(argsString);
  }
}

class AddPostCommand extends ModelCommand<Post> {
  execute(model: Model, post: Post, _clock: Clock): void {
    model.posts[post.id] = post;
  }
}

class RemovePostCommand extends ModelCommand<string> {
  execute(model: Model, postId: string, _clock: Clock): void {
    delete model.posts[postId];
  }
}

class AddUserCommand extends ModelCommand<User> {
  execute(model: Model, user: User, _clock: Clock): void {
    model.users.push(user);
  }
}

class RemoveUserCommand extends ModelCommand<number> {
  execute(model: Model, userId: number, _clock: Clock): void {
    model.users = model.users.filter((user) => user.uuid !== userId);
  }
}

const commands = {
  addPost: new AddPostCommand(),
  removePost: new RemovePostCommand(),
  addUser: new AddUserCommand(),
  removeUser: new RemoveUserCommand(),
} as const;

const marshaller: Marshaller<
  Model,
  typeof commands,
  string
> = new SuperserialMarshaller<Model, typeof commands, keyof typeof commands>(
  new Serializer({
    classes: {
      User,
      Model,
    },
  }),
);
const kv: Deno.Kv = await Deno.openKv("example-person-invoice.db");
const persister: Persister<Model, typeof commands, keyof typeof commands> =
  new KvPersister<Model, typeof commands, keyof typeof commands, string>(
    kv,
    [],
    marshaller,
  );
const defaultInitialModel: Model = { posts: {}, users: [] };
const prevalence = await Prevalence.create<Model, typeof commands>(
  defaultInitialModel,
  commands,
  persister,
);
await prevalence.execute("addPost", { id: "post#1", subject: "Lorem" });
await prevalence.execute("addPost", { id: "post#2", subject: "Ipsum" });
await prevalence.execute("addPost", { id: "post#3", subject: "Dolor" });
await prevalence.execute("removePost", "post#2");
await prevalence.execute("addUser", alice);

const posts: Post[] = Object.values(prevalence.model.posts);

console.log("Posts:");
for (const post of posts) {
  console.log(`${post.id}: ${post.subject}`);
}
console.log();
console.log("Users:");
for (const user of prevalence.model.users) {
  console.log(`${user.uuid}: ${user.displayName}`);
}

await prevalence.execute("removeUser", [alice.uuid]);
console.log();
console.log("Users:");
for (const user of prevalence.model.users) {
  console.log(`${user.uuid}: ${user.displayName}`);
}
console.log("Done.");
