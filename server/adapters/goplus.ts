import { createHash } from "node:crypto";
import { interpretGoPlus } from "../../src/shared/goplus.ts";
import { providerById } from "../../src/shared/providers.ts";
import { envValue } from "../env.ts";
import { fetchJson } from "../http.ts";
import { failed, fromInterpretation, timed } from "./common.ts";

const provider = providerById("goplus")!;
let cached: { token: string; expires: number } | null = null;

async function authorizationHeader(): Promise<Record<string, string>> {
  const appKey = envValue("GOPLUS_APP_KEY");
  const appSecret = envValue("GOPLUS_APP_SECRET");
  if (!appKey || !appSecret) return {};
  if (cached && cached.expires > Date.now()) return { Authorization: `Bearer ${cached.token}` };
  const time = Math.floor(Date.now() / 1000);
  const sign = createHash("sha1").update(`${appKey}${time}${appSecret}`).digest("hex");
  const payload = await fetchJson("https://api.gopluslabs.io/api/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_key: appKey, sign, time }),
  });
  const result = (payload as { result?: { access_token?: string } }).result;
  const token = result?.access_token;
  if (!token) throw new Error("GoPlus did not return an access token.");
  cached = { token, expires: Date.now() + 25 * 60 * 1000 };
  return { Authorization: `Bearer ${token}` };
}

export function scanGoPlus(address: string, chainId: number, reportUrl: string) {
  return timed(async () => {
    const headers = await authorizationHeader();
    const payload = await fetchJson(`https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`, { headers });
    return fromInterpretation(provider, interpretGoPlus(payload, address), { durationMs: 0, rawData: payload, reportUrl });
  }, (durationMs, error) => {
    const keysSet = Boolean(envValue("GOPLUS_APP_KEY") && envValue("GOPLUS_APP_SECRET"));
    return failed(provider, reportUrl, durationMs, error, keysSet);
  });
}
