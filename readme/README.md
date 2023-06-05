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
"@@include(./person-invoice.ts)";
```

You may run the above example with:

```sh
deno run --unstable --reload --allow-write=example-person-invoice.db --allow-read=example-person-invoice.db https://deno.land/x/kv_prevalence/readme/person-invoice.ts
```

For further usage examples, see the tests:

- [test/prevalence.test.ts](test/prevalence.test.ts)
