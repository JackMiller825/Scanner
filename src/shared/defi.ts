import type { Finding, Severity } from "./types.ts";
import type { Interpreted } from "./result.ts";
import { asRecord, asString, statusFromFindings } from "./text.ts";

function severityOf(value: unknown): Severity {
  const text = asString(value)?.toLowerCase();
  if (text === "critical" || text === "high" || text === "medium" || text === "low" || text === "info" || text === "informational") {
    return text === "informational" ? "info" : text;
  }
  return "unknown";
}

function issueArrays(record: Record<string, unknown>): unknown[] {
  const arrays: unknown[] = [];
  for (const value of Object.values(record)) {
    if (Array.isArray(value)) arrays.push(...value);
    const nested = asRecord(value);
    if (nested) {
      for (const inner of Object.values(nested)) {
        if (Array.isArray(inner)) arrays.push(...inner);
      }
    }
  }
  return arrays;
}

export function interpretDefi(payload: unknown): Interpreted {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  const project = data?.scannerProject;
  const records = Array.isArray(project) ? project.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item)) : asRecord(project) ? [asRecord(project)!] : [];
  if (!root || records.length === 0) {
    return { status: "unavailable", summary: "De.Fi did not return a scannerProject record. That is not a clear result.", findings: [] };
  }
  const findings: Finding[] = [];
  let sawIssueList = false;
  let score: string | null = null;
  let name: string | undefined;
  let symbol: string | undefined;
  for (const record of records) {
    score = score ?? asString(record.securityScore);
    name = name ?? asString(record.name) ?? asString(record.tokenName) ?? undefined;
    symbol = symbol ?? asString(record.symbol) ?? asString(record.tokenSymbol) ?? undefined;
    for (const issue of issueArrays(record)) {
      const row = asRecord(issue);
      if (!row) continue;
      const title = asString(row.title) ?? asString(row.name) ?? asString(row.id);
      const description = asString(row.description) ?? asString(row.impact) ?? asString(row.summary);
      if (!title && !description) continue;
      sawIssueList = true;
      findings.push({
        title: title ?? "De.Fi issue",
        description: description ?? title ?? "De.Fi returned an issue without a description.",
        severity: severityOf(row.severity ?? row.risk),
        category: "verification",
        domain: "code",
        evidence: row,
      });
    }
  }
  const scoreText = score ? `De.Fi securityScore = ${score}. This console does not treat that number as a safety verdict.` : "De.Fi did not return a security score.";
  if (!sawIssueList && findings.length === 0) {
    return {
      status: "unavailable",
      summary: `${scoreText} No issue list was returned, so this is not a clear result.`,
      originalVerdict: score ? `securityScore=${score}` : undefined,
      findings: [],
      reportedName: name,
      reportedSymbol: symbol,
    };
  }
  return {
    status: statusFromFindings(findings),
    summary: `${scoreText} ${findings.length ? "Issue text from De.Fi is shown unchanged." : "De.Fi returned an issue list with no readable issues."}`,
    originalVerdict: score ? `securityScore=${score}` : undefined,
    findings,
    reportedName: name,
    reportedSymbol: symbol,
  };
}
