import { redactText } from "../src/shared/text.ts";

export class ProviderRequestError extends Error {
  readonly status: number;
  readonly detail: string | null;

  constructor(status: number, detail: string | null) {
    super(`Provider responded with HTTP ${status}.`);
    this.name = "ProviderRequestError";
    this.status = status;
    this.detail = detail;
  }
}

function publicDetail(body: string): string | null {
  const redacted = redactText(body).slice(0, 400);
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: unknown; detail?: unknown };
    const message = [parsed.message, parsed.error, parsed.detail].find((item) => typeof item === "string") as string | undefined;
    if (message && message.length <= 180 && !/key|token|secret|authorization|bearer/i.test(message)) return message;
  } catch {
    // The body is not JSON. Keep the generic HTTP error.
  }
  if (redacted.startsWith("<") || /key|token|secret|authorization/i.test(redacted)) return null;
  return redacted.length > 0 && redacted.length <= 180 ? redacted : null;
}

export async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 25_000): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  if (!response.ok) throw new ProviderRequestError(response.status, publicDetail(text));
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderRequestError(response.status, "The provider response was not JSON.");
  }
}
