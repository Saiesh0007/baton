import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Claim } from '../types';
import { buildView } from '../lib/view';
import VersionDiffPanel from '../components/VersionDiffPanel';
import { FIELDS } from '../types';
import { BandStat, EvidenceList, StatusPill, TypeTag, Empty, Lock } from '../ui';
import { download, TYPE_LABEL } from '../meta';
import { fmtDate, hash, terms, uid } from '../lib/text';

const DATE_RE = /\b(\d{1,2}\s+[A-Z][a-z]{2,8}\.?\s+\d{4}|\d{4}-\d{2}-\d{2}|before (I leave|the fest)|deadline|expires?)\b/i;

const listOf = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export default function Handover({ go }: { go: (p: string) => void }) {
  const { project, update, role, actorName } = useStore();
  const [ask, setAsk] = useState('');
  const [asked, setAsked] = useState('');
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const view = useMemo(() => (project?.published ? buildView(project.published) : null), [project?.published]);
  if (!project) return null;
  if (!view) {
    return (
      <Empty title="No handover published yet">
        <p>The successor only sees claims the reviewer has approved and published.</p>
        {role === 'reviewer' ? <button className="btn primary" onClick={() => go('review')}>Go to review queue</button> : <p className="muted">Switch to the <b>Reviewer</b> role to review and publish.</p>}
      </Empty>
    );
  }
  const { snap, visible, shadows } = view;
  const ppl = project.people;
  const wsName = new Map(snap.workstreams.map((w) => [w.id, w.name]));
  const isSucc = role === 'successor';

  const ack = (id: string, state: 'read' | 'unclear', n?: string) =>
    update((p) => ({ ...p, acks: { ...p.acks, [id]: { state, note: n, ts: new Date().toISOString() } } }), `${actorName} marked an item as ${state}${n ? `: "${n}"` : ''}`);

  // People to ask
  const people = new Map<string, Set<string>>();
  const addP = (n: string, what: string) => { if (!n) return; (people.get(n) ?? people.set(n, new Set()).get(n)!).add(what); };
  visible.filter((c) => c.type === 'owner' || c.type === 'contact').forEach((c) => c.people.forEach((n) => addP(n, wsName.get(c.workstream) ?? '')));
  addP(ppl.leaver, 'Leaving: original context, until departure');
  addP(ppl.reviewer, 'Reviewer: restricted items, approvals');

  // First-week continuation plan
  const plan: { id: string; text: string; kind: string; claim?: Claim }[] = [];
  visible.filter((c) => c.type === 'task').forEach((c) => plan.push({ id: 'plan-' + hash(c.id), text: c.statement, kind: 'Do', claim: c }));
  visible.filter((c) => (c.type === 'risk' || c.type === 'dependency') && DATE_RE.test(c.statement)).forEach((c) => plan.push({ id: 'plan-' + hash(c.id), text: c.statement, kind: 'Deadline', claim: c }));
  visible.filter((c) => c.type === 'owner' && c.people[0] && c.people[0] !== ppl.successor).forEach((c) => plan.push({ id: 'plan-meet-' + hash(c.id), text: `Meet ${c.people[0]} about ${wsName.get(c.workstream)}`, kind: 'Meet', claim: c }));
  snap.fields.filter((f) => f.state !== 'filled').forEach((f) => {
    const w = wsName.get(f.workstream);
    if (f.workstream === 'general' && !f.claimIds.length) return;
    plan.push({ id: `plan-gap-${f.workstream}-${f.field}`, text: `Open gap: no evidenced “${FIELDS.find((x) => x.key === f.field)?.label}” for ${w}${f.state === 'dontknow' ? ` (${ppl.leaver} didn't know)` : ''}. Ask ${ppl.reviewer}.`, kind: 'Gap' });
  });
  const seen = new Set<string>();
  const planU = plan.filter((p) => {
    const k = p.text.toLowerCase();
    if (seen.has(p.id) || seen.has(k)) return false;
    seen.add(p.id); seen.add(k);
    return true;
  });

  const risks = visible.filter((c) => c.type === 'risk' || c.type === 'issue' || c.type === 'dependency');
  const ackedCount = [...visible, ...planU].filter((x) => project.acks[x.id]?.state === 'read').length;

  // Ask the handover: retrieval over approved, visible claims only
  const results = (() => {
    if (!asked) return [];
    const qt = terms(asked);
    return visible
      .map((c) => ({ c, s: terms(c.statement + ' ' + (wsName.get(c.workstream) ?? '')).filter((t) => qt.includes(t)).length }))
      .filter((x) => x.s > 0).sort((x, y) => y.s - x.s).slice(0, 4);
  })();

  const exportMd = () => {
    let md = `# Handover: ${project.name}\n\n${ppl.leaver} → ${ppl.successor} · reviewed by ${ppl.reviewer} · v${snap.version}, published ${fmtDate(snap.ts)} · readiness ${snap.readiness}%\n\n`;
    const cites: string[] = [];
    const cite = (c: Claim) => c.evidence.map((e) => {
      const ch = view.chunkById.get(e.chunkId);
      const src = ch && view.sourceById.get(ch.sourceId);
      cites.push(`“${e.quote}” (${src?.name}, ${ch?.ref}${ch?.author ? `, ${ch.author}` : ''}${ch?.ts ? `, ${fmtDate(ch.ts)}` : ''}${ch?.url ? `, ${ch.url}` : ''})`);
      return `[${cites.length}]`;
    }).join('');
    for (const w of snap.workstreams) {
      const cs = visible.filter((c) => c.workstream === w.id);
      if (!cs.length) continue;
      md += `## ${w.name}\n\n`;
      for (const f of FIELDS) {
        const fc = cs.filter((c) => f.types.includes(c.type));
        if (!fc.length) continue;
        md += `**${f.label}**\n\n` + fc.map((c) => `- ${c.statement} _(${c.status}${c.edited ? ', edited' : ''})_ ${cite(c)}`).join('\n') + '\n\n';
      }
    }
    if (shadows.length) md += `## Restricted knowledge (ask ${ppl.reviewer})\n\n` + shadows.map((s) => `- A ${TYPE_LABEL[s.type].toLowerCase()} about ${wsName.get(s.workstream)} exists in a restricted source.`).join('\n') + '\n\n';
    md += `## First-week plan\n\n` + planU.map((p) => `- [ ] **${p.kind}:** ${p.text}`).join('\n') + '\n\n';
    md += `## Citations\n\n` + cites.map((c, i) => `${i + 1}. ${c}`).join('\n') + '\n';
    download(`handover-v${snap.version}.md`, md, 'text/markdown');
  };

  const ackBtns = (id: string) => {
    const a = project.acks[id];
    if (!isSucc) return a ? <span className={`pill ${a.state === 'read' ? 'p-ok' : 'p-warn'}`}>{a.state === 'read' ? '✓ read' : '? unclear'}</span> : null;
    return (
      <span className="ack">
        <button className={`btn xs ${a?.state === 'read' ? 'ok' : ''}`} onClick={() => ack(id, 'read')}>✓ Got it</button>
        <button className={`btn xs ${a?.state === 'unclear' ? 'warn' : ''}`} onClick={() => { setNoteFor(id); setNote(a?.note ?? ''); }}>? Unclear</button>
      </span>
    );
  };

  const itemRow = (c: Claim) => (
    <li key={c.id} className="hitem">
      <div className="row gap wrap hmeta">
        <StatusPill s={c.status} />
        {c.edited && <span className="pill p-warn" title="Edited by reviewer">edited</span>}
        <span className="spacer" />
        {ackBtns(c.id)}
      </div>
      <p className="hstmt">{c.statement}</p>
      {noteFor === c.id && noteBox(c.id)}
      <EvidenceList claim={c} chunkById={view.chunkById} sourceById={view.sourceById} />
    </li>
  );

  const noteBox = (id: string) => (
    <div className="row gap notebox">
      <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is unclear? (goes back to the reviewer)" />
      <button className="btn sm warn" onClick={() => { ack(id, 'unclear', note || undefined); setNoteFor(null); }}>Send</button>
      <button className="btn ghost sm" onClick={() => setNoteFor(null)}>Cancel</button>
    </div>
  );

  return (
    <div className="stack handover">
      {!isSucc && <div className="alert info">Preview of <b>{ppl.successor}</b>'s view, with leads-only content removed. Switch to <b>Successor</b> to acknowledge items.</div>}
      <div className="card band hhead">
        <div>
          <div className="kicker">Step 5 · Handover for {ppl.successor}</div>
          <h2>{project.name}</h2>
          <div className="muted small">v{snap.version} · approved by {snap.by} · published {fmtDate(snap.ts)} · {visible.length} approved items · {shadows.length} restricted</div>
        </div>
        <div className="row gap wrap">
          <BandStat n={snap.readiness} suffix="%" label={`readiness · ${ackedCount}/${visible.length + planU.length} acknowledged`} />
          <button className="btn" onClick={exportMd}>Export Markdown</button>
        </div>
      </div>

      {(project.history?.length ?? 0) >= 2 && <VersionDiffPanel history={project.history!} wsName={new Map(project.workstreams.map((w) => [w.id, w.name]))} />}

      <div className="card ask">
        <h3>Ask the handover</h3>
        <form className="row gap" onSubmit={(e) => { e.preventDefault(); setAsked(ask); }}>
          <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="e.g. what happens with razorpay? who owns certificates?" />
          <button className="btn primary sm" disabled={!ask.trim()}>Ask</button>
        </form>
        {asked && (
          <div className="answers">
            {results.length ? (
              <>
                <p className="muted small">Answered only from approved claims, with their sources:</p>
                <ul className="hlist">{results.map(({ c }) => itemRow(c))}</ul>
              </>
            ) : (
              <div className="alert warn">
                Not in the approved evidence. Ask <b>{ppl.leaver}</b> or <b>{ppl.reviewer}</b>.
                {isSucc && <button className="btn xs" style={{ marginLeft: 8 }} onClick={() => { update((p) => ({ ...p, successorQuestions: [...p.successorQuestions, { id: uid('sq'), text: asked, ts: new Date().toISOString() }] }), `${ppl.successor} asked: "${asked}"`); setAsked(''); setAsk(''); }}>Send question to reviewer</button>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid-main">
        <div className="stack">
          {snap.workstreams.map((w) => {
            const cs = visible.filter((c) => c.workstream === w.id);
            const sh = shadows.filter((c) => c.workstream === w.id);
            if (!cs.length && !sh.length) return null;
            return (
              <section key={w.id} className="card ws">
                <h3>{w.name}</h3>
                {FIELDS.filter((f) => cs.some((c) => f.types.includes(c.type))).map((f) => (
                  <div key={f.key} className="field">
                    <div className="flabel">{f.label}</div>
                    <ul className="hlist">{cs.filter((c) => f.types.includes(c.type)).map((c) => itemRow(c))}</ul>
                  </div>
                ))}
                {(() => {
                  // every empty field of this workstream, said once instead of once per field
                  const gaps = FIELDS.filter((f) => !cs.some((c) => f.types.includes(c.type)));
                  if (!gaps.length) return null;
                  const unknown = gaps.filter((f) => snap.fields.find((x) => x.workstream === w.id && x.field === f.key)?.state === 'dontknow');
                  return (
                    <div className="field">
                      <div className="flabel">Gaps</div>
                      <div className="gap-line">
                        No approved evidence for {listOf(gaps.map((f) => f.label.toLowerCase()))}
                        {unknown.length ? ` (${ppl.leaver} didn't know ${listOf(unknown.map((f) => f.label.toLowerCase()))})` : ''}. Ask {ppl.reviewer}.
                      </div>
                    </div>
                  );
                })()}
                {sh.map((s) => (
                  <div key={s.id} className="shadow"><Lock /> A <b>{TYPE_LABEL[s.type].toLowerCase()}</b> about {w.name} exists in a restricted source. <b>Ask: {ppl.reviewer}</b></div>
                ))}
              </section>
            );
          })}
        </div>

        <aside className="stack">
          <div className="card">
            <h3>First-week plan</h3>
            <ul className="plan">
              {planU.map((p) => (
                <li key={p.id} className={project.acks[p.id]?.state === 'read' ? 'done' : ''}>
                  <div className="row gap">
                    {isSucc ? <input type="checkbox" checked={project.acks[p.id]?.state === 'read'} onChange={(e) => e.target.checked ? ack(p.id, 'read') : update((x) => { const acks = { ...x.acks }; delete acks[p.id]; return { ...x, acks }; })} aria-label="done" /> : null}
                    <span className={`pk pk-${p.kind.toLowerCase()}`}>{p.kind}</span>
                    <span>{p.text}{isSucc && project.acks[p.id]?.state !== 'read' && noteFor !== p.id && <button className="link unclear" onClick={() => { setNoteFor(p.id); setNote(''); }}>Unclear?</button>}</span>
                  </div>
                  {isSucc && noteFor === p.id && noteBox(p.id)}
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h3>Risks &amp; dependencies</h3>
            <ul className="risk-list">
              {risks.map((c) => (
                <li key={c.id}><TypeTag t={c.type} /> {c.statement} {DATE_RE.test(c.statement) && <span className="pill p-warn">deadline</span>}</li>
              ))}
              {!risks.length && <li className="muted">None approved.</li>}
            </ul>
          </div>
          <div className="card">
            <h3>People to ask</h3>
            <ul className="people">
              {[...people.entries()].map(([n, w]) => <li key={n}><b>{n}</b><span className="muted small"> {[...w].filter(Boolean).join(' · ')}</span></li>)}
            </ul>
          </div>
          {shadows.length > 0 && (
            <div className="card shadowbox">
              <h3>Knowledge shadows ({shadows.length})</h3>
              <p className="muted small">These exist in sources you can't access. You can see that they exist, but not what they say.</p>
              <ul>{shadows.map((s) => <li key={s.id}><Lock /> {TYPE_LABEL[s.type]} · {wsName.get(s.workstream)} · ask {ppl.reviewer}</li>)}</ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
