/**
 * POST /api/propose  -> LLM claim proposals for one batch of chunks.
 * The Groq key is read here, on the server, and never reaches the browser.
 * One batch per request keeps each call short; on 429 the client waits retryAfter seconds.
 *
 * Two modes:
 *  - demo / this-browser handovers: { chunks: [{id, text, ref, author}], workstreams } (team text only)
 *  - shared handovers (signed in):  { projectId, chunkIds, workstreams } with a Bearer token. The text
 *    is read here from the database, team-visible rows only, so leads-only text can never be put
 *    into the prompt, whatever the browser sends.
 */
import { adminClient, callerRole, json } from './_supabase.js';
import { BadOutput, DailyLimit, callGroq, MAX_BATCH_CHARS, MAX_BATCH_CHUNKS, MAX_CHUNK_CHARS, LLM_MODEL, RateLimited, type ChunkIn, type WorkstreamIn } from '../src/lib/llm.js';

function readWorkstreams(raw: unknown): WorkstreamIn[] {
  return (Array.isArray(raw) ? raw as Record<string, unknown>[] : []).slice(0, 30)
    .filter((w) => typeof w?.id === 'string' && typeof w.name === 'string')
    .map((w) => ({ id: String(w.id).slice(0, 60), name: String(w.name).slice(0, 80), keywords: Array.isArray(w.keywords) ? w.keywords.slice(0, 12).map((k) => String(k).slice(0, 40)) : undefined }));
}

function readBody(raw: unknown): { chunks: ChunkIn[]; workstreams: WorkstreamIn[] } | string {
  const b = raw as { chunks?: unknown; workstreams?: unknown };
  if (!b || !Array.isArray(b.chunks) || !Array.isArray(b.workstreams)) return 'Expected { chunks: [], workstreams: [] }.';
  if (!b.chunks.length) return 'No chunks to analyse.';
  if (b.chunks.length > MAX_BATCH_CHUNKS) return `At most ${MAX_BATCH_CHUNKS} chunks per request.`;
  const chunks: ChunkIn[] = [];
  for (const c of b.chunks as Record<string, unknown>[]) {
    if (typeof c?.id !== 'string' || typeof c.text !== 'string') return 'Each chunk needs a string id and text.';
    chunks.push({ id: c.id.slice(0, 120), text: c.text.slice(0, MAX_CHUNK_CHARS), ref: String(c.ref ?? '').slice(0, 80), author: c.author ? String(c.author).slice(0, 80) : undefined });
  }
  if (chunks.reduce((n, c) => n + c.text.length, 0) > MAX_BATCH_CHARS * 1.2) return 'Batch too large.';
  return { chunks, workstreams: readWorkstreams(b.workstreams) };
}

async function chunksFromDb(request: Request, raw: Record<string, unknown>): Promise<{ chunks: ChunkIn[]; workstreams: WorkstreamIn[] } | Response> {
  const db = adminClient();
  if (!db) return json(503, { error: 'Accounts are not configured on this server.' });
  const who = await callerRole(request, db, raw.projectId);
  if (who instanceof Response) return who;
  if (who.role === 'successor') return json(403, { error: 'Only the reviewer or leaver can run the proposer.' });
  const ids = Array.isArray(raw.chunkIds) ? raw.chunkIds.filter((x): x is string => typeof x === 'string').slice(0, MAX_BATCH_CHUNKS) : [];
  if (!ids.length) return json(400, { error: 'No chunks to analyse.' });
  const { data, error } = await db.from('chunks').select('id, data').eq('project_id', raw.projectId as string).eq('visibility', 'team').in('id', ids);
  if (error) return json(500, { error: 'Could not read the sources.' });
  const byId = new Map(data.map((r) => [r.id as string, r.data as { text?: string; ref?: string; author?: string }]));
  const chunks: ChunkIn[] = ids.filter((id) => byId.has(id)).map((id) => {
    const d = byId.get(id)!;
    return { id, text: String(d.text ?? '').slice(0, MAX_CHUNK_CHARS), ref: String(d.ref ?? '').slice(0, 80), author: d.author ? String(d.author).slice(0, 80) : undefined };
  });
  return { chunks, workstreams: readWorkstreams(raw.workstreams) };
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return json(503, { error: 'LLM is not configured on this server.' });
  let raw: unknown;
  try { raw = await request.json(); } catch { return json(400, { error: 'Body must be JSON.' }); }
  let body: { chunks: ChunkIn[]; workstreams: WorkstreamIn[] };
  if (raw && typeof raw === 'object' && 'projectId' in raw) {
    const r = await chunksFromDb(request, raw as Record<string, unknown>);
    if (r instanceof Response) return r;
    if (!r.chunks.length) return json(200, { model: LLM_MODEL, proposals: {} }); // nothing team-visible to read
    body = r;
  } else {
    const r = readBody(raw);
    if (typeof r === 'string') return json(400, { error: r });
    body = r;
  }
  try {
    const proposals = await callGroq(key, body.chunks, body.workstreams);
    return json(200, { model: LLM_MODEL, proposals });
  } catch (e) {
    if (e instanceof DailyLimit) return json(429, { error: e.message, code: 'daily_limit' });
    if (e instanceof RateLimited) return json(429, { error: 'The LLM is busy (free-tier rate limit).', retryAfter: e.retryAfter });
    if (e instanceof BadOutput) return json(422, { error: e.message, code: 'bad_output' });
    return json(502, { error: (e as Error).message });
  }
}

export function GET(): Response {
  return json(200, { ok: true, configured: !!process.env.GROQ_API_KEY, accounts: !!adminClient(), model: LLM_MODEL });
}
