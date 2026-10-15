import { interpretDefi } from "../../src/shared/defi.ts";
import { providerById } from "../../src/shared/providers.ts";
import { asRecord } from "../../src/shared/text.ts";
import { envValue } from "../env.ts";
import { fetchJson } from "../http.ts";
import { failed, fromInterpretation, notConfigured, timed } from "./common.ts";

const provider = providerById("defi")!;
const endpoint = "https://public-api.de.fi/graphql";

const attempts = [
  { field: "smartContractAddresses", variable: "addresses", type: "[String!]!" },
  { field: "contractAddresses", variable: "addresses", type: "[String!]!" },
  { field: "contractAddress", variable: "address", type: "String!" },
];

function queryFor(field: string, type: string, selection: string): string {
  return `query ($value: ${type}) { scannerProject(${field}: $value) ${selection} }`;
}

function hasErrors(payload: unknown): boolean {
  const root = asRecord(payload);
  return Array.isArray(root?.errors) && root.errors.length > 0;
}

export function scanDefi(address: string, reportUrl: string) {
  const key = envValue("DEFI_API_KEY");
  if (!key) return Promise.resolve(notConfigured(provider, reportUrl));
  return timed(async () => {
    let payload: unknown = null;
    let lastError = "De.Fi rejected the scanner query.";
    for (const attempt of attempts) {
      const variables = attempt.variable === "addresses" ? { value: [address] } : { value: address };
      const minimal = await fetchJson(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": key },
        body: JSON.stringify({
          query: queryFor(attempt.field, attempt.type, "{ address name securityScore }"),
          variables,
        }),
      });
      if (hasErrors(minimal)) {
        const message = asRecord((asRecord(minimal)?.errors as unknown[] | undefined)?.[0])?.message;
        if (typeof message === "string") lastError = message.slice(0, 180);
        continue;
      }
      payload = minimal;
      const richer = await fetchJson(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": key },
        body: JSON.stringify({
          query: queryFor(attempt.field, attempt.type, "{ address name symbol securityScore issues { title name severity description summary } }"),
          variables,
        }),
      });
      if (!hasErrors(richer)) payload = richer;
      break;
    }
    if (!payload) {
      return fromInterpretation(provider, { status: "error", summary: lastError, findings: [] }, { durationMs: 0, reportUrl });
    }
    return fromInterpretation(provider, interpretDefi(payload), { durationMs: 0, rawData: payload, reportUrl });
  }, (durationMs, error) => failed(provider, reportUrl, durationMs, error, true));
}
