import type { FindingCategory, FindingDomain, ScannerStatus, Severity } from "./types.ts";

export const STATUS_LABELS: Record<ScannerStatus, string> = {
  flagged: "Flagged",
  suspicious: "Suspicious findings",
  no_findings: "No findings reported",
  unavailable: "Unavailable",
  not_configured: "Not configured",
  manual: "Manual result",
  error: "Error",
  stale: "Stale",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Informational",
  unknown: "Unknown",
};

export const CATEGORY_ORDER: FindingCategory[] = [
  "honeypot",
  "tax",
  "ownership",
  "transfer_controls",
  "mint_upgrade",
  "liquidity",
  "holders_deployer",
  "verification",
  "impersonation",
  "user_submitted",
];

export const CATEGORY_LABELS: Record<FindingCategory, string> = {
  honeypot: "Buy/sell simulation or honeypot indicators",
  tax: "Buy, sell, or transfer tax",
  ownership: "Owner/admin permissions",
  transfer_controls: "Transfer restrictions, blacklist, whitelist, pause, or trading controls",
  mint_upgrade: "Minting, upgradeability, proxy, or balance-changing powers",
  liquidity: "Liquidity lock/burn information",
  holders_deployer: "Holder concentration and deployer history",
  verification: "Contract verification or audit availability",
  impersonation: "Token impersonation, phishing, spam, or known-scam matches",
  user_submitted: "User-submitted notes",
};

export const DOMAIN_LABELS: Record<FindingDomain, string> = {
  code: "Contract code",
  liquidity: "Liquidity",
  holder: "Holder",
  deployer: "Deployer",
  social: "Social",
  reputation: "Reputation",
};

export const MODE_LABELS = {
  api: "API",
  link_out: "Link-out",
  manual: "Manual",
} as const;
