import type { ProviderDefinition } from "../../src/shared/providers.ts";
import { buildResult, configuredMessage, type Interpreted } from "../../src/shared/result.ts";
import type { ScannerResult } from "../../src/shared/types.ts";
import { ProviderRequestError } from "../http.ts";
import type { ManualRecord } from "../storage.ts";

export function fromInterpretation(
  provider: ProviderDefinition,
  interpreted: Interpreted,
  extra: { durationMs: number; rawData?: unknown; reportUrl: string; errorCode?: string; errorMessage?: string },
): ScannerResult {
  return buildResult(provider, interpreted, extra);
}

export function notConfigured(provider: ProviderDefinition, reportUrl: string): ScannerResult {
  return buildResult(provider, {
    status: "not_configured",
    summary: configuredMessage(provider),
    findings: [],
  }, { reportUrl, durationMs: 0 });
}

export function unsupported(provider: ProviderDefinition, reportUrl: string, message: string): ScannerResult {
  return buildResult(provider, { status: "unavailable", summary: message, findings: [] }, { reportUrl, durationMs: 0 });
}

export function failed(provider: ProviderDefinition, reportUrl: string, durationMs: number, error: unknown, requiresKey: boolean): ScannerResult {
  if (error instanceof ProviderRequestError) {
    const authFailed = error.status === 401 || error.status === 403;
    const status = authFailed && requiresKey ? "not_configured" : error.status === 404 ? "unavailable" : "error";
    const errorMessage = authFailed && requiresKey
      ? "The provider rejected the configured credential."
      : error.status === 429
        ? "The provider rate limit was reached. Wait and try again."
        : error.status === 404
          ? "The provider has no result for this contract."
          : error.detail || `The provider request failed (HTTP ${error.status}).`;
    return buildResult(provider, { status, summary: errorMessage, findings: [] }, {
      reportUrl,
      durationMs,
      errorCode: String(error.status),
      errorMessage,
    });
  }
  const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
  const errorMessage = timedOut ? "The provider did not respond before the timeout." : "The provider request failed.";
  return buildResult(provider, { status: "error", summary: errorMessage, findings: [] }, {
    reportUrl,
    durationMs,
    errorCode: timedOut ? "timeout" : "request_failed",
    errorMessage,
  });
}

export async function timed(work: () => Promise<ScannerResult>, fail: (durationMs: number, error: unknown) => ScannerResult): Promise<ScannerResult> {
  const started = Date.now();
  try {
    const result = await work();
    result.durationMs = Date.now() - started;
    return result;
  } catch (error) {
    return fail(Date.now() - started, error);
  }
}

export function manualResult(provider: ProviderDefinition, reportUrl: string, manual?: ManualRecord): ScannerResult {
  if (!manual) {
    return buildResult(provider, {
      status: "manual",
      summary: `${provider.name} is manual / link-out only. No result has been submitted for this contract.`,
      findings: [],
    }, { reportUrl, durationMs: 0, integrationMode: "link_out", userSubmitted: false });
  }
  return buildResult(provider, {
    status: "manual",
    summary: "User-submitted result. It was pasted into this console and was not fetched from the provider.",
    originalVerdict: manual.text,
    findings: [{
      title: "User-submitted result",
      description: manual.text,
      severity: "unknown",
      category: "user_submitted",
    }],
  }, {
    reportUrl: manual.sourceUrl || reportUrl,
    checkedAt: manual.submittedAt,
    durationMs: 0,
    integrationMode: "manual",
    userSubmitted: true,
    submission: { submittedAt: manual.submittedAt, sourceUrl: manual.sourceUrl },
  });
}
