import { useEffect, useState } from "react";
import { checkHealth, loadHistory, loadIntegrations, requestScan, submitManual, type IntegrationRow } from "./api.ts";
import { FindingsBoard, HistoryList, IntegrationTable, ResultCard } from "./cards.tsx";
import { DEFAULT_ADDRESS, DEFAULT_CHAIN_ID, isAddress, NETWORKS } from "../shared/networks.ts";
import { overviewSentences } from "../shared/overview.ts";
import { PROVIDERS } from "../shared/providers.ts";
import { shortAddress } from "../shared/text.ts";
import type { ScannerResult, ScanResponse } from "../shared/types.ts";

type Filter = "all" | "flagged" | "no_findings" | "unavailable" | "errors";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All results" },
  { id: "flagged", label: "Flagged" },
  { id: "no_findings", label: "No findings" },
  { id: "unavailable", label: "Unavailable" },
  { id: "errors", label: "Errors" },
];

function matches(filter: Filter, result: ScannerResult | undefined): boolean {
  if (filter === "all") return true;
  if (!result) return filter === "unavailable";
  if (filter === "flagged") return result.status === "flagged" || result.status === "suspicious";
  if (filter === "no_findings") return result.status === "no_findings";
  if (filter === "errors") return result.status === "error";
  return result.status === "unavailable" || result.status === "not_configured" || result.status === "manual" || result.status === "stale";
}

export function RiskApp() {
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [chainId, setChainId] = useState(DEFAULT_CHAIN_ID);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [history, setHistory] = useState<ScanResponse[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceDown, setServiceDown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(() => {
    const hash = window.location.hash.replace("#", "").replace(/^provider-/, "");
    return PROVIDERS.some((provider) => provider.id === hash) ? hash : null;
  });
  const [viewingStored, setViewingStored] = useState(false);
  const [notes, setNotes] = useState<Record<string, ScannerResult>>({});

  useEffect(() => {
    void checkHealth().then((ok) => {
      setServiceDown(!ok);
      void loadIntegrations().then(setIntegrations).catch(() => setServiceDown(true));
      void loadHistory(DEFAULT_ADDRESS, DEFAULT_CHAIN_ID).then(setHistory).catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`provider-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusId, filter, scan]);

  async function scanToken() {
    const nextAddress = address.trim();
    if (!isAddress(nextAddress)) {
      setError("Enter a 42-character 0x contract address.");
      return;
    }
    setBusy(true);
    setError(null);
    setViewingStored(false);
    try {
      const response = await requestScan(nextAddress, chainId);
      setScan(response);
      setHistory(await loadHistory(nextAddress, chainId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The scan failed.");
    } finally {
      setBusy(false);
    }
  }

  async function pasteAddress() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) setAddress(text);
    } catch {
      setError("Clipboard read was blocked. Paste into the address field with the keyboard.");
    }
  }

  async function copyAddress() {
    const value = (scan?.token.address ?? address).trim();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const field = document.createElement("textarea");
      field.value = value;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.left = "-9999px";
      document.body.append(field);
      field.select();
      const copiedByCommand = document.execCommand("copy");
      field.remove();
      if (!copiedByCommand) {
        setError("Clipboard write was blocked. Select the address and copy it with the keyboard.");
        return;
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function openProvider(id: string) {
    setFilter("all");
    setFocusId(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  function resultFor(providerId: string, mode: string): ScannerResult | undefined {
    const live = scan?.results.find((result) => result.providerId === providerId);
    const note = notes[providerId];
    if (mode === "link_out") return note ?? live;
    return live ?? note;
  }

  const visible = PROVIDERS.filter((provider) => matches(filter, resultFor(provider.id, provider.mode)));

  return (
    <>
      <a className="skip-link" href="#overview">Skip to overview</a>
      <header className="console-header">
        <div className="header-row">
          <div>
            <p className="eyebrow">Private research</p>
            <h1>Token Risk Console</h1>
          </div>
          <nav className="section-nav" aria-label="Console sections">
            <a href="#overview">Overview</a>
            <a href="#scanners">Scanners</a>
            <a href="#findings">Findings</a>
            <a href="#history">History</a>
            <a href="#integrations">Integrations</a>
          </nav>
        </div>
        <p className="disclaimer">Read-only research tool. Results are provider opinions, not proof of safety or fraud.</p>
        <form
          className="scan-form"
          onSubmit={(event) => {
            event.preventDefault();
            void scanToken();
          }}
        >
          <label>
            Contract address
            <input value={address} onChange={(event) => setAddress(event.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
          </label>
          <label>
            Network
            <select value={chainId} onChange={(event) => setChainId(Number(event.target.value))}>
              {NETWORKS.map((network) => (
                <option key={network.chainId} value={network.chainId}>{network.name}</option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button className="button" type="submit" disabled={busy}>{busy ? "Scanning" : "Scan"}</button>
            <button className="button secondary" type="button" disabled={busy} onClick={() => void scanToken()}>Refresh</button>
            <button className="button secondary" type="button" onClick={() => void pasteAddress()}>Paste</button>
            <button className="button secondary" type="button" onClick={() => void copyAddress()}>{copied ? "Copied" : "Copy"}</button>
          </div>
        </form>
        {serviceDown ? <p className="meta-line">GoPlus and Honeypot.is run in this browser. Providers that need an API key stay Not configured on this published page.</p> : null}
        {error ? <p className="error-banner" role="alert">{error}</p> : null}
      </header>

      <main>
        <section id="overview" className="panel">
          <h2>Overview</h2>
          {scan ? (
            <>
              <div className="token-meta">
                <p className="token-name">{scan.token.name ?? "Name not returned"} <span>{scan.token.symbol ?? "Symbol not returned"}</span></p>
                <p>{scan.token.chainName} · chain ID {scan.token.chainId}</p>
                <p className="address-line">{scan.token.address}</p>
                <p>Decimals {scan.token.decimals ?? "not returned"} · Total supply {scan.token.totalSupply ?? "not returned"}</p>
                <p className="meta-line">Source {scan.token.source} · Retrieved {new Date(scan.token.retrievedAt).toLocaleString()} · Bytecode {scan.token.bytecodeBytes.toLocaleString()} bytes</p>
                {scan.token.partialErrors.length > 0 ? <p className="meta-line">{scan.token.partialErrors.join(" ")}</p> : null}
                {viewingStored ? <p className="meta-line">Viewing a stored run. Raw provider payloads are kept on the scan that just finished, not in the history list.</p> : null}
              </div>
              <ul className="summary-list">
                {overviewSentences(scan.overview).map((sentence) => <li key={sentence}>{sentence}</li>)}
              </ul>
              <p className="meta-line">Counts use independent scanners only. The Uniswap card is a surface reference because Uniswap says its token warnings come from Blockaid.</p>
              {scan.mismatches.length > 0 ? (
                <div className="mismatch">
                  <h3>Providers disagree on the token identity</h3>
                  {scan.mismatches.map((mismatch) => (
                    <p key={mismatch.field}>
                      On-chain {mismatch.field}: {mismatch.onChain ?? "not returned"}.
                      {" "}
                      {mismatch.reports.map((report) => `${report.providerName} reported ${report.value}`).join("; ")}.
                    </p>
                  ))}
                </div>
              ) : <p className="meta-line">No name or symbol mismatch was returned. A missing comparison is not agreement.</p>}
            </>
          ) : (
            <p className="empty">Scan a contract to read its on-chain name, symbol, decimals, and supply. This page does not assume what {shortAddress(DEFAULT_ADDRESS)} is called.</p>
          )}
        </section>

        <section id="scanners" className="panel">
          <div className="section-head">
            <h2>Scanner results</h2>
            <div className="filters" role="toolbar" aria-label="Filter scanner results">
              {FILTERS.map((item) => (
                <button key={item.id} type="button" className={filter === item.id ? "chip active" : "chip"} onClick={() => setFilter(item.id)}>{item.label}</button>
              ))}
            </div>
          </div>
          <div className="provider-jump">
            {PROVIDERS.map((provider) => (
              <button key={provider.id} type="button" onClick={() => openProvider(provider.id)}>{provider.name}</button>
            ))}
          </div>
          <div className="card-grid">
            {visible.map((provider) => (
              <ResultCard
                key={provider.id}
                provider={provider}
                integration={integrations.find((row) => row.id === provider.id)}
                result={resultFor(provider.id, provider.mode)}
                address={address.trim()}
                chainId={chainId}
                onSubmit={async (providerId, text, sourceUrl) => {
                  const saved = await submitManual({ providerId, address: address.trim(), chainId, text, sourceUrl: sourceUrl || undefined });
                  setNotes((current) => ({ ...current, [providerId]: saved }));
                  setScan((current) => current ? { ...current, results: current.results.map((result) => result.providerId === providerId ? saved : result) } : current);
                }}
              />
            ))}
          </div>
        </section>

        <section id="findings" className="panel">
          <h2>Findings and evidence</h2>
          <p className="meta-line">Each item stays with the provider that reported it. Contract-code items are separate from liquidity, holder, deployer, social, and reputation items.</p>
          <FindingsBoard results={scan?.results ?? []} />
        </section>

        <section id="history" className="panel">
          <h2>History</h2>
          <HistoryList
            runs={history}
            onOpen={(run) => {
              setScan(run);
              setViewingStored(true);
              setAddress(run.token.address);
              setChainId(run.token.chainId);
              document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </section>

        <section id="integrations" className="panel">
          <h2>Integrations</h2>
          <p className="meta-line">Credentials stay in server environment variables. This page shows whether a name is set, never the value. See .env.example and INTEGRATIONS.md.</p>
          <IntegrationTable rows={integrations} />
        </section>
      </main>
    </>
  );
}
