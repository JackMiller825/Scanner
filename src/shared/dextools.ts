import type { Finding } from "./types.ts";
import type { Interpreted } from "./result.ts";
import { asRecord, asString, fraction, isAffirmative, isNegative, percentLabel, statusFromFindings, taxSeverity } from "./text.ts";

function payloadOf(value: unknown): Record<string, unknown> | null {
  const root = asRecord(value);
  if (!root) return null;
  return asRecord(root.data) ?? root;
}

export function interpretDextools(scorePayload: unknown, auditPayload: unknown): Interpreted {
  const scoreRoot = payloadOf(scorePayload);
  const auditRoot = payloadOf(auditPayload);
  const dext = asRecord(scoreRoot?.dextScore) ?? scoreRoot;
  const total = typeof dext?.total === "number" ? dext.total : null;
  const findings: Finding[] = [];
  let recognized = false;
  if (auditRoot) {
    for (const [key, value] of Object.entries(auditRoot)) {
      const name = key.toLowerCase();
      if (/honeypot|mint|blacklist|pause|hidden|scam|proxy/.test(name)) {
        recognized = true;
        if (isAffirmative(value)) {
          findings.push({
            title: key,
            description: `DEXTools ${key} = ${JSON.stringify(value)}.`,
            severity: /honeypot|scam|hidden/.test(name) ? "critical" : /proxy/.test(name) ? "medium" : "high",
            category: /honeypot/.test(name) ? "honeypot" : /tax|fee/.test(name) ? "tax" : "ownership",
            domain: "code",
            evidence: { [key]: value },
          });
        }
      }
      if (/tax|fee/.test(name)) {
        const parsed = fraction(value);
        const severity = parsed === null ? null : taxSeverity(parsed);
        if (parsed !== null) recognized = true;
        if (parsed !== null && severity) {
          findings.push({
            title: key,
            description: `DEXTools ${key} = ${JSON.stringify(value)} (${percentLabel(parsed)}).`,
            severity,
            category: "tax",
            domain: "code",
            evidence: { [key]: value },
          });
        }
      }
      if (/opensource|verified/.test(name) && isNegative(value)) {
        recognized = true;
        findings.push({
          title: "Source or verification flag",
          description: `DEXTools ${key} = ${JSON.stringify(value)}.`,
          severity: "high",
          category: "verification",
          domain: "code",
          evidence: { [key]: value },
        });
      }
    }
  }
  const scoreText = total === null ? "DEXTools did not return a DEXTScore." : `DEXTools DEXTScore total = ${total}. This console does not treat that score as a safety verdict.`;
  if (!auditRoot || !recognized) {
    return {
      status: "unavailable",
      summary: `${scoreText} No recognized audit flags were returned, so this is not a clear result.`,
      originalVerdict: total === null ? undefined : `DEXTScore=${total}`,
      findings,
    };
  }
  return {
    status: statusFromFindings(findings),
    summary: `${scoreText} ${findings.length ? "Audit fields reported items." : "Recognized audit flags were present and none were affirmative."}`,
    originalVerdict: total === null ? "audit returned" : `DEXTScore=${total}`,
    findings,
    reportedName: asString(auditRoot.name) ?? asString(scoreRoot?.name) ?? undefined,
    reportedSymbol: asString(auditRoot.symbol) ?? asString(scoreRoot?.symbol) ?? undefined,
  };
}
