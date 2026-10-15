import type { Network } from "../../src/shared/networks.ts";
import { providerById } from "../../src/shared/providers.ts";
import { buildResult } from "../../src/shared/result.ts";
import type { ScannerResult } from "../../src/shared/types.ts";
import { manualFor, type ManualRecord } from "../storage.ts";
import { scanBlockaid } from "./blockaid.ts";
import { manualResult } from "./common.ts";
import { scanDefi } from "./defi.ts";
import { scanDextools } from "./dextools.ts";
import { scanGoPlus } from "./goplus.ts";
import { scanHoneypot } from "./honeypot.ts";
import { scanQuickIntel } from "./quickintel.ts";
import { scanTokenSniffer } from "./tokensniffer.ts";

const linkOutIds = ["dexanalyzer", "ethsafesniper", "banana", "uniswap"] as const;

async function runOne(id: string, address: string, network: Network): Promise<ScannerResult> {
  const provider = providerById(id)!;
  const reportUrl = provider.link(address, network.chainId);
  if (id === "goplus") return scanGoPlus(address, network.chainId, reportUrl);
  if (id === "quickintel") return scanQuickIntel(address, network, reportUrl);
  if (id === "honeypot") return scanHoneypot(address, network, reportUrl);
  if (id === "blockaid") return scanBlockaid(address, network, reportUrl);
  if (id === "tokensniffer") return scanTokenSniffer(address, network.chainId, reportUrl);
  if (id === "defi") return scanDefi(address, reportUrl);
  if (id === "dextools") return scanDextools(address, network, reportUrl);
  const saved = await manualFor(address, network.chainId, id);
  return manualResult(provider, reportUrl, saved);
}

export async function runScanners(address: string, network: Network): Promise<ScannerResult[]> {
  const ids = ["goplus", "quickintel", "honeypot", "blockaid", "tokensniffer", "defi", "dextools", ...linkOutIds];
  const settled = await Promise.allSettled(ids.map((id) => runOne(id, address, network)));
  return settled.map((item, index) => {
    if (item.status === "fulfilled") return item.value;
    const provider = providerById(ids[index] ?? "goplus")!;
    return buildResult(provider, {
      status: "error",
      summary: "This provider failed before it returned a result. Other providers were not cancelled.",
      findings: [],
    }, {
      reportUrl: provider.link(address, network.chainId),
      errorCode: "adapter_failed",
      errorMessage: "This provider failed before it returned a result.",
    });
  });
}

export async function attachManualNotes(address: string, chainId: number, results: ScannerResult[]): Promise<ScannerResult[]> {
  return Promise.all(results.map(async (result) => {
    if (result.userSubmitted || result.integrationMode === "manual" || result.integrationMode === "link_out") return result;
    const note = await manualFor(address, chainId, result.providerId);
    if (!note) return result;
    return {
      ...result,
      findings: [...result.findings, {
        title: "User-submitted note",
        description: note.text,
        severity: "unknown" as const,
        category: "user_submitted" as const,
      }],
      submission: { submittedAt: note.submittedAt, sourceUrl: note.sourceUrl },
    };
  }));
}

export function manualCard(record: ManualRecord): ScannerResult | undefined {
  const provider = providerById(record.providerId);
  if (!provider) return undefined;
  return manualResult(provider, provider.link(record.address, record.chainId), record);
}
