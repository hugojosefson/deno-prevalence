#!/usr/bin/env -S deno run
import { serialize } from "npm:serializr@3.0.2";
import { Message, Model, User } from "./example-decorator-classes.ts";
import { JSONValue } from "../src/types.ts";

const alice: User = new User(1, "Alice");
const messageFromAlice: Message = new Message(10, alice, "Hello World!");

const bob: User = new User(2, "Bob");
const replyFromBob: Message = new Message(20, bob, "Hi Alice!");
messageFromAlice.comments.push(replyFromBob);

alice.friends.push(bob);
bob.friends.push(alice);

const users: User[] = [alice, bob];

const messages: Message[] = [
  messageFromAlice,
  replyFromBob,
];

const model: Model = new Model(users, messages);
// JSON.stringify(model); // throws an error, because the model contains circular references

const data: JSONValue = serialize(model);
const dataAsString = JSON.stringify(data); // works!
console.log(dataAsString);
