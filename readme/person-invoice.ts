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

type AddPostCommand = Command<Model, [Post]>;
const addPost: AddPostCommand = {
  execute: (model: Model, args: [Post], _clock: Clock) => {
    const [post] = args;
    model.posts[post.id] = post;
  },
  argsToString: (args: [Post]) => {
    const [post] = args;
    return JSON.stringify(post);
  },
  stringToArgs: (argsString: string) => {
    const post = JSON.parse(argsString);
    return [post];
  },
};

type RemovePostCommand = Command<Model, [string]>;
const removePost: RemovePostCommand = {
  execute: (model: Model, args: [string], _clock: Clock) => {
    const [postId] = args;
    delete model.posts[postId];
  },
  argsToString: (args: [string]) => {
    const [postId] = args;
    return postId;
  },
  stringToArgs: (argsString: string) => {
    return [argsString];
  },
};

type AddUserCommand = Command<Model, [User]>;
const addUser: AddUserCommand = {
  execute: (model: Model, args: [User], _clock: Clock) => {
    const [user] = args;
    model.users.push(user);
  },
  argsToString: (args: [User]) => {
    const [user] = args;
    return JSON.stringify(user);
  },
  stringToArgs: (argsString: string) => {
    const user = JSON.parse(argsString);
    return [user];
  },
};

type RemoveUserCommand = Command<Model, [number]>;
const removeUser: RemoveUserCommand = {
  execute: (model: Model, args: [number], _clock: Clock) => {
    const [userId] = args;
    model.users = model.users.filter((user) => user.uuid !== userId);
  },
  argsToString: (args: [number]) => {
    const [userId] = args;
    return userId.toString();
  },
  stringToArgs: (argsString: string) => {
    return [parseInt(argsString, 10)];
  },
};

const commands: Record<
  "addPost" | "removePost" | "addUser" | "removeUser",
  Command<Model, [Post] | [string] | [User] | [number]>
> = {
  addPost,
  removePost,
  addUser,
  removeUser,
};

const marshaller: Marshaller<
  Model,
  typeof commands,
  keyof typeof commands,
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
await prevalence.execute("addPost", [{ id: "post#1", subject: "Lorem" }]);
await prevalence.execute("addPost", [{ id: "post#2", subject: "Ipsum" }]);
await prevalence.execute("addPost", [{ id: "post#3", subject: "Dolor" }]);
await prevalence.execute("removePost", ["post#2"]);
await prevalence.execute("addUser", [alice]);

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
