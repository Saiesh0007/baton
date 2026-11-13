import { useStore } from '../store';
import { FIELDS, type FieldCell } from '../types';
import { STATUS_META } from '../ui';
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

  const next = !project.sources.length
    ? { text: 'Import at least one source to build the claim ledger.', page: 'sources', cta: 'Connect sources' }
    : open && role !== 'successor'
      ? { text: `${open} question${open > 1 ? 's' : ''} for ${project.people.leaver} can't be answered from the evidence.`, page: 'interview', cta: 'Open exit interview' }
      : pending && role === 'reviewer'
        ? { text: `${pending} claims are waiting for review.`, page: 'review', cta: 'Open review queue' }
        : { text: project.published ? `Handover v${project.published.version} is published.` : 'Everything is reviewed and ready to publish.', page: project.published ? 'handover' : 'review', cta: project.published ? 'View handover' : 'Publish' };

  return (
    <div className="stack">
      <div className="card next">
        <div>
          <div className="kicker">Next step</div>
          <div className="lead">{next.text}</div>
        </div>
        <button className="btn primary" onClick={() => go(next.page)}>{next.cta} →</button>
      </div>

      <div className="stats">
        <div className="stat big">
          <div className="ring" style={{ ['--p' as string]: a.readiness }}><span>{a.readiness}%</span></div>
          <div>
            <div className="stat-l">Handover readiness</div>
            <div className="muted small">Share of required template fields backed by a Corroborated, Cited or Leaver-attested claim.</div>
          </div>
        </div>
        <div className="stat"><div className="stat-n">{project.sources.length}</div><div className="stat-l">sources · {a.chunks.length} events</div></div>
        <div className="stat"><div className="stat-n">{live.length}</div><div className="stat-l">claims in ledger</div></div>
        <div className="stat"><div className="stat-n">{open}</div><div className="stat-l">open interview questions</div></div>
        <div className="stat"><div className="stat-n">{approved}/{live.length}</div><div className="stat-l">approved by reviewer</div></div>
        <div className="stat"><div className="stat-n">{redactions}</div><div className="stat-l">secrets / PII masked at import</div></div>
      </div>

      <div className="card">
        <div className="row between wrap">
          <h3>Evidence status of every claim</h3>
          <span className="muted small">Assigned by rules, never by the AI's own confidence</span>
        </div>
        <div className="statusbar">
          {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map((s) => (
            a.stats[s] ? <div key={s} className={`seg s-${STATUS_META[s].cls}`} style={{ flex: a.stats[s] }} title={`${STATUS_META[s].label}: ${a.stats[s]}`} /> : null
          ))}
        </div>
        <div className="legend">
          {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map((s) => (
            <div key={s} className="lg"><span className={`dot s-${STATUS_META[s].cls}`} /> <b>{STATUS_META[s].label}</b> {a.stats[s]} <span className="muted small">· {STATUS_META[s].help}</span></div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="row between wrap">
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
                    <td><b>{w.name}</b></td>
                    {FIELDS.map((f) => {
                      const c = cells.find((x) => x.field === f.key)!;
                      return <td key={f.key}><span className={`cell c-${CELL[c.state].cls}`}>{CELL[c.state].label}</span></td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Audit log</h3>
        <ul className="audit">
          {project.audit.slice(0, 12).map((e, i) => (
            <li key={i}><span className="muted small">{fmtDate(e.ts)} {new Date(e.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span> <b>{e.actor}</b> {e.action}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
