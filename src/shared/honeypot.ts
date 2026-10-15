import type { Finding, Severity } from "./types.ts";
import type { Interpreted } from "./result.ts";
import { asRecord, asString, isAffirmative, isNegative, statusFromFindings } from "./text.ts";

const RISK_STATUS: Record<string, { status: Interpreted["status"]; label: string }> = {
  honeypot: { status: "flagged", label: "honeypot" },
  very_high: { status: "flagged", label: "very_high" },
  high: { status: "suspicious", label: "high" },
  medium: { status: "suspicious", label: "medium" },
  low: { status: "no_findings", label: "low" },
  very_low: { status: "no_findings", label: "very_low" },
};

function severityOf(value: unknown): Severity {
  const text = asString(value)?.toLowerCase();
  if (text === "critical" || text === "high" || text === "medium" || text === "low" || text === "info") return text;
  return "unknown";
}

export function interpretHoneypot(payload: unknown): Interpreted {
  const root = asRecord(payload);
  if (!root) return { status: "unavailable", summary: "Honeypot.is returned a response this console could not read.", findings: [] };
  const summaryRecord = asRecord(root.summary);
  const risk = asString(summaryRecord?.risk)?.toLowerCase() ?? "unknown";
  const token = asRecord(root.token);
  const honeypot = asRecord(root.honeypotResult);
  const simulation = asRecord(root.simulationResult);
  const code = asRecord(root.contractCode);
  const findings: Finding[] = [];

  if (isAffirmative(honeypot?.isHoneypot)) {
    findings.push({
      title: "Honeypot simulation",
      description: `Honeypot.is honeypotResult.isHoneypot = true. Reason: ${asString(honeypot?.honeypotReason) ?? "not returned"}.`,
      severity: "critical",
      category: "honeypot",
      domain: "code",
      evidence: honeypot,
    });
  }
  const flags = Array.isArray(summaryRecord?.flags) ? summaryRecord.flags : [];
  for (const flag of flags) {
    const row = asRecord(flag);
    if (!row) continue;
    findings.push({
      title: asString(row.flag) ?? "Honeypot.is flag",
      description: asString(row.description) ?? "Honeypot.is returned this flag without a description.",
      severity: severityOf(row.severity),
      category: "honeypot",
      domain: "code",
      evidence: row,
    });
  }
  for (const [field, title] of [["buyTax", "Buy tax"], ["sellTax", "Sell tax"], ["transferTax", "Transfer tax"]] as const) {
    const raw = simulation?.[field];
    if (typeof raw !== "number" || raw <= 0) continue;
    findings.push({
      title,
      description: `Honeypot.is simulationResult.${field} = ${raw}. The API documents this number as a tax percentage.`,
      severity: raw >= 50 ? "critical" : raw >= 10 ? "high" : "medium",
      category: "tax",
      domain: "code",
      evidence: { [field]: raw },
    });
  }
  if (code && isNegative(code.openSource)) {
    findings.push({
      title: "Buy/sell path is not fully open source",
      description: "Honeypot.is contractCode.openSource = false. Honeypot.is says this requires every contract used in the buy/sell path to be open source.",
      severity: "high",
      category: "verification",
      domain: "code",
      evidence: code,
    });
  }
  if (code && isAffirmative(code.isProxy)) {
    findings.push({
      title: "Proxy contract",
      description: "Honeypot.is contractCode.isProxy = true.",
      severity: "medium",
      category: "mint_upgrade",
      domain: "code",
      evidence: code,
    });
  }
  const holders = asRecord(root.holderAnalysis);
  const failed = Number(holders?.failed);
  const analyzed = Number(holders?.holders);
  if (Number.isFinite(failed) && Number.isFinite(analyzed) && analyzed > 0 && failed / analyzed >= 0.5) {
    findings.push({
      title: "Holder sell failures",
      description: `Honeypot.is holderAnalysis failed = ${holders?.failed} of ${holders?.holders} analyzed holders. Honeypot.is says this is the analyzed sample, not the holder count.`,
      severity: "high",
      category: "honeypot",
      domain: "holder",
      evidence: holders,
    });
  }

  const mapped = RISK_STATUS[risk];
  let status: Interpreted["status"];
  if (!mapped || risk === "unknown") {
    status = findings.length > 0 ? statusFromFindings(findings) : "unavailable";
  } else if (mapped.status === "no_findings") {
    status = statusFromFindings(findings);
  } else {
    const fromFindings = statusFromFindings(findings);
    status = fromFindings === "flagged" || mapped.status === "flagged" ? "flagged" : "suspicious";
  }
  if (risk === "unknown" && findings.length === 0) status = "unavailable";

  const reason = asString(honeypot?.honeypotReason);
  const simulationError = asString(root.simulationError);
  const verdict = [`risk=${risk}`, reason ? `honeypotReason=${reason}` : "", simulationError ? `simulationError=${simulationError}` : ""]
    .filter(Boolean)
    .join("; ");
  const summaryText = risk === "unknown"
    ? "Honeypot.is risk is unknown. That is not a clear result."
    : `Honeypot.is summary.risk = "${risk}". ${isNegative(honeypot?.isHoneypot) ? "honeypotResult.isHoneypot = false." : "A missing honeypot result is not treated as clear."}`;

  return {
    status,
    summary: summaryText,
    originalVerdict: verdict,
    findings,
    reportedName: asString(token?.name) ?? undefined,
    reportedSymbol: asString(token?.symbol) ?? undefined,
  };
}
