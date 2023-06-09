#!/bin/sh
DEBUG='*' \
deno run --unstable \
  --reload \
  --allow-env=DEBUG \
  --allow-read=example-person-invoice.db \
  --allow-write=example-person-invoice.db \
  ./person-invoice.ts
