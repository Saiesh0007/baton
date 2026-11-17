/**
 * Round 3 (improvement 2): shared handovers in Supabase.
 * The browser uses the publishable key and the signed-in user's session, so every query runs under
 * row-level security: a successor's queries simply never return leads-only rows.
 */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Ack, Chunk, Project, PublishedSnapshot, Role, Source, SuccessorQuestion } from '../types';
import type { LlmClaim, ChunkIn, WorkstreamIn } from './llm';
import { BadOutput, DailyLimit, RateLimited } from './llm';

let sb: SupabaseClient | null = null;
let apiBase = '';
export let cloudEnabled = false;

/** Set up the client (the app does this from its build env; scripts/rls-check.ts calls it directly). */
export function initCloud(url: string | undefined, key: string | undefined, base = '', persist = true) {
  cloudEnabled = !!(url && key);
  sb = cloudEnabled ? createClient(url!, key!, { auth: { persistSession: persist, autoRefreshToken: persist } }) : null;
  apiBase = base;
}
const env = (import.meta as { env?: Record<string, string | undefined> }).env;
if (env) initCloud(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY);
export const supabase = () => sb;

const need = () => { if (!sb) throw new Error('Accounts are not set up on this deployment.'); return sb; };
const fail = (what: string, e: { message: string } | null) => { if (e) throw new Error(`${what}: ${friendly(e.message)}`); };
function friendly(m: string): string {
  if (/row-level security|permission denied/i.test(m)) return 'you do not have permission for that.';
  if (/JWT|session/i.test(m)) return 'your session expired. Sign in again.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'no connection to the server.';
  return m;
}

/* ---------------------------------------------------------------- auth */

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await need().auth.signUp({ email, password, options: { data: { name } } });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error('Account created. Check your email to confirm it, then sign in.');
  return data.session;
}
export async function signIn(email: string, password: string) {
  const { data, error } = await need().auth.signInWithPassword({ email, password });
  if (error) throw new Error(/invalid/i.test(error.message) ? 'Wrong email or password.' : error.message);
  return data.session;
}
export async function signOut() { await need().auth.signOut(); }
export const displayName = (s: Session | null) => (s?.user.user_metadata?.name as string | undefined) || s?.user.email?.split('@')[0] || 'You';

/* ---------------------------------------------------------------- listing, creating, joining */

export interface CloudItem { id: string; name: string; description: string; role: Role; createdAt: string }

export async function listProjects(): Promise<CloudItem[]> {
  const db = need();
  const { data: u } = await db.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await db.from('members').select('role, projects(id, name, description, created_at)').eq('user_id', u.user.id);
  fail('Could not load your handovers', error);
  type Row = { role: Role; projects: { id: string; name: string; description: string; created_at: string } | null };
  return ((data ?? []) as unknown as Row[]).filter((r) => r.projects).map((r) => ({
    id: r.projects!.id, name: r.projects!.name, description: r.projects!.description, role: r.role, createdAt: r.projects!.created_at,
  })).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Create a shared handover from a local Project (a new one, or a copy of the demo). Returns its id. */
export async function createProject(p: Project): Promise<string> {
  const db = need();
  const { data, error } = await db.from('projects').insert({ name: p.name, description: p.description, people: p.people, workstreams: p.workstreams }).select('id').single();
  fail('Could not create the handover', error);
  const id = data!.id as string;
  const empty: Project = { ...p, id, sources: [], chunks: [], answers: {}, reviews: {}, manualClaims: [], acks: {}, successorQuestions: [], audit: [], published: undefined, history: undefined, llm: undefined };
  await saveProject(empty, { ...p, id, published: undefined, history: undefined, isDemo: false }, 'reviewer');
  return id;
}

export async function deleteProject(id: string) {
  const { error } = await need().from('projects').delete().eq('id', id);
  fail('Could not delete', error);
}

export async function createInvite(projectId: string, role: Role): Promise<string> {
  const { data, error } = await need().from('invites').insert({ project_id: projectId, role }).select('token').single();
  fail('Could not create the invite', error);
  return data!.token as string;
}

export async function acceptInvite(token: string, name: string): Promise<string> {
  const { data, error } = await need().rpc('accept_invite', { invite_token: token, name });
  if (error) throw new Error(error.message.replace(/^.*?: /, ''));
  return data as string;
}

export interface Member { userId: string; role: Role; name: string; joinedAt: string }
export async function listMembers(projectId: string): Promise<Member[]> {
  const { data, error } = await need().from('members').select('user_id, role, display_name, joined_at').eq('project_id', projectId);
  fail('Could not load members', error);
  return (data ?? []).map((m) => ({ userId: m.user_id, role: m.role, name: m.display_name, joinedAt: m.joined_at }));
}
export async function removeMember(projectId: string, userId: string) {
  const { error } = await need().from('members').delete().eq('project_id', projectId).eq('user_id', userId);
  fail('Could not remove', error);
}

/* ---------------------------------------------------------------- load */

type StateData = Pick<Project, 'answers' | 'reviews' | 'manualClaims' | 'audit' | 'llm'>;
const STATE_KEYS: (keyof StateData)[] = ['answers', 'reviews', 'manualClaims', 'audit', 'llm'];

async function allRows<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    fail('Could not load the handover', error);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export async function loadProject(id: string): Promise<{ project: Project; role: Role }> {
  const db = need();
  const { data: u } = await db.auth.getUser();
  if (!u.user) throw new Error('Sign in to open shared handovers.');
  const [{ data: proj, error: pe }, { data: me, error: me_ }] = await Promise.all([
    db.from('projects').select('*').eq('id', id).maybeSingle(),
    db.from('members').select('role').eq('project_id', id).eq('user_id', u.user.id).maybeSingle(),
  ]);
  fail('Could not open the handover', pe ?? me_);
  if (!proj || !me) throw new Error('This handover does not exist or you are not a member of it.');
  const role = me.role as Role;

  const [stateRow, succRow, sources, chunks, published] = await Promise.all([
    role === 'successor' ? Promise.resolve(null) : db.from('project_state').select('data').eq('project_id', id).maybeSingle().then((r) => { fail('Could not load the working state', r.error); return r.data; }),
    db.from('successor_state').select('acks, questions').eq('project_id', id).maybeSingle().then((r) => { fail('Could not load acknowledgements', r.error); return r.data; }),
    allRows<{ id: string; visibility: 'team' | 'leads'; data: Omit<Source, 'id' | 'visibility'> }>((a, b) => db.from('sources').select('id, visibility, data').eq('project_id', id).order('id').range(a, b)),
    allRows<{ id: string; source_id: string; data: Omit<Chunk, 'id' | 'sourceId'> }>((a, b) => db.from('chunks').select('id, source_id, data').eq('project_id', id).order('id').range(a, b)),
    allRows<{ version: number; visibility: 'full' | 'team'; snapshot: PublishedSnapshot }>((a, b) => db.from('published').select('version, visibility, snapshot').eq('project_id', id).order('version').range(a, b)),
  ]);

  // reviewer/leaver get the full copy of each version; a successor can only ever read the team copy
  const byVersion = new Map<number, PublishedSnapshot>();
  for (const r of published) if (r.visibility === 'full' || !byVersion.has(r.version)) byVersion.set(r.version, r.snapshot);
  const history = [...byVersion.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s);
  const st = (stateRow?.data ?? {}) as Partial<StateData>;
  // keep chunks in import order: each row stores its position (ids sort alphabetically in the database)
  const chunkList = chunks.map((c) => ({ ...c.data, id: c.id, sourceId: c.source_id }) as Chunk).sort((a, b) => order(a) - order(b));

  const project: Project = {
    id, name: proj.name, description: proj.description, people: proj.people, workstreams: proj.workstreams,
    sources: sources.map((s) => ({ ...s.data, id: s.id, visibility: s.visibility }) as Source).sort((a, b) => (a.importedAt < b.importedAt ? -1 : 1)),
    chunks: chunkList,
    answers: st.answers ?? {}, reviews: st.reviews ?? {}, manualClaims: st.manualClaims ?? [], audit: st.audit ?? [], llm: st.llm,
    acks: (succRow?.acks ?? {}) as Record<string, Ack>, successorQuestions: (succRow?.questions ?? []) as SuccessorQuestion[],
    published: history[history.length - 1], history,
    createdAt: proj.created_at, cloud: { role },
  };
  return { project, role };
}
const order = (c: Chunk) => (c as Chunk & { seq?: number }).seq ?? 0;

/* ---------------------------------------------------------------- save (only what changed) */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const chunkData = (c: Chunk, seq: number) => { const { id: _i, sourceId: _s, ...rest } = c; void _i; void _s; return { ...rest, seq }; };
const sourceData = (s: Source) => { const { id: _i, visibility: _v, ...rest } = s; void _i; void _v; return rest; };

export async function saveProject(prev: Project, next: Project, role: Role): Promise<void> {
  const db = need();
  const pid = next.id;

  if (role === 'reviewer' && (prev.name !== next.name || prev.description !== next.description || !same(prev.people, next.people) || !same(prev.workstreams, next.workstreams))) {
    const { error } = await db.from('projects').update({ name: next.name, description: next.description, people: next.people, workstreams: next.workstreams, updated_at: new Date().toISOString() }).eq('id', pid);
    fail('Could not save the handover details', error);
  }

  if (role === 'reviewer') {
    // sources first (chunks reference them); visibility changes re-label chunks in the database
    const prevS = new Map(prev.sources.map((s) => [s.id, s]));
    const upS = next.sources.filter((s) => !same(prevS.get(s.id), s)).map((s) => ({ project_id: pid, id: s.id, visibility: s.visibility, data: sourceData(s) }));
    if (upS.length) { const { error } = await db.from('sources').upsert(upS); fail('Could not save sources', error); }
    const gone = prev.sources.filter((s) => !next.sources.some((n) => n.id === s.id)).map((s) => s.id);
    if (gone.length) { const { error } = await db.from('sources').delete().eq('project_id', pid).in('id', gone); fail('Could not remove sources', error); }

    const prevC = new Map(prev.chunks.map((c, i) => [c.id, JSON.stringify(chunkData(c, i))]));
    const upC = next.chunks.map((c, i) => ({ c, d: chunkData(c, i) })).filter(({ c, d }) => prevC.get(c.id) !== JSON.stringify(d))
      .map(({ c, d }) => ({ project_id: pid, id: c.id, source_id: c.sourceId, data: d }));
    for (let i = 0; i < upC.length; i += 400) { const { error } = await db.from('chunks').upsert(upC.slice(i, i + 400)); fail('Could not save source text', error); }
    const nextIds = new Set(next.chunks.map((c) => c.id));
    const goneC = prev.chunks.filter((c) => !nextIds.has(c.id) && !gone.includes(c.sourceId)).map((c) => c.id);
    for (let i = 0; i < goneC.length; i += 300) { const { error } = await db.from('chunks').delete().eq('project_id', pid).in('id', goneC.slice(i, i + 300)); fail('Could not remove source text', error); }
  }

  if (role !== 'successor') {
    const patch: Partial<StateData> = {};
    for (const k of STATE_KEYS) if (!same(prev[k], next[k])) (patch as Record<string, unknown>)[k] = next[k] ?? null;
    if (Object.keys(patch).length) {
      const { data, error } = await db.rpc('patch_state', { p: pid, patch });
      fail('Could not save your work', error);
      if (data === 0) throw new Error('Could not save your work: you do not have permission for that.');
    }
  }

  if (!same(prev.acks, next.acks) || !same(prev.successorQuestions, next.successorQuestions)) {
    const { error } = await db.from('successor_state').update({ acks: next.acks, questions: next.successorQuestions, updated_at: new Date().toISOString() }).eq('project_id', pid);
    fail('Could not save acknowledgements', error);
  }

  if (role === 'reviewer' && next.published && next.published.version > (prev.published?.version ?? 0)) {
    await publishVersion(pid, next.published);
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await need().auth.getSession();
  if (!data.session) throw new Error('Sign in again to continue.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

async function publishVersion(projectId: string, snapshot: PublishedSnapshot) {
  const res = await fetch(`${apiBase}/api/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ projectId, snapshot }) });
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Publishing failed (${res.status}).`);
}

/** LLM proposer for shared handovers: only chunk ids leave the browser; the server reads team text. */
export function cloudSender(projectId: string) {
  return async (batch: ChunkIn[], ws: WorkstreamIn[]): Promise<Record<string, LlmClaim[]>> => {
    let res: Response;
    try {
      res = await fetch(`${apiBase}/api/propose`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ projectId, chunkIds: batch.map((c) => c.id), workstreams: ws }) });
    } catch { throw new Error('Could not reach the LLM service. Check your connection.'); }
    const body = await res.json().catch(() => ({})) as { proposals?: Record<string, LlmClaim[]>; error?: string; retryAfter?: number; code?: string };
    if (res.status === 429 && body.code === 'daily_limit') throw new DailyLimit(body.error ?? 'Daily LLM quota used up.');
    if (res.status === 429) throw new RateLimited(body.retryAfter ?? 20);
    if (res.status === 422) throw new BadOutput(body.error ?? 'The model returned malformed JSON.');
    if (!res.ok || !body.proposals) throw new Error(body.error ?? `LLM service error ${res.status}`);
    return body.proposals;
  };
}
