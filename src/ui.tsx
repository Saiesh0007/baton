import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Chunk, Claim, ClaimStatus, ClaimType, Source } from './types';
import { escapeRe, fmtDate } from './lib/text';
import { STATUS_META, TICK, TYPE_LABEL } from './meta';


export function Tick({ s, attested }: { s: ClaimStatus; attested?: boolean }) {
  const m = STATUS_META[s];
  return (
    <span className={`tick tk-${s}`} title={`${m.label}: ${m.help}`} aria-label={m.label}>
      {TICK[s]}{(attested ?? s === 'attested') && <Person />}
    </span>
  );
}

function Person() {
  return (
    <svg className="tk-person" viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
      <circle cx="6" cy="3.6" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.6 11c.5-2.5 2.3-3.7 4.4-3.7s3.9 1.2 4.4 3.7" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function Lock() {
  return (
    <svg className="ico" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function StatusPill({ s }: { s: ClaimStatus }) {
  const m = STATUS_META[s];
  return <span className={`pill p-${m.cls}`} title={m.help}><Tick s={s} /> {m.label}</span>;
}

export function TypeTag({ t }: { t: ClaimType }) {
  return <span className={`ttag t-${t}`}>{TYPE_LABEL[t]}</span>;
}

export function ReviewPill({ c }: { c: Claim }) {
  if (c.superseded) return <span className="pill p-grey" title="Replaced by a leaver-attested answer">Superseded</span>;
  if (c.review === 'approved') return <span className="stamp ok">Approved</span>;
  if (c.review === 'rejected') return <span className="stamp bad">Rejected</span>;
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
              <h3>{st.source?.name ?? 'Unknown source'}</h3>
              <button className="btn ghost sm" onClick={() => setSt(null)} aria-label="Close">Close</button>
            </div>
            <div className="mono muted small">
              {st.chunk.ref}
              {st.chunk.author ? ` · ${st.chunk.author}` : ''}
              {st.chunk.ts ? ` · ${fmtDate(st.chunk.ts)}` : ''}
              {st.source ? ` · visibility: ${st.source.visibility === 'leads' ? 'Leads only' : 'Team'}` : ''}
            </div>
            <div className={`verify ${st.verified ? 'yes' : 'no'}`}>
              {st.verified ? '✓ Quote found word-for-word in this source text' : '✕ Quote not found in this source text'}
            </div>
            <div className="chunk-text"><Highlight text={st.chunk.text} quote={st.quote} /></div>
            {st.chunk.url ? (
              <a className="btn sm self-start" href={st.chunk.url} target="_blank" rel="noreferrer">Open original ↗</a>
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
              <span className={`ev-mark ${e.verified ? 'yes' : 'no'}`} title={e.verified ? 'Quote found word-for-word in the source' : 'Quote not found in the source'}>{e.verified ? '✓' : '✕'}</span>
              <q className="ev-quote">{e.quote}</q>
              <span className="ev-src">
                {src?.name ?? 'missing source'} · {ch?.ref}
                {ch?.author ? ` · ${ch.author}` : ''}
                {ch?.ts ? ` · ${fmtDate(ch.ts)}` : ''}
                {src?.visibility === 'leads' ? <> · <Lock /> leads only</> : ''}
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

