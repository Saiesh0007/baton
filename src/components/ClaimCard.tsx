import type { ReactNode } from 'react';
import type { Claim } from '../types';
import type { Analysis } from '../lib/analyze';
import { EvidenceList, ReviewPill, Tick, TypeTag } from '../ui';
import { STATUS_META } from '../meta';
import { fmtDate } from '../lib/text';

export default function ClaimCard({ c, a, wsName, children, compact, noConflicts, fresh }: {
  c: Claim; a: Analysis; wsName?: string; children?: ReactNode; compact?: boolean; noConflicts?: boolean; fresh?: boolean;
}) {
  const conflicts = c.conflictWith.map((id) => a.claims.find((x) => x.id === id)).filter(Boolean) as Claim[];
  return (
    <article className={`claim st-${c.status} ${c.superseded ? 'superseded' : ''} ${c.review === 'rejected' ? 'rejected' : ''}`}>
      <div className="margin"><Tick s={c.status} /></div>
      <div className="claim-body">
        <header className="claim-meta">
          <span className={`stl stl-${c.status}`} title={STATUS_META[c.status].help}>{STATUS_META[c.status].label}</span>
          <TypeTag t={c.type} />
          {wsName && <span className="muted">{wsName}</span>}
          {c.edited && <span className="stl stl-edited" title="Statement edited by reviewer; previous versions are kept">Edited</span>}
          <ReviewPill c={c} fresh={fresh} />
          <span className="spacer" />
          {c.date && <span className="mono muted">{fmtDate(c.date)}</span>}
        </header>
        <p className="claim-text">{c.statement}</p>
        {c.edited && <p className="muted small">Original: <s>{c.originalStatement}</s></p>}
        {c.origin === 'interview' && c.note && <p className="muted small">{c.note}</p>}
        {!compact && <EvidenceList claim={c} chunkById={a.chunkById} sourceById={a.sourceById} />}
        {!compact && !noConflicts && conflicts.length > 0 && (
          <div className="conflict-box">
            <div className="conflict-head">Contradicted by</div>
            {conflicts.map((o) => (
              <div key={o.id} className="conflict-side">
                <p className="claim-text sm">{o.statement}</p>
                <EvidenceList claim={o} chunkById={a.chunkById} sourceById={a.sourceById} />
              </div>
            ))}
            <p className="muted small">Baton doesn't pick a side. This becomes an exit-interview question for the leaver.</p>
          </div>
        )}
        {c.superseded && <p className="muted small">Superseded by the leaver's exit-interview answer.</p>}
        {children}
      </div>
    </article>
  );
}
