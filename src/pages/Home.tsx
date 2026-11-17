import { useRef, useState } from 'react';
import { newLlmState } from '../lib/llm';
import { useStore } from '../store';
import type { Project, Workstream } from '../types';
import { uid, fmtDate } from '../lib/text';
import Stage from '../components/Stage';
import { SharedHandovers } from '../components/Account';
import { CountUp, reducedMotion, useFirstSight } from '../motion';

function parseWorkstreams(text: string): Workstream[] {
  const ws = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, kw = ''] = l.split(':');
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid('ws');
    return { id, name: name.trim(), keywords: kw.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean) };
  });
  if (!ws.some((w) => w.id === 'general')) ws.push({ id: 'general', name: 'General', keywords: [] });
  return ws;
}

/* Real numbers: scripts/eval.ts on the seeded demo, scripts/real.ts on public repos; they count up when they come into view. */
const PROOF: { n: number; of?: number; label: string }[] = [
  { n: 14, of: 14, label: 'planted facts recovered' },
  { n: 2, of: 2, label: 'contradictions caught, no false alarms' },
  { n: 114, of: 114, label: 'quotes verified in 5 real public repos' },
  { n: 0, label: 'secrets left after masking' },
];

function Proof() {
  const [ref, sight] = useFirstSight<HTMLDListElement>();
  return (
    <section className="proof" aria-labelledby="proof-h">
      <h2 id="proof-h">Checked, not claimed</h2>
      <dl ref={ref}>
        {PROOF.map((p) => (
          <div key={p.label}>
            <dt>{p.label}</dt>
            <dd><CountUp value={sight === 'wait' ? 0 : p.n} suffix={p.of !== undefined ? `/${p.of}` : ''} /></dd>
          </div>
        ))}
      </dl>
      <p className="muted small">Measured by <code>scripts/eval.ts</code> on the seeded demo data.</p>
    </section>
  );
}

export default function Home() {
  const { projects, open, addProject, removeProject, resetDemo, setRole, session, createShared, busy } = useStore();
  const [showNew, setShowNew] = useState(false);
  const [shared, setShared] = useState(false);
  const formRef = useRef<HTMLElement>(null);
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
      acks: {}, successorQuestions: [], audit: [{ ts: now, actor: f.reviewer || 'Reviewer', action: 'Handover created' }], createdAt: now, llm: newLlmState(),
    };
    if (shared && session) { createShared(p); return; }
    setRole('reviewer');
    addProject(p);
  };

  const startOwn = (asShared = false) => {
    setShared(asShared && !!session);
    setShowNew(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }));
  };

  return (
    <div className="home">
      <section className="stage">
        <div className="stage-in wrap">
          <div className="stage-copy">
            <h1>When someone leaves, the why shouldn't leave with&nbsp;them.</h1>
            <p className="stage-lead">Baton rebuilds a project from its chats, commits and notes, and backs every line with a quote you can check.</p>
            <div className="row gap wrap">
              <button className="btn primary lg" onClick={() => { setRole('reviewer'); if (demo) open(demo.id); else resetDemo(); }}>Open the demo →</button>
              <button className="btn lg on-dark" onClick={() => startOwn(!!session)}>Start your own</button>
            </div>
            <p className="stage-note">Aarav graduates, Diya takes over. Synthetic data, about 3 minutes.
              {demo && <> <button className="link" onClick={resetDemo} title="Discard changes to the demo">Reset demo</button></>}
            </p>
          </div>
          <Stage />
        </div>
      </section>

      <div className="wrap home-body">
        {showNew && (
          <section ref={formRef} className="card new">
            <div className="card-head">
              <h2>Start a new handover</h2>
              <button className="btn ghost sm" onClick={() => setShowNew(false)}>Cancel</button>
            </div>
            <p className="muted">GitHub repos, notes, chat exports or task CSVs.</p>
            {session ? (
              <div className="seg-ctl" role="group" aria-label="Where to keep it">
                <button className={shared ? 'on' : ''} onClick={() => setShared(true)}>Shared with my team</button>
                <button className={!shared ? 'on' : ''} onClick={() => setShared(false)}>Only in this browser</button>
              </div>
            ) : <p className="muted small">It stays in this browser. Sign in below to share a handover with your team.</p>}
            <div className="form">
              <label>Handover name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Robotics club website, Riya → Sam" /></label>
              <div className="grid3">
                <label>Leaving<input value={f.leaver} onChange={(e) => setF({ ...f, leaver: e.target.value })} placeholder="Name" /></label>
                <label>Taking over<input value={f.successor} onChange={(e) => setF({ ...f, successor: e.target.value })} placeholder="Name" /></label>
                <label>Reviewer<input value={f.reviewer} onChange={(e) => setF({ ...f, reviewer: e.target.value })} placeholder="Name" /></label>
              </div>
              <label>
                Workstreams, one per line as <code>Name: keyword, keyword</code>
                <textarea rows={4} value={f.ws} onChange={(e) => setF({ ...f, ws: e.target.value })} />
              </label>
              <div><button className="btn primary" disabled={!!busy} onClick={create}>{busy || (shared && session ? 'Create shared handover' : 'Create handover')}</button></div>
            </div>
          </section>
        )}

        {mine.length > 0 && (
          <section className="card">
            <h3>In this browser</h3>
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

        <SharedHandovers onNew={() => startOwn(true)} />

        <Proof />

        <section className="trio">
          <div><h3>Traceable</h3><p>Status comes from code that checks the quote, never from a model's confidence.</p></div>
          <div><h3>Honest about gaps</h3><p>Missing owners and contradictions become questions for the leaver, not guesses.</p></div>
          <div><h3>Permission-aware</h3><p>In shared handovers the database itself withholds leads-only sources: they never reach the successor's browser or the LLM.</p></div>
        </section>
      </div>
    </div>
  );
}
