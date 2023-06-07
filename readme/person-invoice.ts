#!/usr/bin/env -S deno run --unstable --allow-write=example-person-invoice.db --allow-read=example-person-invoice.db
import { Serializer } from "https://deno.land/x/superserial@0.3.4/serializer.ts";
import {
  KvPersister,
  Marshaller,
  Persister,
  Prevalence,
  SuperserialMarshaller,
} from "../mod.ts";
import { Action, SerializableClassesContainer } from "../src/types.ts";

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

class AddPostAction implements Action<Model> {
  constructor(public post: Post) {}
  execute(model: Model): void {
    model.posts[this.post.id] = this.post;
  }
}

class RemovePostAction implements Action<Model> {
  constructor(public postId: string) {}
  execute(model: Model): void {
    delete model.posts[this.postId];
  }
}

class AddUserAction implements Action<Model> {
  constructor(public user: User) {}
  execute(model: Model): void {
    model.users.push(this.user);
  }
}

class RemoveUserAction implements Action<Model> {
  constructor(public userUuid: User["uuid"]) {}
  execute(model: Model): void {
    model.users = model.users.filter((u) => u.uuid !== this.userUuid);
  }
}

const classes: SerializableClassesContainer = {
  User,
  Model,
  AddPostAction,
  RemovePostAction,
  AddUserAction,
  RemoveUserAction,
};

const marshaller: Marshaller<Model, string> = new SuperserialMarshaller<Model>(
  new Serializer({ classes }),
);
const kv: Deno.Kv = await Deno.openKv("example-person-invoice.db");
const persister: Persister<Model> = new KvPersister<Model, string>(
  kv,
  [],
  marshaller,
);
const defaultInitialModel: Model = { posts: {}, users: [] };
const prevalence = await Prevalence.create<Model>(
  defaultInitialModel,
  { persister },
);
await prevalence.execute(new AddPostAction({ id: "post#1", subject: "Lorem" }));
await prevalence.execute(new AddPostAction({ id: "post#2", subject: "Ipsum" }));
await prevalence.execute(new AddPostAction({ id: "post#3", subject: "Dolor" }));
await prevalence.execute(new RemovePostAction("post#2"));
await prevalence.execute(new AddUserAction(alice));

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

await prevalence.execute(new RemoveUserAction(alice.uuid));
console.log();
console.log("Users:");
for (const user of prevalence.model.users) {
  console.log(`${user.uuid}: ${user.displayName}`);
}
console.log("Done.");
