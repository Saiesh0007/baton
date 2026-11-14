import { useState } from 'react';
import { useStore } from '../store';
import type { Claim, ClaimType, ReviewRecord, ReviewState } from '../types';
import ClaimCard from '../components/ClaimCard';
import { riskRank } from '../lib/analyze';
import { Empty } from '../ui';
import { TYPE_LABEL } from '../meta';
import { fmtDate, uid } from '../lib/text';

export default function Review({ go }: { go: (p: string) => void }) {
  const { project, analysis, update, role, actorName } = useStore();
  const [filter, setFilter] = useState<'pending' | 'all' | 'approved' | 'rejected'>('pending');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<string | null>(null);
  const [manual, setManual] = useState({ open: false, workstream: '', type: 'decision' as ClaimType, statement: '', quote: '' });
  if (!project || !analysis) return null;
  const a = analysis;
  const wsName = new Map(project.workstreams.map((w) => [w.id, w.name]));
  const isReviewer = role === 'reviewer';

  const live = a.claims.filter((c) => !c.superseded);
  const queue = live
    .filter((c) => filter === 'all' || c.review === filter)
    .sort((x, y) => riskRank(x) - riskRank(y));
  const counts = { pending: live.filter((c) => c.review === 'pending').length, approved: live.filter((c) => c.review === 'approved').length, rejected: live.filter((c) => c.review === 'rejected').length };

  const blockReason = (c: Claim) =>
    c.status === 'inferred' && !c.edited ? 'Inferred claims need a human edit before approval.'
      : c.status === 'conflicting' && !c.edited ? 'Unresolved conflict: ask the leaver (exit interview) or edit it first.'
        : '';

  const setReview = (c: Claim, state: ReviewState, statement?: string) => {
    const prev = project.reviews[c.id];
    const rec: ReviewRecord = {
      state,
      statement: statement ?? prev?.statement,
      versions: [...(prev?.versions ?? []), { statement: statement ?? c.statement, by: actorName, ts: new Date().toISOString(), action: statement !== undefined ? 'edit' : state }],
    };
    update((p) => ({ ...p, reviews: { ...p.reviews, [c.id]: rec } }), `${statement !== undefined ? 'Edited' : state === 'approved' ? 'Approved' : state === 'rejected' ? 'Rejected' : 'Reset'} claim: "${(statement ?? c.statement).slice(0, 70)}"`);
  };

  const bulkApprove = () => {
    const ok = live.filter((c) => c.review === 'pending' && !blockReason(c) && (c.status === 'corroborated' || c.status === 'attested'));
    if (!ok.length) return;
    update((p) => {
      const reviews = { ...p.reviews };
      const ts = new Date().toISOString();
      ok.forEach((c) => { reviews[c.id] = { state: 'approved', statement: p.reviews[c.id]?.statement, versions: [...(p.reviews[c.id]?.versions ?? []), { statement: c.statement, by: actorName, ts, action: 'approved' }] }; });
      return { ...p, reviews };
    }, `Bulk-approved ${ok.length} Corroborated / Leaver-attested claims`);
  };

  const addManual = () => {
    if (!manual.statement.trim()) return;
    const ws = manual.workstream || project.workstreams[0]?.id || 'general';
    update((p) => ({ ...p, manualClaims: [...p.manualClaims, { id: uid('man'), workstream: ws, type: manual.type, statement: manual.statement.trim(), quote: manual.quote.trim() || undefined, ts: new Date().toISOString() }] }), `Added manual claim: "${manual.statement.slice(0, 60)}"`);
    setManual({ open: false, workstream: '', type: 'decision', statement: '', quote: '' });
  };

  const publish = () => {
    const included = live.filter((c) => c.review === 'approved');
    const chunkIds = new Set(included.flatMap((c) => c.evidence.map((e) => e.chunkId)));
    const version = (project.published?.version ?? 0) + 1;
    update((p) => ({
      ...p,
      published: {
        version, ts: new Date().toISOString(), by: actorName,
        claims: included,
        chunks: a.chunks.filter((ch) => chunkIds.has(ch.id)),
        sources: a.sources,
        workstreams: p.workstreams,
        fields: a.fields,
        readiness: a.readiness,
      },
    }), `Published handover v${version} with ${included.length} approved claims`);
    go('handover');
  };

  const unclear = project.published ? project.published.claims.filter((c) => project.acks[c.id]?.state === 'unclear') : [];
  const unclearPlan = Object.entries(project.acks).filter(([k, v]) => k.startsWith('plan-') && v.state === 'unclear');

  return (
    <div className="stack">
      <div className="card">
        <div className="row between wrap">
          <div>
            <div className="kicker">Step 4 · Review</div>
            <h2>Review queue</h2>
          </div>
          <div className="row gap wrap">
            {isReviewer && <button className="btn" onClick={bulkApprove} title="Only claims with 2+ independent sources or a leaver attestation">Approve all Corroborated + Attested</button>}
            {isReviewer && <button className="btn primary" disabled={!counts.approved} onClick={publish}>{project.published ? `Re-publish (v${project.published.version + 1})` : 'Publish handover'} →</button>}
          </div>
        </div>
        <p className="muted">
          Sorted by risk: conflicts and inferred claims first. Approve, edit or reject each claim. Edits are stored as new versions,
          never as overwrites, and approval never changes the evidence status: an approved claim that was edited still shows where it came from.
          Only <b>approved</b> claims reach {project.people.successor}.
        </p>
        {!isReviewer && <div className="alert warn">You are viewing as <b>{role}</b>. Switch to <b>Reviewer</b> (top right) to approve or edit.</div>}
        <div className="row between wrap">
          <div className="seg-ctl">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}{f !== 'all' ? ` (${counts[f]})` : ''}</button>
            ))}
          </div>
          {isReviewer && <button className="btn ghost sm" onClick={() => setManual({ ...manual, open: !manual.open })}>+ Add a claim manually</button>}
        </div>
        {manual.open && (
          <div className="form manual">
            <div className="grid2">
              <label>Workstream<select value={manual.workstream} onChange={(e) => setManual({ ...manual, workstream: e.target.value })}>{project.workstreams.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
              <label>Type<select value={manual.type} onChange={(e) => setManual({ ...manual, type: e.target.value as ClaimType })}>{(Object.keys(TYPE_LABEL) as ClaimType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></label>
            </div>
            <label>Statement<input value={manual.statement} onChange={(e) => setManual({ ...manual, statement: e.target.value })} placeholder="e.g. Kabir will own certificates after Aarav leaves" /></label>
            <label>Supporting quote (optional). It is checked word-for-word against every source. If it isn't found, the claim stays <i>Inferred</i>.
              <input value={manual.quote} onChange={(e) => setManual({ ...manual, quote: e.target.value })} placeholder="Paste an exact sentence from a source" />
            </label>
            <div><button className="btn primary sm" onClick={addManual}>Add claim</button></div>
          </div>
        )}
      </div>

      {(unclear.length > 0 || unclearPlan.length > 0 || project.successorQuestions.length > 0) && (
        <div className="card warnbox">
          <h3>Follow-ups from {project.people.successor}</h3>
          <ul>
            {unclear.map((c) => <li key={c.id}>Marked <b>unclear</b>: “{c.statement}”{project.acks[c.id]?.note ? ` (${project.acks[c.id]!.note})` : ''}</li>)}
            {unclearPlan.map(([k, v]) => <li key={k}>Plan item marked <b>unclear</b>{v.note ? `: ${v.note}` : ''}</li>)}
            {project.successorQuestions.map((q) => <li key={q.id}>Asked: “{q.text}” <span className="muted small">{fmtDate(q.ts)}</span></li>)}
          </ul>
          <p className="muted small">Answer these by editing claims, adding a manual claim, or asking {project.people.leaver}, then re-publish.</p>
        </div>
      )}

      {queue.length === 0 && (
        <Empty title={filter === 'pending' ? 'Nothing left to review' : 'No claims here'}>
          {filter === 'pending' && counts.approved > 0 && isReviewer && <button className="btn primary" onClick={publish}>Publish handover →</button>}
        </Empty>
      )}
      <div className="claims">
        {queue.map((c) => {
          const block = blockReason(c);
          return (
            <ClaimCard key={c.id} c={c} a={a} wsName={wsName.get(c.workstream)}>
              {editing === c.id ? (
                <div className="form">
                  <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} />
                  <div className="row gap">
                    <button className="btn primary sm" disabled={!draft.trim()} onClick={() => { setReview(c, 'pending', draft.trim()); setEditing(null); }}>Save as new version</button>
                    <button className="btn ghost sm" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              ) : isReviewer ? (
                <div className="actions row gap wrap">
                  <button className="btn sm ok" disabled={!!block || c.review === 'approved'} title={block} onClick={() => setReview(c, 'approved')}>✓ Approve</button>
                  <button className="btn sm" onClick={() => { setEditing(c.id); setDraft(c.statement); }}>Edit</button>
                  <button className="btn sm bad" disabled={c.review === 'rejected'} onClick={() => setReview(c, 'rejected')}>✕ Reject</button>
                  {c.review !== 'pending' && <button className="btn ghost sm" onClick={() => setReview(c, 'pending')}>Undo</button>}
                  {c.versions.length > 0 && <button className="btn ghost sm" onClick={() => setHistory(history === c.id ? null : c.id)}>History ({c.versions.length})</button>}
                  {block && <span className="muted small">{block}</span>}
                </div>
              ) : null}
              {history === c.id && (
                <ol className="versions">
                  <li><span className="muted small">original</span> {c.originalStatement}</li>
                  {c.versions.map((v, i) => <li key={i}><span className="muted small">{fmtDate(v.ts)} · {v.by} · {v.action}</span> {v.action === 'edit' ? v.statement : ''}</li>)}
                </ol>
              )}
            </ClaimCard>
          );
        })}
      </div>
    </div>
  );
}
