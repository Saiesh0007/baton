import type { Chunk, Source, SourceKind, Visibility, TaskMeta } from '../types';
import { redact, tallyToList } from './redact';
import { uid } from './text';

export interface Ingested { source: Source; chunks: Chunk[] }

interface RawChunk { author?: string; ts?: string; text: string; ref: string; url?: string; task?: TaskMeta; key?: string }

function build(name: string, kind: SourceKind, visibility: Visibility, raws: RawChunk[], extra: Partial<Source> = {}): Ingested {
  const id = uid('src');
  const tally = new Map<string, number>();
  const chunks: Chunk[] = [];
  raws.forEach((r, i) => {
    const text = redact(r.text, tally).trim();
    if (!text) return;
    const task = r.task
      ? { ...r.task, title: redact(r.task.title, tally), assignee: r.task.assignee }
      : undefined;
    chunks.push({ id: `${id}-${i}`, sourceId: id, author: r.author?.trim() || undefined, ts: r.ts, text, ref: r.ref, url: r.url, task, key: r.key });
  });
  const source: Source = {
    id, name, kind, visibility, importedAt: new Date().toISOString(), redactions: tallyToList(tally), ...extra,
  };
  return { source, chunks };
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function parseLooseDate(s: string): string | undefined {
  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T10:00:00Z`).toISOString();
  const dmy = s.match(/\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})\b/);
  if (dmy && MONTHS[dmy[2].toLowerCase()] !== undefined) {
    return new Date(Date.UTC(+dmy[3], MONTHS[dmy[2].toLowerCase()], +dmy[1], 10)).toISOString();
  }
  return undefined;
}

/** Markdown / plain-text meeting notes or docs: one chunk per line, dated by the nearest heading. */
export function parseNotes(name: string, text: string, visibility: Visibility, author?: string): Ingested {
  const raws: RawChunk[] = [];
  let currentDate: string | undefined;
  text.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    if (/^#{1,6}\s/.test(t)) {
      const d = parseLooseDate(t);
      if (d) currentDate = d;
      return;
    }
    raws.push({ text: t, ref: `line ${i + 1}`, ts: currentDate ?? parseLooseDate(t), author });
  });
  return build(name, 'notes', visibility, raws);
}

function toIso(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v))) {
    const n = Number(v);
    const d = new Date(n < 1e12 ? n * 1000 : n);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? parseLooseDate(String(v)) : d.toISOString();
}

/** Discord (DiscordChatExporter JSON), Slack export JSON, or a generic [{author,timestamp,text}] array. */
export function parseChat(name: string, data: unknown, visibility: Visibility): Ingested {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgs: any[] = Array.isArray(d) ? d : Array.isArray(d?.messages) ? d.messages : [];
  if (!msgs.length) throw new Error('No messages found. Expected a Discord export ({ messages: [...] }) or a Slack export (array of messages).');
  const raws: RawChunk[] = msgs.map((m, i) => {
    const author =
      m.author?.nickname || m.author?.name || m.user_profile?.real_name || m.user_profile?.display_name ||
      m.user_name || m.username || (typeof m.author === 'string' ? m.author : undefined) || m.user || 'unknown';
    const text = String(m.content ?? m.text ?? m.message ?? '');
    const mid = m.id ?? m.client_msg_id ?? m.ts;
    return { author, ts: toIso(m.timestamp ?? m.ts ?? m.date ?? m.time), text, ref: `msg #${i + 1}`, key: mid !== undefined && mid !== null && mid !== '' ? `msg:${mid}` : undefined };
  });
  const channel = d?.channel?.name ? `#${d.channel.name}` : undefined;
  return build(name || channel || 'Chat export', 'chat', visibility, raws);
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Task records as CSV with columns like title, status, assignee, due. */
export function parseTasks(name: string, csv: string, visibility: Visibility): Ingested {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one task.');
  const head = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iTitle = col('title', 'task', 'name', 'summary');
  const iStatus = col('status', 'state', 'column');
  const iAssignee = col('assignee', 'owner', 'assigned to', 'assigned');
  const iDue = col('due', 'deadline', 'due date');
  if (iTitle < 0 || iStatus < 0) throw new Error('CSV must have a "title" and a "status" column.');
  const raws: RawChunk[] = lines.slice(1).map((l, i) => {
    const c = splitCsvLine(l);
    const task: TaskMeta = { title: c[iTitle] ?? '', status: c[iStatus] ?? '', assignee: iAssignee >= 0 ? c[iAssignee] || undefined : undefined, due: iDue >= 0 ? c[iDue] || undefined : undefined };
    const text = `${task.title} — status: ${task.status}` + (task.assignee ? ` — assignee: ${task.assignee}` : '') + (task.due ? ` — due: ${task.due}` : '');
    return { text, ref: `row ${i + 2}`, task, ts: task.due ? toIso(task.due) : undefined, author: undefined, key: task.title ? `task:${task.title.toLowerCase()}` : undefined };
  });
  return build(name, 'tasks', visibility, raws);
}

export interface GithubExport {
  repo: string;
  synthetic?: boolean;
  readme?: string;
  commits?: { sha: string; author: string; date: string; message: string }[];
  pulls?: { number: number; title: string; body?: string; state: string; merged?: boolean; author: string; date: string }[];
  issues?: { number: number; title: string; body?: string; state: string; author: string; date: string }[];
}

export function parseGithub(gh: GithubExport, visibility: Visibility): Ingested {
  const base = gh.synthetic ? undefined : `https://github.com/${gh.repo}`;
  const raws: RawChunk[] = [];
  for (const c of gh.commits ?? []) {
    raws.push({ author: c.author, ts: toIso(c.date), text: c.message.split('\n').slice(0, 6).join('\n').slice(0, 600), ref: `commit ${c.sha.slice(0, 7)}`, url: base && `${base}/commit/${c.sha}`, key: `commit:${c.sha}` });
  }
  for (const p of gh.pulls ?? []) {
    const st = p.merged ? 'merged' : p.state;
    raws.push({ author: p.author, ts: toIso(p.date), text: `${p.title}${p.body ? '\n' + p.body.slice(0, 800) : ''}`, ref: `PR #${p.number} (${st})`, url: base && `${base}/pull/${p.number}`, key: `pr:${p.number}` });
  }
  for (const s of gh.issues ?? []) {
    raws.push({ author: s.author, ts: toIso(s.date), text: `${s.title}${s.body ? '\n' + s.body.slice(0, 800) : ''}`, ref: `issue #${s.number} (${s.state})`, url: base && `${base}/issues/${s.number}`, key: `issue:${s.number}` });
  }
  if (gh.readme) {
    gh.readme.split(/\r?\n/).forEach((l, i) => {
      const t = l.trim();
      if (t && !/^#{1,6}\s/.test(t) && !/^!\[|^<|^\[!\[/.test(t)) raws.push({ text: t.slice(0, 600), ref: `README line ${i + 1}`, url: base && `${base}#readme` });
    });
  }
  return build(`GitHub · ${gh.repo}`, 'github', visibility, raws, { url: base, synthetic: gh.synthetic });
}

/** Live import of a public GitHub repository through the REST API (no token, read-only). */
export async function fetchGithub(input: string, onProgress?: (s: string) => void): Promise<GithubExport> {
  const raw = input.trim();
  if (/^(https?:\/\/)?(www\.)?(gitlab|bitbucket|codeberg)\./i.test(raw)) throw new Error('Only GitHub repositories can be imported directly. For other hosts, export the history as a file and upload it.');
  if (/^https?:\/\//i.test(raw) && !/github\.com\//i.test(raw)) throw new Error('That is not a github.com link. Enter owner/name or a github.com URL.');
  const m = raw.replace(/\.git$/, '').match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+)\/?$/);
  if (!m) throw new Error('Enter a repository as owner/name or a github.com URL.');
  const repo = `${m[1]}/${m[2]}`;
  const api = `https://api.github.com/repos/${repo}`;
  const get = async (path: string, accept = 'application/vnd.github+json') => {
    const r = await fetch(api + path, { headers: { Accept: accept } });
    if (r.status === 404) throw new Error(`Repository ${repo} not found or not public.`);
    if (r.status === 403) throw new Error('GitHub rate limit reached (60 requests/hour without login). Try again later or upload an export.');
    if (!r.ok) throw new Error(`GitHub API error ${r.status}`);
    return accept.includes('raw') ? r.text() : r.json();
  };
  onProgress?.('Reading commits…');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commits = (await get('/commits?per_page=60')) as any[];
  onProgress?.('Reading issues and pull requests…');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const issues = (await get('/issues?state=all&per_page=50&sort=updated')) as any[];
  onProgress?.('Reading README…');
  let readme: string | undefined;
  try { readme = (await get('/readme', 'application/vnd.github.raw')) as string; } catch { readme = undefined; }
  return {
    repo,
    readme: readme?.slice(0, 12000),
    commits: commits.map((c) => ({ sha: c.sha, author: c.author?.login || c.commit?.author?.name || 'unknown', date: c.commit?.author?.date, message: c.commit?.message ?? '' })),
    pulls: issues.filter((i) => i.pull_request).map((p) => ({ number: p.number, title: p.title, body: p.body ?? '', state: p.state, merged: !!p.pull_request?.merged_at, author: p.user?.login ?? 'unknown', date: p.created_at })),
    issues: issues.filter((i) => !i.pull_request).map((s) => ({ number: s.number, title: s.title, body: s.body ?? '', state: s.state, author: s.user?.login ?? 'unknown', date: s.created_at })),
  };
}

/** Guess the parser from the file name and content. */
export function ingestFile(fileName: string, content: string, visibility: Visibility): Ingested {
  const lower = fileName.toLowerCase();
  const base = fileName.replace(/\.[^.]+$/, '');
  if (lower.endsWith('.csv')) return parseTasks(base, content, visibility);
  if (lower.endsWith('.json')) {
    let data: unknown;
    try { data = JSON.parse(content); } catch { throw new Error('This is not valid JSON. Upload a Discord or Slack chat export, or a GitHub export.'); }
    if (!data || typeof data !== 'object') throw new Error('This JSON has no messages or commits in it.');
    const d = data as Partial<GithubExport>;
    if (!Array.isArray(data) && (d.commits || d.pulls) && d.repo) return parseGithub(data as GithubExport, visibility);
    return parseChat(base, data, visibility);
  }
  return parseNotes(base, content, visibility);
}
