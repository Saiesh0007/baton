import type {
  Chunk, Claim, ClaimStatus, ClaimType, FieldCell, FieldKey, Project, Question, Source, Workstream,
} from '../types';
import { FIELDS } from '../types';
import { hash, norm, splitSentences, terms, escapeRe } from './text';

/* ------------------------------------------------------------------ */
/* 1. Proposer: rules-based claim extraction (swappable for an LLM).   */
/* ------------------------------------------------------------------ */

const PATTERNS: { type: ClaimType; re: RegExp }[] = [
  { type: 'issue', re: /\b(again|keeps (on )?(failing|breaking|happening|crashing)|recurring|every time|each time|happened before|same bug|flaky|intermittent(ly)?|regress(ion|ed))\b/i },
  { type: 'risk', re: /\b(risk|risky|expires?|expiry|expiring|fragile|careful|don'?t touch|single point|will break|breaks|quota|rate.?limit|outage|critical|times? out|timeout|personal (card|account|drive)|security)\b/i },
  { type: 'dependency', re: /\b(depends on|dependency|dependent on|waiting (on|for)|blocked (by|on)|notice|vendor|third.party|requires|relies on)\b/i },
  { type: 'decision', re: /\b(decided|decision|going with|we('| wi)ll use|switch(ed|ing)? to|mov(e|ed|ing) (\w+ ){0,3}to|chose|chosen|dropping|dropped|drop|agreed|finali[sz]ed|re-?enable[sd]?|rejected|replac(e|ed|ing)|migrat(e|ed|ing))\b/i },
  { type: 'owner', re: /\b(owns|owner\s*[:-]|is handling|will handle|handles|in charge of|responsible for|maintains|maintainer|point of contact|poc\b)/i },
  { type: 'contact', re: /\b(contact|reach out to|talk to|liaison|coordinator)\b/i },
  { type: 'task', re: /\b(todo|to-do|next step|need to|needs to|have to|pending|remaining|follow up|still to|must be (moved|renewed|done|fixed))\b/i },
  { type: 'status', re: /\b(done|completed?|in progress|wip|deployed|is live|went live|shipped|merged|half.done|not started|blocked|released)\b/i },
];

const NEG = /\b(drop|dropping|dropped|remov\w*|disabl\w*|stop(ped|ping)?|no longer|not|never|isn'?t|won'?t|cancel\w*|revert\w*|half|incomplete|broken|abandon\w*|paused?|wip|in progress|work in progress)\b/i;
const polarity = (s: string) => (NEG.test(s) ? -1 : 1);
const pol = (c: Claim) => polarity(c.evidence[0]?.quote ?? c.statement);

function classify(sentence: string): ClaimType | null {
  for (const p of PATTERNS) if (p.re.test(sentence)) return p.type;
  return null;
}

function assignWorkstream(text: string, fallbackText: string, ws: Workstream[]): string {
  const score = (t: string) => {
    const n = norm(t);
    let best = { id: '', s: 0 };
    for (const w of ws) {
      let s = 0;
      for (const k of w.keywords) if (k && n.includes(norm(k))) s += norm(k).length > 4 ? 2 : 1;
      if (n.includes(norm(w.name))) s += 3;
      if (s > best.s) best = { id: w.id, s };
    }
    return best;
  };
  const a = score(text);
  if (a.s > 0) return a.id;
  const b = score(fallbackText);
  if (b.s > 0) return b.id;
  return ws.find((w) => w.id === 'general')?.id ?? ws[0]?.id ?? 'general';
}

function findPeople(text: string, names: string[]): string[] {
  const found: string[] = [];
  for (const n of names) {
    const first = n.split(/\s+/)[0];
    if (first.length < 3) continue;
    if (new RegExp(`\\b${escapeRe(first)}\\b`, 'i').test(text)) found.push(n);
  }
  return [...new Set(found)];
}

const blankClaim = (p: Partial<Claim>): Claim => ({
  id: '', workstream: 'general', type: 'status', statement: '', originalStatement: '', people: [], evidence: [],
  origin: 'extracted', status: 'inferred', conflictWith: [], review: 'pending', edited: false, versions: [], ...p,
});

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function extractClaims(chunks: Chunk[], ws: Workstream[], names: string[]): Claim[] {
  const out: Claim[] = [];
  for (const ch of chunks) {
    if (ch.task) {
      const t = ch.task;
      const w = assignWorkstream(t.title, '', ws);
      const statusQuote = `${t.title} — status: ${t.status}`;
      const done = /\b(done|complete|completed|closed|shipped)\b/i.test(t.status);
      out.push(blankClaim({ id: 'c-' + hash(ch.id + '|status'), workstream: w, type: 'status', statement: `"${t.title}" is marked ${t.status} on the task board`, evidence: [{ chunkId: ch.id, quote: statusQuote, verified: false }], date: ch.ts, people: t.assignee ? [t.assignee] : [] }));
      if (t.assignee) out.push(blankClaim({ id: 'c-' + hash(ch.id + '|owner'), workstream: w, type: 'owner', statement: `${t.assignee} is assigned "${t.title}"`, evidence: [{ chunkId: ch.id, quote: `assignee: ${t.assignee}`, verified: false }], people: [t.assignee], date: ch.ts }));
      if (!done) out.push(blankClaim({ id: 'c-' + hash(ch.id + '|task'), workstream: w, type: 'task', statement: `Open task: ${t.title} (${t.status}${t.due ? `, due ${t.due}` : ''}${t.assignee ? `, ${t.assignee}` : ', unassigned'})`, evidence: [{ chunkId: ch.id, quote: statusQuote, verified: false }], people: t.assignee ? [t.assignee] : [], date: ch.ts }));
      continue;
    }
    splitSentences(ch.text).forEach((s, i) => {
      if (s.endsWith('?')) return; // questions are not claims
      if (s.split(/\s+/).length < 4) return;
      if (/^\[REDACTED/.test(s)) return;
      const type = classify(s);
      if (!type) return;
      const statement = cap(s.replace(/^(feat|fix|chore|docs|refactor|perf|wip)(\([^)]*\))?:\s*/i, '').replace(/^(decision|risk|todo|note)\s*:\s*/i, ''));
      out.push(blankClaim({
        id: 'c-' + hash(ch.id + '|' + i),
        workstream: assignWorkstream(s, ch.text, ws),
        type,
        statement,
        evidence: [{ chunkId: ch.id, quote: s, verified: false }],
        people: findPeople(s, names),
        date: ch.ts,
      }));
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 2. Verifier: deterministic, never trusts the proposer.             */
/* ------------------------------------------------------------------ */

export function verifyQuote(quote: string, chunk?: Chunk): boolean {
  if (!chunk) return false;
  const q = norm(quote);
  return q.length >= 8 && norm(chunk.text).includes(q);
}

function overlap(a: string[], b: string[]) {
  const sb = new Set(b);
  const shared = a.filter((x) => sb.has(x));
  return { shared, ratio: shared.length / Math.max(1, Math.min(a.length, b.length)) };
}

/** Merge near-duplicate claims of the same type from different chunks (corroboration). */
function mergeDuplicates(claims: Claim[]): Claim[] {
  const kept: Claim[] = [];
  const tcache = new Map<string, string[]>();
  const T = (c: Claim) => { let t = tcache.get(c.id); if (!t) { t = terms(c.statement); tcache.set(c.id, t); } return t; };
  for (const c of claims) {
    const twin = kept.find((k) => {
      if (k.type !== c.type || k.workstream !== c.workstream) return false;
      if (k.evidence.some((e) => c.evidence.some((f) => f.chunkId === e.chunkId))) return false;
      if ((k.type === 'decision' || k.type === 'status') && pol(k) !== pol(c)) return false;
      const o = overlap(T(k), T(c));
      return o.shared.length >= 3 || (o.shared.length >= 2 && o.ratio >= 0.4);
    });
    if (twin) {
      twin.evidence.push(...c.evidence);
      twin.people = [...new Set([...twin.people, ...c.people])];
      if (c.date && (!twin.date || c.date > twin.date)) twin.date = c.date;
    } else kept.push({ ...c, evidence: [...c.evidence] });
  }
  return kept;
}

/** Contradiction detection: decision/status claims on the same topic with opposite polarity. */
function detectConflicts(claims: Claim[], ws: Workstream[]) {
  const topic = new Map(ws.map((w) => [w.id, new Set(terms([w.name, ...w.keywords].join(' ')))]));
  const byWs = new Map<string, Claim[]>();
  for (const c of claims) if (c.type === 'decision' || c.type === 'status') {
    (byWs.get(c.workstream) ?? byWs.set(c.workstream, []).get(c.workstream)!).push(c);
  }
  for (const [wsId, list] of byWs.entries()) {
    const generic = topic.get(wsId) ?? new Set<string>();
    const df = new Map<string, number>();
    const tl = list.map((c) => terms(c.statement));
    tl.forEach((ts) => ts.forEach((t) => df.set(t, (df.get(t) ?? 0) + 1)));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (pol(a) === pol(b)) continue;
      const o = overlap(tl[i], tl[j]);
      const rare = o.shared.filter((t) => (df.get(t) ?? 0) <= 3 && t.length >= 5 && !generic.has(t));
      if (rare.length >= 1 && o.ratio >= 0.2) {
        a.conflictWith.push(b.id);
        b.conflictWith.push(a.id);
      }
    }
  }
}

/** Inferred ownership from activity counts (never shown as fact). */
function inferOwners(claims: Claim[], chunks: Chunk[], ws: Workstream[], sources: Source[], skipNames: string[]): Claim[] {
  const out: Claim[] = [];
  const kindOf = new Map(sources.map((s) => [s.id, s.kind]));
  for (const w of ws) {
    if (claims.some((c) => c.workstream === w.id && c.type === 'owner')) continue;
    if (!w.keywords.length) continue;
    const related = chunks.filter((ch) => ch.author && kindOf.get(ch.sourceId) !== 'interview' && assignWorkstream(ch.text, '', ws) === w.id && w.keywords.some((k) => norm(ch.text).includes(norm(k))));
    const counts = new Map<string, number>();
    related.forEach((ch) => counts.set(ch.author!, (counts.get(ch.author!) ?? 0) + 1));
    const top = [...counts.entries()].filter(([n]) => !skipNames.includes(n)).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) {
      out.push(blankClaim({
        id: 'inf-owner-' + w.id, workstream: w.id, type: 'owner', origin: 'inferred',
        statement: `${top[0]} appears to be the most active person on ${w.name} (${top[1]} of ${related.length} related messages/commits)`,
        people: [top[0]], note: 'Inferred from activity counts. No source states this directly.',
      }));
    }
  }
  return out;
}

function computeStatus(c: Claim, chunkById: Map<string, Chunk>, sourceById: Map<string, Source>): ClaimStatus {
  if (c.origin === 'interview') return 'attested';
  if (c.conflictWith.length) return 'conflicting';
  const v = c.evidence.filter((e) => e.verified);
  if (!v.length) return 'inferred';
  const kinds = new Set<string>(), authors = new Set<string>(), srcs = new Set<string>();
  v.forEach((e) => {
    const ch = chunkById.get(e.chunkId);
    if (!ch) return;
    srcs.add(ch.sourceId);
    kinds.add(sourceById.get(ch.sourceId)?.kind ?? '');
    if (ch.author) authors.add(ch.author);
  });
  return kinds.size >= 2 || srcs.size >= 2 || authors.size >= 2 ? 'corroborated' : 'cited';
}

/* ------------------------------------------------------------------ */
/* 3. Gap engine + interview questions.                                */
/* ------------------------------------------------------------------ */

const FIELD_PROMPT: Record<FieldKey, (w: string, succ: string) => string> = {
  owner: (w, s) => `Who owns "${w}" after you leave, and who should ${s} ask about it?`,
  status: (w) => `What is the real current state of "${w}"? (live, half-done, paused, abandoned…)`,
  decision: (w) => `What is the most important recent decision on "${w}", and why was it made?`,
  risks: (w) => `What could go wrong on "${w}"? Deadlines, fragile parts, vendors, recurring problems?`,
  next: (w, s) => `What is the very next thing ${s} should do on "${w}"?`,
};
const FIELD_PRIORITY: Record<FieldKey, number> = { owner: 90, next: 80, risks: 70, decision: 60, status: 50 };
const FIELD_TYPE: Record<FieldKey, ClaimType> = { owner: 'owner', status: 'status', decision: 'decision', risks: 'risk', next: 'task' };

const GOOD: ClaimStatus[] = ['corroborated', 'cited', 'attested'];

function fieldCells(claims: Claim[], ws: Workstream[]): FieldCell[] {
  const cells: FieldCell[] = [];
  for (const w of ws) for (const f of FIELDS) {
    const cs = claims.filter((c) => c.workstream === w.id && f.types.includes(c.type) && c.review !== 'rejected' && !c.superseded);
    let state: FieldCell['state'] = 'missing';
    if (cs.some((c) => GOOD.includes(c.status))) state = 'filled';
    else if (cs.some((c) => c.status === 'conflicting')) state = 'conflicting';
    else if (cs.length) state = 'inferred';
    cells.push({ workstream: w.id, field: f.key, state, claimIds: cs.map((c) => c.id) });
  }
  return cells;
}

/* ------------------------------------------------------------------ */
/* Full pipeline: inputs -> claim ledger, statuses, questions.         */
/* ------------------------------------------------------------------ */

export interface Analysis {
  claims: Claim[];
  questions: Question[];
  fields: FieldCell[];
  readiness: number;
  chunkById: Map<string, Chunk>;
  sourceById: Map<string, Source>;
  sources: Source[];
  chunks: Chunk[];
  people: string[];
  stats: Record<ClaimStatus, number>;
}

export const INTERVIEW_SOURCE_ID = 'src-interview';

export function analyze(p: Project): Analysis {
  const ws = p.workstreams.length ? p.workstreams : [{ id: 'general', name: 'General', keywords: [] }];
  const names = [...new Set([
    ...p.chunks.map((c) => c.author).filter(Boolean) as string[],
    ...p.chunks.map((c) => c.task?.assignee).filter(Boolean) as string[],
    p.people.leaver, p.people.successor, p.people.reviewer,
  ].filter((n) => n && n !== 'unknown'))];

  // Interview answers become a labelled source.
  const interviewSource: Source = { id: INTERVIEW_SOURCE_ID, name: `Exit interview · ${p.people.leaver}`, kind: 'interview', visibility: 'team', importedAt: p.createdAt, redactions: [] };
  const sources = [...p.sources, interviewSource];
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const baseChunks = p.chunks.filter((c) => sourceById.has(c.sourceId));
  const chunkById = new Map(baseChunks.map((c) => [c.id, c]));

  // 1. propose
  let claims = extractClaims(baseChunks, ws, names);
  // 2. verify each quote literally against its chunk
  claims.forEach((c) => c.evidence.forEach((e) => { e.verified = verifyQuote(e.quote, chunkById.get(e.chunkId)); }));
  claims = claims.filter((c) => c.evidence.some((e) => e.verified)); // proposer misfires dropped
  claims = mergeDuplicates(claims);
  detectConflicts(claims, ws);
  claims.push(...inferOwners(claims, baseChunks, ws, p.sources, [p.people.successor]));

  // manual claims added by the reviewer: quote checked against all chunks
  for (const m of p.manualClaims) {
    const hit = m.quote ? baseChunks.find((ch) => verifyQuote(m.quote!, ch)) : undefined;
    claims.push(blankClaim({
      id: m.id, workstream: m.workstream, type: m.type, statement: m.statement, origin: 'manual', date: m.ts,
      evidence: m.quote ? [{ chunkId: hit?.id ?? '', quote: m.quote, verified: !!hit }] : [],
      people: findPeople(m.statement, names),
      note: m.quote && !hit ? 'Quote was not found word-for-word in any source.' : undefined,
    }));
  }

  claims.forEach((c) => { c.status = computeStatus(c, chunkById, sourceById); c.originalStatement = c.statement; });

  // 3. questions from gaps on the evidence-only ledger
  const wsName = new Map(ws.map((w) => [w.id, w.name]));
  const baseCells = fieldCells(claims, ws);
  const questions: Question[] = [];
  const seenPairs = new Set<string>();
  for (const c of claims) {
    if (c.status !== 'conflicting') continue;
    const group = [c.id, ...c.conflictWith].sort();
    const key = group.join('|');
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    questions.push({ id: 'q-conf-' + hash(key), kind: 'conflict', workstream: c.workstream, claimIds: group, priority: 100, prompt: `Sources disagree about "${wsName.get(c.workstream)}". Which one is true today?` });
  }
  for (const cell of baseCells) {
    const w = wsName.get(cell.workstream) ?? cell.workstream;
    if (cell.state === 'missing') {
      questions.push({ id: `q-miss-${cell.workstream}-${cell.field}`, kind: 'missing', workstream: cell.workstream, field: cell.field, claimIds: [], priority: FIELD_PRIORITY[cell.field], prompt: FIELD_PROMPT[cell.field](w, p.people.successor) });
    } else if (cell.state === 'inferred') {
      for (const id of cell.claimIds) {
        questions.push({ id: 'q-inf-' + id, kind: 'inferred', workstream: cell.workstream, field: cell.field, claimIds: [id], priority: FIELD_PRIORITY[cell.field] - 5, prompt: 'We inferred this from activity, but no source says it directly. Is it correct?' });
      }
    }
  }
  questions.sort((a, b) => b.priority - a.priority);

  // 4. answers -> leaver-attested claims (a new labelled source type)
  const byId = new Map(claims.map((c) => [c.id, c]));
  for (const q of questions) {
    const a = p.answers[q.id];
    if (!a || a.choice === 'dontknow') continue;
    const chunkId = `${INTERVIEW_SOURCE_ID}-${q.id}`;
    let statement = '';
    let type: ClaimType = q.field ? FIELD_TYPE[q.field] : 'decision';
    if (q.kind === 'conflict') {
      const picked = a.pickedClaimId ? byId.get(a.pickedClaimId) : undefined;
      statement = a.choice === 'pick' && picked ? picked.statement : a.text ?? '';
      type = picked?.type ?? byId.get(q.claimIds[0])?.type ?? 'decision';
    } else if (q.kind === 'inferred') {
      const orig = byId.get(q.claimIds[0]);
      statement = a.choice === 'confirm' ? (orig?.statement ?? '') : a.text ?? '';
      type = orig?.type ?? type;
    } else statement = a.text ?? '';
    statement = statement.trim();
    if (!statement) continue;
    const text = a.choice === 'pick' || a.choice === 'confirm'
      ? `Confirmed: ${statement}${a.text ? ` — ${a.text}` : ''}`
      : statement;
    const chunk: Chunk = { id: chunkId, sourceId: INTERVIEW_SOURCE_ID, author: p.people.leaver, ts: a.ts, text, ref: 'exit interview answer' };
    chunkById.set(chunkId, chunk);
    baseChunks.push(chunk);
    const att = blankClaim({
      id: 'att-' + q.id, workstream: q.workstream, type, statement, origin: 'interview', status: 'attested', date: a.ts,
      evidence: [{ chunkId, quote: text, verified: true }], people: findPeople(statement, names), basedOn: q.claimIds,
      note: `According to ${p.people.leaver}, exit interview`,
    });
    claims.push(att);
    for (const id of q.claimIds) { const o = byId.get(id); if (o) o.superseded = att.id; }
  }

  // 5. reviewer decisions (versioned, never change evidence status)
  for (const c of claims) {
    const r = p.reviews[c.id];
    if (!r) continue;
    c.review = r.state;
    c.versions = r.versions;
    if (r.statement && r.statement !== c.statement) { c.statement = r.statement; c.edited = true; }
  }

  const fields = fieldCells(claims, ws);
  // "don't know" answers keep the gap, but mark it as honestly unknown
  for (const cell of fields) {
    if (cell.state !== 'filled' && p.answers[`q-miss-${cell.workstream}-${cell.field}`]?.choice === 'dontknow') cell.state = 'dontknow';
  }
  const readiness = fields.length ? Math.round((fields.filter((f) => f.state === 'filled').length / fields.length) * 100) : 0;
  const stats = { corroborated: 0, cited: 0, attested: 0, inferred: 0, conflicting: 0 } as Record<ClaimStatus, number>;
  claims.forEach((c) => { if (!c.superseded) stats[c.status]++; });

  return { claims, questions, fields, readiness, chunkById, sourceById, sources, chunks: baseChunks, people: names, stats };
}

/** Risk-first ordering used by the review queue. */
export function riskRank(c: Claim): number {
  const s = { conflicting: 0, inferred: 1, attested: 3, cited: 4, corroborated: 5 }[c.status];
  const t = c.type === 'risk' || c.type === 'issue' || c.type === 'dependency' ? -0.5 : 0;
  return s + t;
}
