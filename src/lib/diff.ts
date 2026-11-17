/** Word-level diff (LCS) for showing what changed in a source line or a claim between versions. */
export type DiffPart = { t: 'same' | 'add' | 'del'; s: string };

function rawDiff(a: string[], b: string[]): DiffPart[] {
  const n = a.length, m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: DiffPart[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: 'same', s: a[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: 'del', s: a[i++] });
    else out.push({ t: 'add', s: b[j++] });
  }
  while (i < n) out.push({ t: 'del', s: a[i++] });
  while (j < m) out.push({ t: 'add', s: b[j++] });
  return out;
}

/**
 * Readable hunks: within a run of changes (including the spaces between changed words), all removed
 * words come first, then all added words, e.g. "on [Netlify instead of the college server] [Vercel instead of Netlify]".
 */
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = before.split(/(\s+)/).filter(Boolean), b = after.split(/(\s+)/).filter(Boolean);
  // inputs are single source events / claim statements; cap the table so a huge paste can't freeze the page
  if (a.length * b.length > 250_000) return [{ t: 'del', s: before }, { t: 'add', s: after }];
  const raw = rawDiff(a, b);
  const out: DiffPart[] = [];
  let del = '', add = '';
  const flush = () => {
    if (del) out.push({ t: 'del', s: del.trim() });
    if (del && add) out.push({ t: 'same', s: ' ' });
    if (add) out.push({ t: 'add', s: add.trim() });
    del = ''; add = '';
  };
  for (let k = 0; k < raw.length; k++) {
    const p = raw[k];
    const inHunk = del || add;
    const isGap = p.t === 'same' && /^\s+$/.test(p.s) && inHunk && raw[k + 1] && raw[k + 1].t !== 'same';
    if (p.t === 'del' || (isGap)) del += p.s;
    if (p.t === 'add' || (isGap)) add += p.s;
    if (p.t === 'same' && !isGap) {
      if (inHunk) { const trail = /^\s/.test(p.s) ? '' : ' '; flush(); if (trail && out.length) out.push({ t: 'same', s: trail }); }
      const last = out[out.length - 1];
      if (last && last.t === 'same') last.s += p.s; else out.push({ t: 'same', s: p.s });
    }
  }
  flush();
  return out;
}
