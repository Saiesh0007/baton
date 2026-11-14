/**
 * Real-data run: the unchanged pipeline on snapshots of public GitHub repos (scripts/real/*).
 * Run: npx tsx scripts/real.ts [repo]   (prints every claim so it can be hand-checked)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseGithub, type GithubExport } from '../src/lib/ingest';
import { analyze } from '../src/lib/analyze';
import { redact } from '../src/lib/redact';
import type { Project, Workstream } from '../src/types';

const ws = (spec: Record<string, string[]>): Workstream[] => [
  ...Object.entries(spec).map(([name, keywords]) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, keywords })),
  { id: 'general', name: 'General', keywords: [] },
];
export const REPOS: Record<string, { repo: string; ws: Workstream[] }> = {
  request: { repo: 'request/request', ws: ws({ 'Maintenance status': ['deprecat', 'maintenance', 'maintainer', 'alternative'], 'HTTP client': ['proxy', 'redirect', 'cookie', 'stream', 'timeout', 'tls', 'header'], Security: ['security', 'cve', 'vulnerab', 'ssrf'] }) },
  'node-sass': { repo: 'sass/node-sass', ws: ws({ 'Maintenance status': ['deprecat', 'dart sass', 'maintenance', 'end of life', 'eol'], 'Build & binaries': ['binary', 'node-gyp', 'build', 'python', 'install', 'binding'], 'Node support': ['node 1', 'node 2', 'node version', 'support'] }) },
  moment: { repo: 'moment/moment', ws: ws({ 'Project status': ['legacy', 'maintenance', 'status', 'alternative', 'luxon'], Locales: ['locale', 'translation'], 'Time zones & parsing': ['timezone', 'utc', 'parse', 'format', 'dst'] }) },
  // held out: added after the rules were frozen, never used to tune them
  'request-promise': { repo: 'request/request-promise', ws: ws({ 'Maintenance status': ['deprecat', 'maintenance', 'maintainer', 'alternative'], Promises: ['promise', 'bluebird', 'then', 'async'], Security: ['security', 'cve', 'vulnerab'] }) },
  multer: { repo: 'expressjs/multer', ws: ws({ 'Maintenance status': ['deprecat', 'maintenance', 'maintainer', 'release'], 'Uploads & storage': ['upload', 'storage', 'disk', 'memory', 'file', 'busboy'], Security: ['security', 'cve', 'vulnerab', 'dos'] }) },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export function load(key: string): GithubExport {
  const dir = new URL('./real/', import.meta.url);
  const commits = JSON.parse(readFileSync(new URL(`${key}.commits.json`, dir), 'utf8')) as any[];
  const issues = JSON.parse(readFileSync(new URL(`${key}.issues.json`, dir), 'utf8')) as any[];
  const readme = readFileSync(new URL(`${key}.readme.md`, dir), 'utf8');
  return {
    repo: REPOS[key].repo,
    readme: readme.slice(0, 12000),
    commits: commits.map((c) => ({ sha: c.sha, author: c.author?.login || c.commit?.author?.name || 'unknown', date: c.commit?.author?.date, message: c.commit?.message ?? '' })),
    pulls: issues.filter((i) => i.pull_request).map((p) => ({ number: p.number, title: p.title, body: p.body ?? '', state: p.state, merged: !!p.pull_request?.merged_at, author: p.user?.login ?? 'unknown', date: p.created_at })),
    issues: issues.filter((i) => !i.pull_request).map((s) => ({ number: s.number, title: s.title, body: s.body ?? '', state: s.state, author: s.user?.login ?? 'unknown', date: s.created_at })),
  };
}

export function project(key: string): Project {
  const ing = parseGithub(load(key), 'team');
  const now = new Date().toISOString();
  return {
    id: `real-${key}`, name: REPOS[key].repo, description: '', people: { leaver: 'Maintainer', successor: 'Successor', reviewer: 'Reviewer' },
    workstreams: REPOS[key].ws, sources: [ing.source], chunks: ing.chunks, answers: {}, reviews: {}, manualClaims: [],
    acks: {}, successorQuestions: [], audit: [], createdAt: now,
  } as Project;
}

if (process.argv[2] === '--export') {
  // the snapshots the app can load offline: exactly the data evaluated here
  const out = new URL('../public/real/', import.meta.url);
  mkdirSync(out, { recursive: true });
  // masked before it is served, so the public file carries no contributor emails or tokens
  const m = (t?: string) => (t ? redact(t, new Map()) : t);
  for (const k of Object.keys(REPOS)) {
    const g = load(k);
    const safe = { ...g, readme: m(g.readme), commits: g.commits?.map((c) => ({ ...c, message: m(c.message)! })), pulls: g.pulls?.map((p) => ({ ...p, body: m(p.body) })), issues: g.issues?.map((i) => ({ ...i, body: m(i.body) })) };
    writeFileSync(new URL(k + '.json', out), JSON.stringify(safe));
  }
  console.log('exported', Object.keys(REPOS).join(', '));
} else if (process.argv[1]?.endsWith('real.ts')) {
  const keys = process.argv[2] ? [process.argv[2]] : Object.keys(REPOS);
  for (const k of keys) {
    const p = project(k);
    const a = analyze(p);
    const live = a.claims.filter((c) => !c.superseded);
    const cites = live.filter((c) => c.status === 'cited' || c.status === 'corroborated');
    console.log(`\n=== ${REPOS[k].repo}: ${p.chunks.length} events, ${live.length} claims, readiness ${a.readiness}%, stats ${JSON.stringify(a.stats)}, questions ${a.questions.length}, cited-valid ${cites.filter((c) => c.evidence.every((e) => e.verified)).length}/${cites.length}`);
    live.forEach((c, i) => {
      const ch = p.chunks.find((x) => x.id === c.evidence[0]?.chunkId);
      console.log(`${i + 1}. [${c.workstream}/${c.type}/${c.status}] ${c.statement}  <- ${ch?.ref ?? '-'}`);
    });
  }
}
