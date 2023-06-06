import { Clock } from "./types.ts";
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
  C extends Commands<M>,
> {
  private constructor(
    readonly model: M,
    private readonly commands: C,
    private readonly persister: Persister<M>,
    private readonly clock: Clock = Date.now,
  ) {}

  static async create<
    M,
    C extends Commands<M>,
  >(
    defaultInitialModel: M,
    commands: C,
    persister: Persister<M>,
    clock: Clock = Date.now,
  ): Promise<Prevalence<M, C>> {
    const model: M = await persister.loadModel(defaultInitialModel);
    return new Prevalence<M, C>(model, commands, persister, clock);
  }

  async execute<A extends unknown[]>(
    commandName: keyof C,
    args: A,
  ): Promise<void> {
    const timestamp = this.clock();
    await this.persister.appendToJournal({ timestamp, commandName, args });
    this.commands[commandName](this.model, args, () => timestamp);
  }
}

type CommandFunction<M, A extends unknown[]> = (
  model: M,
  args: A,
  clock: Clock,
) => void;
type Commands<M> = {
  [commandName: string]: CommandFunction<M, unknown[]>;
};
