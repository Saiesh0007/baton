/**
 * LLM claim proposer (Round 3). Shared by the server function (api/propose.ts), the
 * evaluation script (scripts/eval-llm.ts) and the app. The model only PROPOSES claims:
 * every quote it returns is still checked word for word by verifyQuote() in analyze.ts,
 * so an invented quote can never reach the ledger.
 */
import type { Chunk, ClaimType } from '../types';
// '.js' so Vercel's Node runtime can load this file from api/ as an ES module
import { hash, norm } from './text.js';

export const LLM_MODEL = 'openai/gpt-oss-120b';
export const LLM_MODEL_LABEL = 'gpt-oss-120b (open weights) on Groq';
/** Used only when the main model's daily quota is used up; claims record which model proposed them. */
export const LLM_FALLBACK = 'openai/gpt-oss-20b';

/** What the model proposes for one chunk. Cached by the chunk's text, not its id. */
export interface LlmClaim { type: ClaimType; workstream: string; statement: string; quote: string; model?: string }

export interface LlmState {
  enabled: boolean;
  model: string;
  /** textKey(chunk.text) -> proposals ([] = analysed, nothing worth keeping) */
  cache: Record<string, LlmClaim[]>;
  ranAt?: string;
  lastError?: string;
  /** proposals shipped with the demo (made ahead of time with the same model) */
  prebuilt?: boolean;
}

/** `key` is textKey() of the FULL chunk text (the sent text may be cut); the server ignores it. */
export const newLlmState = (): LlmState => ({ enabled: true, model: LLM_MODEL, cache: {} });

export interface ChunkIn { id: string; text: string; author?: string; ref: string; key?: string }
export interface WorkstreamIn { id: string; name: string; keywords?: string[] }

export const CLAIM_TYPES: ClaimType[] = ['decision', 'owner', 'status', 'risk', 'dependency', 'task', 'issue', 'contact'];

export const textKey = (text: string) => `${hash(text)}.${text.length}`;

/* Limits that keep one request inside Groq's free tier (8k tokens/minute) and stop abuse of the key. */
export const MAX_BATCH_CHARS = 8000; // ~2.5k tokens: fewer, larger batches send the instructions fewer times
export const MAX_CHUNK_CHARS = 1000;
export const MAX_BATCH_CHUNKS = 40;

export const SYSTEM_PROMPT = `You extract knowledge-handover claims for a person taking over a project from someone who is leaving.

You receive numbered source chunks (commits, PRs, issues, README lines, chat messages, notes) and a list of workstreams.
Return only claims a successor would genuinely need: who owns what, current status (including deprecated / end of life / maintenance mode), decisions and why, risks and fragile parts, dependencies, recurring issues, open next actions, and who to contact.

Do NOT return claims for:
- user support questions, bug reports from strangers asking for help, or "how do I" questions
- API reference, usage examples, installation steps, option descriptions, code, logs, badges
- routine commits (typo fixes, version bumps, formatting, dependency bumps, merges) unless they state a decision, a status change or a risk
- anything a bot wrote
- generic statements that would be true of any project

Rules:
- "quote" MUST be copied character for character from the chunk text: ONE contiguous span, usually one sentence, 15 to 200 characters. Never paraphrase, shorten with "...", join two places, or fix spelling.
- Each chunk starts with a metadata line beginning with "#". Never quote the metadata line.
- "statement" is one plain, self-contained sentence a successor can read without the source (name the component; resolve "this"/"it").
- "type" is one of: decision, owner, status, risk, dependency, task, issue, contact.
  status = how finished or working something is now (live, done, half done, broken, paused, deprecated).
  dependency = something outside the team the work relies on or waits for (vendors, notice periods, other teams, services).
  issue = a problem that keeps coming back. task = an open next action.
- "workstream" is one of the given workstream ids; use "general" if none fits.
- Prefer fewer, high-value claims. Returning no claims for a chunk is normal.

Respond with JSON only: {"claims":[{"chunk":<number>,"type":"...","workstream":"...","statement":"...","quote":"..."}]}`;

/** Chunks that are worth sending: no bots, no structured task rows, no blank or code-only text. */
export function worthSending(ch: Chunk, isBot: (a?: string) => boolean): boolean {
  if (ch.task || isBot(ch.author)) return false;
  const t = ch.text.trim();
  if (t.length < 20) return false;
  const letters = t.replace(/[^a-z]/gi, '').length;
  return letters / t.length >= 0.5;
}

export function toChunkIn(ch: Chunk): ChunkIn {
  return { id: ch.id, text: ch.text.slice(0, MAX_CHUNK_CHARS), author: ch.author, ref: ch.ref, key: textKey(ch.text) };
}

/** Split chunks into batches that fit one request. */
export function makeBatches(chunks: ChunkIn[]): ChunkIn[][] {
  const out: ChunkIn[][] = [];
  let cur: ChunkIn[] = [];
  let size = 0;
  for (const c of chunks) {
    const n = c.text.length + 40;
    if (cur.length && (size + n > MAX_BATCH_CHARS || cur.length >= MAX_BATCH_CHUNKS)) { out.push(cur); cur = []; size = 0; }
    cur.push(c);
    size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

export function buildUserMessage(batch: ChunkIn[], ws: WorkstreamIn[]): string {
  const wsList = ws.map((w) => `- ${w.id}: ${w.name}${w.keywords?.length ? ` (topics: ${w.keywords.slice(0, 12).join(', ')})` : ''}`).join('\n');
  const body = batch.map((c, i) => `# chunk ${i + 1} · ${c.ref}${c.author ? ` · by ${c.author}` : ''}\n${c.text}`).join('\n\n');
  return `Workstreams:\n${wsList}\n\nChunks:\n${body}`;
}

/**
 * Proposer-side tidy-up: if the model stitched a quote together with "...", keep the longest
 * piece that appears in the chunk. The verifier in analyze.ts still checks the result word for word.
 */
export function fitQuote(quote: string, text: string): string {
  const t = norm(text);
  if (t.includes(norm(quote))) return quote;
  const parts = quote.split(/\s*(?:\.{3}|…)\s*/).map((x) => x.trim()).filter((x) => x.length >= 15 && t.includes(norm(x)));
  return parts.sort((a, b) => b.length - a.length)[0] ?? quote;
}

/** Validate the model's JSON against the batch. Anything malformed is dropped, never repaired. */
export function parseLlmJson(content: string, batch: ChunkIn[], ws: WorkstreamIn[]): Record<string, LlmClaim[]> {
  const out: Record<string, LlmClaim[]> = {};
  batch.forEach((c) => { out[c.id] = []; });
  let data: unknown;
  try { data = JSON.parse(content); } catch {
    // lenient fallback for replies made without JSON mode: take the outermost {...}
    const a = content.indexOf('{'), b = content.lastIndexOf('}');
    try { data = a >= 0 && b > a ? JSON.parse(content.slice(a, b + 1)) : undefined; } catch { data = undefined; }
  }
  const claims = (data as { claims?: unknown })?.claims;
  if (!Array.isArray(claims)) throw new BadOutput('The model did not return readable JSON.');
  const wsIds = new Set(ws.map((w) => w.id));
  for (const raw of claims) {
    const r = raw as Record<string, unknown>;
    const idx = Number(r.chunk) - 1;
    const ch = batch[idx];
    if (!ch) continue;
    const type = String(r.type ?? '') as ClaimType;
    const statement = String(r.statement ?? '').trim().slice(0, 400);
    const quote = fitQuote(String(r.quote ?? '').trim(), ch.text).slice(0, 400);
    if (!CLAIM_TYPES.includes(type) || statement.length < 8 || quote.length < 8) continue;
    const wsId = String(r.workstream ?? '');
    const list = out[ch.id];
    if (list.some((x) => norm(x.quote) === norm(quote) && x.type === type)) continue;
    list.push({ type, workstream: wsIds.has(wsId) ? wsId : '', statement, quote });
  }
  return out;
}

/** The model answered, but not in a usable shape. Worth retrying on a smaller batch. */
export class BadOutput extends Error { name = 'BadOutput'; }

/** The daily token/request quota for a model is used up: waiting minutes will not help. */
export class DailyLimit extends Error { name = 'DailyLimit'; }

export class RateLimited extends Error {
  retryAfter: number;
  constructor(seconds: number) { super(`Rate limited, retry in ${seconds}s`); this.retryAfter = seconds; }
}

function retrySeconds(h: Headers): number {
  const ra = Number(h.get('retry-after'));
  if (Number.isFinite(ra) && ra > 0) return Math.min(60, Math.ceil(ra));
  const m = /([\d.]+)s/.exec(h.get('x-ratelimit-reset-tokens') ?? '');
  return m ? Math.min(60, Math.ceil(Number(m[1]))) : 20;
}

async function groqOnce(apiKey: string, batch: ChunkIn[], ws: WorkstreamIn[], model: string, jsonMode: boolean): Promise<Record<string, LlmClaim[]>> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      reasoning_effort: 'low',
      // counts against the 8k tokens/minute budget together with the input, so keep it modest
      max_completion_tokens: 2500,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: buildUserMessage(batch, ws) }],
    }),
  });
  if (res.status === 429 || res.status === 413) {
    const detail = await res.text();
    // one request bigger than the per-minute budget never succeeds by waiting: split it instead
    if (/per day|\(TPD\)|\(RPD\)/i.test(detail)) throw new DailyLimit(`Daily quota for ${model} is used up.`);
    if (res.status === 413 || /request too large/i.test(detail)) throw new BadOutput('Batch too large for the rate limit.');
    throw new RateLimited(retrySeconds(res.headers));
  }
  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 400 && /json_validate_failed|failed_generation/.test(detail)) throw new BadOutput('The model returned malformed JSON.');
    throw new Error(`Groq error ${res.status}: ${detail.slice(0, 160)}`);
  }
  const json = await res.json() as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  return parseLlmJson(json.choices?.[0]?.message?.content ?? '', batch, ws);
}

async function groqModel(apiKey: string, batch: ChunkIn[], ws: WorkstreamIn[], model: string): Promise<Record<string, LlmClaim[]>> {
  try { return await groqOnce(apiKey, batch, ws, model, true); } catch (e) {
    if (!(e instanceof BadOutput)) throw e;
    return groqOnce(apiKey, batch, ws, model, false);
  }
}

/**
 * One batch through Groq. JSON mode first; if Groq rejects the JSON, one retry without it.
 * If a model's daily quota is used up, the next model in `models` is tried; every claim records its model.
 */
export async function callGroq(apiKey: string, batch: ChunkIn[], ws: WorkstreamIn[], models: string[] = [LLM_MODEL, LLM_FALLBACK]): Promise<Record<string, LlmClaim[]>> {
  for (let i = 0; i < models.length; i++) {
    try {
      const out = await groqModel(apiKey, batch, ws, models[i]);
      for (const list of Object.values(out)) list.forEach((c) => { c.model = models[i]; });
      return out;
    } catch (e) {
      if (!(e instanceof DailyLimit) || i === models.length - 1) throw e;
    }
  }
  throw new DailyLimit('No model available.');
}

export interface RunProgress { done: number; total: number; waiting?: number }

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Stopped', 'AbortError')); }, { once: true });
});

/**
 * Runs every batch through `send`, waiting out rate limits. A batch the model garbles is split
 * in half and retried; a single chunk that still fails is skipped (left un-cached, so a later run
 * retries it). Setup errors (no key, offline) stop the run. Partial results are always kept.
 */
export async function proposeAll(
  chunks: ChunkIn[], ws: WorkstreamIn[],
  send: (batch: ChunkIn[], ws: WorkstreamIn[]) => Promise<Record<string, LlmClaim[]>>,
  opts: { onProgress?: (p: RunProgress) => void; onBatch?: (cache: Record<string, LlmClaim[]>) => void; signal?: AbortSignal; maxWaits?: number } = {},
): Promise<{ cache: Record<string, LlmClaim[]>; error?: string; skipped: number }> {
  const queue = makeBatches(chunks);
  const total = chunks.length;
  const cache: Record<string, LlmClaim[]> = {};
  let waits = 0, done = 0, skipped = 0;
  while (queue.length) {
    if (opts.signal?.aborted) return { cache, error: 'Stopped.', skipped };
    const batch = queue[0];
    opts.onProgress?.({ done, total });
    try {
      const res = await send(batch, ws);
      const part: Record<string, LlmClaim[]> = {};
      for (const c of batch) part[c.key ?? textKey(c.text)] = res[c.id] ?? [];
      Object.assign(cache, part);
      opts.onBatch?.(part);
      done += batch.length;
      queue.shift();
    } catch (e) {
      if ((e as Error).name === 'AbortError') return { cache, error: 'Stopped.', skipped };
      if (e instanceof DailyLimit) return { cache, error: "Today's free LLM quota is used up. The rules proposer covers the rest; the LLM resumes when the quota refills.", skipped };
      if (e instanceof RateLimited) {
        if (waits++ >= (opts.maxWaits ?? 12)) return { cache, error: 'The LLM is busy (rate limit). Try again in a minute.', skipped };
        opts.onProgress?.({ done, total, waiting: e.retryAfter });
        try { await sleep(e.retryAfter * 1000, opts.signal); } catch { return { cache, error: 'Stopped.', skipped }; }
        continue;
      }
      if (e instanceof BadOutput) {
        queue.shift();
        if (batch.length > 1) {
          const mid = Math.ceil(batch.length / 2);
          queue.unshift(batch.slice(0, mid), batch.slice(mid));
        } else { skipped++; done++; }
        continue;
      }
      return { cache, error: (e as Error).message, skipped };
    }
  }
  opts.onProgress?.({ done: total, total });
  return { cache, skipped };
}

/** Team-visible chunks the LLM has not analysed yet. Leads-only sources are never included. */
export function pendingChunks(chunks: Chunk[], sources: { id: string; visibility: string }[], cache: Record<string, LlmClaim[]>, isBot: (a?: string) => boolean): Chunk[] {
  const team = new Set(sources.filter((s) => s.visibility === 'team').map((s) => s.id));
  return chunks.filter((c) => team.has(c.sourceId) && worthSending(c, isBot) && !(textKey(c.text) in cache));
}

/** Browser side: one batch through our server function (/api/propose). */
export async function sendViaApi(batch: ChunkIn[], ws: WorkstreamIn[]): Promise<Record<string, LlmClaim[]>> {
  let res: Response;
  try {
    res = await fetch('/api/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunks: batch.map((c) => ({ id: c.id, text: c.text, ref: c.ref, author: c.author })), workstreams: ws }),
    });
  } catch {
    throw new Error('Could not reach the LLM service. Check your connection.');
  }
  const body = await res.json().catch(() => ({})) as { proposals?: Record<string, LlmClaim[]>; error?: string; retryAfter?: number; code?: string };
  if (res.status === 429 && body.code === 'daily_limit') throw new DailyLimit(body.error ?? 'Daily LLM quota used up.');
  if (res.status === 429) throw new RateLimited(body.retryAfter ?? 20);
  if (res.status === 422) throw new BadOutput(body.error ?? 'The model returned malformed JSON.');
  if (!res.ok || !body.proposals) throw new Error(body.error ?? `LLM service error ${res.status}`);
  return body.proposals;
}
