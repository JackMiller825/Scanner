export type ScannerStatus =
  | "flagged"
  | "suspicious"
  | "no_findings"
  | "unavailable"
  | "not_configured"
  | "manual"
  | "error"
  | "stale";

export type Severity = "critical" | "high" | "medium" | "low" | "info" | "unknown";

export type FindingCategory =
  | "honeypot"
  | "tax"
  | "ownership"
  | "transfer_controls"
  | "mint_upgrade"
  | "liquidity"
  | "holders_deployer"
  | "verification"
  | "impersonation"
  | "user_submitted";

export type FindingDomain = "code" | "liquidity" | "holder" | "deployer" | "social" | "reputation";

export type Finding = {
  title: string;
  description: string;
  severity: Severity;
  category: FindingCategory;
  domain?: FindingDomain;
  evidence?: unknown;
};

export type IntegrationMode = "api" | "link_out" | "manual";

export type ScannerResult = {
  providerId: string;
  providerName: string;
  integrationMode: IntegrationMode;
  independent: boolean;
  role: "scanner" | "surface_reference";
  status: ScannerStatus;
  checkedAt?: string;
  durationMs?: number;
  freshness?: "current" | "stale";
  summary: string;
  originalVerdict?: string;
  findings: Finding[];
  reportUrl?: string;
  attribution?: string;
  reportedName?: string;
  reportedSymbol?: string;
  errorCode?: string;
  errorMessage?: string;
  changedSincePrevious?: boolean | null;
  previousCheckedAt?: string;
  userSubmitted?: boolean;
  submission?: {
    submittedAt: string;
    sourceUrl?: string;
  };
  rawData?: unknown;
};

export type TokenMetadata = {
  address: string;
  chainId: number;
  chainName: string;
  bytecodeBytes: number;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupplyRaw: string | null;
  totalSupply: string | null;
  source: string;
  retrievedAt: string;
  partialErrors: string[];
};

export type NameMismatch = {
  field: "name" | "symbol";
  onChain: string | null;
  reports: Array<{ providerId: string; providerName: string; value: string }>;
};

export type Overview = {
  findings: number;
  noFindings: number;
  unavailableOrNotConfigured: number;
  errors: number;
  manual: number;
  disagreement: boolean;
};

export type ScanResponse = {
  id: string;
  scannedAt: string;
  token: TokenMetadata;
  results: ScannerResult[];
  mismatches: NameMismatch[];
  overview: Overview;
};
