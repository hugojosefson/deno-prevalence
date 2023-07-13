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

Requires [Deno](https://deno.land/) v1.35 or later, with the `--unstable` flag.

## API

Please see the
[auto-generated API documentation](https://deno.land/x/prevalence?doc).

## Example usage

```typescript
"@@include(../examples/person-invoice.ts)";
```

You may run the above example with:

```sh
DEBUG='*'       \
deno run         \
  --reload        \
  --unstable       \
  --allow-env=DEBUG \
  --allow-write=example-person-invoice.db \
  --allow-read=example-person-invoice.db   \
  https://deno.land/x/prevalence/examples/person-invoice.ts
```

For further usage examples, see the tests:

- [test/prevalence.test.ts](test/prevalence.test.ts)

## TODO

### Synchronization and ordering

#### Being up-to-date

For an instance to _be able to know_ whether it's up-to-date, it needs to:

- [ ] Keep track of the latest journal entry it has applied, in the
      `ModelHolder.lastAppliedJournalEntryId`.
- [ ] Keep a queue of journal entries it has received, but not yet applied.
- [ ] Keep track of the latest journal entry it has received.

For an instance to _know_ that it's up-to-date:

- [ ] If the latest journal entry it has applied is the same as the latest
      journal entry it has received, it is up-to-date.

#### Receiving journal entries

When receiving a journal entry, we should:

- [ ] Check that the journal entry is newer than the latest journal entry we
      have applied.
- [ ] If so, we should apply the journal entry to our model.
- [ ] If not, we should ignore the journal entry.

### Prevalence

#### lastJournalEntryId

- [ ] There is a single, global, strongly consistent `Deno.KvU64` counter at the
      key `["journal", "lastEntryId"]`.
- [ ] It is incremented by 1 for every journal entry.

#### Timestamps

- [x] Timestamps are ISO 8601 strings, as returned by `dayjs().toISOString()`.

#### Snapshot

- [ ] The snapshot is a serialized copy of the model after a certain
      `journalEntryId`.
- [ ] The snapshot has a `lastAppliedJournalEntryId` that is the id of the last
      journal entry that was applied to the snapshot.
- [ ] When reading the snapshot, we also read all journal entries with id
      greater than `lastAppliedJournalEntryId`, and apply them to the model in
      memory.

#### Actions

- [x] An action is an instance of a class that implements the `Action`
      interface.
- [x] An action instance contains all the data needed to execute it, including
      the timestamp for the clock.
- [x] An action is executed by calling its `execute` method.
- [x] An action is executed by the `Prevalence` instance, which passes the model
      to the action.
- [ ] In executing an action, the `Prevalence` instance:
  - [x] Tests the action by executing it on a copy of the model.
    - [x] The copy is made if not already exists, by serializing and
          deserializing the model.
    - [x] If the action throws an exception when run on the model copy, the
          `Prevalence` instance:
      - [x] Discards the now possibly tainted copy of the model.
      - [x] Re-throws the exception.
  - [ ] If the action was successful on the copy, the `Prevalence` instance
        will:
    - [ ] Append a journal entry with the action, to the journal:
      - [x] `const lastEntryId = await kv.get(["journal", "lastEntryId"])`
      - [x] Check that the current model is up-to-date with `lastEntryId`, and
            if not:
        - [x] discard the model copy,
        - [ ] load the journal entries that were appended since we read
              `["journal", "lastEntryId"]`,
        - [ ] apply them to the model
        - [ ] try again, from testing the action on a copy of the model.
      - [x] `const newLastEntryId = lastEntryId + 1`
      - [x] run an atomic operation:
        - [x] check that `["journal", "lastEntryId"]` hasn't changed since we
              read it,
        - [x] check that `["journal", "entries", newLastEntryId]` is `null`,
        - [x] save `newLastEntryId` to `["journal", "lastEntryId"]`, and
        - [x] store the journal entry at
              `["journal", "entries", newLastEntryId]`.
      - [x] If the atomic operation fails, we:
        - [x] discard the model copy,
        - [x] load the journal entries that were appended since our model's
              latest entry was applied,
        - [x] apply them to the model
        - [x] try again, from testing the action on a copy of the model.
      - [x] If the atomic operation succeeds, we:
        - [x] Execute the action on the model.
        - [x] Update the model with the `lastAppliedJournalEntryId` from the
              latest journal entry we just applied.

#### BroadcastChannel

Use a `BroadcastChannel` to keep all instances of the app in up-to-date as
quickly as possible.

- [ ] Broadcast all journal entries to all instances.

When an instance receives a broadcast, it should:

- [ ] Check if the broadcast is newer than the latest journal entry it has
      applied.
- [ ] If so, it should apply the journal entry to its model.
- [ ] If the broadcast is older than the latest journal entry it has applied, it
      should ignore it.

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
