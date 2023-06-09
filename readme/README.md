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
"@@include(./person-invoice.ts)";
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
- [ ] Before executing an action, the `Prevalence` instance:
  - [ ] Tests the action by executing it on a copy of the model.
    - [ ] If the action throws an exception, the `Prevalence` instance:
      - [ ] Discards the now possibly tainted copy of the model.
      - [ ] Re-throws the exception.
  - [ ] If the action was successful on the copy, the `Prevalence` instance:
    - [ ] Append it to the journal:
      - [ ] `const lastEntryId = await kv.get(["journal", "lastEntryId"])`
      - [ ] `const newLastEntryId = lastEntryId + 1`
      - [ ] run an atomic operation:
        - [ ] check that `["journal", "lastEntryId"]` hasn't changed since we
              read it,
        - [ ] check that `["journal", "entries", newLastEntryId]` is `null`,
        - [ ] save `newLastEntryId` to `["journal", "lastEntryId"]`, and
        - [ ] store the journal entry at
              `["journal", "entries", newLastEntryId]`.
      - [ ] If the atomic operation fails, we:
        - [ ] load any journal entries that were appended since we read
              `["journal", "lastEntryId"]`,
        - [ ] apply them to the model in memory, and
        - [ ] try again.
        - [ ] Executes the action on the model.

#### Code defensively

- [ ] When programming actions, we should program defensively, so we don't break
      the model or the journal.
