/** Round 3: compare two published handover versions (claims already permission-filtered for the viewer). */
import type { Claim } from '../types';
import { norm } from './text';

export interface VersionDiff {
  added: Claim[];
  removed: Claim[];
  reworded: { before: Claim; after: Claim }[];
  same: number;
}

export function diffVersions(older: Claim[], newer: Claim[]): VersionDiff {
  const oldById = new Map(older.map((c) => [c.id, c]));
  const matched = new Set<string>();
  const added: Claim[] = [];
  const reworded: VersionDiff['reworded'] = [];
  let same = 0;
  const unmatchedNew: Claim[] = [];
  for (const c of newer) {
    const o = oldById.get(c.id);
    if (!o) { unmatchedNew.push(c); continue; }
    matched.add(o.id);
    if (norm(o.statement) === norm(c.statement)) same++;
    else reworded.push({ before: o, after: c });
  }
  // a claim can change id (e.g. re-proposed by another proposer) while saying the same thing
  const oldByText = new Map(older.filter((c) => !matched.has(c.id)).map((c) => [norm(c.statement), c]));
  for (const c of unmatchedNew) {
    const o = oldByText.get(norm(c.statement));
    if (o && !matched.has(o.id)) { matched.add(o.id); same++; } else added.push(c);
  }
  return { added, removed: older.filter((c) => !matched.has(c.id)), reworded, same };
}
