# prevalence

[System prevalence](https://en.wikipedia.org/wiki/System_prevalence) as a typed
library, using [Deno.Kv](https://deno.com/kv) for storage.

[![deno.land/x/prevalence](https://shield.deno.dev/x/prevalence)](https://deno.land/x/prevalence)
[![CI](https://github.com/hugojosefson/deno-prevalence/actions/workflows/ci.yaml/badge.svg)](https://github.com/hugojosefson/deno-prevalence/actions/workflows/ci.yaml)

TypeScript implementation for Deno of the Prevalence design pattern, as
introduced by Klaus Wuestefeld in 1998 with [Prevayler](https://prevayler.org/).

Saves periodical snapshots of the whole model for faster startup, and keeps a
journal of executed actions since last snapshot, using a
[Persister](https://deno.land/x/prevalence/mod.ts?s=Persister). The `Persister`
uses a [Marshaller](https://deno.land/x/prevalence/mod.ts?s=Marshaller) to
serialize/deserialize the model and the journal.

## Requirements

Requires [Deno](https://deno.land/) v1.32 or later, with the `--unstable` flag.

## API

Please see the
[auto-generated API documentation](https://deno.land/x/prevalence?doc).

## Example usage

```typescript
import {
  Action,
  KvPersister,
  logger,
  Marshaller,
  Model,
  Persister,
  Prevalence,
  SerializableClassesContainer,
  SuperserialMarshaller,
} from "https://deno.land/x/prevalence/mod.ts";
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

log("Posts:");
for (const post of posts) {
  log(`${post.id}: ${post.subject}`);
}
log("Users:");
for (const user of Object.values(prevalence.model.users)) {
  log(`${user.uuid}: ${user.displayName}`);
}

await prevalence.execute(new RemoveUserAction(alice.uuid));
log("Users:");
for (const user of Object.values(prevalence.model.users)) {
  log(`${user.uuid}: ${user.displayName}`);
}

await prevalence.snapshot();

log("Done.");
```

You may run the above example with:

```sh
DEBUG='*' deno run --unstable --allow-env=DEBUG --reload --allow-write=example-person-invoice.db --allow-read=example-person-invoice.db https://deno.land/x/prevalence/readme/person-invoice.ts
```

For further usage examples, see the tests:

- [test/prevalence.test.ts](test/prevalence.test.ts)

## TODO

### Prevalence

#### lastJournalEntryId

- [ ] There is a single, global, strongly consistent `Deno.KvU64` counter at the
      key `["journal", "lastEntryId"]`.
- [ ] It is incremented by 1 for every journal entry.

#### Snapshot

- [ ] The snapshot is a serialized copy of the model after a certain
      `journalEntryId`.
- [ ] The snapshot has a `lastAppliedJournalEntryId` that is the id of the last
      journal entry that was applied to the snapshot.
- [ ] When reading the snapshot, we also read all journal entries with id
      greater than `lastAppliedJournalEntryId`, and apply them to the model in
      memory.

#### Actions

- [ ] An action is an instance of a class that implements the `Action`
      interface.
- [ ] An action instance contains all the data needed to execute it, including
      the timestamp for the clock.
- [ ] An action is executed by calling its `execute` method.
- [ ] An action is executed by the `Prevalence` instance, which passes the model
      to the action.
- [ ] In executing an action, the `Prevalence` instance:
  - [ ] Tests the action by executing it on a copy of the model.
    - [ ] The copy is made if not already exists, by serializing and
          deserializing the model.
    - [ ] If the action throws an exception when run on the model copy, the
          `Prevalence` instance:
      - [ ] Discards the now possibly tainted copy of the model.
      - [ ] Re-throws the exception.
  - [ ] If the action was successful on the copy, the `Prevalence` instance
        will:
    - [ ] Append a journal entry with the action, to the journal:
      - [ ] `const lastEntryId = await kv.get(["journal", "lastEntryId"])`
      - [ ] Check that the current model is up-to-date with `lastEntryId`, and
            if not:
        - [ ] discard the model copy,
        - [ ] load the journal entries that were appended since we read
              `["journal", "lastEntryId"]`,
        - [ ] apply them to the model
        - [ ] try again, from testing the action on a copy of the model.
      - [ ] `const newLastEntryId = lastEntryId + 1`
      - [ ] run an atomic operation:
        - [ ] check that `["journal", "lastEntryId"]` hasn't changed since we
              read it,
        - [ ] check that `["journal", "entries", newLastEntryId]` is `null`,
        - [ ] save `newLastEntryId` to `["journal", "lastEntryId"]`, and
        - [ ] store the journal entry at
              `["journal", "entries", newLastEntryId]`.
      - [ ] If the atomic operation fails, we:
        - [ ] discard the model copy,
        - [ ] load the journal entries that were appended since our model's
              latest entry was applied,
        - [ ] apply them to the model
        - [ ] try again, from testing the action on a copy of the model.
      - [ ] If the atomic operation succeeds, we:
        - [ ] Execute the action on the model.
        - [ ] Update the model with the `lastAppliedJournalEntryId` from the
              latest journal entry we just applied.

#### Code defensively

- [ ] When programming actions, we should program defensively, so we don't break
      the model or the journal.
- [ ] Check each step in the above algorithm for async things, and make sure
      they don't clash in the model or in the model copy.

Make the system consistent, considering:

- several app instances at Deno Deploy,
- several `async` code paths in a single app instance,

...at the same time:

- running actions,
- appending journal entries to the journal,

...and:

- failing at any point,
- crashing at any point.
