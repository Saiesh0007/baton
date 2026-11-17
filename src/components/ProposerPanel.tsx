import { useStore } from '../store';
import { LLM_MODEL_LABEL } from '../lib/llm';

/**
 * Which proposer suggests claims, and the live state of an LLM run.
 * The verifier is the same either way: every quote is checked word for word.
 */
export default function ProposerPanel({ compact }: { compact?: boolean }) {
  const { project, analysis, role, llmRun, llmPending, runLlm, stopLlm, setLlmEnabled } = useStore();
  if (!project || !analysis) return null;
  const on = !!project.llm?.enabled;
  const err = project.llm?.lastError;
  const canEdit = role === 'reviewer';
  const llmClaims = analysis.claims.filter((c) => c.proposer === 'llm' && !c.superseded).length;
  const leads = project.sources.filter((s) => s.visibility === 'leads').length;
  const pr = llmRun?.progress;
  const pct = pr && pr.total ? Math.round((pr.done / pr.total) * 100) : 0;

  return (
    <div className="proposer" aria-live="polite">
      <div className="row between wrap">
        <div>
          <b>Claim proposer:</b>{' '}
          {on ? <>LLM <span className="muted">· {LLM_MODEL_LABEL}</span></> : <>Rules <span className="muted">· deterministic patterns</span></>}
        </div>
        {canEdit && (
          <div className="seg-ctl" role="group" aria-label="Claim proposer">
            <button className={on ? 'on' : ''} onClick={() => !on && setLlmEnabled(true)}>LLM</button>
            <button className={!on ? 'on' : ''} onClick={() => on && setLlmEnabled(false)}>Rules</button>
          </div>
        )}
      </div>

      {on && llmRun && pr && (
        <>
          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }} /></div>
          <div className="row between wrap small">
            <span>{pr.waiting ? `Free-tier rate limit reached, continuing in ${pr.waiting}s…` : `Reading ${pr.done} of ${pr.total} events…`} Claims appear as each batch finishes.</span>
            <button className="btn xs" onClick={stopLlm}>Pause</button>
          </div>
        </>
      )}

      {on && !llmRun && err && (
        <div className="row between wrap small proposer-msg">
          <span>{err === 'Paused.' ? `Paused. ${llmPending} events not read by the LLM yet; they use the rules for now.` : <>LLM unavailable: {err} The {llmPending} unread events use the rules proposer meanwhile.</>}</span>
          {canEdit && <button className="btn xs" onClick={runLlm}>{err === 'Paused.' ? 'Resume' : 'Try again'}</button>}
        </div>
      )}

      {!compact && (
        <p className="muted small proposer-note">
          {on
            ? <>The model only <i>proposes</i>. Every quote it returns is checked word for word against the source; {analysis.rejectedQuotes.llm > 0 ? <><b>{analysis.rejectedQuotes.llm}</b> proposals with a quote not found in the source were dropped. </> : 'none has failed yet. '}
              {llmClaims} claims from the LLM. Task rows{leads ? ' and leads-only sources (never sent to the model)' : ''} use the rules.
              {project.llm?.prebuilt && <> The demo's proposals were made with the same model ahead of time so it opens instantly; any source you import is read live.</>}</>
            : <>Rules find claims by pattern. They are predictable but noisy on real repos (41% useful on our held-out test). Switching re-proposes the claims; reviews made under the other proposer are kept and come back if you switch back.</>}
        </p>
      )}
    </div>
  );
}
