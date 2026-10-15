import type { IncomingMessage, ServerResponse } from "node:http";
import { getNetwork, isAddress, NETWORKS } from "../src/shared/networks.ts";
import { PROVIDERS, providerById } from "../src/shared/providers.ts";
import { hasEnv } from "./env.ts";
import { HttpError, performScan } from "./scan.ts";
import { listRuns, saveManual } from "./storage.ts";
import { manualCard } from "./adapters/index.ts";

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 32_000) {
        reject(new HttpError(413, "The request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => reject(new HttpError(400, "The request body could not be read.")));
  });
}

function configuration(id: string, mode: string): "connected" | "not_configured" | "manual" {
  if (mode === "link_out") return "manual";
  if (id === "goplus" || id === "honeypot") return "connected";
  if (id === "dextools") return hasEnv("DEXTOOLS_API_KEY") ? "connected" : "not_configured";
  const provider = providerById(id);
  if (!provider || provider.credentialEnv.some((name) => !hasEnv(name))) return "not_configured";
  return "connected";
}

function validUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (url.href.length > 500) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/")) return false;
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      send(res, 200, { ok: true });
      return true;
    }
    if (req.method === "GET" && url.pathname === "/api/integrations") {
      send(res, 200, {
        providers: PROVIDERS.map((provider) => ({
          id: provider.id,
          name: provider.name,
          mode: provider.mode,
          role: provider.role,
          independent: provider.independent,
          configuration: configuration(provider.id, provider.mode),
          docsUrl: provider.docsUrl,
          termsUrl: provider.termsUrl ?? null,
          summary: provider.summary,
          limitations: provider.limitations,
          attribution: provider.attribution,
          credentials: provider.credentialEnv.map((name) => ({ name, present: hasEnv(name) })),
        })),
      });
      return true;
    }
    if (req.method === "GET" && url.pathname === "/api/history") {
      const address = url.searchParams.get("address") ?? undefined;
      const chainParam = url.searchParams.get("chainId");
      const chainId = chainParam ? Number(chainParam) : undefined;
      if (address && !isAddress(address)) throw new HttpError(400, "Enter a valid 0x address.");
      if (chainId !== undefined && !getNetwork(chainId)) throw new HttpError(400, "Select a supported network.");
      send(res, 200, { runs: await listRuns(address, chainId) });
      return true;
    }
    if (req.method === "GET" && url.pathname === "/api/networks") {
      send(res, 200, { networks: NETWORKS.map((network) => ({ chainId: network.chainId, name: network.name })) });
      return true;
    }
    if (req.method === "POST" && url.pathname === "/api/scan") {
      const body = JSON.parse(await readBody(req)) as { address?: unknown; chainId?: unknown };
      if (typeof body.address !== "string" || typeof body.chainId !== "number") throw new HttpError(400, "Enter a valid 0x address and a supported network.");
      send(res, 200, await performScan(body.address, body.chainId));
      return true;
    }
    if (req.method === "POST" && url.pathname === "/api/manual") {
      const body = JSON.parse(await readBody(req)) as { providerId?: unknown; address?: unknown; chainId?: unknown; text?: unknown; sourceUrl?: unknown };
      if (typeof body.providerId !== "string" || !providerById(body.providerId)) throw new HttpError(400, "Choose a listed provider.");
      if (typeof body.address !== "string" || !isAddress(body.address) || typeof body.chainId !== "number" || !getNetwork(body.chainId)) {
        throw new HttpError(400, "Enter a valid 0x address and a supported network.");
      }
      if (typeof body.text !== "string" || body.text.trim().length < 1 || body.text.trim().length > 8000) {
        throw new HttpError(400, "Paste the provider result, warning, or note.");
      }
      if (body.sourceUrl && !validUrl(body.sourceUrl)) throw new HttpError(400, "The provider URL must be an http or https link.");
      const record = {
        providerId: body.providerId,
        address: body.address.trim(),
        chainId: body.chainId,
        text: body.text.trim(),
        sourceUrl: validUrl(body.sourceUrl),
        submittedAt: new Date().toISOString(),
      };
      await saveManual(record);
      send(res, 200, { result: manualCard(record) });
      return true;
    }
    send(res, 404, { error: "That API route does not exist." });
  } catch (error) {
    if (error instanceof SyntaxError) {
      send(res, 400, { error: "The request body must be JSON." });
      return true;
    }
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : "The scan service failed.";
    send(res, status, { error: message });
  }
  return true;
}
