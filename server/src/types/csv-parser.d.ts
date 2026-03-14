declare module "csv-parser" {
  import type { Transform } from "node:stream";

  type CsvParserOptions = {
    separator?: string;
    headers?: string[] | boolean;
    skipLines?: number;
    mapHeaders?: (args: { header: string; index: number }) => string | null;
    mapValues?: (args: {
      header: string;
      index: number;
      value: string;
    }) => unknown;
  };

  export default function csvParser(options?: CsvParserOptions): Transform;
}
