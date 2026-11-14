import { useState } from 'react';
import { useStore } from '../store';
import type { Project, Workstream } from '../types';
import { uid, fmtDate } from '../lib/text';
import { Tick } from '../ui';

function parseWorkstreams(text: string): Workstream[] {
  const ws = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, kw = ''] = l.split(':');
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid('ws');
    return { id, name: name.trim(), keywords: kw.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean) };
  });
  if (!ws.some((w) => w.id === 'general')) ws.push({ id: 'general', name: 'General', keywords: [] });
  return ws;
}

/** Two real rows from the demo ledger, shown as the product's own output. */
function Specimen() {
  return (
    <figure className="specimen" aria-label="Two rows from the demo claim ledger">
      <figcaption className="mono">Claim ledger · Spark Fest tech team</figcaption>
      <div className="claim st-corroborated">
        <div className="margin"><Tick s="corroborated" /></div>
        <div className="claim-body">
          <header className="claim-meta"><span className="stl stl-corroborated">Corroborated</span><span className="ttag">Decision</span><span className="muted">Fest website</span></header>
          <p className="claim-text">We decided to host the fest website on Netlify instead of the college server, because the college server went down twice last year.</p>
          <ul className="ev-list">
            <li><div className="ev"><span className="ev-mark yes">✓</span><q className="ev-quote">We decided to host the fest website on Netlify instead of the college server</q><span className="ev-src">Core meeting notes · line 7 · 02 Sept 2026</span></div></li>
            <li><div className="ev"><span className="ev-mark yes">✓</span><q className="ev-quote">chore: move fest website deploy to Netlify</q><span className="ev-src">GitHub · commit 3d7e9a0 · Meera · 17 Sept 2026</span></div></li>
          </ul>
        </div>
      </div>
      <div className="claim st-conflicting">
        <div className="margin"><Tick s="conflicting" /></div>
        <div className="claim-body">
          <header className="claim-meta"><span className="stl stl-conflicting">Conflicting</span><span className="ttag">Decision</span><span className="muted">Registration app</span></header>
          <p className="claim-text">We're dropping razorpay for now, UPI QR is enough for this fest.</p>
          <ul className="ev-list">
            <li><div className="ev"><span className="ev-mark yes">✓</span><q className="ev-quote">feat: re-enable razorpay webhook for workshop payments</q><span className="ev-src">GitHub · PR #48 (merged) · Aarav · 20 Sept 2026</span></div></li>
          </ul>
          <p className="spec-note">Becomes a question for Aarav before he leaves.</p>
        </div>
      </div>
    </figure>
  );
}

export default function Home() {
  const { projects, open, addProject, removeProject, resetDemo, setRole } = useStore();
  const [showNew, setShowNew] = useState(false);
  const [f, setF] = useState({
    name: '', leaver: '', successor: '', reviewer: '',
    ws: 'Backend: api, server, database, auth\nFrontend: ui, page, react, css\nDeployment: deploy, ci, docker, hosting',
  });
  const demo = projects.find((p) => p.isDemo);
  const mine = projects.filter((p) => !p.isDemo);

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
        <div className="hero-copy">
          <h1>When someone leaves, the why shouldn't leave with them.</h1>
          <p className="lead">
            Baton reads a team's scattered activity (meeting notes, chat exports, GitHub history, task boards) and turns it into a
            claim ledger. Every statement carries a quote, checked word-for-word against its source. Gaps and contradictions become
            a short exit interview for the person leaving. A reviewer approves each claim, and the successor gets a role-filtered
            handover with a first-week plan.
          </p>
          <div className="row gap wrap">
            <button className="btn primary lg" onClick={() => { setRole('reviewer'); if (demo) open(demo.id); else resetDemo(); }}>Open the demo handover →</button>
            <button className="btn lg" onClick={() => setShowNew(true)}>Start your own</button>
          </div>
          <p className="muted small demo-note">
            The demo: Aarav is graduating and hands the fest registration app, website and certificates to Diya. Prof. Joshi reviews.
            Five synthetic sources, with planted contradictions, missing owners, a leaked token and a leads-only channel. About 3 minutes.
            {demo && <> <button className="link small" onClick={resetDemo} title="Discard demo changes">Reset demo</button></>}
          </p>
        </div>
        <Specimen />
      </section>

      {showNew && (
        <section className="card new">
          <div className="card-head">
            <h2>Start a new handover</h2>
            <button className="btn ghost sm" onClick={() => setShowNew(false)}>Cancel</button>
          </div>
          <p className="muted">Import a public GitHub repo, Markdown or text notes, a Discord/Slack JSON export, or a task CSV. Everything stays in your browser.</p>
          <div className="form">
            <label>Project / handover name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Robotics club website, Riya → Sam" /></label>
            <div className="grid3">
              <label>Leaving<input value={f.leaver} onChange={(e) => setF({ ...f, leaver: e.target.value })} placeholder="Name" /></label>
              <label>Taking over<input value={f.successor} onChange={(e) => setF({ ...f, successor: e.target.value })} placeholder="Name" /></label>
              <label>Reviewer<input value={f.reviewer} onChange={(e) => setF({ ...f, reviewer: e.target.value })} placeholder="Name" /></label>
            </div>
            <label>
              Workstreams, one per line as <code>Name: keyword, keyword</code>. Keywords route claims to a workstream.
              <textarea rows={4} value={f.ws} onChange={(e) => setF({ ...f, ws: e.target.value })} />
            </label>
            <div><button className="btn primary" onClick={create}>Create handover</button></div>
          </div>
        </section>
      )}

      {mine.length > 0 && (
        <section className="card">
          <h3>Your handovers</h3>
          <table className="tbl">
            <tbody>
              {mine.map((p) => (
                <tr key={p.id}>
                  <td><button className="link" onClick={() => open(p.id)}>{p.name}</button></td>
                  <td className="muted">{p.people.leaver} → {p.people.successor}</td>
                  <td className="muted num">{p.sources.length} sources</td>
                  <td className="muted mono">{fmtDate(p.createdAt)}</td>
                  <td><button className="btn ghost sm" onClick={() => { if (confirm(`Delete "${p.name}" and all its derived data?`)) removeProject(p.id); }}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="how">
        <ol className="flow">
          <li><span className="mono">1</span><b>Connect sources</b><span className="muted">Notes, chats, GitHub, tasks. Secrets are masked before anything is stored.</span></li>
          <li><span className="mono">2</span><b>Reconstruct and verify</b><span className="muted">Claims are proposed, then every quote is checked against the stored text.</span></li>
          <li><span className="mono">3</span><b>Ask the leaver</b><span className="muted">Only the gaps and conflicts the evidence can't settle.</span></li>
          <li><span className="mono">4</span><b>Review and approve</b><span className="muted">A human approves, edits or rejects each claim.</span></li>
          <li><span className="mono">5</span><b>Handover</b><span className="muted">The successor sees approved claims, a first-week plan and who to ask.</span></li>
        </ol>
        <div className="principles">
          <div><h4>Traceable</h4><p>A claim is “Cited” only if its quote exists word-for-word in the stored source. Status is set by code, never by the model's own confidence.</p></div>
          <div><h4>Honest about gaps</h4><p>A template per workstream (owner, status, decision, risks, next action) makes missing knowledge visible, and each gap becomes a targeted question.</p></div>
          <div><h4>Permission-aware</h4><p>Sources marked “Leads only” are filtered out before the successor view is built. Restricted claims show up as a “knowledge shadow” with someone to ask.</p></div>
        </div>
      </section>
    </div>
  );
}
