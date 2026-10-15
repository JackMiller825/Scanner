import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretBlockaid } from "../src/shared/blockaid.ts";
import { interpretDextools } from "../src/shared/dextools.ts";
import { interpretGoPlus } from "../src/shared/goplus.ts";
import { withHistory } from "../src/shared/history.ts";
import { interpretHoneypot } from "../src/shared/honeypot.ts";
import { isAddress } from "../src/shared/networks.ts";
import { buildMismatches, buildOverview } from "../src/shared/overview.ts";
import { providerById } from "../src/shared/providers.ts";
import { interpretQuickIntel } from "../src/shared/quickintel.ts";
import { buildResult } from "../src/shared/result.ts";
import { fraction, redactValue, statusFromFindings } from "../src/shared/text.ts";
import type { ScannerResult } from "../src/shared/types.ts";

const address = "0x99a76d66e121d6b3ed11bb5a43d6a710278c9164";

function result(partial: Pick<ScannerResult, "providerId" | "status" | "independent" | "role"> & Partial<ScannerResult>): ScannerResult {
  const provider = providerById(partial.providerId)!;
  return buildResult(provider, {
    status: partial.status,
    summary: partial.summary ?? partial.status,
    findings: partial.findings ?? [],
    originalVerdict: partial.originalVerdict,
    reportedName: partial.reportedName,
    reportedSymbol: partial.reportedSymbol,
  });
}

test("accepts the prefilled address and rejects a short one", () => {
  assert.equal(isAddress(address), true);
  assert.equal(isAddress("0x1234"), false);
});

test("does not treat a GoPlus honeypot flag as clear when trust_list is set", () => {
  const interpreted = interpretGoPlus({
    code: 1,
    result: {
      [address]: {
        token_name: "Example",
        token_symbol: "EX",
        is_honeypot: "1",
        trust_list: "1",
        is_open_source: "1",
      },
    },
  }, address);
  assert.equal(interpreted.status, "flagged");
  assert.match(interpreted.summary, /trust_list/);
  assert.equal(interpreted.findings.some((finding) => finding.title === "Honeypot"), true);
});

test("does not turn a missing GoPlus record into no findings", () => {
  const interpreted = interpretGoPlus({ code: 1, result: {} }, address);
  assert.equal(interpreted.status, "unavailable");
});

test("keeps an empty GoPlus tax unknown and reports no tracked flags without saying safe", () => {
  const interpreted = interpretGoPlus({
    code: 1,
    result: { [address]: { token_name: "Onchain Name", token_symbol: "ONC", is_open_source: "1", buy_tax: "", sell_tax: "0" } },
  }, address);
  assert.equal(interpreted.status, "no_findings");
  assert.equal(interpreted.findings.some((finding) => finding.category === "tax"), false);
  assert.doesNotMatch(interpreted.summary.toLowerCase(), /safe/);
});

test("treats an unknown Honeypot.is risk as unavailable", () => {
  const interpreted = interpretHoneypot({ summary: { risk: "unknown" }, token: { name: "X", symbol: "X" } });
  assert.equal(interpreted.status, "unavailable");
});

test("preserves a low Honeypot.is verdict as no findings when no flags are present", () => {
  const interpreted = interpretHoneypot({
    summary: { risk: "low", riskLevel: 5 },
    honeypotResult: { isHoneypot: false },
    token: { name: "Reported", symbol: "RPT" },
  });
  assert.equal(interpreted.status, "no_findings");
  assert.match(interpreted.originalVerdict ?? "", /risk=low/);
});

test("keeps Blockaid benign and malicious apart", () => {
  assert.equal(interpretBlockaid({ result_type: "Benign", attack_types: {}, metadata: { name: "A", symbol: "A" } }).status, "no_findings");
  assert.equal(interpretBlockaid({ result_type: "Malicious", attack_types: { PHISHING: { description: "Phishing site" } } }).status, "flagged");
  assert.equal(interpretBlockaid({}).status, "unavailable");
});

test("does not treat a DEXTools score alone as a clear result", () => {
  const interpreted = interpretDextools({ data: { dextScore: { total: 99 } } }, null);
  assert.equal(interpreted.status, "unavailable");
  assert.match(interpreted.summary, /not treat that score as a safety verdict/);
});

test("leaves an unrecognized Quick Intel payload unavailable", () => {
  assert.equal(interpretQuickIntel({ unexpected: true }).status, "unavailable");
});

test("counts only independent scanners and shows disagreement", () => {
  const overview = buildOverview([
    result({ providerId: "goplus", status: "flagged", independent: true, role: "scanner" }),
    result({ providerId: "honeypot", status: "no_findings", independent: true, role: "scanner" }),
    result({ providerId: "blockaid", status: "not_configured", independent: true, role: "scanner" }),
    result({ providerId: "uniswap", status: "manual", independent: false, role: "surface_reference", originalVerdict: "Blockaid warning copied" }),
  ]);
  assert.deepEqual(overview, {
    findings: 1,
    noFindings: 1,
    unavailableOrNotConfigured: 1,
    errors: 0,
    manual: 0,
    disagreement: true,
  });
});

test("reports a provider name that differs from the on-chain value", () => {
  const mismatches = buildMismatches({ name: "Onchain Name", symbol: "ONC" }, [
    result({ providerId: "goplus", status: "no_findings", independent: true, role: "scanner", reportedName: "Other Name", reportedSymbol: "ONC" }),
  ]);
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0]?.field, "name");
  assert.equal(mismatches[0]?.reports[0]?.value, "Other Name");
});

test("detects a changed provider result and redacts secret-like fields", () => {
  const first = result({ providerId: "honeypot", status: "no_findings", independent: true, role: "scanner", originalVerdict: "risk=low" });
  const second = result({ providerId: "honeypot", status: "flagged", independent: true, role: "scanner", originalVerdict: "risk=honeypot" });
  const [compared] = withHistory([second], [first]);
  assert.equal(compared?.changedSincePrevious, true);
  assert.deepEqual(redactValue({ apiKey: "secret", nested: { access_token: "abc" }, name: "Visible" }), {
    apiKey: "[redacted]",
    nested: { access_token: "[redacted]" },
    name: "Visible",
  });
});

test("parses GoPlus fractions and ignores informational-only findings in the status", () => {
  assert.equal(fraction("1"), 1);
  assert.equal(fraction(""), null);
  assert.equal(statusFromFindings([{ severity: "info" }]), "no_findings");
  assert.equal(statusFromFindings([{ severity: "low" }]), "suspicious");
});
