import { useStore } from '../store';
import { FIELDS, type FieldCell } from '../types';
import { Tick } from '../ui';
import { STATUS_META } from '../meta';
import { fmtDate } from '../lib/text';

const CELL: Record<FieldCell['state'], { label: string; cls: string }> = {
  filled: { label: 'Evidenced', cls: 'ok' },
  inferred: { label: 'Inferred', cls: 'grey' },
  conflicting: { label: 'Conflict', cls: 'bad' },
  missing: { label: 'Missing', cls: 'warn' },
  dontknow: { label: "Leaver doesn't know", cls: 'warn' },
};

export default function Overview({ go }: { go: (p: string) => void }) {
  const { project, analysis, role } = useStore();
  if (!project || !analysis) return null;
  const a = analysis;
  const open = a.questions.filter((q) => !project.answers[q.id]).length;
  const live = a.claims.filter((c) => !c.superseded);
  const pending = live.filter((c) => c.review === 'pending').length;
  const approved = live.filter((c) => c.review === 'approved').length;
  const redactions = project.sources.reduce((n, s) => n + s.redactions.reduce((m, r) => m + r.count, 0), 0);
  const filled = a.fields.filter((f) => f.state === 'filled').length;

  const next = !project.sources.length
    ? { text: 'Import at least one source to build the claim ledger.', page: 'sources', cta: 'Connect sources' }
    : open && role !== 'successor'
      ? { text: `${open} question${open > 1 ? 's' : ''} for ${project.people.leaver} can't be answered from the evidence.`, page: 'interview', cta: 'Open exit interview' }
      : pending && role === 'reviewer'
        ? { text: `${pending} claims are waiting for review.`, page: 'review', cta: 'Open review queue' }
        : { text: project.published ? `Handover v${project.published.version} is published.` : 'Everything is reviewed and ready to publish.', page: project.published ? 'handover' : 'review', cta: project.published ? 'View handover' : 'Publish' };

  const statuses = Object.keys(STATUS_META) as (keyof typeof STATUS_META)[];

  return (
    <div className="stack">
      <section className="readiness">
        <div className="rd-figure">
          <div className="rd-n">{a.readiness}<span>%</span></div>
          <div className="rd-copy">
            <p className="rd-line">of {project.people.successor}'s handover is backed by evidence.</p>
            <p className="muted small">{filled} of {a.fields.length} required template fields hold a Corroborated, Cited or Leaver-attested claim.</p>
            <div className="rd-track" aria-hidden="true"><div style={{ width: `${a.readiness}%` }} /></div>
          </div>
        </div>
        <div className="rd-next">
          <p>{next.text}</p>
          <button className="btn primary" onClick={() => go(next.page)}>{next.cta} →</button>
        </div>
      </section>

      <dl className="figures">
        <div><dt>Sources</dt><dd>{project.sources.length}</dd></div>
        <div><dt>Events</dt><dd>{a.chunks.length}</dd></div>
        <div><dt>Claims in ledger</dt><dd>{live.length}</dd></div>
        <div><dt>Open questions</dt><dd>{open}</dd></div>
        <div><dt>Approved</dt><dd>{approved}<span className="muted">/{live.length}</span></dd></div>
        <div><dt>Secrets masked at import</dt><dd>{redactions}</dd></div>
      </dl>

      <section className="card">
        <div className="card-head">
          <h3>Evidence status of every claim</h3>
          <span className="muted small">Assigned by rules, never by the AI's own confidence</span>
        </div>
        <div className="statusbar">
          {statuses.map((s) => (
            a.stats[s] ? <div key={s} className={`seg sg-${s}`} style={{ flex: a.stats[s] }} title={`${STATUS_META[s].label}: ${a.stats[s]}`} /> : null
          ))}
        </div>
        <ul className="legend">
          {statuses.map((s) => (
            <li key={s}>
              <span className="lg-tick"><Tick s={s} /></span>
              <span className="lg-n">{a.stats[s]}</span>
              <span><b>{STATUS_META[s].label}</b> <span className="muted">{STATUS_META[s].help}</span></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Handover template coverage</h3>
          <span className="muted small">What every workstream must have before a handover is complete</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl matrix">
            <thead><tr><th>Workstream</th>{FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
            <tbody>
              {project.workstreams.map((w) => {
                const cells = a.fields.filter((c) => c.workstream === w.id);
                if (w.id === 'general' && cells.every((c) => !c.claimIds.length)) return null;
                return (
                  <tr key={w.id}>
                    <td className="ws-name">{w.name}</td>
                    {FIELDS.map((f) => {
                      const c = cells.find((x) => x.field === f.key)!;
                      return <td key={f.key}><span className={`cell c-${CELL[c.state].cls}`}>{c.state === 'filled' && '✓ '}{CELL[c.state].label}</span></td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Audit log</h3>
        <ul className="audit">
          {project.audit.slice(0, 12).map((e, i) => (
            <li key={i}><span className="mono muted">{fmtDate(e.ts)} {new Date(e.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span> <span><b>{e.actor}</b> {e.action}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
