export type WithToJSON = { toJSON: () => JSONValue };
export type fromJSON<T> = (data: JSONValue) => T;
export type WithFromJSON<T> = { fromJSON: fromJSON<T> };
export type WithToFromJSON<T> = WithToJSON & WithFromJSON<T>;
export type JSONSerializable<T> = WithToFromJSON<T> | JSONValue;

function isWithToJSON<T>(obj: unknown): obj is WithToJSON {
  return typeof obj === "object" && obj !== null && "toJSON" in obj;
}

function isWithFromJSON<T>(obj: unknown): obj is WithFromJSON<T> {
  return typeof obj === "object" && obj !== null && "fromJSON" in obj;
}

function isWithToFromJSON<T>(obj: unknown): obj is WithToFromJSON<T> {
  return isWithToJSON(obj) && isWithFromJSON(obj);
}

class User implements WithToFromJSON<User> {
  readonly uuid: number;

  displayName: string;

  constructor(uuid: number, displayName: string) {
    this.uuid = uuid;
    this.displayName = displayName;
  }

  toJSON(): JSONValue {
    return {
      uuid: this.uuid,
      displayName: this.displayName,
    };
  }

  fromJSON(data: { uuid: number; displayName: string }): User {
    return new User(data.uuid, data.displayName);
  }
}

class UsersModel {
  users: User[] = [];
}
export type Clock = () => number;

export class Command<M, A extends JSONSerializable<unknown>[]> {
  readonly name: string;
  readonly execute: (model: M, args: A, clock: Clock) => void;

  constructor(
    name: string,
    execute: (model: M, args: A, clock: Clock) => void,
  ) {
    this.name = name;
    this.execute = execute;
  }
}

export class AddUserCommand extends Command<UsersModel, [User]> {
  constructor() {
    super(AddUserCommand.name, (model, [user]) => {
      model.users.push(user);
    });
  }
}

export class RemoveUserCommand extends Command<UsersModel, [number]> {
  constructor() {
    super(RemoveUserCommand.name, (model, [uuid]) => {
      model.users = model.users.filter((user) => user.uuid !== uuid);
    });
  }
}

export class RenameUserCommand extends Command<UsersModel, [number, string]> {
  constructor() {
    super(RenameUserCommand.name, (model, [uuid, displayName]) => {
      const user = model.users.find((user) => user.uuid === uuid);
      if (user) {
        user.displayName = displayName;
      }
    });
  }
}

export class JournalEntry<
  M,
  C extends Command<M, A>,
  A extends JSONSerializable<unknown>[],
> implements WithToFromJSON<JournalEntry<M, C, A>> {
  readonly commandName: C["name"];
  readonly timestamp: number;
  readonly args: A;

  constructor(
    commandName: C["name"],
    timestamp: number,
    args: A,
  ) {
    this.commandName = commandName;
    this.timestamp = timestamp;
    this.args = args;
  }

  toJSON(): JSONValue {
    return {
      commandName: this.commandName,
      timestamp: this.timestamp,
      args: this.args.map((arg) => isWithToFromJSON(arg) ? arg.toJSON() : arg),
    };
  }
}

/**
 * a Transaction instance is JSONSerializable.
 * a Transaction class has code to execute the transaction.
 * a Transaction instance has data to execute the transaction.
 * a Transaction instance possibly has a timestamp, which it gets when executed.
 * Transactions are immutable.
 * Transaction instances are stored in the journal.
 */
export abstract class Transaction<
  M,
  A extends JSONSerializable[] = [],
> implements WithToJSON {
  readonly timestamp?: number;

  abstract readonly args: A;
  abstract execute(model: M, clock: Clock): void;
  abstract toJSON(): JSONValue;
}

export class AddUserTransaction extends Transaction<UsersModel, [User]> {
  readonly args: [User];

  execute(model: UsersModel, _clock: Clock): void {
    model.users.push(this.args[0]);
  }

  constructor(user: User) {
    super();
    this.args = [user];
  }

  toJSON(): JSONValue {
    return {
      timestamp: this.timestamp,
      args: this.args.map((arg) => arg.toJSON()),
    } as JSONValue;
  }
}

const alice = new User(1, "Alice");
const addAlice = new AddUserTransaction(alice);
const serializedAddAlice = serialize(addAlice);
const deserializedAddAlice = deserialize(
  AddUserTransaction,
  serializedAddAlice,
);

// export class JournalEntry<
//   M,
//   T extends Transaction<M, A>,
//   A extends JSONValue[],
// > {
//   @serializable(primitive())
//   readonly timestamp: number;
//
//   @serializable(primitive())
//   readonly transaction: Transaction<M, A>;
//
//   constructor(
//     timestamp: number,
//     transaction: Transaction<M, A>,
//   ) {
//     this.timestamp = timestamp;
//     this.transaction = transaction;
//   }
//
//   execute(model: M): void {
//     this.transaction.execute(model, () => this.timestamp);
//   }
// }

/**
 * Things that JSON.stringify can serialize.
 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string | number]: JSONValue };

/**
 * Things that Deno.Kv can store as values.
 */
export type KvValue<T extends KvValue<T>> =
  | undefined
  | null
  | boolean
  | number
  | string
  | bigint
  | Uint8Array
  | T[]
  | Record<string | number, T>
  | Map<T, T>
  | Set<T>
  | Date
  | RegExp;
