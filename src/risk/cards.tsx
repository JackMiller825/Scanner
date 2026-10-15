import { useState } from "react";
import { CATEGORY_LABELS, CATEGORY_ORDER, DOMAIN_LABELS, MODE_LABELS, SEVERITY_LABELS, STATUS_LABELS } from "../shared/labels.ts";
import type { ProviderDefinition } from "../shared/providers.ts";
import type { Finding, ScannerResult, ScanResponse } from "../shared/types.ts";
import type { IntegrationRow } from "./api.ts";

function statusClass(status: string): string {
  return `pill status-${status.replaceAll("_", "-")}`;
}

export function ResultCard(props: {
  provider: ProviderDefinition;
  integration?: IntegrationRow;
  result?: ScannerResult;
  address: string;
  chainId: number;
  onSubmit: (providerId: string, text: string, sourceUrl: string) => Promise<void>;
}) {
  const { provider, integration, result, address, chainId } = props;
  const configuration = integration?.configuration;
  const showForm = provider.mode === "link_out" || configuration === "not_configured" || result?.status === "not_configured" || result?.status === "manual";
  return (
    <article className="card" id={`provider-${provider.id}`}>
      <header className="card-head">
        <div>
          <h3>{provider.name}</h3>
          <p className="meta-line">
            {provider.role === "surface_reference" ? "Surface reference" : "Independent scanner"}
            {" · "}
            {MODE_LABELS[result?.integrationMode ?? provider.mode]}
            {result?.userSubmitted ? " · User-submitted" : ""}
          </p>
        </div>
        {result ? <span className={statusClass(result.status)}>{STATUS_LABELS[result.status]}</span> : <span className="pill status-idle">Not scanned yet</span>}
      </header>
      {result?.freshness === "stale" ? <p className="stale-note">Stale. This result is more than six hours old.</p> : null}
      <p>{result?.summary ?? provider.summary}</p>
      {result?.originalVerdict ? (
        <blockquote>
          <span>Original result</span>
          {result.originalVerdict}
        </blockquote>
      ) : null}
      {result?.errorMessage ? <p className="error-inline">{result.errorMessage}</p> : null}
      <dl className="facts">
        <div>
          <dt>Checked</dt>
          <dd>{result?.checkedAt ? new Date(result.checkedAt).toLocaleString() : "Not yet"}</dd>
        </div>
        <div>
          <dt>Response</dt>
          <dd>{result?.durationMs === undefined ? "—" : `${(result.durationMs / 1000).toFixed(1)}s`}</dd>
        </div>
        <div>
          <dt>Since previous run</dt>
          <dd>{result?.changedSincePrevious === undefined ? "—" : result.changedSincePrevious === null ? "No previous run" : result.changedSincePrevious ? "Changed" : "Unchanged"}</dd>
        </div>
      </dl>
      {result && result.findings.length > 0 ? (
        <ul className="finding-list">
          {result.findings.map((finding, index) => (
            <li key={`${finding.title}-${index}`}>
              <strong>{finding.title}</strong>
              <span className={statusClass(finding.severity)}>{SEVERITY_LABELS[finding.severity]}</span>
              <p>{finding.description}</p>
              <p className="meta-line">
                {CATEGORY_LABELS[finding.category]}
                {finding.domain ? ` · ${DOMAIN_LABELS[finding.domain]}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="attribution">{result?.attribution ?? provider.attribution}</p>
      <div className="card-actions">
        <a className="button secondary" href={result?.reportUrl || provider.link(address, chainId)} target="_blank" rel="noreferrer">
          Open official {provider.mode === "link_out" ? "page" : "report"}
        </a>
        {provider.docsUrl ? (
          <a className="text-link" href={provider.docsUrl} target="_blank" rel="noreferrer">Documentation</a>
        ) : null}
      </div>
      {result?.rawData !== undefined ? (
        <details className="raw">
          <summary>View raw provider data</summary>
          <pre>{JSON.stringify(result.rawData, null, 2)}</pre>
        </details>
      ) : null}
      {showForm ? <ManualForm providerId={provider.id} onSubmit={props.onSubmit} /> : null}
    </article>
  );
}

function ManualForm(props: { providerId: string; onSubmit: (providerId: string, text: string, sourceUrl: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="manual-form"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setMessage(null);
        void props.onSubmit(props.providerId, text, sourceUrl).then(() => {
          setText("");
          setSourceUrl("");
          setMessage("Saved as a user-submitted result.");
        }).catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : "The note could not be saved.");
        }).finally(() => setPending(false));
      }}
    >
      <label>
        Paste the provider result, warning, or note
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} required />
      </label>
      <label>
        Provider URL, if you have one
        <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} inputMode="url" placeholder="https://" />
      </label>
      <button className="button secondary" type="submit" disabled={pending}>{pending ? "Saving" : "Save user-submitted result"}</button>
      {message ? <p className="meta-line">{message}</p> : null}
    </form>
  );
}

export function FindingsBoard({ results }: { results: ScannerResult[] }) {
  const findings = results.flatMap((result) => result.findings.map((finding) => ({ finding, result })));
  if (findings.length === 0) {
    return <p className="empty">Findings appear here after a provider reports them. An empty list is not a clear result.</p>;
  }
  return (
    <div className="topic-list">
      {CATEGORY_ORDER.map((category) => {
        const rows = findings.filter((item) => item.finding.category === category);
        if (rows.length === 0) return null;
        return (
          <section key={category}>
            <h3>{CATEGORY_LABELS[category]}</h3>
            <ul className="finding-list">
              {rows.map((item, index) => (
                <FindingRow key={`${item.result.providerId}-${index}`} finding={item.finding} providerName={item.result.providerName} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function FindingRow({ finding, providerName }: { finding: Finding; providerName: string }) {
  return (
    <li>
      <strong>{finding.title}</strong>
      <span className={statusClass(finding.severity)}>{SEVERITY_LABELS[finding.severity]}</span>
      <p>{finding.description}</p>
      <p className="meta-line">
        Reported by {providerName}
        {finding.domain ? ` · ${DOMAIN_LABELS[finding.domain]}` : " · Unclassified source"}
      </p>
    </li>
  );
}

export function HistoryList({ runs, onOpen }: { runs: ScanResponse[]; onOpen: (run: ScanResponse) => void }) {
  if (runs.length === 0) return <p className="empty">Scans you run on this machine are stored in the local project history.</p>;
  return (
    <ul className="history-list">
      {runs.map((run) => (
        <li key={run.id}>
          <div>
            <strong>{new Date(run.scannedAt).toLocaleString()}</strong>
            <p className="meta-line">{run.token.chainName} · {run.token.address}</p>
            <p className="meta-line">
              {run.results.every((result) => result.changedSincePrevious == null)
                ? "First run for this contract"
                : `${run.results.filter((result) => result.changedSincePrevious === true).length} changed · ${run.results.filter((result) => result.changedSincePrevious === false).length} unchanged`}
            </p>
          </div>
          <button className="button secondary" type="button" onClick={() => onOpen(run)}>View run</button>
        </li>
      ))}
    </ul>
  );
}

export function IntegrationTable({ rows }: { rows: IntegrationRow[] }) {
  if (rows.length === 0) return <p className="empty">The integration list loads from the scan service.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Status</th>
            <th>Configuration</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.name}</strong>
                <p>{row.summary}</p>
                <p className="meta-line">{row.limitations}</p>
              </td>
              <td><span className={statusClass(row.configuration === "manual" ? "manual" : row.configuration)}>{labelForConfiguration(row.configuration)}</span></td>
              <td>
                {row.credentials.length === 0 ? "No server credential." : row.credentials.map((item) => (
                  <p key={item.name}>{item.name}: {item.present ? "present" : "not set"}</p>
                ))}
                <a href={row.docsUrl} target="_blank" rel="noreferrer">Official documentation</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function labelForConfiguration(value: IntegrationRow["configuration"]): string {
  if (value === "connected") return "Connected";
  if (value === "not_configured") return "Not configured";
  if (value === "manual") return "Manual / link-out only";
  return "Error";
}
