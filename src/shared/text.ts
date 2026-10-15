export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function isAffirmative(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  }
  return false;
}

export function isNegative(value: unknown): boolean {
  if (value === false || value === 0) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "0" || normalized === "false" || normalized === "no";
  }
  return false;
}

export function fraction(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") return null;
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric > 1 ? numeric / 100 : numeric;
}

export function percentLabel(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function taxSeverity(fractionValue: number): "critical" | "high" | "medium" | null {
  if (fractionValue >= 0.5) return "critical";
  if (fractionValue >= 0.1) return "high";
  if (fractionValue > 0) return "medium";
  return null;
}

export function statusFromFindings(findings: Array<{ severity: string }>): "flagged" | "suspicious" | "no_findings" {
  if (findings.some((finding) => finding.severity === "critical" || finding.severity === "high")) return "flagged";
  if (findings.some((finding) => finding.severity === "medium" || finding.severity === "low")) return "suspicious";
  return "no_findings";
}

export function sameText(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function formatSupply(raw: bigint, decimals: number): string {
  if (decimals < 0 || decimals > 36) return raw.toString();
  const negative = raw < 0n;
  const value = negative ? -raw : raw;
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fractionPart = value % scale;
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (fractionPart === 0n) return negative ? `-${wholeText}` : wholeText;
  const fractionText = fractionPart.toString().padStart(decimals, "0").replace(/0+$/, "");
  const text = `${wholeText}.${fractionText}`;
  return negative ? `-${text}` : text;
}

export function shortAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  const record = asRecord(value);
  if (!record) return value;
  const hidden = /key|secret|token|authorization|password|sign/i;
  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    redacted[key] = hidden.test(key) ? "[redacted]" : redactValue(entry);
  }
  return redacted;
}

export function redactText(value: string): string {
  return value
    .replace(/([A-Za-z0-9_-]{0,40}(?:key|token|secret)[A-Za-z0-9_-]{0,40}\s*[:=]\s*)(["']?)[^\s"',}]+/gi, "$1$2[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
}
