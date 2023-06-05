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
  readonly model: M;
  private readonly persister: Persister<M>;
  private readonly clock: Clock;

  constructor(
    initialModel: M,
    persister: Persister<M>,
    clock: Clock = Date.now,
  ) {
    this.model = initialModel;
    this.persister = persister;
    this.clock = clock;
  }

  async execute(transaction: T): Promise<void> {
    const now = this.clock();
    await this.persister.appendToJournal({
      timestamp: now,
      transaction,
    });
    transaction.execute(this.model, {
      clock: this.clock,
    });
  }
}
