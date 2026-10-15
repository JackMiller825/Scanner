import type { ScannerResult } from "./types.ts";

export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export function resultFingerprint(result: ScannerResult): string {
  return JSON.stringify({
    status: result.status,
    verdict: result.originalVerdict ?? "",
    findings: result.findings.map((finding) => [finding.title, finding.severity, finding.description]),
    submission: result.submission?.submittedAt ?? "",
  });
}

export function withHistory(current: ScannerResult[], previous: ScannerResult[] | undefined, now = Date.now()): ScannerResult[] {
  return current.map((result) => {
    const prior = previous?.find((item) => item.providerId === result.providerId);
    const checkedAt = result.checkedAt ? Date.parse(result.checkedAt) : now;
    const stale = Number.isFinite(checkedAt) && now - checkedAt > STALE_AFTER_MS;
    return {
      ...result,
      freshness: stale ? "stale" : "current",
      changedSincePrevious: prior ? resultFingerprint(result) !== resultFingerprint(prior) : null,
      previousCheckedAt: prior?.checkedAt,
    };
  });
}
