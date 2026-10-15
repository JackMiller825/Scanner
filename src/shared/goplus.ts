import type { Finding, FindingCategory, FindingDomain, Severity } from "./types.ts";
import { asRecord, asString, fraction, isAffirmative, isNegative, percentLabel, statusFromFindings, taxSeverity } from "./text.ts";
import type { Interpreted } from "./result.ts";

const FLAGS: Array<{
  key: string;
  title: string;
  severity: Severity;
  category: FindingCategory;
  domain: FindingDomain;
  description: string;
}> = [
  { key: "is_honeypot", title: "Honeypot", severity: "critical", category: "honeypot", domain: "code", description: "GoPlus is_honeypot = \"1\". GoPlus describes a honeypot as a token that may be unsellable or that contains malicious code." },
  { key: "honeypot_with_same_creator", title: "Honeypot from the same creator", severity: "high", category: "honeypot", domain: "deployer", description: "GoPlus honeypot_with_same_creator = \"1\"." },
  { key: "cannot_sell_all", title: "Cannot sell all", severity: "high", category: "honeypot", domain: "code", description: "GoPlus cannot_sell_all = \"1\". GoPlus says holders may be unable to sell the full balance in one transaction." },
  { key: "cannot_buy", title: "Cannot buy", severity: "high", category: "honeypot", domain: "code", description: "GoPlus cannot_buy = \"1\"." },
  { key: "is_mintable", title: "Mint function", severity: "high", category: "mint_upgrade", domain: "code", description: "GoPlus is_mintable = \"1\". GoPlus says a mint function can increase supply." },
  { key: "can_take_back_ownership", title: "Ownership can be reclaimed", severity: "high", category: "ownership", domain: "code", description: "GoPlus can_take_back_ownership = \"1\"." },
  { key: "owner_change_balance", title: "Owner can change balances", severity: "critical", category: "mint_upgrade", domain: "code", description: "GoPlus owner_change_balance = \"1\". GoPlus says the owner can modify holder balances." },
  { key: "hidden_owner", title: "Hidden owner", severity: "critical", category: "ownership", domain: "code", description: "GoPlus hidden_owner = \"1\". GoPlus says hidden ownership can keep control after ownership appears abandoned." },
  { key: "selfdestruct", title: "Self-destruct", severity: "high", category: "mint_upgrade", domain: "code", description: "GoPlus selfdestruct = \"1\"." },
  { key: "gas_abuse", title: "Gas abuse", severity: "high", category: "honeypot", domain: "code", description: "GoPlus gas_abuse = \"1\"." },
  { key: "transfer_pausable", title: "Transfers can be paused", severity: "high", category: "transfer_controls", domain: "code", description: "GoPlus transfer_pausable = \"1\"." },
  { key: "is_blacklisted", title: "Blacklist function", severity: "high", category: "transfer_controls", domain: "code", description: "GoPlus is_blacklisted = \"1\". GoPlus says a blacklist can stop selected addresses from trading." },
  { key: "slippage_modifiable", title: "Tax can be changed", severity: "high", category: "tax", domain: "code", description: "GoPlus slippage_modifiable = \"1\"." },
  { key: "personal_slippage_modifiable", title: "Address-specific tax", severity: "high", category: "tax", domain: "code", description: "GoPlus personal_slippage_modifiable = \"1\"." },
  { key: "is_airdrop_scam", title: "Airdrop scam", severity: "critical", category: "impersonation", domain: "reputation", description: "GoPlus is_airdrop_scam = \"1\". GoPlus says only this value means it found an airdrop scam." },
  { key: "is_proxy", title: "Proxy contract", severity: "medium", category: "mint_upgrade", domain: "code", description: "GoPlus is_proxy = \"1\". GoPlus says proxy implementations can be changed." },
  { key: "is_whitelisted", title: "Whitelist function", severity: "medium", category: "transfer_controls", domain: "code", description: "GoPlus is_whitelisted = \"1\"." },
  { key: "trading_cooldown", title: "Trading cooldown", severity: "medium", category: "transfer_controls", domain: "code", description: "GoPlus trading_cooldown = \"1\"." },
  { key: "anti_whale_modifiable", title: "Modifiable anti-whale limit", severity: "medium", category: "transfer_controls", domain: "code", description: "GoPlus anti_whale_modifiable = \"1\"." },
  { key: "is_anti_whale", title: "Anti-whale limit", severity: "low", category: "transfer_controls", domain: "code", description: "GoPlus is_anti_whale = \"1\"." },
  { key: "external_call", title: "External call", severity: "info", category: "mint_upgrade", domain: "code", description: "GoPlus external_call = \"1\". GoPlus says the contract depends on other contracts, which may or may not be risky." },
];

function taxFinding(label: string, field: string, value: unknown): Finding | null {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = fraction(value);
  if (parsed === null) return null;
  const severity = taxSeverity(parsed);
  if (!severity) return null;
  return {
    title: label,
    description: `GoPlus ${field} = ${JSON.stringify(value)}. On GoPlus's 0–1 scale, 1 means 100%. This console reads that as ${percentLabel(parsed)}.`,
    severity,
    category: "tax",
    domain: "code",
    evidence: { field, value },
  };
}

function holderFindings(record: Record<string, unknown>): Finding[] {
  const findings: Finding[] = [];
  const holders = Array.isArray(record.holders) ? record.holders : [];
  for (const holder of holders) {
    const row = asRecord(holder);
    if (!row) continue;
    const tag = asString(row.tag)?.toLowerCase() ?? "";
    if (/burn|dead|blackhole|null address/.test(tag)) continue;
    const share = fraction(row.percent);
    if (share === null || share < 0.2) continue;
    findings.push({
      title: "Holder concentration",
      description: `GoPlus reports holder ${asString(row.address) ?? "unknown"} at ${percentLabel(share)}${tag ? ` (${tag})` : ""}. GoPlus percent uses 1 for 100%.`,
      severity: share >= 0.5 ? "high" : "medium",
      category: "holders_deployer",
      domain: "holder",
      evidence: row,
    });
  }
  const ownerShare = fraction(record.owner_percent);
  if (ownerShare !== null && ownerShare >= 0.2) {
    findings.push({
      title: "Owner token share",
      description: `GoPlus owner_percent = ${JSON.stringify(record.owner_percent)} (${percentLabel(ownerShare)}).`,
      severity: ownerShare >= 0.5 ? "high" : "medium",
      category: "holders_deployer",
      domain: "holder",
      evidence: { owner_address: record.owner_address, owner_percent: record.owner_percent },
    });
  }
  const creatorShare = fraction(record.creator_percent);
  if (creatorShare !== null && creatorShare >= 0.2) {
    findings.push({
      title: "Creator token share",
      description: `GoPlus creator_percent = ${JSON.stringify(record.creator_percent)} (${percentLabel(creatorShare)}). Creator: ${asString(record.creator_address) ?? "not returned"}.`,
      severity: creatorShare >= 0.5 ? "high" : "medium",
      category: "holders_deployer",
      domain: "deployer",
      evidence: { creator_address: record.creator_address, creator_percent: record.creator_percent },
    });
  }
  return findings;
}

function liquidityFindings(record: Record<string, unknown>): Finding[] {
  const holders = Array.isArray(record.lp_holders) ? record.lp_holders : [];
  const findings: Finding[] = [];
  for (const holder of holders) {
    const row = asRecord(holder);
    if (!row || row.is_locked === undefined || row.is_locked === null || row.is_locked === "") continue;
    const share = fraction(row.percent);
    const who = asString(row.address) ?? "unknown";
    const tag = asString(row.tag);
    if (isAffirmative(row.is_locked)) {
      findings.push({
        title: "LP reported locked",
        description: `GoPlus is_locked = "1" for LP holder ${who}${tag ? ` (${tag})` : ""}.`,
        severity: "info",
        category: "liquidity",
        domain: "liquidity",
        evidence: row,
      });
    } else if (isNegative(row.is_locked) && share !== null && share >= 0.1) {
      findings.push({
        title: "LP not reported locked",
        description: `GoPlus is_locked = "0" for LP holder ${who} at ${percentLabel(share)}. GoPlus only marks locks it has indexed.`,
        severity: "medium",
        category: "liquidity",
        domain: "liquidity",
        evidence: row,
      });
    }
  }
  return findings;
}

export function interpretGoPlus(payload: unknown, address: string): Interpreted {
  const root = asRecord(payload);
  if (!root) {
    return { status: "unavailable", summary: "GoPlus returned a response this console could not read.", findings: [] };
  }
  const code = root.code;
  if (code !== 1 && code !== "1") {
    return {
      status: "error",
      summary: "GoPlus did not return a successful result.",
      originalVerdict: asString(root.message) ?? undefined,
      findings: [],
    };
  }
  const table = asRecord(root.result);
  const record = table
    ? asRecord(table[address] ?? table[address.toLowerCase()] ?? Object.entries(table).find(([key]) => key.toLowerCase() === address.toLowerCase())?.[1])
    : null;
  if (!record) {
    return { status: "unavailable", summary: "GoPlus returned no token record for this contract.", findings: [] };
  }

  const findings: Finding[] = [];
  if (isNegative(record.is_open_source)) {
    findings.push({
      title: "Closed source",
      description: "GoPlus is_open_source = \"0\". GoPlus says closed-source contracts may hide unknown mechanisms, and other items may be absent.",
      severity: "high",
      category: "verification",
      domain: "code",
      evidence: { is_open_source: record.is_open_source },
    });
  }
  for (const flag of FLAGS) {
    if (isAffirmative(record[flag.key])) {
      findings.push({
        title: flag.title,
        description: flag.description,
        severity: flag.severity,
        category: flag.category,
        domain: flag.domain,
        evidence: { [flag.key]: record[flag.key] },
      });
    }
  }
  for (const [field, title] of [["buy_tax", "Buy tax"], ["sell_tax", "Sell tax"], ["transfer_tax", "Transfer tax"]] as const) {
    const finding = taxFinding(title, field, record[field]);
    if (finding) findings.push(finding);
  }
  const fake = asRecord(record.fake_token);
  if (fake && (isAffirmative(fake.value) || asString(fake.true_token_address))) {
    findings.push({
      title: "Possible counterfeit token",
      description: `GoPlus fake_token value = ${JSON.stringify(fake.value)}. Referenced address: ${asString(fake.true_token_address) ?? "not returned"}.`,
      severity: "critical",
      category: "impersonation",
      domain: "reputation",
      evidence: fake,
    });
  }
  const other = asString(record.other_potential_risks);
  if (other) {
    findings.push({
      title: "Other potential risk",
      description: other,
      severity: "medium",
      category: "ownership",
      domain: "code",
      evidence: { other_potential_risks: other },
    });
  }
  findings.push(...holderFindings(record), ...liquidityFindings(record));
  if (isNegative(record.is_in_dex)) {
    findings.push({
      title: "No mainstream DEX pair reported",
      description: "GoPlus is_in_dex = \"0\". GoPlus says this means it did not find a pair against a mainstream token.",
      severity: "info",
      category: "liquidity",
      domain: "liquidity",
      evidence: { is_in_dex: record.is_in_dex },
    });
  }

  const notes: string[] = [];
  if (isAffirmative(record.is_open_source)) notes.push("is_open_source = \"1\"");
  if (isAffirmative(record.trust_list)) notes.push("trust_list = \"1\" (GoPlus's own trustworthy-token flag; a missing value is not a risk flag)");
  const cex = asRecord(record.is_in_cex);
  if (cex && isAffirmative(cex.listed)) notes.push("is_in_cex.listed = \"1\"");
  const note = asString(record.note);
  if (note) notes.push(`note: ${note}`);
  const name = asString(record.token_name);
  const symbol = asString(record.token_symbol);
  const status = statusFromFindings(findings);
  const summary = [
    status === "no_findings"
      ? "GoPlus returned a token record and did not report the risk flags this console tracks."
      : "GoPlus reported one or more items. The original fields are listed with each finding.",
    notes.length ? `GoPlus also returned ${notes.join("; ")}.` : "",
  ].filter(Boolean).join(" ");

  return {
    status,
    summary,
    originalVerdict: [name, symbol].filter(Boolean).join(" / ") || asString(root.message) || undefined,
    findings,
    reportedName: name ?? undefined,
    reportedSymbol: symbol ?? undefined,
  };
}
