import { Action, Clock, SerializableClassesContainer } from "./types.ts";
import { Persister } from "./persist/persister.ts";
import { MemoryPersister } from "./persist/memory-persister.ts";

export function defaultPrevalenceOptions<M>(): PrevalenceOptions<M> {
  return {
    persister: new MemoryPersister<M>(),
    classes: {},
    clock: Date.now,
  };
}

export type PrevalenceOptions<M> = {
  persister: Persister<M>;
  classes: SerializableClassesContainer;
  clock: Clock;
};

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
export class Prevalence<M> {
  model: M;
  private readonly persister: Persister<M>;
  private readonly classes: SerializableClassesContainer;
  private readonly clock: Clock;

  private constructor(
    model: M,
    options: PrevalenceOptions<M>,
  ) {
    this.model = model;
    this.persister = options.persister;
    this.classes = options.classes;
    this.clock = options.clock;
  }

  static async create<M>(
    defaultInitialModel: M,
    options: Partial<PrevalenceOptions<M>>,
  ): Promise<Prevalence<M>> {
    const effectiveOptions: PrevalenceOptions<M> = {
      ...defaultPrevalenceOptions(),
      ...options,
    };

    const model: M = await effectiveOptions.persister.loadModel(
      defaultInitialModel,
    );
    return new Prevalence<M>(model, effectiveOptions);
  }

  async execute<A extends Action<M>>(action: A): Promise<void> {
    const timestamp: number = this.clock();
    await this.persister.appendToJournal({
      timestamp,
      action,
    });
    action.execute(
      this.model,
      () => timestamp,
    );
  }
}
