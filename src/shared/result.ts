import type { ProviderDefinition } from "./providers.ts";
import type { Finding, IntegrationMode, ScannerResult, ScannerStatus } from "./types.ts";
import { redactValue } from "./text.ts";

export type Interpreted = {
  status: ScannerStatus;
  summary: string;
  originalVerdict?: string;
  findings: Finding[];
  reportedName?: string;
  reportedSymbol?: string;
};

type ResultExtra = {
  durationMs?: number;
  checkedAt?: string;
  reportUrl?: string;
  rawData?: unknown;
  errorCode?: string;
  errorMessage?: string;
  integrationMode?: IntegrationMode;
  userSubmitted?: boolean;
  submission?: ScannerResult["submission"];
};

export function buildResult(provider: ProviderDefinition, interpreted: Interpreted, extra: ResultExtra = {}): ScannerResult {
  return {
    providerId: provider.id,
    providerName: provider.name,
    integrationMode: extra.integrationMode ?? provider.mode,
    independent: provider.independent,
    role: provider.role,
    status: interpreted.status,
    checkedAt: extra.checkedAt ?? new Date().toISOString(),
    durationMs: extra.durationMs,
    freshness: "current",
    summary: interpreted.summary,
    originalVerdict: interpreted.originalVerdict,
    findings: interpreted.findings,
    reportUrl: extra.reportUrl,
    attribution: provider.attribution,
    reportedName: interpreted.reportedName,
    reportedSymbol: interpreted.reportedSymbol,
    errorCode: extra.errorCode,
    errorMessage: extra.errorMessage,
    userSubmitted: extra.userSubmitted,
    submission: extra.submission,
    rawData: extra.rawData === undefined ? undefined : redactValue(extra.rawData),
  };
}

export function configuredMessage(provider: ProviderDefinition): string {
  if (provider.credentialEnv.length === 0) return `${provider.name} has no API credential to configure.`;
  return `Add ${provider.credentialEnv.join(" and ")} on the server. Keys are read from environment variables and are not accepted in the browser.`;
}
