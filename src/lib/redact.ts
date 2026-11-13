import type { Redaction } from '../types';

const RULES: { type: string; re: RegExp; repl?: string }[] = [
  { type: 'token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { type: 'token', re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { type: 'token', re: /\b[sr]k_(live|test)_[A-Za-z0-9]{10,}\b/g },
  { type: 'token', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: 'token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { type: 'token', re: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { type: 'token', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g },
  { type: 'secret', re: /\b(api[_-]?key|secret|password|passwd|pwd|access[_-]?token)(\s*[:=]\s*)(?!\[REDACTED)\S+/gi, repl: '$1$2[REDACTED:secret]' },
  { type: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: 'phone', re: /(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g },
];

/** Mask secrets and personal data before anything is stored or analysed. */
export function redact(text: string, tally: Map<string, number>): string {
  let out = text;
  for (const r of RULES) {
    out = out.replace(r.re, (...args) => {
      tally.set(r.type, (tally.get(r.type) ?? 0) + 1);
      if (r.repl) {
        return r.repl.replace('$1', args[1]).replace('$2', args[2]);
      }
      return `[REDACTED:${r.type}]`;
    });
  }
  return out;
}

export function tallyToList(t: Map<string, number>): Redaction[] {
  return [...t.entries()].map(([type, count]) => ({ type, count }));
}
