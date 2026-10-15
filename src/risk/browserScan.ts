import { decodeBytes, decodeUint } from "../shared/abi.ts";
import { withHistory } from "../shared/history.ts";
import { getNetwork, type Network } from "../shared/networks.ts";
import { buildMismatches, buildOverview } from "../shared/overview.ts";
import { PROVIDERS, providerById } from "../shared/providers.ts";
import { buildResult, configuredMessage } from "../shared/result.ts";
import { formatSupply } from "../shared/text.ts";
import { interpretGoPlus } from "../shared/goplus.ts";
import { interpretHoneypot } from "../shared/honeypot.ts";
import type { ScannerResult, ScanResponse, TokenMetadata } from "../shared/types.ts";

const SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
} as const;

const HISTORY_KEY = "token-risk-console-history";
const NOTES_KEY = "token-risk-console-notes";
const KEYED_IDS = new Set(["quickintel", "blockaid", "tokensniffer", "defi", "dextools"]);

type StoredNote = {
  providerId: string;
  address: string;
  chainId: number;
  text: string;
  sourceUrl?: string;
  submittedAt: string;
};

function readStore<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function noteFor(address: string, chainId: number, providerId: string): StoredNote | undefined {
  return readStore<StoredNote>(NOTES_KEY).find((note) => (
    note.providerId === providerId
    && note.chainId === chainId
    && note.address.toLowerCase() === address.toLowerCase()
  ));
}

function manualCard(providerId: string, address: string, chainId: number, reportUrl: string): ScannerResult {
  const provider = providerById(providerId)!;
  const note = noteFor(address, chainId, providerId);
  if (!note) {
    return buildResult(provider, {
      status: "manual",
      summary: `${provider.name} is manual / link-out only. No result has been submitted for this contract.`,
      findings: [],
    }, { reportUrl, durationMs: 0, integrationMode: "link_out", userSubmitted: false });
  }
  return buildResult(provider, {
    status: "manual",
    summary: "User-submitted result. It was pasted into this console and was not fetched from the provider.",
    originalVerdict: note.text,
    findings: [{
      title: "User-submitted result",
      description: note.text,
      severity: "unknown",
      category: "user_submitted",
    }],
  }, {
    reportUrl: note.sourceUrl || reportUrl,
    checkedAt: note.submittedAt,
    durationMs: 0,
    integrationMode: "manual",
    userSubmitted: true,
    submission: { submittedAt: note.submittedAt, sourceUrl: note.sourceUrl },
  });
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 25_000): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return JSON.parse(text) as unknown;
}

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const payload = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }, 12_000) as { result?: unknown; error?: { message?: string } };
  if (payload.error) throw new Error(payload.error.message || "RPC request failed.");
  return payload.result;
}

async function readToken(network: Network, address: string): Promise<TokenMetadata> {
  let lastError = "No RPC endpoint responded.";
  for (const url of network.rpcUrls) {
    try {
      const code = await rpc(url, "eth_getCode", [address, "latest"]);
      if (typeof code !== "string") throw new Error("The RPC response did not include bytecode.");
      const normalized = code.toLowerCase();
      if (normalized === "0x" || /^0x0+$/.test(normalized)) {
        throw new Error("No contract bytecode was found for this address on the selected network.");
      }
      const partialErrors: string[] = [];
      const calls = await Promise.all(
        (Object.entries(SELECTORS) as Array<[keyof typeof SELECTORS, string]>).map(async ([field, data]) => {
          try {
            const result = await rpc(url, "eth_call", [{ to: address, data }, "latest"]);
            return [field, typeof result === "string" ? result : null] as const;
          } catch {
            partialErrors.push(`${field}() did not return a value.`);
            return [field, null] as const;
          }
        }),
      );
      const values = Object.fromEntries(calls) as Record<keyof typeof SELECTORS, string | null>;
      const decimals = values.decimals ? Number(decodeUint(values.decimals)) : null;
      const supplyRaw = values.totalSupply ? decodeUint(values.totalSupply) : null;
      const safeDecimals = decimals !== null && Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : null;
      return {
        address,
        chainId: network.chainId,
        chainName: network.name,
        bytecodeBytes: (normalized.length - 2) / 2,
        name: values.name ? decodeBytes(values.name) : null,
        symbol: values.symbol ? decodeBytes(values.symbol) : null,
        decimals: safeDecimals,
        totalSupplyRaw: supplyRaw === null ? null : supplyRaw.toString(),
        totalSupply: supplyRaw !== null && safeDecimals !== null ? formatSupply(supplyRaw, safeDecimals) : supplyRaw?.toString() ?? null,
        source: new URL(url).host,
        retrievedAt: new Date().toISOString(),
        partialErrors,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "The RPC request failed.";
      if (lastError.startsWith("No contract bytecode")) throw new Error(lastError);
    }
  }
  throw new Error(lastError);
}

async function scanProvider(id: string, address: string, network: Network): Promise<ScannerResult> {
  const provider = providerById(id)!;
  const reportUrl = provider.link(address, network.chainId);
  const started = Date.now();
  try {
    if (id === "goplus") {
      const payload = await fetchJson(`https://api.gopluslabs.io/api/v1/token_security/${network.chainId}?contract_addresses=${address}`);
      const result = buildResult(provider, interpretGoPlus(payload, address), { durationMs: 0, rawData: payload, reportUrl });
      result.durationMs = Date.now() - started;
      return result;
    }
    if (id === "honeypot") {
      const payload = await fetchJson(`https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=${network.chainId}`);
      const result = buildResult(provider, interpretHoneypot(payload), { durationMs: 0, rawData: payload, reportUrl });
      result.durationMs = Date.now() - started;
      return result;
    }
    if (KEYED_IDS.has(id)) {
      return buildResult(provider, {
        status: "not_configured",
        summary: configuredMessage(provider),
        findings: [],
      }, { reportUrl, durationMs: 0 });
    }
    return manualCard(id, address, network.chainId, reportUrl);
  } catch {
    const result = buildResult(provider, {
      status: "error",
      summary: "The provider request failed from this browser. Other providers were not cancelled.",
      findings: [],
    }, {
      reportUrl,
      durationMs: Date.now() - started,
      errorCode: "browser_request_failed",
      errorMessage: "The provider request failed from this browser.",
    });
    return result;
  }
}

function previousResults(address: string, chainId: number): ScannerResult[] | undefined {
  const runs = readStore<ScanResponse>(HISTORY_KEY);
  return runs.find((run) => run.token.chainId === chainId && run.token.address.toLowerCase() === address.toLowerCase())?.results;
}

function remember(response: ScanResponse): void {
  const stored = {
    ...response,
    results: response.results.map((result) => ({ ...result, rawData: undefined })),
  };
  const runs = readStore<ScanResponse>(HISTORY_KEY).filter((run) => run.id !== stored.id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([stored, ...runs].slice(0, 40)));
}

export function browserIntegrations() {
  return PROVIDERS.map((provider) => ({
    id: provider.id,
    name: provider.name,
    mode: provider.mode,
    role: provider.role,
    independent: provider.independent,
    configuration: provider.mode === "link_out" ? "manual" as const : provider.id === "goplus" || provider.id === "honeypot" ? "connected" as const : "not_configured" as const,
    docsUrl: provider.docsUrl,
    termsUrl: provider.termsUrl ?? null,
    summary: provider.summary,
    limitations: provider.mode === "link_out"
      ? provider.limitations
      : provider.id === "goplus" || provider.id === "honeypot"
        ? `${provider.limitations} This published page calls the public endpoint from the browser.`
        : provider.limitations,
    attribution: provider.attribution,
    credentials: provider.credentialEnv.map((name) => ({ name, present: false })),
  }));
}

export function browserHistory(address: string, chainId: number): ScanResponse[] {
  return readStore<ScanResponse>(HISTORY_KEY).filter((run) => (
    run.token.chainId === chainId && run.token.address.toLowerCase() === address.toLowerCase()
  ));
}

export function browserManual(input: {
  providerId: string;
  address: string;
  chainId: number;
  text: string;
  sourceUrl?: string;
}): ScannerResult {
  const provider = providerById(input.providerId);
  if (!provider) throw new Error("That provider is not in the scanner list.");
  const note: StoredNote = {
    providerId: input.providerId,
    address: input.address.trim(),
    chainId: input.chainId,
    text: input.text.trim(),
    sourceUrl: input.sourceUrl,
    submittedAt: new Date().toISOString(),
  };
  const notes = readStore<StoredNote>(NOTES_KEY).filter((item) => !(
    item.providerId === note.providerId
    && item.chainId === note.chainId
    && item.address.toLowerCase() === note.address.toLowerCase()
  ));
  localStorage.setItem(NOTES_KEY, JSON.stringify([note, ...notes].slice(0, 100)));
  return manualCard(note.providerId, note.address, note.chainId, provider.link(note.address, note.chainId));
}

export async function browserScan(address: string, chainId: number): Promise<ScanResponse> {
  const network = getNetwork(chainId);
  if (!network) throw new Error("Select a supported network.");
  const token = await readToken(network, address.trim());
  const ids = ["goplus", "quickintel", "honeypot", "blockaid", "tokensniffer", "defi", "dextools", "dexanalyzer", "ethsafesniper", "banana", "uniswap"];
  const settled = await Promise.allSettled(ids.map((id) => scanProvider(id, address.trim(), network)));
  const results = withHistory(settled.map((item, index) => {
    if (item.status === "fulfilled") return item.value;
    const provider = providerById(ids[index] ?? "goplus")!;
    return buildResult(provider, {
      status: "error",
      summary: "This provider failed before it returned a result. Other providers were not cancelled.",
      findings: [],
    }, { reportUrl: provider.link(address, chainId), errorCode: "adapter_failed", errorMessage: "This provider failed before it returned a result." });
  }), previousResults(address, chainId));
  const response: ScanResponse = {
    id: crypto.randomUUID(),
    scannedAt: new Date().toISOString(),
    token,
    results,
    mismatches: buildMismatches(token, results),
    overview: buildOverview(results),
  };
  remember(response);
  return response;
}
