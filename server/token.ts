import { decodeBytes, decodeUint } from "../src/shared/abi.ts";
import type { Network } from "../src/shared/networks.ts";
import type { TokenMetadata } from "../src/shared/types.ts";
import { formatSupply } from "../src/shared/text.ts";
import { envValue } from "./env.ts";
import { fetchJson } from "./http.ts";

const SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
} as const;

export class RpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RpcError";
  }
}

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const payload = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }, 12_000);
  const record = payload as { result?: unknown; error?: { message?: string } };
  if (record.error) throw new RpcError(record.error.message || "RPC request failed.");
  return record.result;
}

export async function readToken(network: Network, address: string): Promise<TokenMetadata> {
  const override = envValue(network.rpcEnv);
  const urls = override ? [override] : [...network.rpcUrls];
  let lastError = "No RPC endpoint responded.";
  for (const url of urls) {
    try {
      const code = await rpc(url, "eth_getCode", [address, "latest"]);
      if (typeof code !== "string") throw new RpcError("The RPC response did not include bytecode.");
      const normalized = code.toLowerCase();
      if (normalized === "0x" || /^0x0+$/.test(normalized)) {
        throw new RpcError("No contract bytecode was found for this address on the selected network.");
      }
      const bytecodeBytes = (normalized.length - 2) / 2;
      const partialErrors: string[] = [];
      const calls = await Promise.all(
        (Object.entries(SELECTORS) as Array<[keyof typeof SELECTORS, string]>).map(async ([field, data]) => {
          try {
            const result = await rpc(url, "eth_call", [{ to: address, data }, "latest"]);
            return [field, typeof result === "string" ? result : null] as const;
          } catch {
            partialErrors.push(`${field}() did not return a value.`);
            return [field, null] as const;
          }
        }),
      );
      const values = Object.fromEntries(calls) as Record<keyof typeof SELECTORS, string | null>;
      const decimals = values.decimals ? Number(decodeUint(values.decimals)) : null;
      const supplyRaw = values.totalSupply ? decodeUint(values.totalSupply) : null;
      const host = new URL(url).host;
      return {
        address,
        chainId: network.chainId,
        chainName: network.name,
        bytecodeBytes,
        name: values.name ? decodeBytes(values.name) : null,
        symbol: values.symbol ? decodeBytes(values.symbol) : null,
        decimals: decimals !== null && Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : null,
        totalSupplyRaw: supplyRaw === null ? null : supplyRaw.toString(),
        totalSupply: supplyRaw !== null && decimals !== null && Number.isInteger(decimals) ? formatSupply(supplyRaw, decimals) : supplyRaw?.toString() ?? null,
        source: host,
        retrievedAt: new Date().toISOString(),
        partialErrors,
      };
    } catch (error) {
      lastError = error instanceof RpcError ? error.message : "The RPC request failed.";
      if (lastError.startsWith("No contract bytecode")) throw new RpcError(lastError);
    }
  }
  throw new RpcError(lastError);
}
