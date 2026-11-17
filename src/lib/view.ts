import type { Claim, Chunk, PublishedSnapshot, Source } from '../types';

export interface View {
  snap: PublishedSnapshot;
  visible: Claim[];
  shadows: Claim[];
  chunkById: Map<string, Chunk>;
  sourceById: Map<string, Source>;
}

/** Build the successor's view: permission filter applied BEFORE anything is rendered or searched. */
export function buildView(snap: PublishedSnapshot): View {
  const sourceById = new Map(snap.sources.map((s) => [s.id, s]));
  const chunkById = new Map(snap.chunks.map((c) => [c.id, c]));
  const allowed = (chunkId: string) => {
    const ch = chunkById.get(chunkId);
    const src = ch && sourceById.get(ch.sourceId);
    return !!src && src.visibility === 'team';
  };
  const visible: Claim[] = [];
  const shadows: Claim[] = [];
  for (const c of snap.claims) {
    if (c.restricted) { shadows.push(c); continue; } // already withheld by the server (team copy)
    if (!c.evidence.length) { visible.push(c); continue; }
    const ev = c.evidence.filter((e) => allowed(e.chunkId));
    // the statement is worded from the first quote; if that quote is leads-only, the wording is too
    if (ev.length && (allowed(c.evidence[0].chunkId) || c.edited)) visible.push({ ...c, evidence: ev });
    else shadows.push({ ...c, statement: '', originalStatement: '', evidence: [], people: [] }); // content withheld
  }
  // restricted chunks are dropped from the successor's copy entirely
  const okChunks = new Map([...chunkById].filter(([id]) => allowed(id)));
  return { snap, visible, shadows, chunkById: okChunks, sourceById };
}


/**
 * The successor's copy of a published version (Round 3). Used by the server function api/publish
 * with visibility read from the database, so the browser's own labels are never trusted.
 * Claims backed only by leads-only evidence become content-free placeholders ("knowledge shadows");
 * leads-only quotes, chunks and sources are removed; reviewer-only fields are dropped.
 */
export function teamSnapshot(snap: PublishedSnapshot, chunkIsTeam: (chunkId: string) => boolean, sourceIsTeam: (sourceId: string) => boolean): PublishedSnapshot {
  const claims: Claim[] = snap.claims.map((c) => {
    const base = { ...c, versions: [], stale: undefined, note: c.origin === 'interview' ? c.note : undefined };
    if (!c.evidence.length) return base;
    const ev = c.evidence.filter((e) => chunkIsTeam(e.chunkId));
    // the statement is worded from the first quote: if that one is leads-only, so is the wording
    // (unless the reviewer rewrote it, which is a deliberate decision to share it)
    if (ev.length && (chunkIsTeam(c.evidence[0].chunkId) || c.edited)) return { ...base, evidence: ev, originalStatement: c.edited ? '' : c.originalStatement };
    return {
      id: c.id, workstream: c.workstream, type: c.type, status: c.status, review: c.review, origin: c.origin,
      statement: '', originalStatement: '', evidence: [], people: [], conflictWith: [], edited: false, versions: [], restricted: true,
    };
  });
  return {
    ...snap,
    claims,
    chunks: snap.chunks.filter((ch) => chunkIsTeam(ch.id)),
    sources: snap.sources.filter((s) => sourceIsTeam(s.id)),
  };
}
