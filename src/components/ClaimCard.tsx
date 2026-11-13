import type { ReactNode } from 'react';
import type { Claim } from '../types';
import type { Analysis } from '../lib/analyze';
import { EvidenceList, ReviewPill, StatusPill, TypeTag } from '../ui';
import { fmtDate } from '../lib/text';

export default function ClaimCard({ c, a, wsName, children, compact }: {
  c: Claim; a: Analysis; wsName?: string; children?: ReactNode; compact?: boolean;
}) {
  const conflicts = c.conflictWith.map((id) => a.claims.find((x) => x.id === id)).filter(Boolean) as Claim[];
  return (
    <article className={`claim st-${c.status} ${c.superseded ? 'superseded' : ''} ${c.review === 'rejected' ? 'rejected' : ''}`}>
      <header className="row gap wrap">
        <TypeTag t={c.type} />
        <StatusPill s={c.status} />
        <ReviewPill c={c} />
        {c.edited && <span className="pill p-warn" title="Statement edited by reviewer; previous versions are kept">Edited</span>}
        {wsName && <span className="muted small">{wsName}</span>}
        <span className="spacer" />
        {c.date && <span className="muted small">{fmtDate(c.date)}</span>}
      </header>
      <p className="claim-text">{c.statement}</p>
      {c.edited && <p className="muted small">Original: <s>{c.originalStatement}</s></p>}
      {c.origin === 'interview' && c.note && <p className="muted small">{c.note}</p>}
      {!compact && <EvidenceList claim={c} chunkById={a.chunkById} sourceById={a.sourceById} />}
      {!compact && conflicts.length > 0 && (
        <div className="conflict-box">
          <div className="kicker bad">Contradicted by</div>
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
    </article>
  );
}
