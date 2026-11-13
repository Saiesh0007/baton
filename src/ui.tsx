import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Chunk, Claim, ClaimStatus, ClaimType, Source } from './types';
import { escapeRe, fmtDate } from './lib/text';

export const STATUS_META: Record<ClaimStatus, { label: string; cls: string; help: string }> = {
  corroborated: { label: 'Corroborated', cls: 'ok', help: 'Quotes found word-for-word in 2+ independent sources (different source types or authors).' },
  cited: { label: 'Cited', cls: 'acc', help: 'Exactly one quote, checked word-for-word against the stored source text. Single source.' },
  attested: { label: 'Leaver-attested', cls: 'vio', help: 'Supplied or confirmed by the departing member in the exit interview.' },
  inferred: { label: 'Inferred', cls: 'grey', help: 'No verified quote. Cannot be approved without a human edit.' },
  conflicting: { label: 'Conflicting', cls: 'bad', help: 'Disagrees with another claim on the same topic. Both sides are shown.' },
};

export const TYPE_LABEL: Record<ClaimType, string> = {
  decision: 'Decision', owner: 'Owner', status: 'Status', risk: 'Risk', dependency: 'Dependency', task: 'Next action', issue: 'Recurring issue', contact: 'Contact',
};

export function StatusPill({ s }: { s: ClaimStatus }) {
  const m = STATUS_META[s];
  return <span className={`pill p-${m.cls}`} title={m.help}>{m.label}</span>;
}

export function TypeTag({ t }: { t: ClaimType }) {
  return <span className={`ttag t-${t}`}>{TYPE_LABEL[t]}</span>;
}

export function ReviewPill({ c }: { c: Claim }) {
  if (c.superseded) return <span className="pill p-grey" title="Replaced by a leaver-attested answer">Superseded</span>;
  if (c.review === 'approved') return <span className="pill p-ok-solid">✓ Approved</span>;
  if (c.review === 'rejected') return <span className="pill p-bad-solid">Rejected</span>;
  return null;
}

/* ---------------- Evidence drawer ---------------- */

interface DrawerState { chunk: Chunk; source?: Source; quote: string; verified: boolean }
const DrawerCtx = createContext<(s: DrawerState | null) => void>(() => {});

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<DrawerState | null>(null);
  return (
    <DrawerCtx.Provider value={setSt}>
      {children}
      {st && (
        <div className="drawer-back" onClick={() => setSt(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Source evidence">
            <div className="row between">
              <div className="kicker">Source evidence</div>
              <button className="btn ghost sm" onClick={() => setSt(null)} aria-label="Close">✕</button>
            </div>
            <h3>{st.source?.name ?? 'Unknown source'}</h3>
            <div className="muted small">
              {st.chunk.ref}
              {st.chunk.author ? ` · ${st.chunk.author}` : ''}
              {st.chunk.ts ? ` · ${fmtDate(st.chunk.ts)}` : ''}
              {st.source ? ` · visibility: ${st.source.visibility === 'leads' ? 'Leads only' : 'Team'}` : ''}
            </div>
            <div className={`verify ${st.verified ? 'yes' : 'no'}`}>
              {st.verified ? '✓ Quote found word-for-word in this source text' : '✕ Quote NOT found in this source text'}
            </div>
            <div className="chunk-text"><Highlight text={st.chunk.text} quote={st.quote} /></div>
            {st.chunk.url ? (
              <a className="btn sm" href={st.chunk.url} target="_blank" rel="noreferrer">Open original ↗</a>
            ) : st.source?.synthetic ? (
              <p className="muted small">This is a synthetic demo source, so there is no external link. The text above is the stored copy (after redaction).</p>
            ) : null}
          </aside>
        </div>
      )}
    </DrawerCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useDrawer = () => useContext(DrawerCtx);

function Highlight({ text, quote }: { text: string; quote: string }) {
  const q = quote.trim();
  if (!q) return <>{text}</>;
  const pattern = escapeRe(q).replace(/\s+/g, '\\s+');
  const re = new RegExp(pattern, 'i');
  const m = text.match(re);
  if (!m || m.index === undefined) return <>{text}</>;
  return (
    <>
      {text.slice(0, m.index)}
      <mark>{m[0]}</mark>
      {text.slice(m.index + m[0].length)}
    </>
  );
}

export function EvidenceList({ claim, chunkById, sourceById, hideRestricted }: {
  claim: Claim; chunkById: Map<string, Chunk>; sourceById: Map<string, Source>; hideRestricted?: boolean;
}) {
  const open = useDrawer();
  if (!claim.evidence.length) return <div className="ev-none">No supporting quote. {claim.note}</div>;
  return (
    <ul className="ev-list">
      {claim.evidence.map((e, i) => {
        const ch = chunkById.get(e.chunkId);
        const src = ch ? sourceById.get(ch.sourceId) : undefined;
        if (hideRestricted && src?.visibility === 'leads') return null;
        return (
          <li key={i}>
            <button className="ev" onClick={() => ch && open({ chunk: ch, source: src, quote: e.quote, verified: e.verified })} disabled={!ch}>
              <span className={`ev-mark ${e.verified ? 'yes' : 'no'}`} title={e.verified ? 'Verified quote' : 'Quote not found'}>{e.verified ? '✓' : '✕'}</span>
              <span className="ev-quote">“{e.quote}”</span>
              <span className="ev-src">
                {src?.name ?? 'missing source'} · {ch?.ref}
                {ch?.author ? ` · ${ch.author}` : ''}
                {ch?.ts ? ` · ${fmtDate(ch.ts)}` : ''}
                {src?.visibility === 'leads' ? ' · 🔒 leads only' : ''}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function download(name: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
