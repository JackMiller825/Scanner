import type { Network } from "../../src/shared/networks.ts";
import { interpretDextools } from "../../src/shared/dextools.ts";
import { providerById } from "../../src/shared/providers.ts";
import { envValue } from "../env.ts";
import { fetchJson } from "../http.ts";
import { failed, fromInterpretation, notConfigured, timed } from "./common.ts";

const provider = providerById("dextools")!;
const plans = new Set(["trial", "standard", "advanced", "pro"]);

export function scanDextools(address: string, network: Network, reportUrl: string) {
  const key = envValue("DEXTOOLS_API_KEY");
  if (!key) return Promise.resolve(notConfigured(provider, reportUrl));
  const plan = (envValue("DEXTOOLS_PLAN") ?? "trial").toLowerCase();
  if (!plans.has(plan)) {
    return Promise.resolve(fromInterpretation(provider, {
      status: "error",
      summary: "DEXTOOLS_PLAN must be trial, standard, advanced, or pro.",
      findings: [],
    }, { durationMs: 0, reportUrl, errorCode: "config", errorMessage: "DEXTOOLS_PLAN is not a recognized plan name." }));
  }
  return timed(async () => {
    const headers = { "X-API-KEY": key };
    const base = `https://public-api.dextools.io/${plan}/v2/token/${network.dextools}/${address}`;
    const [score, audit] = await Promise.allSettled([
      fetchJson(`${base}/score`, { headers }),
      fetchJson(`${base}/audit`, { headers }),
    ]);
    if (score.status === "rejected" && audit.status === "rejected") throw score.reason;
    return fromInterpretation(
      provider,
      interpretDextools(score.status === "fulfilled" ? score.value : null, audit.status === "fulfilled" ? audit.value : null),
      {
        durationMs: 0,
        reportUrl,
        rawData: {
          score: score.status === "fulfilled" ? score.value : null,
          audit: audit.status === "fulfilled" ? audit.value : null,
        },
      },
    );
  }, (durationMs, error) => failed(provider, reportUrl, durationMs, error, true));
}
