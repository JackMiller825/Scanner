import type { ScannerResult, ScanResponse } from "../shared/types.ts";

export type IntegrationRow = {
  id: string;
  name: string;
  mode: "api" | "link_out";
  role: "scanner" | "surface_reference";
  independent: boolean;
  configuration: "connected" | "not_configured" | "manual" | "error";
  docsUrl: string;
  termsUrl: string | null;
  summary: string;
  limitations: string;
  attribution: string;
  credentials: Array<{ name: string; present: boolean }>;
};

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "The request failed.");
  return body;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch("/api/health");
    return response.ok;
  } catch {
    return false;
  }
}

export async function loadIntegrations(): Promise<IntegrationRow[]> {
  const body = await readJson<{ providers: IntegrationRow[] }>(await fetch("/api/integrations"));
  return body.providers;
}

export async function loadHistory(address: string, chainId: number): Promise<ScanResponse[]> {
  const params = new URLSearchParams({ address, chainId: String(chainId) });
  const body = await readJson<{ runs: ScanResponse[] }>(await fetch(`/api/history?${params}`));
  return body.runs;
}

export async function requestScan(address: string, chainId: number): Promise<ScanResponse> {
  return readJson<ScanResponse>(await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, chainId }),
  }));
}

export async function submitManual(input: {
  providerId: string;
  address: string;
  chainId: number;
  text: string;
  sourceUrl?: string;
}): Promise<ScannerResult> {
  const body = await readJson<{ result: ScannerResult }>(await fetch("/api/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
  return body.result;
}
