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
    if (!c.evidence.length) { visible.push(c); continue; }
    const ev = c.evidence.filter((e) => allowed(e.chunkId));
    if (ev.length) visible.push({ ...c, evidence: ev });
    else shadows.push({ ...c, statement: '', originalStatement: '', evidence: [], people: [] }); // content withheld
  }
  // restricted chunks are dropped from the successor's copy entirely
  const okChunks = new Map([...chunkById].filter(([id]) => allowed(id)));
  return { snap, visible, shadows, chunkById: okChunks, sourceById };
}

