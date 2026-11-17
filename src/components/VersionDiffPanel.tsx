import { useMemo, useState } from 'react';
import type { Claim, PublishedSnapshot } from '../types';
import { buildView } from '../lib/view';
import { diffVersions } from '../lib/versions';
import { DiffText } from './DiffText';
import { fmtDate } from '../lib/text';

/**
 * "What changed" between two published versions. Both sides go through the successor's permission
 * filter first, so a leads-only claim can never show up through the diff.
 */
export default function VersionDiffPanel({ history, wsName }: { history: PublishedSnapshot[]; wsName: Map<string, string> }) {
  const latest = history[history.length - 1];
  const [from, setFrom] = useState(history.length - 2);
  const older = history[Math.min(Math.max(from, 0), history.length - 2)];
  const d = useMemo(() => (older && latest ? diffVersions(buildView(older).visible, buildView(latest).visible) : null), [older, latest]);
  if (!older || !latest || !d) return null;
  const nothing = !d.added.length && !d.removed.length && !d.reworded.length;
  const line = (c: Claim) => <><span className="muted small">{wsName.get(c.workstream) ?? c.workstream} · </span>{c.statement}</>;

  return (
    <div className="card vdiff">
      <div className="row between wrap">
        <h3>What changed</h3>
        <label className="inline small">Compare v{latest.version} with
          <select value={history.indexOf(older)} onChange={(e) => setFrom(Number(e.target.value))}>
            {history.slice(0, -1).map((h, i) => <option key={h.version} value={i}>v{h.version} · {fmtDate(h.ts)}</option>)}
          </select>
        </label>
      </div>
      {nothing ? <p className="muted">No changes between v{older.version} and v{latest.version}. {d.same} items are the same.</p> : (
        <>
          <p className="muted small">{d.added.length} added · {d.reworded.length} reworded · {d.removed.length} removed · {d.same} unchanged</p>
          {d.added.length > 0 && <><div className="kicker">Added</div><ul className="vlist add">{d.added.map((c) => <li key={c.id}>{line(c)}</li>)}</ul></>}
          {d.reworded.length > 0 && <><div className="kicker">Reworded</div><ul className="vlist">{d.reworded.map(({ before, after }) => <li key={after.id}><span className="muted small">{wsName.get(after.workstream) ?? after.workstream} · </span><DiffText before={before.statement} after={after.statement} /></li>)}</ul></>}
          {d.removed.length > 0 && <><div className="kicker">Removed</div><ul className="vlist del">{d.removed.map((c) => <li key={c.id}><s>{line(c)}</s></li>)}</ul></>}
        </>
      )}
    </div>
  );
}
