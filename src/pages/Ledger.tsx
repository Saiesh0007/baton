import { useState } from 'react';
import { useStore } from '../store';
import type { ClaimStatus, ClaimType } from '../types';
import ClaimCard from '../components/ClaimCard';
import ProposerPanel from '../components/ProposerPanel';
import { BandStat, Empty, EvidenceList, Tick } from '../ui';
import { STATUS_META, TYPE_LABEL } from '../meta';
import { Explain } from '../motion';
import { fmtDate } from '../lib/text';

export default function Ledger({ go }: { go: (p: string) => void }) {
  const { project, analysis } = useStore();
  const [ws, setWs] = useState('all');
  const [st, setSt] = useState<'all' | ClaimStatus>('all');
  const [ty, setTy] = useState<'all' | ClaimType>('all');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'claims' | 'timeline'>('claims');
  const [showSuperseded, setShowSuperseded] = useState(false);
  if (!project || !analysis) return null;
  const a = analysis;
  const wsName = new Map(project.workstreams.map((w) => [w.id, w.name]));

  if (!project.sources.length) {
    return <Empty title="No sources yet"><p>Connect at least one source to reconstruct the project.</p><button className="btn primary" onClick={() => go('sources')}>Connect sources</button></Empty>;
  }

  const list = a.claims
    .filter((c) => showSuperseded || !c.superseded)
    .filter((c) => ws === 'all' || c.workstream === ws)
    .filter((c) => st === 'all' || c.status === st)
    .filter((c) => ty === 'all' || c.type === ty)
    .filter((c) => !q || c.statement.toLowerCase().includes(q.toLowerCase()));

  const decisions = a.claims.filter((c) => c.type === 'decision' && c.date).sort((x, y) => (x.date! < y.date! ? -1 : 1));

  return (
    <div className="stack">
      <div className="card band">
        <div className="row between wrap band-head">
          <div>
            <div className="kicker">Steps 2–3 · Reconstruct &amp; verify</div>
            <h2>Claim ledger</h2>
          </div>
          <BandStat n={a.claims.filter((c) => !c.superseded).length} label="claims, each with its evidence status">
            <span className="band-ticks">
              {(Object.keys(STATUS_META) as ClaimStatus[]).filter((s) => a.stats[s]).map((s) => <span key={s}><Tick s={s} /> {a.stats[s]}</span>)}
            </span>
          </BandStat>
        </div>
        <div className="row between wrap band-tools">
          <span />
          <div className="seg-ctl">
            <button className={view === 'claims' ? 'on' : ''} onClick={() => setView('claims')}>Claims</button>
            <button className={view === 'timeline' ? 'on' : ''} onClick={() => setView('timeline')}>Decision timeline</button>
          </div>
        </div>
        <p className="lede">Every claim, with the quotes that prove it. Click a quote to see it in its source.</p>
        <ProposerPanel compact />
        <Explain><p>The extractor <i>proposes</i> atomic claims (decision, owner, status, risk, dependency, next action, recurring issue, contact),
          each with a quote. The verifier then checks every quote word-for-word against the stored source text, groups duplicates across
          sources (corroboration) and compares claims on the same topic for contradictions. Click any quote to see it in its source.</p></Explain>
        {view === 'claims' && (
          <div className="filters">
            <select value={ws} onChange={(e) => setWs(e.target.value)}>
              <option value="all">All workstreams</option>
              {project.workstreams.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select value={st} onChange={(e) => setSt(e.target.value as typeof st)}>
              <option value="all">All statuses</option>
              {(Object.keys(STATUS_META) as ClaimStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label} ({a.stats[s]})</option>)}
            </select>
            <select value={ty} onChange={(e) => setTy(e.target.value as typeof ty)}>
              <option value="all">All types</option>
              {(Object.keys(TYPE_LABEL) as ClaimType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <input placeholder="Search claims…" value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="inline"><input type="checkbox" checked={showSuperseded} onChange={(e) => setShowSuperseded(e.target.checked)} /> show superseded</label>
          </div>
        )}
      </div>

      {view === 'claims' ? (
        <div className="claims">
          {list.length === 0 && <p className="muted">No claims match these filters.</p>}
          {list.map((c) => <ClaimCard key={c.id} c={c} a={a} wsName={wsName.get(c.workstream)} />)}
        </div>
      ) : (
        <div className="card">
          <h3>Decisions over time</h3>
          {!decisions.length && <p className="muted">No dated decisions found.</p>}
          <ol className="timeline">
            {decisions.map((c) => (
              <li key={c.id} className={`st-${c.status}`}>
                <div className="tl-date">{fmtDate(c.date)}</div>
                <div className="tl-body">
                  <div className="row gap wrap"><b>{wsName.get(c.workstream)}</b> <span className={`pill p-${STATUS_META[c.status].cls}`}>{STATUS_META[c.status].label}</span>{c.conflictWith.length > 0 && <span className="pill p-bad">reversal / conflict</span>}{c.superseded && <span className="pill p-grey">superseded</span>}</div>
                  <p className="claim-text sm">{c.statement}</p>
                  <EvidenceList claim={c} chunkById={a.chunkById} sourceById={a.sourceById} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
