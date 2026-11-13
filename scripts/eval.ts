/**
 * Seeded-data evaluation: runs the pipeline on the synthetic demo dataset and checks it
 * against the ground truth planted in it. Run: npx tsx scripts/eval.ts
 */
import { buildDemoProject } from '../src/lib/demo';
import { analyze } from '../src/lib/analyze';
import { norm } from '../src/lib/text';

const p = buildDemoProject();
const a = analyze(p);
const has = (ws: string, type: string, needle: string) =>
  a.claims.some((c) => c.workstream === ws && c.type === type && norm(c.statement).includes(norm(needle)));

const facts: [string, boolean][] = [
  ['Owner: Aarav owns registration app', has('registration', 'owner', 'Aarav owns the registration app')],
  ['Owner: Meera handles website', has('website', 'owner', 'Meera is handling')],
  ['Owner: Kabir responsible for certificates', has('certificates', 'owner', 'Kabir is responsible')],
  ['Decision: website on Netlify', has('website', 'decision', 'Netlify')],
  ['Decision: certificates emailed as PDFs', has('certificates', 'decision', 'emailed as PDFs')],
  ['Decision: dropping Razorpay', has('registration', 'decision', 'dropping razorpay')],
  ['Decision: re-enable Razorpay (PR #48)', has('registration', 'decision', 're-enable razorpay')],
  ['Risk: SMS gateway key expiry', has('infra', 'risk', 'expires on 31 Mar 2027')],
  ['Risk: fragile password reset', has('registration', 'risk', 'fragile')],
  ['Risk: Firebase quota', has('registration', 'risk', 'quota')],
  ['Risk: bulk export timeout', has('certificates', 'risk', 'times out')],
  ['Dependency: print vendor notice', has('certificates', 'dependency', 'notice')],
  ['Recurring issue: iOS QR scanner', has('registration', 'issue', 'QR scanner')],
  ['Next action: move DB backups', has('registration', 'task', 'backups')],
];
const conflictsPlanted = [['razorpay', 'registration'], ['certificate generator', 'certificates']];
const conflictsFound = conflictsPlanted.filter(([kw, ws]) => a.claims.some((c) => c.workstream === ws && c.status === 'conflicting' && norm(c.statement).includes(kw)));
const falseConflicts = a.questions.filter((q) => q.kind === 'conflict').length - conflictsFound.length;
const gapsPlanted = [['infra', 'owner'], ['sponsorship', 'owner']];
const gapsFound = gapsPlanted.filter(([ws, f]) => a.questions.some((q) => q.workstream === ws && q.field === f));
const shown = a.claims.filter((c) => c.status === 'cited' || c.status === 'corroborated');
const validCites = shown.filter((c) => c.evidence.every((e) => e.verified));
const leadsSrc = new Set(p.sources.filter((s) => s.visibility === 'leads').map((s) => s.id));
const allText = p.chunks.map((c) => c.text).join('\n');

const recall = facts.filter(([, ok]) => ok).length;
console.log('Baton seeded evaluation (synthetic demo dataset)\n');
facts.forEach(([n, ok]) => console.log(`${ok ? 'PASS' : 'MISS'}  ${n}`));
console.log(`\nClaim recall on planted facts:      ${recall}/${facts.length} (${Math.round((recall / facts.length) * 100)}%)`);
console.log(`Planted contradictions detected:    ${conflictsFound.length}/${conflictsPlanted.length}  (false conflict questions: ${falseConflicts})`);
console.log(`Planted gaps turned into questions: ${gapsFound.length}/${gapsPlanted.length}`);
console.log(`Citation validity (Cited/Corrob.):  ${validCites.length}/${shown.length}`);
console.log(`Secrets left after redaction:       ${/ghp_[A-Za-z0-9]{10,}|98765 43210/.test(allText) ? 'FAIL' : '0'}`);
console.log(`Restricted chunks in leads sources: ${p.chunks.filter((c) => leadsSrc.has(c.sourceId)).length} (excluded from successor view by buildView)`);
console.log(`Readiness before interview:         ${a.readiness}%  · questions: ${a.questions.length}`);
