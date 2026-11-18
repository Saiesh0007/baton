/**
 * Creates (or resets) three judge accounts that share one handover: a copy of the demo with a
 * first version already published, so each role has something to look at straight away.
 *   npx tsx scripts/seed-judges.ts [apiBase] [outFile]
 * apiBase: where /api/publish runs (default http://localhost:5173, same database as production).
 * outFile: where the logins are written (default ../JUDGE-LOGINS.md, outside the repository).
 * Passwords are fixed and simple (reviewer@123, leaver@123, successor@123) because they are printed for judges.
 * Re-running resets the passwords to these and rebuilds the handover from scratch.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { initCloud, signIn, createProject, createInvite, acceptInvite, loadProject, saveProject } from '../src/lib/cloud';
import { analyze, approvalBasis } from '../src/lib/analyze';
import { buildDemoProject } from '../src/lib/demo';
import type { PublishedSnapshot, Role } from '../src/types';

const envFile = new URL('../.env.local', import.meta.url);
if (existsSync(envFile)) for (const l of readFileSync(envFile, 'utf8').split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const URL_ = process.env.VITE_SUPABASE_URL!, PUB = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, SECRET = process.env.SUPABASE_SECRET_KEY!;
const API = process.argv[2] ?? 'http://localhost:5173';
const OUT = process.argv[3] ?? fileURLToPath(new URL('../../JUDGE-LOGINS.md', import.meta.url));
const admin = createClient(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });

const ACCOUNTS: { role: Role; email: string; name: string }[] = [
  { role: 'reviewer', email: 'judge.reviewer@example.com', name: 'Prof. Joshi (judge)' },
  { role: 'leaver', email: 'judge.leaver@example.com', name: 'Aarav (judge)' },
  { role: 'successor', email: 'judge.successor@example.com', name: 'Diya (judge)' },
];
const pw = (role: Role) => `${role}@123`;

const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const creds: Record<string, string> = {};
for (const a of ACCOUNTS) {
  const password = pw(a.role);
  creds[a.role] = password;
  const existing = list.users.find((u) => u.email === a.email);
  if (existing) {
    await admin.from('projects').delete().eq('created_by', existing.id); // fresh handover each time
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password, user_metadata: { name: a.name } });
    if (error) throw error;
  } else {
    const { error } = await admin.auth.admin.createUser({ email: a.email, password, email_confirm: true, user_metadata: { name: a.name } });
    if (error) throw error;
  }
}
// memberships in old copies (from earlier runs) go with those projects; nothing else to clean

const as = async (role: Role) => { initCloud(URL_, PUB, API, false); await signIn(ACCOUNTS.find((a) => a.role === role)!.email, creds[role]); };

await as('reviewer');
const id = await createProject({ ...buildDemoProject(), name: 'Spark Fest tech team (shared, for judges)', isDemo: false });
let { project: p } = await loadProject(id);
// approve the well-supported claims and publish v1, as a reviewer would
const a = analyze(p);
const good = a.claims.filter((c) => !c.superseded && (c.status === 'corroborated' || c.status === 'cited') && c.evidence.some((e) => e.verified));
// include the leads-only claims too, so the successor login shows them as restricted placeholders
const leads = new Set(p.sources.filter((s) => s.visibility === 'leads').map((s) => s.id));
const isLeads = (c: (typeof good)[number]) => c.evidence.every((e) => leads.has(a.chunkById.get(e.chunkId)?.sourceId ?? ''));
const ok = [...good.filter((c) => !isLeads(c)).slice(0, 12), ...good.filter(isLeads)];
const reviews = Object.fromEntries(ok.map((c) => [c.id, { state: 'approved' as const, versions: [{ statement: c.statement, by: p.people.reviewer, ts: new Date().toISOString(), action: 'approved' }], basis: approvalBasis(c, a.chunkById), snapshot: { statement: c.statement, type: c.type, workstream: c.workstream } }]));
const reviewed = { ...p, reviews };
await saveProject(p, reviewed, 'reviewer');
const a2 = analyze(reviewed);
const included = a2.claims.filter((c) => c.review === 'approved');
const ids = new Set(included.flatMap((c) => c.evidence.map((e) => e.chunkId)));
const snap: PublishedSnapshot = { version: 1, ts: new Date().toISOString(), by: p.people.reviewer, claims: included, chunks: a2.chunks.filter((c) => ids.has(c.id)), sources: a2.sources, workstreams: p.workstreams, fields: a2.fields, readiness: a2.readiness };
await saveProject(reviewed, { ...reviewed, published: snap, history: [snap], audit: [{ ts: snap.ts, actor: p.people.reviewer, action: `Published handover v1 with ${included.length} approved claims` }, ...reviewed.audit] }, 'reviewer');
const leaverToken = await createInvite(id, 'leaver');
const succToken = await createInvite(id, 'successor');
await as('leaver'); await acceptInvite(leaverToken, ACCOUNTS[1].name);
await as('successor'); await acceptInvite(succToken, ACCOUNTS[2].name);
({ project: p } = await loadProject(id));
const restricted = p.published?.claims.filter((c) => c.restricted).length ?? 0;

const md = `# Baton: judge logins (keep private)

Generated ${new Date().toISOString()} by scripts/seed-judges.ts. Re-running it resets the shared handover; the passwords stay the same.

Site: https://baton-phi-three.vercel.app → "Shared handovers" → Sign in.
All three accounts share one handover: "Spark Fest tech team (shared, for judges)", v1 already published (${included.length} approved items).

| Role | Email | Password | What they see |
|---|---|---|---|
| Reviewer | ${ACCOUNTS[0].email} | ${creds.reviewer} | Everything: sources, ledger, review, publish, invites |
| Leaver | ${ACCOUNTS[1].email} | ${creds.leaver} | Overview, ledger, exit interview (incl. leads-only sources) |
| Successor | ${ACCOUNTS[2].email} | ${creds.successor} | Only the published handover; ${restricted} leads-only item(s) appear as restricted placeholders |

Tip for judges: open the successor login in a private window next to the reviewer, so both are signed in at once.
`;
writeFileSync(OUT, md);
console.log(`seeded project ${id}: ${included.length} approved, ${restricted} restricted for the successor. Logins written to ${OUT}`);
process.exit(0);
