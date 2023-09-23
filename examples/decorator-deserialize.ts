#!/usr/bin/env -S deno run
import { readAll } from "https://deno.land/std@0.202.0/streams/read_all.ts";
import { deserialize } from "npm:serializr@3.0.2";
import { Model } from "./decorator-classes.ts";
import { JSONValue } from "../src/types.ts";
import { logger } from "../src/log.ts";
const log = logger(import.meta.url);

const stdinString: string = new TextDecoder().decode(await readAll(Deno.stdin));
const data: JSONValue = JSON.parse(stdinString);
const model: Model = deserialize(Model, data);
log("model =", model);
