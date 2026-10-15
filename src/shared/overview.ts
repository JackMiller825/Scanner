import type { NameMismatch, Overview, ScannerResult, TokenMetadata } from "./types.ts";
import { sameText } from "./text.ts";

export function independentResults(results: ScannerResult[]): ScannerResult[] {
  return results.filter((result) => result.independent && result.role === "scanner");
}

export function buildOverview(results: ScannerResult[]): Overview {
  const rows = independentResults(results);
  const findings = rows.filter((result) => result.status === "flagged" || result.status === "suspicious").length;
  const noFindings = rows.filter((result) => result.status === "no_findings").length;
  const unavailableOrNotConfigured = rows.filter(
    (result) => result.status === "unavailable" || result.status === "not_configured" || result.status === "stale",
  ).length;
  const errors = rows.filter((result) => result.status === "error").length;
  const manual = rows.filter((result) => result.status === "manual").length;
  return {
    findings,
    noFindings,
    unavailableOrNotConfigured,
    errors,
    manual,
    disagreement: findings > 0 && noFindings > 0,
  };
}

export function buildMismatches(token: Pick<TokenMetadata, "name" | "symbol">, results: ScannerResult[]): NameMismatch[] {
  return (["name", "symbol"] as const).flatMap((field) => {
    const onChain = field === "name" ? token.name : token.symbol;
    const reports = results.flatMap((result) => {
      const value = field === "name" ? result.reportedName : result.reportedSymbol;
      if (!value) return [];
      return [{ providerId: result.providerId, providerName: result.providerName, value }];
    });
    const distinct = new Set(reports.map((report) => report.value.trim().toLowerCase()));
    if (onChain) distinct.add(onChain.trim().toLowerCase());
    const differsFromChain = onChain ? reports.some((report) => !sameText(report.value, onChain)) : false;
    if (distinct.size < 2 && !differsFromChain) return [];
    return [{ field, onChain, reports }];
  });
}

export function overviewSentences(overview: Overview): string[] {
  const findingLabel = overview.findings === 1 ? "provider reported findings" : "providers reported findings";
  const clearLabel = overview.noFindings === 1 ? "provider reported no findings" : "providers reported no findings";
  const gapLabel =
    overview.unavailableOrNotConfigured === 1
      ? "provider unavailable or not configured"
      : "providers unavailable or not configured";
  const lines = [
    `${overview.findings} ${findingLabel}`,
    `${overview.noFindings} ${clearLabel}`,
    `${overview.unavailableOrNotConfigured} ${gapLabel}`,
  ];
  if (overview.errors > 0) {
    lines.push(`${overview.errors} ${overview.errors === 1 ? "provider returned an error" : "providers returned an error"}`);
  }
  if (overview.manual > 0) {
    lines.push(`${overview.manual} ${overview.manual === 1 ? "provider is manual or link-out only" : "providers are manual or link-out only"}`);
  }
  if (overview.disagreement) lines.push("Providers disagree: some reported findings and some reported none.");
  return lines;
}
