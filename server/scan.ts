import { randomUUID } from "node:crypto";
import { getNetwork, isAddress } from "../src/shared/networks.ts";
import { buildMismatches, buildOverview } from "../src/shared/overview.ts";
import { withHistory } from "../src/shared/history.ts";
import type { ScanResponse } from "../src/shared/types.ts";
import { attachManualNotes, runScanners } from "./adapters/index.ts";
import { previousResults, saveRun } from "./storage.ts";
import { readToken, RpcError } from "./token.ts";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

const inflight = new Map<string, Promise<ScanResponse>>();

export async function performScan(address: string, chainId: number): Promise<ScanResponse> {
  const network = getNetwork(chainId);
  if (!network || !isAddress(address)) throw new HttpError(400, "Enter a valid 0x address and a supported network.");
  const normalized = address.trim();
  const key = `${chainId}:${normalized.toLowerCase()}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const run = scan(normalized, chainId).finally(() => inflight.delete(key));
  inflight.set(key, run);
  return run;
}

async function scan(address: string, chainId: number): Promise<ScanResponse> {
  const network = getNetwork(chainId);
  if (!network) throw new HttpError(400, "Select a supported network.");
  let token;
  try {
    token = await readToken(network, address);
  } catch (error) {
    if (error instanceof RpcError) throw new HttpError(422, error.message);
    throw new HttpError(502, "The contract could not be read from the selected network.");
  }
  const previous = await previousResults(address, chainId);
  const results = withHistory(await attachManualNotes(address, chainId, await runScanners(address, network)), previous);
  const response: ScanResponse = {
    id: randomUUID(),
    scannedAt: new Date().toISOString(),
    token,
    results,
    mismatches: buildMismatches(token, results),
    overview: buildOverview(results),
  };
  await saveRun(response);
  return response;
}
