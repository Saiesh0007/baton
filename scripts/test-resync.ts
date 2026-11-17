/**
 * Re-sync tests (Round 3, improvement 3). Run: npx tsx scripts/test-resync.ts
 * Uses the rules proposer so results are deterministic.
 */
import { analyze, approvalBasis } from '../src/lib/analyze';
import { buildDemoProject, DEMO_NOTES, DEMO_NOTES_UPDATE, DEMO_GITHUB } from '../src/lib/demo';
import { parseGithub, parseNotes } from '../src/lib/ingest';
import { applyResync } from '../src/lib/resync';
import type { Project } from '../src/types';

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); if (!ok) failed++; };

const base = (): Project => ({ ...buildDemoProject(), llm: undefined });
const approve = (p: Project, match: (s: string) => boolean): Project => {
  const a = analyze(p);
  const reviews = { ...p.reviews };
  for (const c of a.claims.filter((c) => match(c.statement))) {
    reviews[c.id] = { state: 'approved', versions: [], basis: approvalBasis(c, a.chunkById), snapshot: { statement: c.statement, type: c.type, workstream: c.workstream } };
  }
  return { ...p, reviews };
};
const notesId = (p: Project) => p.sources.find((s) => s.kind === 'notes')!.id;

// 1. re-syncing an unchanged source changes nothing
{
  let p = approve(base(), (s) => /netlify|sms gateway api key|backups/i.test(s));
  const before = analyze(p);
  const { project, summary } = applyResync(p, notesId(p), parseNotes('x', DEMO_NOTES, 'team'), 'test');
  p = project;
  const after = analyze(p);
  check('unchanged source: nothing added/changed/removed', summary.added === 0 && summary.changed === 0 && summary.removed === 0, JSON.stringify({ a: summary.added, c: summary.changed, r: summary.removed, u: summary.unchanged }));
  check('unchanged source: same claim ids', JSON.stringify(before.claims.map((c) => c.id).sort()) === JSON.stringify(after.claims.map((c) => c.id).sort()));
  check('unchanged source: no approval flagged', after.claims.every((c) => !c.stale) && summary.flagged === 0);
  check('unchanged source: approvals intact', after.claims.filter((c) => c.review === 'approved').length === before.claims.filter((c) => c.review === 'approved').length);
}

// 2. the sample update: one decision edited, one date edited, one task removed, two lines added
let p = approve(base(), (s) => /netlify|sms gateway api key|backups|meera is handling/i.test(s));
const approvedBefore = analyze(p).claims.filter((c) => c.review === 'approved');
check('setup: 4+ claims approved', approvedBefore.length >= 4, String(approvedBefore.length));
const { project, summary } = applyResync(p, notesId(p), parseNotes('x', DEMO_NOTES_UPDATE, 'team'), 'test');
p = project;
check('update: 2 changed lines', summary.changed === 2, String(summary.changed));
check('update: 1 removed line', summary.removed === 1, String(summary.removed));
check('update: 2 new lines', summary.added === 2, String(summary.added));
check('update: 3 approvals sent back', summary.flagged === 3, String(summary.flagged));
const a = analyze(p);
const stale = a.claims.filter((c) => c.stale);
check('analysis: 3 claims need re-review', stale.length === 3, stale.map((c) => c.statement.slice(0, 40)).join(' | '));
check('analysis: flagged claims are back in the queue (pending)', stale.every((c) => c.review === 'pending'));
check('analysis: edited line shows before and after', stale.some((c) => c.stale!.before?.includes('Netlify instead of the college server') && c.stale!.after?.includes('Vercel instead of Netlify')));
check('analysis: removed line kept visible, not silently dropped', stale.some((c) => /backups/i.test(c.statement) && /deleted/.test(c.stale!.reason)));
check('analysis: untouched approval stays approved', a.claims.some((c) => /meera is handling/i.test(c.statement) && c.review === 'approved' && !c.stale));
// (whether a new line becomes a claim is the proposer's job; the rules have no "will own" pattern, the LLM reads it)
check('analysis: new lines arrive as source events', a.chunks.some((c) => /Isha will own/.test(c.text)) && a.chunks.some((c) => /backups now run nightly/.test(c.text)));
check('source keeps its id and visibility', p.sources.some((s) => s.id === notesId(p) && s.visibility === 'team' && s.syncs?.length === 1));

// 3. re-approving a flagged claim clears the flag
{
  const c = stale.find((x) => /vercel|netlify/i.test(x.statement) && x.status !== 'inferred')!;
  const p2 = { ...p, reviews: { ...p.reviews, [c.id]: { state: 'approved' as const, versions: [], basis: approvalBasis(c, a.chunkById), snapshot: { statement: c.statement, type: c.type, workstream: c.workstream } } } };
  const again = analyze(p2).claims.find((x) => x.id === c.id)!;
  check('re-approval clears the flag', again.review === 'approved' && !again.stale);
}

// 4. GitHub: items match by commit sha / PR number, even when their text changes
{
  let g = base();
  const gid = g.sources.find((s) => s.kind === 'github')!.id;
  const edited = { ...DEMO_GITHUB, pulls: DEMO_GITHUB.pulls!.map((x, i) => (i === 0 ? { ...x, body: (x.body ?? '') + ' Update: also used for merchandise.' } : x)) };
  const { summary: s2 } = applyResync(g, gid, parseGithub(edited, 'team'), 'test');
  check('github: edited PR is "changed", not removed+added', s2.changed === 1 && s2.added === 0 && s2.removed === 0, JSON.stringify({ c: s2.changed, a: s2.added, r: s2.removed }));
  const idsBefore = g.chunks.filter((c) => c.sourceId === gid).map((c) => c.id).join();
  g = applyResync(g, gid, parseGithub(DEMO_GITHUB, 'team'), 'test').project;
  check('github: unchanged re-import keeps every chunk id', g.chunks.filter((c) => c.sourceId === gid).map((c) => c.id).join() === idsBefore);
}

console.log(failed ? `\n${failed} FAILED` : '\nall re-sync tests passed');
process.exit(failed ? 1 : 0);
