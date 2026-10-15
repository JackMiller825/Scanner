import type { Network } from "../../src/shared/networks.ts";
import { interpretHoneypot } from "../../src/shared/honeypot.ts";
import { providerById } from "../../src/shared/providers.ts";
import { envValue } from "../env.ts";
import { fetchJson } from "../http.ts";
import { failed, fromInterpretation, timed } from "./common.ts";

const provider = providerById("honeypot")!;

export function scanHoneypot(address: string, network: Network, reportUrl: string) {
  return timed(async () => {
    const key = envValue("HONEYPOT_API_KEY");
    const headers: Record<string, string> = {};
    if (key) headers["X-API-KEY"] = key;
    const payload = await fetchJson(`https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=${network.chainId}`, { headers });
    return fromInterpretation(provider, interpretHoneypot(payload), { durationMs: 0, rawData: payload, reportUrl });
  }, (durationMs, error) => failed(provider, reportUrl, durationMs, error, Boolean(envValue("HONEYPOT_API_KEY"))));
}
