import type { Finding, FindingCategory, FindingDomain, Severity } from "./types.ts";
import type { Interpreted } from "./result.ts";
import { asRecord, asString, fraction, isAffirmative, isNegative, percentLabel, statusFromFindings, taxSeverity } from "./text.ts";

type FlagSpec = { title: string; severity: Severity; category: FindingCategory; domain: FindingDomain };

const FLAGS: Record<string, FlagSpec> = {
  ishoneypot: { title: "Honeypot", severity: "critical", category: "honeypot", domain: "code" },
  honeypot: { title: "Honeypot", severity: "critical", category: "honeypot", domain: "code" },
  cannotsell: { title: "Sell restriction", severity: "high", category: "honeypot", domain: "code" },
  cannotbuy: { title: "Buy restriction", severity: "high", category: "honeypot", domain: "code" },
  canmint: { title: "Mint permission", severity: "high", category: "mint_upgrade", domain: "code" },
  ismintable: { title: "Mint permission", severity: "high", category: "mint_upgrade", domain: "code" },
  mintable: { title: "Mint permission", severity: "high", category: "mint_upgrade", domain: "code" },
  canblacklist: { title: "Blacklist permission", severity: "high", category: "transfer_controls", domain: "code" },
  isblacklisted: { title: "Blacklist permission", severity: "high", category: "transfer_controls", domain: "code" },
  blacklist: { title: "Blacklist permission", severity: "high", category: "transfer_controls", domain: "code" },
  canpausetrading: { title: "Trading can be paused", severity: "high", category: "transfer_controls", domain: "code" },
  pausetrading: { title: "Trading can be paused", severity: "high", category: "transfer_controls", domain: "code" },
  hiddenowner: { title: "Hidden owner", severity: "critical", category: "ownership", domain: "code" },
  isproxy: { title: "Proxy", severity: "medium", category: "mint_upgrade", domain: "code" },
  proxy: { title: "Proxy", severity: "medium", category: "mint_upgrade", domain: "code" },
  modifiabletax: { title: "Modifiable tax", severity: "high", category: "tax", domain: "code" },
  taxmodifiable: { title: "Modifiable tax", severity: "high", category: "tax", domain: "code" },
  isscam: { title: "Scam flag", severity: "critical", category: "impersonation", domain: "reputation" },
  scam: { title: "Scam flag", severity: "critical", category: "impersonation", domain: "reputation" },
  airdropphishing: { title: "Airdrop or phishing flag", severity: "critical", category: "impersonation", domain: "reputation" },
  isairdropphishingscam: { title: "Airdrop or phishing flag", severity: "critical", category: "impersonation", domain: "reputation" },
};

function compact(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function firstObject(root: Record<string, unknown>, names: string[]): Record<string, unknown> | null {
  for (const name of names) {
    const found = Object.entries(root).find(([key]) => compact(key) === compact(name));
    const record = found ? asRecord(found[1]) : null;
    if (record) return record;
  }
  return null;
}

function readName(source: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const found = Object.entries(source).find(([entry]) => compact(entry) === compact(key));
    const value = found ? asString(found[1]) : null;
    if (value) return value;
  }
  return undefined;
}

export function interpretQuickIntel(payload: unknown): Interpreted {
  const root = asRecord(payload);
  if (!root) return { status: "unavailable", summary: "Quick Intel returned a response this console could not read.", findings: [] };
  const audit = firstObject(root, ["quickiAudit", "audit"]) ?? root;
  const details = firstObject(root, ["tokenDetails", "tokenDynamicDetails"]);
  const findings: Finding[] = [];
  let recognized = false;

  const visit = (record: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(record)) {
      const name = compact(key);
      const spec = FLAGS[name];
      if (spec) {
        recognized = true;
        if (isAffirmative(value)) {
          findings.push({
            title: spec.title,
            description: `Quick Intel ${key} = ${JSON.stringify(value)}.`,
            severity: spec.severity,
            category: spec.category,
            domain: spec.domain,
            evidence: { [key]: value },
          });
        }
        continue;
      }
      if (name.includes("tax") && !name.includes("modifiable")) {
        const parsed = fraction(value);
        const severity = parsed === null ? null : taxSeverity(parsed);
        if (parsed !== null) recognized = true;
        if (parsed !== null && severity) {
          findings.push({
            title: key,
            description: `Quick Intel ${key} = ${JSON.stringify(value)} (${percentLabel(parsed)}).`,
            severity,
            category: "tax",
            domain: "code",
            evidence: { [key]: value },
          });
        }
      }
      if ((name === "contractverified" || name === "verified") && isNegative(value)) {
        recognized = true;
        findings.push({
          title: "Contract not verified",
          description: `Quick Intel ${key} = ${JSON.stringify(value)}.`,
          severity: "high",
          category: "verification",
          domain: "code",
          evidence: { [key]: value },
        });
      }
      if (name.includes("renounced") && isNegative(value)) {
        recognized = true;
        findings.push({
          title: "Ownership not renounced",
          description: `Quick Intel ${key} = ${JSON.stringify(value)}.`,
          severity: "medium",
          category: "ownership",
          domain: "code",
          evidence: { [key]: value },
        });
      }
      if ((name === "contractverified" || name === "verified" || name.includes("renounced")) && (isAffirmative(value) || isNegative(value))) {
        recognized = true;
      }
    }
  };

  visit(audit);
  if (audit !== root) {
    const scalars = Object.fromEntries(Object.entries(root).filter(([, value]) => !asRecord(value) && !Array.isArray(value)));
    visit(scalars);
  }
  if (details) visit(details);

  if (!recognized) {
    return {
      status: "unavailable",
      summary: "Quick Intel returned a response without the audit fields this console recognizes. It is not treated as clear.",
      findings: [],
      reportedName: readName(details, ["tokenName", "name"]),
      reportedSymbol: readName(details, ["tokenSymbol", "symbol"]),
    };
  }

  return {
    status: statusFromFindings(findings),
    summary: findings.length
      ? "Quick Intel reported one or more audit fields. Original field names are kept in each finding."
      : "Quick Intel returned recognized audit fields and none of the tracked risk flags were affirmative.",
    originalVerdict: asString(root.message) ?? undefined,
    findings,
    reportedName: readName(details, ["tokenName", "name"]) ?? readName(audit, ["tokenName", "name"]),
    reportedSymbol: readName(details, ["tokenSymbol", "symbol"]) ?? readName(audit, ["tokenSymbol", "symbol"]),
  };
}
