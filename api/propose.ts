/**
 * POST /api/propose  -> LLM claim proposals for one batch of chunks.
 * The Groq key is read here, on the server, and never reaches the browser.
 * One batch per request keeps each call short; on 429 the client waits retryAfter seconds.
 */
import { BadOutput, DailyLimit, callGroq, MAX_BATCH_CHARS, MAX_BATCH_CHUNKS, MAX_CHUNK_CHARS, LLM_MODEL, RateLimited, type ChunkIn, type WorkstreamIn } from '../src/lib/llm.js';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

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
  const workstreams = (b.workstreams as Record<string, unknown>[]).slice(0, 30)
    .filter((w) => typeof w?.id === 'string' && typeof w.name === 'string')
    .map((w) => ({ id: String(w.id).slice(0, 60), name: String(w.name).slice(0, 80), keywords: Array.isArray(w.keywords) ? w.keywords.slice(0, 12).map((k) => String(k).slice(0, 40)) : undefined }));
  return { chunks, workstreams };
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return json(503, { error: 'LLM is not configured on this server.' });
  let raw: unknown;
  try { raw = await request.json(); } catch { return json(400, { error: 'Body must be JSON.' }); }
  const body = readBody(raw);
  if (typeof body === 'string') return json(400, { error: body });
  try {
    const proposals = await callGroq(key, body.chunks, body.workstreams);
    return json(200, { model: LLM_MODEL, proposals });
  } catch (e) {
    if (e instanceof RateLimited) return json(429, { error: 'The LLM is busy (free-tier rate limit).', retryAfter: e.retryAfter });
    if (e instanceof BadOutput) return json(422, { error: e.message, code: 'bad_output' });
    if (e instanceof DailyLimit) return json(429, { error: e.message, code: 'daily_limit' });
    return json(502, { error: (e as Error).message });
  }
}

export function GET(): Response {
  return json(200, { ok: true, configured: !!process.env.GROQ_API_KEY, model: LLM_MODEL });
}
