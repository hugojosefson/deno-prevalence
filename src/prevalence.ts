import { Serializer } from "https://deno.land/x/superserial@0.3.4/mod.ts";
import {
  Action,
  Clock,
  JournalEntry,
  Model,
  SerializableClassesContainer,
} from "./types.ts";
import { Persister } from "./persist/persister.ts";
import { MemoryPersister } from "./persist/memory-persister.ts";
import { SuperserialMarshaller } from "./marshall/superserial-marshaller.ts";
import { logger } from "./log.ts";

const log0 = logger(import.meta.url);

export function defaultPrevalenceOptions<M extends Model<M>>(
  classes?: SerializableClassesContainer,
): PrevalenceOptions<M> {
  return {
    persister: new MemoryPersister<M, string>(
      new SuperserialMarshaller<M>(new Serializer({ classes })),
    ),
    classes: {},
    clock: Date.now,
  };
}

export type PrevalenceOptions<M extends Model<M>> = {
  persister: Persister<M>;
  classes: SerializableClassesContainer;
  clock: Clock;
};

/**
 * TypeScript implementation for Deno of the Prevalence design pattern, as
 * introduced by Klaus Wüstefeld in 1998 with Prevayler.
 *
 * Saves periodical snapshots of the model, and journal of executed actions
 * since last snapshot, using a Persister.
 *
 * The Persister uses a Marshaller to serialize/deserialize the model and the
 * journal.
 *
 * @see https://en.wikipedia.org/wiki/System_prevalence
 * @see https://prevayler.org/
 */
export class Prevalence<M extends Model<M>> {
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

  static async create<M extends Model<M>>(
    defaultInitialModel: M,
    options: Partial<PrevalenceOptions<M>>,
  ): Promise<Prevalence<M>> {
    const log1 = log0.sub("create");
    log1("defaultInitialModel =", defaultInitialModel);
    log1("options =", options);
    const effectiveOptions: PrevalenceOptions<M> = {
      ...defaultPrevalenceOptions(options.classes),
      ...options,
    };
    log1("effectiveOptions =", effectiveOptions);

    const model: M = await effectiveOptions.persister.loadModel(
      defaultInitialModel,
    );
    // sort journal by timestamp, from oldest to newest, in case it was not already done by the persister
    const journal: JournalEntry<M>[] =
      (await effectiveOptions.persister.loadJournal()).sort((je1, je2) =>
        je1.timestamp - je2.timestamp
      );

    let lastAppliedTimestamp =
      await effectiveOptions.persister.loadLastAppliedTimestamp() ?? 0;

    // apply all actions in the journal that were not already applied
    journal
      .filter((entry) => entry.timestamp > lastAppliedTimestamp)
      .forEach((entry) => {
        entry.action.execute(
          model,
          () => entry.timestamp,
        );
        lastAppliedTimestamp = entry.timestamp;
      });

    // save updated model, if any action was applied
    if (lastAppliedTimestamp > 0) {
      await effectiveOptions.persister.saveModelAndClearJournal(
        model,
        lastAppliedTimestamp,
      );
    }

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

  async snapshot(): Promise<void> {
    const timestamp: number = this.clock();
    await this.persister.saveModelAndClearJournal(
      this.model,
      timestamp,
    );
  }
}
