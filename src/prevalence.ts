import { Clock, Commands } from "./types.ts";
import { Persister } from "./persist/persister.ts";

/**
 * TypeScript implementation for Deno of the Prevalence design pattern, as
 * introduced by Klaus Wüstefeld in 1998 with Prevayler.
 *
 * Expects Commands to serialize/deserialize arguments into/from a string, and to mutate the
 * model.
 *
 * Saves periodical snapshots of the model, and journal of executed commands
 * since last snapshot, using a Persister.
 *
 * The Persister uses a Marshaller to serialize/deserialize the model and the
 * journal.
 *
 * @see https://en.wikipedia.org/wiki/System_prevalence
 * @see https://prevayler.org/
 */
export class Prevalence<
  M,
  C extends Commands<M>,
> {
  private constructor(
    readonly model: M,
    private readonly commands: C,
    private readonly persister: Persister<M, C, keyof C>,
    private readonly clock: Clock = Date.now,
  ) {}

  static async create<
    M,
    C extends Commands<M>,
  >(
    defaultInitialModel: M,
    commands: C,
    persister: Persister<M, C, keyof C>,
    clock: Clock = Date.now,
  ): Promise<Prevalence<M, C>> {
    const model: M = await persister.loadModel(defaultInitialModel);
    return new Prevalence<M, C>(model, commands, persister, clock);
  }

  async execute<
    CN extends keyof C,
    A extends Parameters<C[CN]["execute"]>[1],
  >(
    commandName: CN,
    args: A,
  ): Promise<void> {
    const command: C[CN] = this.commands[commandName];
    const argsString: string = command.argsToString(args);
    const timestamp: number = this.clock();
    await this.persister.appendToJournal({
      commandName,
      argsString,
      timestamp,
    });
    command.execute(
      this.model,
      command.stringToArgs(argsString),
      () => timestamp,
    );
  }
}
