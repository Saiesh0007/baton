import { useState } from 'react';
import { useStore } from '../store';
import type { Project, Workstream } from '../types';
import { uid, fmtDate } from '../lib/text';

function parseWorkstreams(text: string): Workstream[] {
  const ws = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, kw = ''] = l.split(':');
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid('ws');
    return { id, name: name.trim(), keywords: kw.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean) };
  });
  if (!ws.some((w) => w.id === 'general')) ws.push({ id: 'general', name: 'General', keywords: [] });
  return ws;
}

export default function Home() {
  const { projects, open, addProject, removeProject, resetDemo, setRole } = useStore();
  const [showNew, setShowNew] = useState(false);
  const [f, setF] = useState({
    name: '', leaver: '', successor: '', reviewer: '',
    ws: 'Backend: api, server, database, auth\nFrontend: ui, page, react, css\nDeployment: deploy, ci, docker, hosting',
  });
  const demo = projects.find((p) => p.isDemo);

  const create = () => {
    const now = new Date().toISOString();
    const p: Project = {
      id: uid('prj'), name: f.name || 'Untitled handover', description: '',
      people: { leaver: f.leaver || 'Leaver', successor: f.successor || 'Successor', reviewer: f.reviewer || 'Reviewer' },
      workstreams: parseWorkstreams(f.ws), sources: [], chunks: [], answers: {}, reviews: {}, manualClaims: [],
      acks: {}, successorQuestions: [], audit: [{ ts: now, actor: f.reviewer || 'Reviewer', action: 'Handover created' }], createdAt: now,
    };
    setRole('reviewer');
    addProject(p);
  };

  return (
    <div className="home">
      <section className="hero">
        <div className="kicker">Evidence-first knowledge handover</div>
        <h1>When someone leaves, the <em>why</em> shouldn't leave with them.</h1>
        <p className="lead">
          Baton reads a team's scattered activity (meeting notes, chat exports, GitHub history, task boards) and turns it into a
          <b> claim ledger</b>: every statement carries a quote that is checked word-for-word against its source. Gaps and
          contradictions become a short exit interview for the person leaving. A reviewer approves each claim, and the
          successor gets a role-filtered handover with a first-week plan.
        </p>
        <ol className="flow">
          <li><b>1</b> Connect sources</li>
          <li><b>2</b> Reconstruct + verify</li>
          <li><b>3</b> Ask the leaver</li>
          <li><b>4</b> Review &amp; approve</li>
          <li><b>5</b> Handover</li>
        </ol>
      </section>

      <section className="grid2">
        <div className="card accent">
          <div className="kicker">Fastest way to try it · 3 minutes</div>
          <h2>Open the demo handover</h2>
          <p>
            A fictional college tech team: <b>Aarav</b> (graduating) hands the fest registration app, website and certificates to
            <b> Diya</b>. <b>Prof. Joshi</b> reviews. Five synthetic sources are already imported, with planted contradictions,
            missing owners, a leaked token and a leads-only channel.
          </p>
          <div className="row gap">
            <button className="btn primary" onClick={() => { setRole('reviewer'); if (demo) open(demo.id); else resetDemo(); }}>
              Open demo →
            </button>
            {demo && <button className="btn ghost" onClick={resetDemo} title="Discard demo changes">Reset demo</button>}
          </div>
        </div>

        <div className="card">
          <div className="kicker">Use your own data</div>
          <h2>Start a new handover</h2>
          {!showNew ? (
            <>
              <p>Import a public GitHub repo, Markdown or text notes, a Discord/Slack JSON export, or a task CSV. Everything stays in your browser.</p>
              <button className="btn" onClick={() => setShowNew(true)}>New handover</button>
            </>
          ) : (
            <div className="form">
              <label>Project / handover name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Robotics club website — Riya → Sam" /></label>
              <div className="grid3">
                <label>Leaving<input value={f.leaver} onChange={(e) => setF({ ...f, leaver: e.target.value })} placeholder="Name" /></label>
                <label>Taking over<input value={f.successor} onChange={(e) => setF({ ...f, successor: e.target.value })} placeholder="Name" /></label>
                <label>Reviewer<input value={f.reviewer} onChange={(e) => setF({ ...f, reviewer: e.target.value })} placeholder="Name" /></label>
              </div>
              <label>
                Workstreams <span className="muted small">(one per line: <code>Name: keyword, keyword</code>). Keywords route claims to a workstream.</span>
                <textarea rows={4} value={f.ws} onChange={(e) => setF({ ...f, ws: e.target.value })} />
              </label>
              <div className="row gap">
                <button className="btn primary" onClick={create}>Create</button>
                <button className="btn ghost" onClick={() => setShowNew(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {projects.filter((p) => !p.isDemo).length > 0 && (
        <section className="card">
          <h3>Your handovers</h3>
          <table className="tbl">
            <tbody>
              {projects.filter((p) => !p.isDemo).map((p) => (
                <tr key={p.id}>
                  <td><button className="link" onClick={() => open(p.id)}>{p.name}</button></td>
                  <td className="muted">{p.people.leaver} → {p.people.successor}</td>
                  <td className="muted">{p.sources.length} sources</td>
                  <td className="muted">{fmtDate(p.createdAt)}</td>
                  <td><button className="btn ghost sm" onClick={() => { if (confirm(`Delete "${p.name}" and all its derived data?`)) removeProject(p.id); }}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="grid3 principles">
        <div><h4>Traceable</h4><p>A claim is “Cited” only if its quote exists word-for-word in the stored source. Status is set by code, never by the model's own confidence.</p></div>
        <div><h4>Honest about gaps</h4><p>A template per workstream (owner, status, decision, risks, next action) makes missing knowledge visible, and each gap becomes a targeted question.</p></div>
        <div><h4>Permission-aware</h4><p>Sources marked “Leads only” are filtered out before the successor view is built. Restricted claims show up as a “knowledge shadow” with someone to ask.</p></div>
      </section>
    </div>
  );
}
