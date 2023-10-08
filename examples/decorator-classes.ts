import {
  identifier,
  list,
  object,
  reference,
  serializable,
} from "npm:serializr@3.0.2";

export class User {
  @serializable(identifier())
  readonly uuid: number;

  @serializable
  displayName: string;

  @serializable(list(reference(User)))
  readonly friends: User[] = [];

  constructor(uuid: number, displayName: string) {
    this.uuid = uuid;
    this.displayName = displayName;
  }
}

export class Message {
  @serializable(identifier())
  readonly uuid: number;

  @serializable
  message: string;

  @serializable(reference(User))
  author: User;

  @serializable(list(reference(Message)))
  comments: Message[] = [];

  constructor(uuid: number, author: User, message: string) {
    this.uuid = uuid;
    this.author = author;
    this.message = message;
  }
}

export class Model {
  @serializable(list(object(User)))
  users: User[] = [];

  @serializable(list(object(Message)))
  messages: Message[] = [];

  constructor(users: User[], messages: Message[]) {
    this.users = users;
    this.messages = messages;
  }
}
