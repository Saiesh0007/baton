/**
 * Permission check against the real database (Round 3, improvement 2).
 *   npx tsx scripts/rls-check.ts [apiBase]      apiBase defaults to http://localhost:5180 (npm run dev)
 * Creates three throwaway accounts (reviewer, leaver, successor), builds a shared handover from the demo
 * (which has a leads-only chat), publishes it, then checks from each account's own session what the
 * database actually returns. Everything it creates is deleted at the end.
 * Needs VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY (read from .env.local).
 */
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { initCloud, signIn, createProject, createInvite, acceptInvite, loadProject, saveProject, supabase } from '../src/lib/cloud';
import { analyze } from '../src/lib/analyze';
import { buildDemoProject } from '../src/lib/demo';
import type { Project, PublishedSnapshot } from '../src/types';

const envFile = new URL('../.env.local', import.meta.url);
if (existsSync(envFile)) for (const l of readFileSync(envFile, 'utf8').split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const URL_ = process.env.VITE_SUPABASE_URL!, PUB = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, SECRET = process.env.SUPABASE_SECRET_KEY!;
const API = process.argv[2] ?? 'http://localhost:5180';
const admin = createClient(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); if (!ok) failed++; };
const tag = Math.random().toString(36).slice(2, 8);
const pw = `Rls-${tag}-${Math.random().toString(36).slice(2, 10)}!`;
const users: Record<string, string> = {};
const as = async (who: string) => { initCloud(URL_, PUB, API, false); await signIn(`rls-${who}-${tag}@example.com`, pw); return supabase()!; };
let projectId = '';

try {
  for (const who of ['reviewer', 'leaver', 'successor']) {
    const { data, error } = await admin.auth.admin.createUser({ email: `rls-${who}-${tag}@example.com`, password: pw, email_confirm: true, user_metadata: { name: `RLS ${who}` } });
    if (error) throw error;
    users[who] = data.user.id;
  }

  // ---- reviewer builds and publishes a handover that includes a leads-only source
  let db = await as('reviewer');
  const demo: Project = { ...buildDemoProject(), llm: undefined };
  projectId = await createProject(demo);
  let { project: p } = await loadProject(projectId);
  const leadsSrc = p.sources.filter((s) => s.visibility === 'leads').map((s) => s.id);
  const leadsTexts = p.chunks.filter((c) => leadsSrc.includes(c.sourceId)).map((c) => c.text);
  check('reviewer: project saved with a leads-only source', leadsSrc.length > 0 && leadsTexts.length > 0, `${leadsTexts.length} leads-only events`);
  check('reviewer: sees every event', p.chunks.length === demo.chunks.length, `${p.chunks.length}/${demo.chunks.length}`);

  const a = analyze(p);
  const approved = a.claims.filter((c) => !c.superseded && c.evidence.some((e) => e.verified));
  const reviews = Object.fromEntries(approved.map((c) => [c.id, { state: 'approved' as const, versions: [] }]));
  const withReviews = { ...p, reviews };
  await saveProject(p, withReviews, 'reviewer');
  const a2 = analyze(withReviews);
  const included = a2.claims.filter((c) => c.review === 'approved');
  const ids = new Set(included.flatMap((c) => c.evidence.map((e) => e.chunkId)));
  const snap: PublishedSnapshot = { version: 1, ts: new Date().toISOString(), by: 'RLS reviewer', claims: included, chunks: a2.chunks.filter((c) => ids.has(c.id)), sources: a2.sources, workstreams: p.workstreams, fields: a2.fields, readiness: a2.readiness };
  const leadsClaims = included.filter((c) => c.evidence.length && c.evidence.every((e) => leadsSrc.includes(a2.chunkById.get(e.chunkId)?.sourceId ?? '')));
  check('setup: some approved claims rest only on leads-only text', leadsClaims.length > 0, String(leadsClaims.length));
  await saveProject(withReviews, { ...withReviews, published: snap, history: [snap] }, 'reviewer');
  ({ project: p } = await loadProject(projectId));
  check('reviewer: v1 published, reviewer copy is complete', p.published?.version === 1 && p.published.claims.length === included.length);

  const succToken = await createInvite(projectId, 'successor');
  const leaverToken = await createInvite(projectId, 'leaver');

  // ---- successor
  db = await as('successor');
  await acceptInvite(succToken, 'RLS successor');
  const { project: s, role } = await loadProject(projectId);
  check('successor: joined by invite with the successor role', role === 'successor');
  const dump = JSON.stringify(s);
  check('successor: no leads-only text anywhere in what the database returned', leadsTexts.every((t) => !dump.includes(t)));
  check('successor: no leads-only sources or events', s.sources.every((x) => x.visibility === 'team') && s.chunks.every((c) => !leadsSrc.includes(c.sourceId)));
  check('successor: leads-only claims arrive as content-free placeholders', (s.published?.claims.filter((c) => c.restricted).length ?? 0) >= leadsClaims.length && s.published!.claims.filter((c) => c.restricted).every((c) => !c.statement && !c.evidence.length));
  check('successor: no review history, interview answers or audit log', !Object.keys(s.reviews).length && !Object.keys(s.answers).length && !s.audit.length);
  const direct = await db.from('chunks').select('id').eq('project_id', projectId).eq('visibility', 'leads');
  check('successor: direct query for leads-only rows returns 0', !direct.error && direct.data.length === 0, String(direct.data?.length));
  const full = await db.from('published').select('version').eq('project_id', projectId).eq('visibility', 'full');
  check('successor: cannot read the reviewer copy of a version', !full.error && full.data.length === 0);
  const st = await db.from('project_state').select('data').eq('project_id', projectId);
  check('successor: cannot read the working state', !st.error && st.data.length === 0);
  const ins = await db.from('sources').insert({ project_id: projectId, id: 'evil', visibility: 'team', data: {} });
  check('successor: cannot add sources', !!ins.error);
  const upd = await db.from('projects').update({ name: 'hijacked' }).eq('id', projectId).select('id');
  check('successor: cannot edit the handover', !!upd.error || upd.data?.length === 0);
  const pub = await fetch(`${API}/api/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await db.auth.getSession()).data.session!.access_token}` }, body: JSON.stringify({ projectId, snapshot: { ...snap, version: 2 } }) });
  check('successor: cannot publish', pub.status === 403, String(pub.status));
  const leadsIds = (await admin.from('chunks').select('id').eq('project_id', projectId).eq('visibility', 'leads')).data!.map((r) => r.id);
  const prop = await fetch(`${API}/api/propose`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await db.auth.getSession()).data.session!.access_token}` }, body: JSON.stringify({ projectId, chunkIds: leadsIds, workstreams: [] }) });
  check('successor: cannot run the LLM proposer', prop.status === 403, String(prop.status));
  const ack = await saveProject(s, { ...s, acks: { [s.published!.claims.find((c) => !c.restricted)!.id]: { state: 'read', ts: new Date().toISOString() } } }, 'successor').then(() => true, () => false);
  check('successor: can acknowledge items', ack);

  // ---- leaver
  db = await as('leaver');
  await acceptInvite(leaverToken, 'RLS leaver');
  const { project: l, role: lr } = await loadProject(projectId);
  check('leaver: joined with the leaver role and sees leads-only events', lr === 'leaver' && l.chunks.some((c) => leadsSrc.includes(c.sourceId)));
  const ans = await saveProject(l, { ...l, answers: { 'q-test': { choice: 'answer', text: 'Kabir owns infra now', ts: new Date().toISOString() } } }, 'leaver').then(() => true, () => false);
  check('leaver: can save interview answers', ans);
  const lins = await db.from('chunks').insert({ project_id: projectId, id: 'evil', source_id: l.sources[0].id, data: { text: 'x' } });
  check('leaver: cannot change sources', !!lins.error);

  // ---- the LLM function never reads leads-only text, even for the reviewer
  db = await as('reviewer');
  const rprop = await fetch(`${API}/api/propose`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await db.auth.getSession()).data.session!.access_token}` }, body: JSON.stringify({ projectId, chunkIds: leadsIds, workstreams: [] }) });
  const rbody = await rprop.json() as { proposals?: Record<string, unknown> };
  check('LLM function: asked for leads-only events, sends none to the model', rprop.ok && Object.keys(rbody.proposals ?? {}).length === 0, JSON.stringify(rbody).slice(0, 80));
  const { project: r } = await loadProject(projectId);
  check('reviewer: sees the leaver\'s answer (merge-save kept both)', r.answers['q-test']?.text === 'Kabir owns infra now' && Object.keys(r.reviews).length === approved.length);
} catch (e) {
  console.log('ERROR ', (e as Error).message);
  failed++;
} finally {
  if (projectId) await admin.from('projects').delete().eq('id', projectId);
  for (const id of Object.values(users)) await admin.auth.admin.deleteUser(id);
  console.log(failed ? `\n${failed} FAILED` : '\nall permission checks passed');
  process.exit(failed ? 1 : 0);
}
