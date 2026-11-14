import { useState } from 'react';
import { useStore } from '../store';
import type { Answer, Claim, Question } from '../types';
import { FIELDS } from '../types';
import ClaimCard from '../components/ClaimCard';
import type { Analysis } from '../lib/analyze';
import { Empty } from '../ui';

export default function Interview({ go }: { go: (p: string) => void }) {
  const { project, analysis, update, role } = useStore();
  if (!project || !analysis) return null;
  const a = analysis;
  const qs = a.questions;
  const answered = qs.filter((q) => project.answers[q.id]).length;
  const wsName = new Map(project.workstreams.map((w) => [w.id, w.name]));
  const canAnswer = role === 'leaver';

  const save = (q: Question, ans: Omit<Answer, 'ts'> | null) =>
    update((p) => {
      const answers = { ...p.answers };
      if (ans) answers[q.id] = { ...ans, ts: new Date().toISOString() };
      else delete answers[q.id];
      return { ...p, answers };
    }, ans ? `Answered exit-interview question (${q.kind}, ${wsName.get(q.workstream)}): ${ans.choice}` : `Cleared answer (${wsName.get(q.workstream)})`);

  if (!project.sources.length) return <Empty title="No sources yet"><button className="btn primary" onClick={() => go('sources')}>Connect sources</button></Empty>;

  return (
    <div className="stack">
      <div className="card">
        <div className="kicker">Step 3½ · Ask the leaver</div>
        <h2>Gap-driven exit interview</h2>
        <p className="muted">
          These are the only questions <b>{project.people.leaver}</b> needs to answer. Each one comes from a conflict, a missing
          template field or an inferred claim. Everything else is already covered by evidence. Answers are stored as a new labelled
          source (<i>Leaver-attested</i>). “I don't know” is a valid answer and stays visible as an honest gap.
        </p>
        <div className="progress"><div style={{ width: `${qs.length ? (answered / qs.length) * 100 : 100}%` }} /></div>
        <div className="row between wrap">
          <span className="muted small">{answered} of {qs.length} answered · readiness now {a.readiness}%</span>
          {!canAnswer && <span className="alert warn inline-alert">You are viewing as <b>{role}</b>. Switch the role to <b>Leaver</b> (top right) to answer.</span>}
          {answered === qs.length && qs.length > 0 && <button className="btn primary" onClick={() => go(role === 'reviewer' ? 'review' : 'overview')}>Done → {role === 'reviewer' ? 'Review' : 'Overview'}</button>}
        </div>
      </div>
      {qs.length === 0 && <Empty title="No open questions">The evidence already covers every required field.</Empty>}
      {qs.map((q, i) => (
        <QuestionCard key={q.id} n={i + 1} q={q} ans={project.answers[q.id]} claims={q.claimIds.map((id) => a.claims.find((c) => c.id === id)).filter(Boolean) as Claim[]}
          wsName={wsName.get(q.workstream) ?? q.workstream} canAnswer={canAnswer} onSave={(x) => save(q, x)} a={a} leaver={project.people.leaver} />
      ))}
    </div>
  );
}

function QuestionCard({ n, q, ans, claims, wsName, canAnswer, onSave, a, leaver }: {
    n: number; q: Question; ans?: Answer; claims: Claim[]; wsName: string; canAnswer: boolean; onSave: (a: Omit<Answer, 'ts'> | null) => void;
    a: Analysis; leaver: string;
  }) {
    const [text, setText] = useState(ans?.text ?? '');
    const [mode, setMode] = useState<'idle' | 'correct'>('idle');
    const fieldLabel = FIELDS.find((f) => f.key === q.field)?.label;
    const kindLabel = q.kind === 'conflict' ? 'Conflict' : q.kind === 'missing' ? `Missing: ${fieldLabel}` : `Inferred: ${fieldLabel}`;
    return (
      <div className={`card q q-${q.kind} ${ans ? 'answered' : ''}`}>
        <div className="row gap wrap">
          <span className="qnum">{n}</span>
          <span className={`pill ${q.kind === 'conflict' ? 'p-bad' : q.kind === 'missing' ? 'p-warn' : 'p-grey'}`}>{kindLabel}</span>
          <b>{wsName}</b>
          <span className="spacer" />
          {ans && <span className="pill p-vio">{ans.choice === 'dontknow' ? "Answered: don't know" : 'Answered'}</span>}
        </div>
        <h3 className="qtext">{q.prompt}</h3>

        {q.kind === 'conflict' && (
          <div className="grid2 sides">
            {claims.map((c, i) => (
              <div key={c.id} className={`side ${ans?.pickedClaimId === c.id ? 'picked' : ''}`}>
                <div className="kicker">Side {String.fromCharCode(65 + i)}</div>
                <ClaimCard c={c} a={a} noConflicts />
                {canAnswer && !ans && <button className="btn sm" onClick={() => onSave({ choice: 'pick', pickedClaimId: c.id, text: text || undefined })}>This one is current</button>}
              </div>
            ))}
          </div>
        )}
        {q.kind === 'inferred' && claims[0] && <ClaimCard c={claims[0]} a={a} />}

        {ans ? (
          <div className="answer">
            <div className="kicker">{leaver}'s answer</div>
            {ans.choice === 'pick' && <p>Picked: “{claims.find((c) => c.id === ans.pickedClaimId)?.statement}”{ans.text ? ` (${ans.text})` : ''}</p>}
            {ans.choice === 'confirm' && <p>Confirmed as correct.</p>}
            {(ans.choice === 'correct' || ans.choice === 'answer') && <p>“{ans.text}”</p>}
            {ans.choice === 'dontknow' && <p>I don't know. This stays an open gap in the handover.</p>}
            {canAnswer && <button className="btn ghost sm" onClick={() => onSave(null)}>Change answer</button>}
          </div>
        ) : canAnswer ? (
          <div className="form">
            {q.kind === 'missing' || mode === 'correct' || q.kind === 'conflict' ? (
              <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)}
                placeholder={q.kind === 'conflict' ? 'Optional: explain, or write the correct version if neither side is right…' : 'Your answer (name people, dates and reasons where you can)…'} />
            ) : null}
            <div className="row gap wrap">
              {q.kind === 'inferred' && mode === 'idle' && <button className="btn primary sm" onClick={() => onSave({ choice: 'confirm' })}>Yes, correct</button>}
              {q.kind === 'inferred' && mode === 'idle' && <button className="btn sm" onClick={() => setMode('correct')}>No, correct it</button>}
              {q.kind === 'missing' && <button className="btn primary sm" disabled={!text.trim()} onClick={() => onSave({ choice: 'answer', text: text.trim() })}>Save answer</button>}
              {(mode === 'correct' || q.kind === 'conflict') && <button className={`btn sm ${q.kind === 'inferred' ? 'primary' : ''}`} disabled={!text.trim()} onClick={() => onSave({ choice: 'correct', text: text.trim() })}>{q.kind === 'conflict' ? 'Neither: save my version' : 'Save correction'}</button>}
              <button className="btn ghost sm" onClick={() => onSave({ choice: 'dontknow' })}>I don't know</button>
            </div>
          </div>
        ) : (
          <p className="muted small">Waiting for {leaver}.</p>
        )}
      </div>
    );
  }
