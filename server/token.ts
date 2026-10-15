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

function decodeBytes(hex: string): string | null {
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!data || /^0+$/.test(data)) return null;
  try {
    if (data.length === 64) {
      const bytes = Buffer.from(data, "hex");
      const end = bytes.indexOf(0);
      const text = bytes.subarray(0, end === -1 ? undefined : end).toString("utf8").trim();
      return text || null;
    }
    if (data.length < 128) return null;
    const offset = Number(BigInt(`0x${data.slice(0, 64)}`));
    const lengthStart = offset * 2;
    if (lengthStart + 64 > data.length) return null;
    const length = Number(BigInt(`0x${data.slice(lengthStart, lengthStart + 64)}`));
    if (!Number.isFinite(length) || length < 0 || length > 256) return null;
    const start = lengthStart + 64;
    const text = Buffer.from(data.slice(start, start + length * 2), "hex").toString("utf8").replace(/\0/g, "").trim();
    return text || null;
  } catch {
    return null;
  }
}

function decodeUint(hex: string): bigint | null {
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!data || /^0*$/.test(data)) return 0n;
  try {
    return BigInt(`0x${data.slice(0, 64)}`);
  } catch {
    return null;
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
