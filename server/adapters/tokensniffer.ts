import { interpretTokenSniffer } from "../../src/shared/tokensniffer.ts";
import { providerById } from "../../src/shared/providers.ts";
import { envValue } from "../env.ts";
import { fetchJson, ProviderRequestError } from "../http.ts";
import { failed, fromInterpretation, notConfigured, timed } from "./common.ts";

const provider = providerById("tokensniffer")!;

export function scanTokenSniffer(address: string, chainId: number, reportUrl: string) {
  const key = envValue("TOKENSNIFFER_API_KEY");
  if (!key) return Promise.resolve(notConfigured(provider, reportUrl));
  return timed(async () => {
    const path = `https://tokensniffer.com/api/v2/tokens/${chainId}/${address}?include_metrics=true&include_tests=true`;
    let payload: unknown;
    try {
      payload = await fetchJson(path, { headers: { "X-API-Key": key } });
    } catch (error) {
      if (!(error instanceof ProviderRequestError) || (error.status !== 401 && error.status !== 403)) throw error;
      payload = await fetchJson(`${path}&apikey=${encodeURIComponent(key)}`);
    }
    return fromInterpretation(provider, interpretTokenSniffer(payload), { durationMs: 0, rawData: payload, reportUrl });
  }, (durationMs, error) => failed(provider, reportUrl, durationMs, error, true));
}
