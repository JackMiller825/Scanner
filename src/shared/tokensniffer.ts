import type { Finding } from "./types.ts";
import type { Interpreted } from "./result.ts";
import { asRecord, asString, isAffirmative, isNegative, statusFromFindings } from "./text.ts";

function testsOf(root: Record<string, unknown>): unknown[] {
  if (Array.isArray(root.tests)) return root.tests;
  const smell = asRecord(root.smell_test) ?? asRecord(root.smellTest);
  if (smell && Array.isArray(smell.tests)) return smell.tests;
  return [];
}

export function interpretTokenSniffer(payload: unknown): Interpreted {
  const root = asRecord(payload);
  if (!root) return { status: "unavailable", summary: "Token Sniffer returned a response this console could not read.", findings: [] };
  const statusText = asString(root.status)?.toLowerCase();
  if (statusText === "pending" || statusText === "running" || statusText === "not_ready") {
    return { status: "unavailable", summary: `Token Sniffer status = "${statusText}". A pending result is not a clear result.`, originalVerdict: statusText, findings: [] };
  }
  const contract = asRecord(root.contract);
  const findings: Finding[] = [];
  const flagged = root.is_flagged ?? root.flagged ?? root.is_scam ?? root.scam;
  if (isAffirmative(flagged)) {
    findings.push({
      title: "Token Sniffer flag",
      description: `Token Sniffer reported a flag value of ${JSON.stringify(flagged)}.`,
      severity: "critical",
      category: "impersonation",
      domain: "reputation",
      evidence: { is_flagged: root.is_flagged, is_scam: root.is_scam, scam: root.scam },
    });
  }
  for (const test of testsOf(root)) {
    const row = asRecord(test);
    if (!row) continue;
    const hit = isAffirmative(row.result) || isAffirmative(row.detected) || isAffirmative(row.flagged) || asString(row.result)?.toLowerCase() === "fail";
    if (!hit) continue;
    findings.push({
      title: asString(row.id) ?? asString(row.name) ?? "Smell test",
      description: asString(row.description) ?? asString(row.message) ?? `Token Sniffer test result = ${JSON.stringify(row.result)}.`,
      severity: "unknown",
      category: "verification",
      domain: "code",
      evidence: row,
    });
  }
  if (contract && isNegative(contract.is_source_verified ?? contract.verified)) {
    findings.push({
      title: "Source not verified",
      description: "Token Sniffer reports the contract source as not verified.",
      severity: "high",
      category: "verification",
      domain: "code",
      evidence: contract,
    });
  }
  const score = typeof root.score === "number" ? root.score : null;
  const knownVerdict = flagged !== undefined || score !== null || testsOf(root).length > 0;
  if (!knownVerdict) {
    return { status: "unavailable", summary: "Token Sniffer did not return a flag, score, or test list. That is not a clear result.", findings: [] };
  }
  const status = isAffirmative(flagged) ? "flagged" : statusFromFindings(findings);
  return {
    status,
    summary: [
      flagged === undefined ? "Token Sniffer did not return is_flagged." : `Token Sniffer is_flagged = ${JSON.stringify(flagged)}.`,
      score === null ? "" : `Score = ${score}. The score is the provider's number, not a safety certificate.`,
    ].filter(Boolean).join(" "),
    originalVerdict: [flagged === undefined ? "" : `is_flagged=${JSON.stringify(flagged)}`, score === null ? "" : `score=${score}`].filter(Boolean).join("; "),
    findings,
    reportedName: asString(root.name) ?? asString(contract?.name) ?? undefined,
    reportedSymbol: asString(root.symbol) ?? asString(contract?.symbol) ?? undefined,
  };
}
