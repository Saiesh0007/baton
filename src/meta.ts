import type { ClaimStatus, ClaimType } from './types';

export const STATUS_META: Record<ClaimStatus, { label: string; cls: string; help: string }> = {
  corroborated: { label: 'Corroborated', cls: 'ok', help: 'Quotes found word-for-word in 2+ independent sources (different source types or authors).' },
  cited: { label: 'Cited', cls: 'acc', help: 'Exactly one quote, checked word-for-word against the stored source text. Single source.' },
  attested: { label: 'Leaver-attested', cls: 'vio', help: 'Supplied or confirmed by the departing member in the exit interview.' },
  inferred: { label: 'Inferred', cls: 'grey', help: 'No verified quote. Cannot be approved without a human edit.' },
  conflicting: { label: 'Conflicting', cls: 'bad', help: 'Disagrees with another claim on the same topic. Both sides are shown.' },
};

export const TYPE_LABEL: Record<ClaimType, string> = {
  decision: 'Decision', owner: 'Owner', status: 'Status', risk: 'Risk', dependency: 'Dependency', task: 'Next action', issue: 'Recurring issue', contact: 'Contact',
};

/** Ledger margin mark: the proof state of a claim, read the same way on every screen. */
export const TICK: Record<ClaimStatus, string> = {
  corroborated: '✓✓', cited: '✓', attested: '✓', inferred: '?', conflicting: '≠',
};

export function download(name: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
