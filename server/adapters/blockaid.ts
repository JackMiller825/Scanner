import type { Network } from "../../src/shared/networks.ts";
import { interpretBlockaid } from "../../src/shared/blockaid.ts";
import { providerById } from "../../src/shared/providers.ts";
import { envValue } from "../env.ts";
import { fetchJson } from "../http.ts";
import { failed, fromInterpretation, notConfigured, timed } from "./common.ts";

const provider = providerById("blockaid")!;

export function scanBlockaid(address: string, network: Network, reportUrl: string) {
  if (!envValue("BLOCKAID_API_KEY")) return Promise.resolve(notConfigured(provider, reportUrl));
  return timed(async () => {
    const payload = await fetchJson("https://api.blockaid.io/v0/token/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": envValue("BLOCKAID_API_KEY") ?? "",
      },
      body: JSON.stringify({ address, chain: network.blockaid }),
    });
    return fromInterpretation(provider, interpretBlockaid(payload), { durationMs: 0, rawData: payload, reportUrl });
  }, (durationMs, error) => failed(provider, reportUrl, durationMs, error, true));
}
