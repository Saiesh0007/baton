import { useMemo } from 'react';
import { wordDiff } from '../lib/diff';

/** Inline word diff: removed words struck through, added words highlighted. */
export function DiffText({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => wordDiff(before, after), [before, after]);
  return (
    <span className="diff">
      {parts.map((p, i) => p.t === 'same' ? <span key={i}>{p.s}</span> : p.t === 'add' ? <ins key={i}>{p.s}</ins> : <del key={i}>{p.s}</del>)}
    </span>
  );
}
