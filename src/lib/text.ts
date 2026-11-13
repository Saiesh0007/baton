export function norm(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const STOP = new Set(
  ('the and for with that this from have has had was were will would should could are is be been being our ours you your ' +
    'they them their there here what when where which who whom why how not but all any can just now then than also into ' +
    'onto over under about after before again still only very more most some such its it\'s we\'re we\'ll i\'m don\'t ' +
    'one two out off per via let get got make made use used using need needs needed want okay yes yeah lol team guys ' +
    'today tomorrow yesterday week month year last next new old now once ever every each same other thing things ' +
    'feat fix chore docs refactor wip merge merged pull request issue task status assignee due marked board open')
    .split(/\s+/),
);

function stem(w: string): string {
  if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 6 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 5 && w.endsWith('ed')) w = w.slice(0, -2);
  return w;
}

export function terms(s: string): string[] {
  const out = new Set<string>();
  for (const raw of norm(s).replace(/[^a-z0-9\- ]/g, ' ').split(' ')) {
    const w = raw.replace(/^-+|-+$/g, '');
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue;
    out.add(stem(w));
  }
  return [...out];
}

/** Split a chunk into candidate sentences. Every returned string is a literal substring of the input. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\n+/)) {
    const cleaned = line.replace(/^\s*(#{1,6}\s+|[-*•]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '');
    const parts = cleaned.split(/(?<=[.!?;])\s+(?=[A-Z0-9"'(])/);
    const merged: string[] = [];
    for (const part of parts) {
      const prev = merged[merged.length - 1];
      if (prev !== undefined && /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|No)\.$/i.test(prev)) merged[merged.length - 1] = prev + ' ' + part;
      else merged.push(part);
    }
    for (const s of merged) {
      const t = s.trim();
      if (t && cleaned.includes(t)) out.push(t);
    }
  }
  return out;
}

export function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function uid(prefix = 'id'): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

export function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
