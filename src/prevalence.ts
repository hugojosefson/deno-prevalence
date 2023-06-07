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
 * introduced by Klaus Wuestefeld in 1998 with Prevayler.
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
    const log = log0.sub("create");
    log("defaultInitialModel =", defaultInitialModel);
    log("options =", options);
    const effectiveOptions: PrevalenceOptions<M> = {
      ...defaultPrevalenceOptions(options.classes),
      ...options,
    };
    log("effectiveOptions =", effectiveOptions);

    const model: M = await effectiveOptions.persister.loadModel(
      defaultInitialModel,
    );
    log("loaded model =", model);

    // sort journal by timestamp, from oldest to newest, in case it was not already done by the persister
    const journal: JournalEntry<M>[] =
      (await effectiveOptions.persister.loadJournal()).sort((je1, je2) =>
        je1.timestamp - je2.timestamp
      );
    log("loaded journal =", journal);

    const previouslyAppliedTimestamp =
      await effectiveOptions.persister.loadLastAppliedTimestamp() ?? 0;
    log("previouslyAppliedTimestamp =", previouslyAppliedTimestamp);

    // apply all actions in the journal that were not already applied
    let lastAppliedTimestamp = previouslyAppliedTimestamp;
    const filteredJournal = journal.filter((journalEntry) =>
      journalEntry.timestamp > lastAppliedTimestamp
    );
    log("filteredJournal =", filteredJournal);
    if (filteredJournal.length === 0) {
      log("no journal to apply");
    } else {
      filteredJournal.forEach((journalEntry) => {
        log(
          "applying journalEntry to model",
          journalEntry.timestamp,
          journalEntry.action,
        );
        journalEntry.action.execute(
          model,
          () => journalEntry.timestamp,
        );
        lastAppliedTimestamp = journalEntry.timestamp;
      });
      log("applied journal to model");
      log("lastAppliedTimestamp =", lastAppliedTimestamp);
    }

    // save updated model, if any action was applied
    if (lastAppliedTimestamp > previouslyAppliedTimestamp) {
      log(
        "saving model, clearing journal, and updating lastAppliedTimestamp",
        lastAppliedTimestamp,
      );
      await effectiveOptions.persister.saveModelAndClearJournal(
        model,
        lastAppliedTimestamp,
      );
      log("model saved");
    } else {
      log("no action applied, no need to save model");
    }

    return new Prevalence<M>(model, effectiveOptions);
  }

  async execute<A extends Action<M>>(action: A): Promise<void> {
    const timestamp: number = this.clock();
    const log = log0.sub("execute");
    log("timestamp =", timestamp);
    log("action =", action);

    const storedAction: Action<M> = await this.persister.appendToJournal({
      timestamp,
      action,
    });
    log("storedAction =", storedAction);

    storedAction.execute(
      this.model,
      () => timestamp,
    );
    log("storedAction executed on model");
  }

  async snapshot(): Promise<void> {
    const timestamp: number = this.clock();
    const log = log0.sub("snapshot");
    log("timestamp =", timestamp);
    await this.persister.saveModelAndClearJournal(
      this.model,
      timestamp,
    );
    log("model saved");
  }
}
