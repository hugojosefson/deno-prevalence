import {
  ClazzOrModelSchema,
  deserialize,
  identifier,
  list,
  ModelSchema,
  object,
  primitive,
  PropSerializer,
  reference,
  serializable,
  serialize,
  subSchema,
} from "npm:serializr@3.0.2";

export type WithToJSON = { toJSON: () => JSONValue };
export type JSONSerializable = WithToJSON | JSONValue

class User implements WithToJSON {
  @serializable(identifier())
  readonly uuid: number;

  @serializable
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
}

class UsersModel {
  @serializable(list(object(User)))
  users: User[] = [];
}
export type Clock = () => number;

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
  @serializable(primitive())
  readonly timestamp?: number;

  abstract readonly args: A;
  abstract execute (model: M, clock: Clock): void;
  abstract toJSON(): JSONValue;
}

@subSchema("AddUserTransaction")
export class AddUserTransaction extends Transaction<UsersModel, [User]> {
  @serializable(list(object(User)))
  readonly args: [User];

  execute (model: UsersModel, _clock: Clock):void{
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
    } as JSONValue
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
