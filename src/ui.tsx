import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Chunk, Claim, ClaimStatus, ClaimType, Source } from './types';
import { escapeRe, fmtDate } from './lib/text';
import { STATUS_META, TYPE_LABEL } from './meta';
import { reducedMotion, useFirstSight } from './motion';

/* Hand-inked strokes. pathLength=1 lets every stroke draw with the same dash maths. */
const CHECK = 'M2.4 8.8C3.6 9.9 5 11.2 6.1 12.4 8.4 9.2 10.8 6.2 13.8 3.4';
const CHECK2 = 'M10.4 8.8C11.6 9.9 13 11.2 14.1 12.4 16.4 9.2 18.8 6.2 21.8 3.4';

export function InkMark({ s }: { s: ClaimStatus }) {
  if (s === 'inferred') return <span className="tk-q">?</span>;
  if (s === 'conflicting') {
    return (
      <svg className="inkmark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path pathLength={1} d="M3 6.3H13" /><path pathLength={1} d="M3 10.1H13" /><path pathLength={1} d="M10.4 2.6 5.6 13.8" />
      </svg>
    );
  }
  if (s === 'corroborated') {
    return <svg className="inkmark" viewBox="0 0 24 16" width="24" height="16" aria-hidden="true"><path pathLength={1} d={CHECK} /><path pathLength={1} d={CHECK2} /></svg>;
  }
  return <svg className="inkmark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path pathLength={1} d={CHECK} /></svg>;
}

export function Tick({ s, attested }: { s: ClaimStatus; attested?: boolean }) {
  const m = STATUS_META[s];
  const [ref, sight] = useFirstSight<HTMLSpanElement>();
  return (
    <span ref={ref} className={`tick tk-${s} ink-${sight}`} title={`${m.label}: ${m.help}`} role="img" aria-label={m.label}>
      <InkMark s={s} />
      {(attested ?? s === 'attested') && <Person />}
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

export function ReviewPill({ c, fresh }: { c: Claim; fresh?: boolean }) {
  if (c.superseded) return <span className="pill p-grey" title="Replaced by a leaver-attested answer">Superseded</span>;
  if (c.review === 'approved') return <span className={`stamp ok ${fresh ? 'slam' : ''}`}>Approved</span>;
  if (c.review === 'rejected') return <span className={`stamp bad ${fresh ? 'slam' : ''}`}>Rejected</span>;
  return null;
}

/* ---------------- Evidence drawer ---------------- */

interface DrawerState { chunk: Chunk; source?: Source; quote: string; verified: boolean }
const DrawerCtx = createContext<(s: DrawerState | null) => void>(() => {});

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<DrawerState | null>(null);
  const still = reducedMotion();
  useEffect(() => {
    if (!st) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSt(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [st]);
  return (
    <DrawerCtx.Provider value={setSt}>
      {children}
      <AnimatePresence>
        {st && (
          <motion.div key="back" className="drawer-back" onClick={() => setSt(null)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: still ? 0 : 0.2 }}>
            <motion.aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Source evidence"
              initial={still ? false : { x: 48, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 48, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.9 }}>
              <div className="row between">
                <h3>{st.source?.name ?? 'Unknown source'}</h3>
                <button className="btn ghost sm" onClick={() => setSt(null)} aria-label="Close" autoFocus>Close</button>
              </div>
              <div className="mono muted small">
                {st.chunk.ref}
                {st.chunk.author ? ` · ${st.chunk.author}` : ''}
                {st.chunk.ts ? ` · ${fmtDate(st.chunk.ts)}` : ''}
                {st.source ? ` · ${st.source.visibility === 'leads' ? 'Leads only' : 'Team'}` : ''}
              </div>
              <div className={`verify ${st.verified ? 'yes' : 'no'}`}>
                <span className={`tick ${st.verified ? 'tk-cited' : 'tk-conflicting'} ink-play`}>{st.verified ? <InkMark s="cited" /> : '✕'}</span>
                {st.verified ? 'Found word for word in this source' : 'Not found in this source'}
              </div>
              <ChunkText text={st.chunk.text} quote={st.quote} />
              {st.chunk.url ? (
                <a className="btn sm self-start" href={st.chunk.url} target="_blank" rel="noreferrer">Open original ↗</a>
              ) : st.source?.synthetic ? (
                <p className="muted small">Synthetic demo source: this is the stored copy, after masking.</p>
              ) : null}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </DrawerCtx.Provider>
  );
}

/* The stored text, scrolled so the match is in view, then marked like a highlighter stroke. */
function ChunkText({ text, quote }: { text: string; quote: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('mark')?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
  }, [text, quote]);
  return <div ref={ref} className="chunk-text"><Highlight text={text} quote={quote} /></div>;
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
      <mark className="sweep">{m[0]}</mark>
      {text.slice(m.index + m[0].length)}
    </>
  );
}

export function EvidenceList({ claim, chunkById, sourceById, hideRestricted }: {
  claim: Claim; chunkById: Map<string, Chunk>; sourceById: Map<string, Source>; hideRestricted?: boolean;
}) {
  const open = useDrawer();
  const [all, setAll] = useState(false);
  if (!claim.evidence.length) return <div className="ev-none">No supporting quote. {claim.note}</div>;
  const items = claim.evidence
    .map((e) => { const ch = chunkById.get(e.chunkId); return { e, ch, src: ch ? sourceById.get(ch.sourceId) : undefined }; })
    .filter((x) => !(hideRestricted && x.src?.visibility === 'leads'));
  // the first quote is shown; further sources are one click away (the margin tick already says how many agree)
  const more = items.length - 1;
  const row = ({ e, ch, src }: (typeof items)[number]) => (
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
  );
  return (
    <ul className="ev-list">
      {items[0] && <li>{row(items[0])}</li>}
      <AnimatePresence initial={false}>
        {all && items.slice(1).map((x, i) => (
          <motion.li key={i} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion() ? 0 : 0.24, ease: [0.2, 0.8, 0.2, 1] }} style={{ overflow: 'hidden' }}>
            {row(x)}
          </motion.li>
        ))}
      </AnimatePresence>
      {more > 0 && (
        <li><button className="ev-more" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Show one source' : `+${more} more source${more > 1 ? 's' : ''}`}</button></li>
      )}
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

