#!/usr/bin/env -S deno run --unstable --allow-write=example-person-invoice.db --allow-read=example-person-invoice.db
import { Serializer } from "https://deno.land/x/superserial@0.3.4/serializer.ts";
import {
  KvPersister,
  Marshaller,
  Persister,
  Prevalence,
  SuperserialMarshaller,
} from "../mod.ts";
import { Action, Model, SerializableClassesContainer } from "../src/types.ts";

class User {
  constructor(
    readonly uuid: string,
    public displayName: string,
  ) {}
}
const alice: User = new User("1", "Alice");

type Post = {
  id: string;
  subject: string;
};

class MyModel implements Model<MyModel> {
  constructor(
    public posts: Record<string, Post>,
    public users: Record<string, User>,
  ) {}
}

class AddPostAction implements Action<MyModel> {
  constructor(public post: Post) {}
  execute(model: MyModel): void {
    model.posts[this.post.id] = this.post;
  }
}

class RemovePostAction implements Action<MyModel> {
  constructor(public postId: string) {}
  execute(model: MyModel): void {
    delete model.posts[this.postId];
  }
}

class AddUserAction implements Action<MyModel> {
  constructor(public user: User) {}
  execute(model: MyModel): void {
    model.users[this.user.uuid] = this.user;
  }
}

class RemoveUserAction implements Action<MyModel> {
  constructor(public userId: string) {}
  execute(model: MyModel): void {
    delete model.users[this.userId];
  }
}

const classes: SerializableClassesContainer = {
  User,
  MyModel,
  AddPostAction,
  RemovePostAction,
  AddUserAction,
  RemoveUserAction,
};

const marshaller: Marshaller<MyModel, string> = new SuperserialMarshaller<
  MyModel
>(
  new Serializer({ classes }),
);
const kv: Deno.Kv = await Deno.openKv("example-person-invoice.db");
const persister: Persister<MyModel> = new KvPersister<MyModel, string>(
  marshaller,
  kv,
);
const defaultInitialModel: MyModel = { posts: {}, users: {} };
const prevalence: Prevalence<MyModel> = await Prevalence.create<MyModel>(
  defaultInitialModel,
  { persister, classes },
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
for (const user of Object.values(prevalence.model.users)) {
  console.log(`${user.uuid}: ${user.displayName}`);
}

await prevalence.execute(new RemoveUserAction(alice.uuid));
console.log();
console.log("Users:");
for (const user of Object.values(prevalence.model.users)) {
  console.log(`${user.uuid}: ${user.displayName}`);
}

console.log("Done.");
