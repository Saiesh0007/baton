/**
 * Round 3 evaluation: the LLM proposer on the same five public-repo snapshots as scripts/real.ts.
 * Proposals are saved to scripts/real/llm/<repo>.json so every number can be re-checked without a key.
 *
 *   npx tsx scripts/eval-llm.ts [repo|demo]     use saved proposals, call Groq only for missing ones
 *   npx tsx scripts/eval-llm.ts [repo] --fresh  ignore saved proposals
 *
 * Needs GROQ_API_KEY (read from .env.local) only when proposals are missing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { project, REPOS } from './real';
import { analyze, isBot } from '../src/lib/analyze';
import { callGroq, LLM_MODEL, pendingChunks, proposeAll, toChunkIn, type LlmClaim } from '../src/lib/llm';
import { buildDemoProject } from '../src/lib/demo';

const envFile = new URL('../.env.local', import.meta.url);
if (!process.env.GROQ_API_KEY && existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const dir = new URL('./real/llm/', import.meta.url);
mkdirSync(dir, { recursive: true });
const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const keys = args.filter((a) => !a.startsWith('--'));

for (const k of keys.length ? keys : Object.keys(REPOS)) {
  const p = k === 'demo' ? buildDemoProject() : project(k);
  const name = k === 'demo' ? 'seeded demo' : REPOS[k].repo;
  const file = new URL(`${k}.json`, dir);
  const saved: { model: string; cache: Record<string, LlmClaim[]> } = !fresh && existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8')) : { model: LLM_MODEL, cache: {} };

  // the same selection the app uses: team-visible, non-bot, non-task text the LLM has not read yet
  const todo = pendingChunks(p.chunks, p.sources, saved.cache, isBot).map(toChunkIn);
  if (todo.length) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY missing (put it in .env.local).');
    const t0 = Date.now();
    const res = await proposeAll(todo, p.workstreams, (b, ws) => callGroq(key, b, ws, [LLM_MODEL]), { // one model only, so the numbers are about one model
      onProgress: (s) => process.stdout.write(`\r${k}: batch ${s.done}/${s.total}${s.waiting ? ` (rate limit, waiting ${s.waiting}s)` : ''}      `),
      onBatch: (part) => { Object.assign(saved.cache, part); writeFileSync(file, JSON.stringify(saved, null, 1)); },
      maxWaits: 60,
    });
    process.stdout.write(`\r${k}: ${todo.length} chunks sent in ${Math.round((Date.now() - t0) / 1000)}s${res.error ? ` · ERROR ${res.error}` : ''}\n`);
  }

  const withLlm = { ...p, llm: { enabled: true, model: saved.model, cache: saved.cache } };
  const a = analyze(withLlm);
  const live = a.claims.filter((c) => !c.superseded && c.origin !== 'inferred');
  const cites = live.filter((c) => c.status === 'cited' || c.status === 'corroborated');
  const valid = cites.filter((c) => c.evidence.every((e) => e.verified)).length;
  const llmClaims = live.filter((c) => c.proposer === 'llm').length;
  console.log(`\n=== ${name} (LLM: ${saved.model}): ${p.chunks.length} events, ${live.length} claims (${llmClaims} LLM, ${live.length - llmClaims} rules for task rows/unsent), cited-valid ${valid}/${cites.length}, quotes rejected by verifier: ${a.rejectedQuotes.llm} LLM`);

  const rows = live.map((c, i) => {
    const ch = a.chunkById.get(c.evidence[0]?.chunkId);
    return { n: i + 1, line: `${i + 1}. [${c.workstream}/${c.type}/${c.status}] ${c.statement}  <- ${ch?.ref ?? '-'}`, quote: c.evidence[0]?.quote ?? '' };
  });
  rows.forEach((r) => console.log(r.line));

  // labelling sheet: put ✓ or ✗ (with a short reason) in the first column, same rule as LABELS.md
  const sheet = [
    `# ${name}: LLM proposals to label`, '',
    'Rule (same as Round 2, LABELS.md): **useful** only if a successor would want it in a handover *and* the statement is true to the quote.',
    'Replace `[ ]` with `[✓]` or `[✗ reason]`.', '',
    ...rows.map((r) => `- [ ] ${r.line.replace(/^\d+\. /, `**${r.n}.** `)}\n  > ${r.quote.replace(/\n/g, ' ')}`),
  ].join('\n');
  // never overwrite a sheet that may already hold hand labels
  const sheetFile = new URL(`${k}.labels.md`, dir);
  if (!existsSync(sheetFile)) writeFileSync(sheetFile, sheet + '\n');
  else console.log(`(kept existing ${k}.labels.md; delete it to regenerate)`);
}
