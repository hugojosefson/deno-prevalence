# kv_prevalence

[System prevalence](https://en.wikipedia.org/wiki/System_prevalence) as a typed
library, using a [Deno.Kv](https://deno.com/kv) database for storage.

[![deno module](https://shield.deno.dev/x/kv_prevalence)](https://deno.land/x/kv_prevalence)
[![CI](https://github.com/hugojosefson/deno-kv-prevalence/actions/workflows/ci.yaml/badge.svg)](https://github.com/hugojosefson/deno-kv-prevalence/actions/workflows/ci.yaml)

## Requirements

Requires [Deno](https://deno.land/) v1.32 or later, with the `--unstable` flag.

## API

Please see the
[auto-generated API documentation](https://deno.land/x/kv_prevalence?doc).

## Example usage

```typescript
import {
  KvPersister,
  Marshaller,
  Persister,
  Prevalence,
  SerializrMarshaller,
  Transaction,
} from "https://deno.land/x/kv_prevalence/mod.ts";
import { JournalEntryClass } from "https://deno.land/x/kv_prevalence/src/types.ts";

type Post = {
  id: string;
  subject: string;
};

type Model = {
  posts: Record<string, Post>;
};

class ModelClass implements Model {
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
  ModelClass,
  JournalEntryClass,
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
```

You may run the above example with:

```sh
deno run --unstable --reload --allow-write=example-person-invoice.db --allow-read=example-person-invoice.db https://deno.land/x/kv_prevalence/readme/person-invoice.ts
```

For further usage examples, see the tests:

- [test/prevalence.test.ts](test/prevalence.test.ts)
