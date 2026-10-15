import type { Network } from "../../src/shared/networks.ts";
import { providerById } from "../../src/shared/providers.ts";
import { interpretQuickIntel } from "../../src/shared/quickintel.ts";
import { envValue } from "../env.ts";
import { fetchJson } from "../http.ts";
import { failed, fromInterpretation, notConfigured, timed } from "./common.ts";

const provider = providerById("quickintel")!;

export function scanQuickIntel(address: string, network: Network, reportUrl: string) {
  if (!envValue("QUICKINTEL_API_KEY")) return Promise.resolve(notConfigured(provider, reportUrl));
  return timed(async () => {
    const payload = await fetchJson("https://api.quickintel.io/v1/getquickiauditfull", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-QKNTL-KEY": envValue("QUICKINTEL_API_KEY") ?? "",
      },
      body: JSON.stringify({ chain: network.quickintel, tokenAddress: address }),
    });
    return fromInterpretation(provider, interpretQuickIntel(payload), { durationMs: 0, rawData: payload, reportUrl });
  }, (durationMs, error) => failed(provider, reportUrl, durationMs, error, true));
}
