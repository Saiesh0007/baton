import { useState } from 'react';
import { useStore } from '../store';
import type { Source } from '../types';
import { fetchGithub, ingestFile, parseChat, parseGithub, parseNotes, parseTasks, type Ingested } from '../lib/ingest';
import { applyResync, githubRepoOf, type ResyncSummary } from '../lib/resync';
import { DEMO_NOTES_UPDATE } from '../lib/demo';
import { DiffText } from './DiffText';
import { fmtDate } from '../lib/text';

/**
 * Re-import one source and show what changed. Approved claims whose source text changed go back
 * to the review queue (analyze() does that from the approval's stored basis).
 */
export default function ResyncPanel({ s, close, go }: { s: Source; close: () => void; go: (p: string) => void }) {
  const { project, update, actorName } = useStore();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState<ResyncSummary | null>(null);
  if (!project) return null;
  const repo = githubRepoOf(s);
  const demoNotes = project.isDemo && s.kind === 'notes';
  const canPaste = s.kind === 'notes' || s.kind === 'chat' || s.kind === 'tasks';

  const apply = (fresh: Ingested) => {
    if (!fresh.chunks.length) throw new Error('The new version is empty, so nothing was changed. Remove the source instead if it is gone.');
    // applyResync is pure: the summary comes from the project as shown, and the same call inside the
    // updater applies it to the latest state (an LLM batch may have landed in between)
    const ts = new Date().toISOString();
    const { summary } = applyResync(project, s.id, fresh, actorName, ts);
    update((p) => applyResync(p, s.id, fresh, actorName, ts).project);
    setResult(summary);
    setText('');
  };

  const run = async (label: string, get: () => Promise<Ingested> | Ingested) => {
    if (busy) return; // a second click while working does nothing
    setErr(''); setResult(null); setBusy(label);
    try { apply(await get()); } catch (e) { setErr((e as Error).message); }
    setBusy('');
  };

  const parseAs = (content: string): Ingested => {
    if (s.kind === 'notes') return parseNotes(s.name, content, s.visibility);
    if (s.kind === 'tasks') return parseTasks(s.name, content, s.visibility);
    if (s.kind === 'chat') {
      let data: unknown;
      try { data = JSON.parse(content); } catch { throw new Error('That is not valid JSON. A chat source needs a Discord or Slack JSON export.'); }
      return parseChat(s.name, data, s.visibility);
    }
    throw new Error('Paste is not available for this kind of source.');
  };

  const fromFile = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    await run('Reading file…', async () => {
      if (/\.(docx|pdf)$/i.test(f.name)) throw new Error('.docx and PDF files cannot be read yet. Export as Markdown or plain text.');
      const content = await f.text();
      const item = s.kind === 'github' ? ingestFile(f.name, content, s.visibility) : parseAs(content);
      if (item.source.kind !== s.kind) throw new Error(`That file looks like ${item.source.kind}, but this source is ${s.kind}. Pick the newer version of the same source.`);
      return item;
    });
  };

  const last = s.syncs?.[s.syncs.length - 1];
  return (
    <div className="resync" role="region" aria-label={`Re-sync ${s.name}`}>
      <div className="row between wrap">
        <b>Re-sync “{s.name}”</b>
        <button className="btn ghost xs" onClick={close} aria-label="Close re-sync">Close</button>
      </div>
      <p className="muted small">Import the newer version of this source. Only changed text is re-read; approved claims whose quote changed or disappeared go back to review.
        {last && <> Last re-synced {fmtDate(last.ts)} by {last.by}.</>}</p>

      <div className="row gap wrap">
        {repo && <button className="btn primary sm" disabled={!!busy} onClick={() => run('Fetching from GitHub…', async () => parseGithub(await fetchGithub(repo, setBusy), s.visibility))}>Fetch latest from GitHub ({repo})</button>}
        {demoNotes && <button className="btn primary sm" disabled={!!busy} onClick={() => run('Applying sample update…', () => parseNotes(s.name, DEMO_NOTES_UPDATE, s.visibility))}>Use the sample update (same notes, three weeks later)</button>}
        <label className={`btn sm ${busy ? 'disabled' : ''}`}>
          Upload newer version
          <input type="file" hidden disabled={!!busy} accept=".md,.txt,.markdown,.json,.csv" onChange={(e) => { fromFile(e.target.files); e.target.value = ''; }} />
        </label>
      </div>
      {demoNotes && !Object.values(project.reviews).some((r) => r.state === 'approved') && (
        <p className="muted small">Tip: approve a few claims first (for example the Netlify decision) to see them come back for re-review.</p>
      )}
      {canPaste && (
        <details className="resync-paste">
          <summary className="small">…or paste the newer version</summary>
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={s.kind === 'chat' ? 'Discord/Slack JSON export' : s.kind === 'tasks' ? 'title,status,assignee,due' : 'The full, updated text of this source'} />
          <button className="btn sm" disabled={!text.trim() || !!busy} onClick={() => run('Comparing…', () => parseAs(text))}>Compare and re-sync</button>
        </details>
      )}
      {busy && <div className="muted small" role="status">{busy}</div>}
      {err && <div className="alert bad">{err}</div>}

      {result && (
        <div className="resync-result" role="status">
          <div>
            {result.added + result.changed + result.removed === 0
              ? <b>No changes. Everything already matched.</b>
              : <b>{result.added} new · {result.changed} changed · {result.removed} removed · {result.unchanged} unchanged</b>}
            {result.flagged > 0 && <> · <span className="pill-stale"><b>{result.flagged}</b> approved claim{result.flagged > 1 ? 's' : ''} need re-review</span></>}
          </div>
          {result.changes.slice(0, 5).map((c) => (
            <p key={c.id} className="stale-diff mono small"><span className="muted">{c.ref}: </span><DiffText before={c.before} after={c.after} /></p>
          ))}
          {result.changes.length > 5 && <p className="muted small">…and {result.changes.length - 5} more changed events.</p>}
          {result.removedRefs.length > 0 && <p className="muted small">Removed: {result.removedRefs.slice(0, 8).join(', ')}{result.removedRefs.length > 8 ? '…' : ''}</p>}
          {result.flagged > 0 && <button className="btn primary sm" onClick={() => go('review')}>Review the flagged claims →</button>}
        </div>
      )}
    </div>
  );
}
