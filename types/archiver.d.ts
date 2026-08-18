// Local type declaration for the `archiver` package (v8, ESM). The published
// @types/archiver@8.0.0 is broken, so we declare the module here to match the
// actual v8 API (named exports: Archiver, ZipArchive, TarArchive, JsonArchive).
declare module "archiver" {
  import { Transform, type Readable } from "stream";

  interface EntryData {
    name: string;
    type?: "directory" | "file" | "symlink";
    date?: Date | string;
    mode?: number;
    prefix?: string;
  }

  interface ArchiverError extends Error {
    code: string;
    data?: unknown;
  }

  interface ArchiverOptions {
    statConcurrency?: number;
    allowHalfOpen?: boolean;
    readableObjectMode?: boolean;
    writableObjectMode?: boolean;
    decodeStrings?: boolean;
    encoding?: BufferEncoding;
    highWaterMark?: number;
    objectMode?: boolean;
    comment?: string;
    forceLocalTime?: boolean;
    forceZip64?: boolean;
    namePrependSlash?: boolean;
    store?: boolean;
    level?: number;
    zlib?: { level?: number };
  }

  class Archiver extends Transform {
    abort(): this;
    append(source: Readable | Buffer | string, data?: EntryData): this;
    file(filename: string, data?: EntryData): this;
    finalize(): Promise<void>;
    pointer(): number;
    on(event: "error" | "warning", listener: (error: ArchiverError) => void): this;
    on(event: "data", listener: (data: Buffer) => void): this;
    on(event: "close" | "drain" | "finish", listener: () => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }

  class ZipArchive extends Archiver {
    constructor(options?: ArchiverOptions);
  }

  class TarArchive extends Archiver {
    constructor(options?: ArchiverOptions);
  }

  class JsonArchive extends Archiver {
    constructor(options?: ArchiverOptions);
  }
}
