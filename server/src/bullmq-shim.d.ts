declare module "bullmq" {
  export type JobsOptions = Record<string, unknown>;

  export class Job<
    TData = unknown,
    TResult = unknown,
    TName extends string = string,
  > {
    id?: string | number;
    name: TName;
    data: TData;
    returnvalue?: TResult;
  }

  export class Queue<
    TData = unknown,
    TResult = unknown,
    TName extends string = string,
  > {
    constructor(
      name: string,
      options?: {
        connection?: unknown;
        defaultJobOptions?: Record<string, unknown>;
      },
    );
    add(
      name: TName,
      data: TData,
      options?: JobsOptions,
    ): Promise<Job<TData, TResult, TName>>;
  }

  export class Worker<
    TData = unknown,
    TResult = unknown,
    TName extends string = string,
  > {
    constructor(
      name: string,
      processor: (job: Job<TData, TResult, TName>) => Promise<unknown>,
      options?: {
        connection?: unknown;
        concurrency?: number;
      },
    );
    on(
      event: "active" | "completed",
      listener: (job: Job<TData, TResult, TName>) => void,
    ): this;
    on(
      event: "failed",
      listener: (
        job: Job<TData, TResult, TName> | undefined,
        error: Error,
      ) => void,
    ): this;
    close(): Promise<void>;
  }
}
