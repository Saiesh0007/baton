import { useState } from 'react';
import { useStore } from '../store';
import type { Chunk, Source, Visibility } from '../types';
import { fetchGithub, ingestFile, parseChat, parseGithub, parseNotes, parseTasks, type Ingested } from '../lib/ingest';
import { SAMPLE_FILES } from '../lib/demo';
import { download } from '../meta';
import { fmtDate } from '../lib/text';

const KIND_LABEL: Record<Source['kind'], string> = { notes: 'Notes / docs', chat: 'Chat export', github: 'GitHub', tasks: 'Task records', interview: 'Exit interview' };

export default function Sources({ go }: { go: (p: string) => void }) {
  const { project, update, analysis } = useStore();
  const [tab, setTab] = useState<'github' | 'file' | 'paste'>('github');
  const [vis, setVis] = useState<Visibility>('team');
  const [repo, setRepo] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [paste, setPaste] = useState({ name: '', kind: 'notes' as 'notes' | 'chat' | 'tasks', text: '' });
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!project || !analysis) return null;

  const add = (items: Ingested[]) => {
    const total = items.reduce((n, i) => n + i.chunks.length, 0);
    const red = items.reduce((n, i) => n + i.source.redactions.reduce((m, r) => m + r.count, 0), 0);
    update(
      (p) => ({ ...p, sources: [...p.sources, ...items.map((i) => i.source)], chunks: [...p.chunks, ...items.flatMap((i) => i.chunks)] }),
      `Imported ${items.map((i) => i.source.name).join(', ')} (${total} events, ${red} values masked)`,
    );
    setErr('');
  };

  const importRepo = async () => {
    setErr(''); setBusy('Connecting to GitHub…');
    try {
      const gh = await fetchGithub(repo, setBusy);
      add([parseGithub(gh, vis)]);
      setRepo('');
    } catch (e) { setErr((e as Error).message); }
    setBusy('');
  };

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr('');
    const out: Ingested[] = [];
    for (const f of Array.from(files)) {
      try {
        if (/\.(docx|pdf)$/i.test(f.name)) throw new Error('.docx/PDF import is planned for Round 3. Please export as Markdown or plain text.');
        out.push(ingestFile(f.name, await f.text(), vis));
      } catch (e) { setErr(`${f.name}: ${(e as Error).message}`); }
    }
    if (out.length) add(out);
  };

  const importPaste = () => {
    try {
      const name = paste.name || (paste.kind === 'notes' ? 'Pasted notes' : paste.kind === 'chat' ? 'Pasted chat export' : 'Pasted tasks');
      const item = paste.kind === 'notes' ? parseNotes(name, paste.text, vis)
        : paste.kind === 'chat' ? parseChat(name, JSON.parse(paste.text), vis)
          : parseTasks(name, paste.text, vis);
      add([item]);
      setPaste({ name: '', kind: paste.kind, text: '' });
    } catch (e) { setErr((e as Error).message); }
  };

  const setVisibility = (id: string, v: Visibility) =>
    update((p) => ({ ...p, sources: p.sources.map((s) => (s.id === id ? { ...s, visibility: v } : s)) }), `Set visibility of "${project.sources.find((s) => s.id === id)?.name}" to ${v === 'leads' ? 'Leads only' : 'Team'}`);

  const remove = (id: string) => {
    const s = project.sources.find((x) => x.id === id);
    if (!confirm(`Remove "${s?.name}" and every claim derived from it?`)) return;
    update((p) => ({ ...p, sources: p.sources.filter((x) => x.id !== id), chunks: p.chunks.filter((c) => c.sourceId !== id) }), `Removed source "${s?.name}"`);
  };

  const claimCount = (sid: string) => analysis.claims.filter((c) => c.evidence.some((e) => analysis.chunkById.get(e.chunkId)?.sourceId === sid)).length;

  return (
    <div className="stack">
      <div className="card">
        <div className="row between wrap">
          <div>
            <div className="kicker">Step 1 · Connect</div>
            <h2>Sources &amp; access</h2>
          </div>
          {project.sources.length > 0 && <button className="btn primary" onClick={() => go('ledger')}>See claim ledger →</button>}
        </div>
        <p className="muted">
          Everything is normalised into events (who, when, text, link). API keys, tokens, emails and phone numbers are masked <b>before</b>{' '}
          anything is stored or analysed. Each source has a visibility: <b>Team</b> (the successor can see it) or <b>Leads only</b>{' '}
          (the successor sees a “knowledge shadow” instead of the content).
        </p>

        <div className="tabs">
          <button className={tab === 'github' ? 'on' : ''} onClick={() => setTab('github')}>GitHub repo</button>
          <button className={tab === 'file' ? 'on' : ''} onClick={() => setTab('file')}>Upload files</button>
          <button className={tab === 'paste' ? 'on' : ''} onClick={() => setTab('paste')}>Paste text</button>
          <div className="spacer" />
          <label className="inline">Visibility for new source
            <select value={vis} onChange={(e) => setVis(e.target.value as Visibility)}>
              <option value="team">Team (successor can see)</option>
              <option value="leads">Leads only (restricted)</option>
            </select>
          </label>
        </div>

        {tab === 'github' && (
          <div className="form">
            <label>Public repository (owner/name or URL). Read-only, no login. Imports recent commits, issues, PRs and the README.
              <div className="row gap">
                <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="e.g. sindresorhus/is-online" onKeyDown={(e) => e.key === 'Enter' && repo && importRepo()} />
                <button className="btn primary" disabled={!repo || !!busy} onClick={importRepo}>{busy ? 'Importing…' : 'Import'}</button>
              </div>
            </label>
            {busy && <div className="muted small">{busy}</div>}
          </div>
        )}
        {tab === 'file' && (
          <div className="form">
            <label className="drop">
              <input type="file" multiple accept=".md,.txt,.markdown,.json,.csv" onChange={(e) => { importFiles(e.target.files); e.target.value = ''; }} />
              <span><b>Choose files</b> or drop them here: <code>.md</code>/<code>.txt</code> notes, Discord/Slack <code>.json</code> exports, task <code>.csv</code> (title, status, assignee, due), or a GitHub export <code>.json</code>.</span>
            </label>
            <div className="muted small">
              Need test files? Download the samples:{' '}
              {SAMPLE_FILES.map((f) => (
                <button key={f.name} className="link" onClick={() => download(f.name, f.content)}>{f.name}</button>
              ))}
            </div>
          </div>
        )}
        {tab === 'paste' && (
          <div className="form">
            <div className="grid2">
              <label>Source name<input value={paste.name} onChange={(e) => setPaste({ ...paste, name: e.target.value })} placeholder="e.g. Sprint retro notes" /></label>
              <label>Format
                <select value={paste.kind} onChange={(e) => setPaste({ ...paste, kind: e.target.value as typeof paste.kind })}>
                  <option value="notes">Notes / document (Markdown or text)</option>
                  <option value="chat">Chat export (Discord/Slack JSON)</option>
                  <option value="tasks">Task records (CSV)</option>
                </select>
              </label>
            </div>
            <textarea rows={8} value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} placeholder={paste.kind === 'notes' ? '## 12 Oct 2026\n- We decided to move the API to Render because…\n- Riya owns the payments module.\n- TODO: rotate the SMTP password before handover.' : paste.kind === 'tasks' ? 'title,status,assignee,due\nPayments refactor,In progress,Riya,2026-11-30' : '{ "messages": [ { "author": { "name": "Riya" }, "timestamp": "2026-10-01T10:00:00Z", "content": "we are switching to Postgres" } ] }'} />
            <div><button className="btn primary" disabled={!paste.text.trim()} onClick={importPaste}>Import</button></div>
          </div>
        )}
        {err && <div className="alert bad">{err}</div>}
      </div>

      <div className="card">
        <h3>Connected sources ({project.sources.length})</h3>
        {!project.sources.length && <p className="muted">No sources yet. Import a GitHub repo or upload files above.</p>}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Source</th><th>Type</th><th>Events</th><th>Claims</th><th>Masked at import</th><th>Visibility</th><th /></tr></thead>
            <tbody>
              {project.sources.map((s) => {
                const ev = project.chunks.filter((c) => c.sourceId === s.id);
                return (
                  <SourceRow key={s.id} s={s} ev={ev} claims={claimCount(s.id)} expanded={expanded === s.id}
                    toggle={() => setExpanded(expanded === s.id ? null : s.id)} setVisibility={setVisibility} remove={remove} />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SourceRow({ s, ev, claims, expanded, toggle, setVisibility, remove }: {
  s: Source; ev: Chunk[]; claims: number; expanded: boolean; toggle: () => void;
  setVisibility: (id: string, v: Visibility) => void; remove: (id: string) => void;
}) {
  const red = s.redactions.reduce((n, r) => n + r.count, 0);
  return (
    <>
      <tr>
        <td><button className="link" onClick={toggle}>{expanded ? '▾' : '▸'} {s.name}</button>{s.synthetic && <span className="pill p-grey" style={{ marginLeft: 6 }}>synthetic</span>}</td>
        <td>{KIND_LABEL[s.kind]}</td>
        <td>{ev.length}</td>
        <td>{claims}</td>
        <td>{red ? s.redactions.map((r) => `${r.count} ${r.type}`).join(', ') : <span className="muted">none</span>}</td>
        <td>
          <select value={s.visibility} onChange={(e) => setVisibility(s.id, e.target.value as Visibility)} className={s.visibility === 'leads' ? 'restricted' : ''}>
            <option value="team">Team</option>
            <option value="leads">Leads only</option>
          </select>
        </td>
        <td><button className="btn ghost sm" onClick={() => remove(s.id)}>Remove</button></td>
      </tr>
      {expanded && (
        <tr className="sub">
          <td colSpan={7}>
            <div className="events">
              {ev.slice(0, 80).map((c) => (
                <div key={c.id} className="event">
                  <span className="muted small">{c.ref}{c.author ? ` · ${c.author}` : ''}{c.ts ? ` · ${fmtDate(c.ts)}` : ''}</span>
                  <div>{c.text}</div>
                </div>
              ))}
              {ev.length > 80 && <div className="muted small">…and {ev.length - 80} more</div>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
