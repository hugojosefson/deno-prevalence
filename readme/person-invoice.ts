#!/usr/bin/env -S deno run --unstable --allow-write=example-person-invoice.db --allow-read=example-person-invoice.db
import { Prevalence } from "../mod.ts";
import { Transaction } from "../src/types.ts";
import { KvPersister } from "../src/persist/kv-persister.ts";
import { JsonMarshaller } from "../src/persist/json-marshaller.ts";
import { Marshaller } from "../src/persist/marshaller.ts";

type Post = {
  id: string;
  subject: string;
};

type Model = {
  posts: Record<string, Post>;
};

class AddPost implements Transaction<Model> {
  constructor(private readonly post: Post) {}
  execute(model: Model): void {
    model.posts[this.post.id] = this.post;
  }
}

const kv = await Deno.openKv("example-person-invoice.db");
const marshaller: Marshaller<Model, string> = new JsonMarshaller<Model>();
const prevalence = new Prevalence<Model, AddPost>(
  { posts: {} },
  new KvPersister<Model, string>(
    kv,
    [],
    marshaller,
  ),
);
await prevalence.execute(new AddPost({ id: "post#1", subject: "Lorem" }));
await prevalence.execute(new AddPost({ id: "post#2", subject: "Ipsum" }));

const posts: Post[] = Object.values(prevalence.model.posts);

for (const post of posts) {
  console.log(`${post.id}: ${post.subject}`);
}
