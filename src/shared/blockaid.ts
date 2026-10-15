import type { Finding, Severity } from "./types.ts";
import type { Interpreted } from "./result.ts";
import { asRecord, asString, fraction, percentLabel, taxSeverity } from "./text.ts";

function featureSeverity(value: unknown): Severity {
  const record = asRecord(value);
  const text = asString(record?.type ?? record?.feature_type ?? record?.severity)?.toLowerCase();
  if (text === "malicious") return "critical";
  if (text === "warning") return "high";
  if (text === "info" || text === "benign") return "info";
  return "high";
}

export function interpretBlockaid(payload: unknown): Interpreted {
  const root = asRecord(payload);
  if (!root) return { status: "unavailable", summary: "Blockaid returned a response this console could not read.", findings: [] };
  const resultType = asString(root.result_type);
  const findings: Finding[] = [];
  const attacks = asRecord(root.attack_types) ?? {};
  for (const [key, value] of Object.entries(attacks)) {
    const row = asRecord(value);
    findings.push({
      title: key,
      description: asString(row?.description) ?? `Blockaid attack_types.${key} = ${JSON.stringify(value)}.`,
      severity: featureSeverity(value),
      category: /fee|tax|honeypot/i.test(key) ? "honeypot" : /spam|phish|imperson/i.test(key) ? "impersonation" : "ownership",
      domain: "reputation",
      evidence: value,
    });
  }
  const fees = asRecord(root.fees);
  if (fees) {
    for (const [field, label] of [["buy", "Buy fee"], ["sell", "Sell fee"], ["transfer", "Transfer fee"]] as const) {
      const parsed = fraction(fees[field]);
      const severity = parsed === null ? null : taxSeverity(parsed);
      if (parsed === null || !severity) continue;
      findings.push({
        title: label,
        description: `Blockaid fees.${field} = ${JSON.stringify(fees[field])} (${percentLabel(parsed)}).`,
        severity,
        category: "tax",
        domain: "code",
        evidence: { [field]: fees[field] },
      });
    }
  }
  const metadata = asRecord(root.metadata);
  let status: Interpreted["status"] = "unavailable";
  if (resultType === "Malicious" || resultType === "Spam") status = "flagged";
  else if (resultType === "Warning") status = "suspicious";
  else if (resultType === "Benign") status = findings.some((finding) => finding.severity === "critical" || finding.severity === "high" || finding.severity === "medium" || finding.severity === "low") ? "suspicious" : "no_findings";
  else if (findings.length > 0) status = "suspicious";

  return {
    status,
    summary: resultType
      ? `Blockaid result_type = "${resultType}". This is Blockaid's verdict, not a safety certificate.`
      : "Blockaid did not return a result_type. The missing verdict is not treated as clear.",
    originalVerdict: resultType ?? undefined,
    findings,
    reportedName: asString(metadata?.name) ?? undefined,
    reportedSymbol: asString(metadata?.symbol) ?? undefined,
  };
}
