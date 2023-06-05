import { Clock, Transaction } from "./types.ts";
import { Persister } from "./persist/persister.ts";

/**
 * TypeScript implementation for Deno of the Prevalence design pattern, as
 * introduced by Klaus Wüstefeld in 1998 with Prevayler.
 *
 * Uses the module "npm:serializr" to serialize and deserialize the model, and transaction objects.
 *
 * Saves journal of transactions, and snapshots of the model, to Deno.Kv.
 */
export class Prevalence<
  M,
  T extends Transaction<M>,
> {
  private constructor(
    readonly model: M,
    private readonly persister: Persister<M>,
    private readonly clock: Clock = Date.now,
  ) {}

  static async create<
    M,
    T extends Transaction<M>,
  >(
    persister: Persister<M>,
    defaultInitialModel: M,
    clock: Clock = Date.now,
  ): Promise<Prevalence<M, T>> {
    const model: M = await persister.loadModel(defaultInitialModel);
    return new Prevalence<M, T>(model, persister, clock);
  }

  async execute(transaction: T): Promise<void> {
    const timestamp = this.clock();
    await this.persister.appendToJournal({ timestamp, transaction });
    transaction.execute(this.model, { clock: () => timestamp });
  }
}
