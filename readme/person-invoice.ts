#!/usr/bin/env -S deno run --unstable --allow-write=example-person-invoice.db --allow-read=example-person-invoice.db
import {
  KvPersister,
  Marshaller,
  Persister,
  Prevalence,
  SerializrMarshaller,
  Transaction,
} from "../mod.ts";
import { Context } from "npm:serializr@3.0.2/core/Context";

type Post = {
  id: string;
  subject: string;
};

class Model {
  constructor(readonly posts: Record<string, Post>) {}
}

class AddPost implements Transaction<Model> {
  constructor(private readonly post: Post) {}
  execute(model: Model): void {
    model.posts[this.post.id] = this.post;
  }
}

class RemovePost implements Transaction<Model> {
  constructor(private readonly id: string) {}
  execute(model: Model): void {
    delete model.posts[this.id];
  }
}

type PostTransaction = AddPost | RemovePost;

const kv = await Deno.openKv("example-person-invoice.db");
const marshaller: Marshaller<Model, Uint8Array> = new SerializrMarshaller<
  Model
>(
  {
    targetClass: Model,
    props: {
      posts: true,
    },
    factory: (context: Context<Model>) => new Model(context.json.posts),
  },
);
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
