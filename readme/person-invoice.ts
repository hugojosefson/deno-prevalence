#!/usr/bin/env -S deno run --unstable --allow-write=example-person-invoice.db --allow-read=example-person-invoice.db
import { Clock, Command } from "../src/types.ts";
import { Marshaller } from "../src/marshall/marshaller.ts";
import { JsonMarshaller } from "../src/marshall/json-marshaller.ts";
import { Persister } from "../src/persist/persister.ts";
import { KvPersister } from "../src/persist/kv-persister.ts";
import { Prevalence } from "../mod.ts";

class User {
  readonly uuid: number;

  displayName: string;

  constructor(uuid: number, displayName: string) {
    this.uuid = uuid;
    this.displayName = displayName;
  }
}
const alice = new User(1, "Alice");

type Post = {
  id: string;
  subject: string;
};

class Model {
  constructor(readonly posts: Record<string, Post>) {}
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
type PostCommand = AddPostCommand | RemovePostCommand;
const commands: Record<"addPost" | "removePost", PostCommand> = {
  addPost,
  removePost,
};

const marshaller: Marshaller<
  Model,
  Record<"addPost" | "removePost", PostCommand>,
  keyof typeof commands,
  string
> = new JsonMarshaller<Model, typeof commands, keyof typeof commands, string>();
const kv: Deno.Kv = await Deno.openKv("example-person-invoice.db");
const persister: Persister<Model> = new KvPersister<Model, Uint8Array>(
  kv,
  [],
  marshaller,
);
const defaultInitialModel: Model = { posts: {} };
const prevalence = await Prevalence.create<Model, PostTransaction>(
  persister,
  defaultInitialModel,
);
await prevalence.execute(new AddPost({ id: "post#1", subject: "Lorem" }));
await prevalence.execute(new AddPost({ id: "post#2", subject: "Ipsum" }));
await prevalence.execute(new AddPost({ id: "post#3", subject: "Dolor" }));
await prevalence.execute(new RemovePost("post#2"));

const posts: Post[] = Object.values(prevalence.model.posts);

for (const post of posts) {
  console.log(`${post.id}: ${post.subject}`);
}
