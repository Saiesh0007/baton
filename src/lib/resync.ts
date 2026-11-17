/**
 * Round 3 re-sync: re-import a source and work out what changed, keeping the ids of chunks that
 * still exist so their claims (and the reviews on them) keep their identity.
 *
 * Matching, in order:
 *  1. same stable key (commit sha, PR/issue number, chat message id, task title)
 *  2. identical text (plain lines that only moved)
 *  3. same kind of locator and mostly the same words -> "changed" (an edited line)
 * Anything left over in the new import is "added"; in the old one, "removed".
 */
import type { Chunk, Project, Source, SyncRecord } from '../types';
import type { Ingested } from './ingest';
import { hash, norm, terms } from './text';

export interface ChunkChange { id: string; before: string; after: string; ref: string }

export interface ResyncResult {
  chunks: Chunk[];          // the source's new chunk list, old ids reused where matched
  added: Chunk[];
  changed: ChunkChange[];
  removed: Chunk[];
  unchanged: number;
}

const refKind = (ref: string) => ref.replace(/[#\d()]+.*$/, '').trim(); // "line 12" -> "line", "PR #4 (open)" -> "PR"

function similarity(a: string, b: string): number {
  const A = new Set(terms(a)), B = new Set(terms(b));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  A.forEach((t) => { if (B.has(t)) shared++; });
  return shared / Math.max(A.size, B.size);
}

export function resyncChunks(sourceId: string, oldChunks: Chunk[], fresh: Chunk[]): ResyncResult {
  const unusedOld = new Map(oldChunks.map((c) => [c.id, c]));
  const byKey = new Map(oldChunks.filter((c) => c.key).map((c) => [c.key!, c]));
  const byText = new Map<string, Chunk[]>();
  oldChunks.forEach((c) => { const k = norm(c.text); byText.set(k, [...(byText.get(k) ?? []), c]); });

  const out: (Chunk | null)[] = fresh.map(() => null);
  const changed: ChunkChange[] = [];
  let unchanged = 0;
  const take = (o: Chunk) => { unusedOld.delete(o.id); };
  const keep = (n: Chunk, o: Chunk): Chunk => ({ ...n, id: o.id, sourceId });

  // 1. stable keys
  fresh.forEach((n, i) => {
    const o = n.key ? byKey.get(n.key) : undefined;
    if (!o || !unusedOld.has(o.id)) return;
    take(o);
    out[i] = keep(n, o);
    if (norm(o.text) === norm(n.text)) unchanged++;
    else changed.push({ id: o.id, before: o.text, after: n.text, ref: n.ref });
  });
  // 2. identical text
  fresh.forEach((n, i) => {
    if (out[i]) return;
    const o = (byText.get(norm(n.text)) ?? []).find((c) => unusedOld.has(c.id) && (!c.key || c.key === n.key));
    if (!o) return;
    take(o);
    out[i] = keep(n, o);
    unchanged++;
  });
  // 3. edited text: best remaining old chunk of the same kind with most words in common
  fresh.forEach((n, i) => {
    if (out[i] || n.key) return; // keyed items that found no key match are genuinely new
    let best: { o: Chunk; s: number } | null = null;
    for (const o of unusedOld.values()) {
      if (o.key || refKind(o.ref) !== refKind(n.ref)) continue;
      const s = similarity(o.text, n.text);
      if (s >= 0.5 && (!best || s > best.s)) best = { o, s };
    }
    if (!best) return;
    take(best.o);
    out[i] = keep(n, best.o);
    changed.push({ id: best.o.id, before: best.o.text, after: n.text, ref: n.ref });
  });

  const added: Chunk[] = [];
  const used = new Set<string>(out.filter(Boolean).map((c) => c!.id));
  const chunks = fresh.map((n, i) => {
    if (out[i]) return out[i]!;
    let id = `${sourceId}-${hash((n.key ?? '') + '|' + n.text)}`;
    while (used.has(id)) id += 'x';
    used.add(id);
    const c = { ...n, id, sourceId };
    added.push(c);
    return c;
  });
  return { chunks, added, changed, removed: [...unusedOld.values()], unchanged };
}

/** GitHub repo behind a source, for a live re-fetch ("owner/name"), if there is one. */
export function githubRepoOf(s: Source): string | undefined {
  if (s.kind !== 'github' || s.synthetic) return undefined;
  const m = /github\.com\/([^/]+\/[^/#?]+)/.exec(s.url ?? '') ?? /GitHub · ([^\s]+\/[^\s]+)/.exec(s.name);
  return m?.[1];
}

export interface ResyncSummary extends SyncRecord { sourceName: string; changes: ChunkChange[]; removedRefs: string[] }

/**
 * Apply a re-import to a project: swap the source's chunks for the matched set, keep its id and
 * visibility, record the sync, and count approvals that now rest on changed or deleted text
 * (analyze() turns those into "needs re-review").
 */
export function applyResync(p: Project, sourceId: string, fresh: Ingested, by: string, ts = new Date().toISOString()): { project: Project; summary: ResyncSummary } {
  const src = p.sources.find((s) => s.id === sourceId);
  if (!src) throw new Error('That source no longer exists.');
  const old = p.chunks.filter((c) => c.sourceId === sourceId);
  const r = resyncChunks(sourceId, old, fresh.chunks);
  const touched = new Set([...r.changed.map((c) => c.id), ...r.removed.map((c) => c.id)]);
  const flagged = Object.values(p.reviews).filter((rv) => rv.state === 'approved' && rv.basis?.some((b) => touched.has(b.chunkId))).length;
  const rec: SyncRecord = { ts, by, added: r.added.length, changed: r.changed.length, removed: r.removed.length, unchanged: r.unchanged, flagged };
  // keep the source's place in the chunk list so claim order stays stable
  const first = p.chunks.findIndex((c) => c.sourceId === sourceId);
  const others = p.chunks.filter((c) => c.sourceId !== sourceId);
  const at = first < 0 ? others.length : p.chunks.slice(0, first).filter((c) => c.sourceId !== sourceId).length;
  const chunks = [...others.slice(0, at), ...r.chunks, ...others.slice(at)];
  const source: Source = {
    ...src,
    name: src.kind === 'github' && !fresh.source.synthetic ? fresh.source.name : src.name,
    url: fresh.source.url ?? src.url,
    importedAt: ts,
    redactions: fresh.source.redactions,
    syncs: [...(src.syncs ?? []), rec].slice(-20),
  };
  const what = rec.added + rec.changed + rec.removed === 0 ? 'no changes' : `${rec.added} new, ${rec.changed} changed, ${rec.removed} removed`;
  return {
    project: {
      ...p,
      chunks,
      sources: p.sources.map((s) => (s.id === sourceId ? source : s)),
      audit: [{ ts, actor: by, action: `Re-synced "${src.name}": ${what}${flagged ? `; ${flagged} approved claim${flagged > 1 ? 's' : ''} sent back for re-review` : ''}` }, ...p.audit].slice(0, 300),
    },
    summary: { ...rec, sourceName: src.name, changes: r.changed, removedRefs: r.removed.map((c) => c.ref) },
  };
}
