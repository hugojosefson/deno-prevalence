#!/usr/bin/env -S deno run --unstable --allow-env=DEBUG --allow-write=example-person-invoice.db --allow-read=example-person-invoice.db
import {
  Action,
  logger,
  Marshaller,
  Model,
  Prevalence,
  SerializableClassesContainer,
  SuperserialMarshaller,
} from "../mod.ts";
import { Serializer } from "https://deno.land/x/superserial@0.3.4/serializer.ts";

const log = logger(import.meta.url);

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
const defaultInitialModel: MyModel = { posts: {}, users: {} };
const prevalence: Prevalence<MyModel> = await Prevalence.create<MyModel>(
  "example-person-invoice",
  defaultInitialModel,
  {
    classes,
    kv,
    marshaller,
  },
);

await prevalence.execute(new AddPostAction({ id: "post#1", subject: "Lorem" }));
await prevalence.execute(new AddPostAction({ id: "post#2", subject: "Ipsum" }));
await prevalence.execute(new AddPostAction({ id: "post#3", subject: "Dolor" }));
await prevalence.execute(new RemovePostAction("post#2"));
await prevalence.execute(new AddUserAction(alice));

const posts: Post[] = []; //Object.values(prevalence.model.posts);

log("Posts:");
for (const post of posts) {
  log(`${post.id}: ${post.subject}`);
}
log("Users:");
for (const user of [] as User[] /*Object.values(prevalence.model.users)*/) {
  log(`${user.uuid}: ${user.displayName}`);
}

await prevalence.execute(new RemoveUserAction(alice.uuid));
log("Users:");
for (const user of [] as User[] /*Object.values(prevalence.model.users)*/) {
  log(`${user.uuid}: ${user.displayName}`);
}

await prevalence.snapshot();

log("Done.");
