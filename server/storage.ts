import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ScannerResult, ScanResponse } from "../src/shared/types.ts";
import { projectRoot } from "./env.ts";

export type ManualRecord = {
  providerId: string;
  address: string;
  chainId: number;
  text: string;
  sourceUrl?: string;
  submittedAt: string;
};

export type ScanRun = ScanResponse;

type Store = {
  runs: ScanRun[];
  manual: ManualRecord[];
};

const file = join(projectRoot, "data", "scan-history.json");
let queue: Promise<unknown> = Promise.resolve();

function emptyStore(): Store {
  return { runs: [], manual: [] };
}

function capRaw(value: unknown): unknown {
  try {
    const text = JSON.stringify(value);
    if (text.length <= 180_000) return value;
    return { truncated: true, preview: text.slice(0, 12_000) };
  } catch {
    return { truncated: true };
  }
}

function sanitizeRun(run: ScanRun): ScanRun {
  return {
    ...run,
    results: run.results.map((result) => ({ ...result, rawData: result.rawData === undefined ? undefined : capRaw(result.rawData) })),
  };
}

function readStore(): Store {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<Store>;
    return {
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      manual: Array.isArray(parsed.manual) ? parsed.manual : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store): void {
  mkdirSync(join(projectRoot, "data"), { recursive: true });
  writeFileSync(file, JSON.stringify(store), "utf8");
}

function locked<T>(work: () => T): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

export function previousResults(address: string, chainId: number): Promise<ScannerResult[] | undefined> {
  return locked(() => readStore().runs.find((run) => run.token.address.toLowerCase() === address.toLowerCase() && run.token.chainId === chainId)?.results);
}

export function saveRun(run: ScanRun): Promise<void> {
  return locked(() => {
    const store = readStore();
    store.runs.unshift(sanitizeRun(run));
    store.runs = store.runs.slice(0, 40);
    writeStore(store);
  });
}

export function listRuns(address?: string, chainId?: number): Promise<ScanRun[]> {
  return locked(() => readStore().runs.filter((run) => {
    if (address && run.token.address.toLowerCase() !== address.toLowerCase()) return false;
    if (chainId && run.token.chainId !== chainId) return false;
    return true;
  }).slice(0, 20).map((run) => ({
    ...run,
    results: run.results.map((result) => ({ ...result, rawData: undefined })),
  })));
}

export function manualFor(address: string, chainId: number, providerId: string): Promise<ManualRecord | undefined> {
  return locked(() => readStore().manual.find((record) => record.providerId === providerId && record.chainId === chainId && record.address.toLowerCase() === address.toLowerCase()));
}

export function saveManual(record: ManualRecord): Promise<void> {
  return locked(() => {
    const store = readStore();
    store.manual = [record, ...store.manual.filter((item) => !(item.providerId === record.providerId && item.chainId === record.chainId && item.address.toLowerCase() === record.address.toLowerCase()))].slice(0, 100);
    writeStore(store);
  });
}
