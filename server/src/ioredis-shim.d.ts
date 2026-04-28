declare module "ioredis" {
  export default class Redis {
    status: string;

    constructor(options?: Record<string, unknown>);

    on(
      event: "ready" | "close",
      listener: () => void,
    ): this;
    on(event: "error", listener: (error: Error) => void): this;

    connect(): Promise<void>;
    get(key: string): Promise<string | null>;
    del(...keys: string[]): Promise<number>;
    set(
      key: string,
      value: string,
      mode?: string,
      ttlSeconds?: number,
    ): Promise<unknown>;
    incr(key: string): Promise<number>;
    pttl(key: string): Promise<number>;
    pexpire(key: string, milliseconds: number): Promise<unknown>;
    scan(
      cursor: string,
      mode: string,
      pattern: string,
      countLabel: string,
      count: number,
    ): Promise<[string, string[]]>;
  }
}
