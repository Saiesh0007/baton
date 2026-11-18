# Baton: evidence-first knowledge handover

**Team Spectrum · CodePuneThinkers Hackathon · Round 3 (The Final Build)**

Baton turns a team's scattered project activity (meeting notes, chat exports, GitHub history, task records) into a
**claim ledger**: every handover statement carries a quote that is checked word for word against its source. Gaps and
contradictions become a short **exit interview** for the person leaving. A **reviewer approves** each claim, and the
**successor** gets a permission-filtered handover with sources, risks, people to ask and a first-week plan.

**Live:** https://baton-phi-three.vercel.app

- **No account:** click **Open the demo** and use **View as** (Reviewer / Leaver / Successor) to walk the whole workflow.
- **With accounts:** sign in under **Shared handovers** to work on one handover as a team, each person in their own role.

## What Round 3 added (the three improvements promised in Round 2)

| # | Promised | Delivered | Where to see it |
|---|---|---|---|
| 1 | An LLM claim proposer, measured against the Round 2 baseline | `gpt-oss-120b` (open weights) on Groq proposes claims from a server function; the key never reaches the browser. The deterministic verifier still checks every quote, so a misquote cannot reach the ledger. Measured on the same real repos as Round 2 (see [Evaluation](#evaluation)). | Sources → "Claim proposer: LLM / Rules"; LLM claims carry an `LLM` label in the ledger |
| 2 | Real accounts with server-enforced permissions | Supabase Auth, a shared Postgres database with row-level security, invite links per role. A successor's queries never return leads-only rows; the successor's copy of a published version is cut on the server from the visibility stored in the database; the LLM function reads team-visible text itself, so restricted text never reaches the successor's browser or the prompt. | Home → Shared handovers; Overview → Team (invite links); `npm run test:rls` |
| 3 | Re-sync with change tracking | Re-import a source (GitHub fetch, upload or paste): only changed text is re-read; approved claims whose quote was edited or deleted go back to review with a word-level diff; every published version is kept and the handover shows what changed. | Sources → Re-sync (the demo notes have a one-click sample update) → Review → Handover "What changed" |

Changes from the Round 2 plan, and why:
- **Model:** Groq does not offer a Llama chat model on our key, so the proposer uses **`openai/gpt-oss-120b`**, also an open-weights
  model. When its free daily quota is used up, it falls back to `gpt-oss-20b` (claims say which model proposed them), and then to the rules.
- **Invites are links, not emails:** the free Supabase tier sends only a few emails per hour, so the reviewer copies a one-time link.

## Core workflow

| Step | Who | What happens |
|---|---|---|
| 1 Connect | Reviewer | Import a **public GitHub repo** (live, read-only), **Markdown/text notes**, **Discord/Slack JSON exports**, **task CSV**, or paste text. Each source is *Team* or *Leads only*. Tokens, API keys, emails and phone numbers are **masked at import**. Re-import any source later with **Re-sync**. |
| 2 Reconstruct | LLM or rules | The proposer suggests atomic claims (decision, owner, status, risk, dependency, next action, recurring issue, contact), each with a quote and a workstream. Leads-only text and task rows always use the rules. |
| 3 Verify | Code | Every quote is checked **word for word** against the stored source. Duplicates across sources merge (**Corroborated**); opposing claims on one topic are **Conflicting**; ownership guessed from activity is **Inferred**. A template per workstream gives **Missing** gaps and a **Readiness %**. |
| 3½ Ask the leaver | Leaver | Only what the evidence can't answer: conflicts (both sides shown), missing fields, inferred claims. Answers become a labelled source (**Leaver-attested**). |
| 4 Review | Reviewer | Risk-sorted queue: approve / edit / reject with version history. Inferred or conflicting claims need a human edit first. Claims whose source changed since approval come back first, flagged, with a diff. Publish creates a frozen version. |
| 5 Handover | Successor | Approved claims only, leads-only evidence removed (shown as **knowledge shadows**), risks, people to ask, first-week plan, per-item *Got it* / *Unclear*, **Ask the handover**, Markdown export, and **What changed** since the previous version. |

Evidence statuses are assigned by code, never by model confidence: **Corroborated** (2+ independent sources), **Cited** (one
verified quote), **Leaver-attested**, **Inferred** (no verified quote), **Conflicting**.

## Architecture

```
Browser (React 19 + TypeScript, Vite)                     Vercel server functions (api/)
 ├─ ingest.ts   parsers, GitHub REST, masking              ├─ propose.ts  Groq call; in shared handovers it reads
 ├─ analyze.ts  proposer → verifier → corroboration →      │              team-visible text from the DB itself
 │              conflicts → gaps → interview → review      └─ publish.ts  checks the caller is the reviewer, cuts the
 ├─ llm.ts      prompt, batching, rate-limit handling,                    successor's copy using DB visibility
 │              quote fitting (verifier is unchanged)
 ├─ resync.ts   match old/new events, flag approvals        Groq (gpt-oss-120b → gpt-oss-20b fallback)
 ├─ cloud.ts    Supabase client: load, diff-save, invites
 └─ store.tsx   local handovers (localStorage) or shared    Supabase: Auth + Postgres with row-level security
                handovers (Supabase), one interface          (supabase/migrations/*.sql)
```

### Who can see what (enforced by Postgres row-level security)

| Data | Reviewer | Leaver | Successor |
|---|---|---|---|
| Team sources and their text | read, write | read | read |
| Leads-only sources and their text | read, write | read | **no rows returned** |
| Working state (reviews, interview answers, audit, LLM cache) | read, write | read, write | **no rows returned** |
| Published version, full copy | read | read | **no rows returned** |
| Published version, team copy (built on the server) | read | read | read |
| Acknowledgements and questions | read, write | read, write | read, write |
| Invites, members | create, remove | read | read |

A chunk always takes its source's visibility through a database trigger, so a browser cannot mislabel restricted text as team text.

## Run it locally

```bash
git clone https://github.com/Saiesh0007/baton.git && cd baton
npm install
npm run dev            # http://localhost:5173 — the demo works with no keys at all
```

Optional, to switch on the LLM and shared handovers: copy `.env.example` to `.env.local` and fill it in.

1. **LLM:** create a free key at console.groq.com and set `GROQ_API_KEY`.
2. **Accounts:** create a free Supabase project, then
   - set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (Settings → API Keys);
   - run the SQL in `supabase/migrations/` in order (SQL editor, or `psql "$DATABASE_POOLER_URL" -f supabase/migrations/001_init.sql`, then `002_...`);
   - in Authentication → Sign In / Providers, turn **Confirm email** off (sign-up then signs in straight away).

`npm run dev` also serves the `api/` functions locally, so no other server is needed. To deploy, import the repo into Vercel
and add the same variables. `npm run build` makes the production build in `dist/`.

## Tests and evaluation

| Command | What it checks |
|---|---|
| `npm test` | Re-sync (19 checks), seeded evaluation with the rules and with the saved LLM proposals |
| `npm run test:rls` | 22 permission checks against the real database: throwaway reviewer, leaver and successor accounts, a handover with a leads-only source; deletes everything afterwards. Needs `npm run dev` running. |
| `npm run eval:real` | The rules proposer on five public-repo snapshots (Round 2 baseline) |
| `npm run eval:llm [repo]` | The LLM proposer on the same snapshots; proposals are saved in `scripts/real/llm/` so results re-run without a key |

### Evaluation

**Seeded demo** (`scripts/eval.ts`, facts planted in the synthetic data):

| | Rules | LLM |
|---|---|---|
| Planted facts found | 14 / 14 | 14 / 14 |
| Planted contradictions caught | 2 / 2 | 2 / 2 |
| False contradiction questions | 0 | 0 |
| Cited quotes verified | 100 % | 100 % |

**Real repos** (latest 60 commits, 50 issues/PRs and README of five public repos, saved 14 Nov 2026; `request-promise` and
`multer` were held out in Round 2 and are the comparison set):

| | Rules (Round 2) | LLM (Round 3) |
|---|---|---|
| Claims proposed, held out | 59 | 93 |
| Held-out claims judged useful for a successor | 24 / 59 (41 %) | **49 / 93 (53 %)**: request-promise 22/37, multer 27/56 |
| Cited quotes found word for word, held out | 52 / 52 | 89 / 89 (11 misquotes caught and dropped by the verifier) |
| False contradictions, held out | 1 pair | 2 pairs (multer) |

The LLM finds **twice as many useful claims** (49 vs 24) at higher precision, and the verifier keeps citation validity at 100 %.
The held-out repos were not used to tune either proposer; the two false contradiction pairs are reported, not tuned away.

Labelling rule, the same as Round 2 ([`scripts/real/LABELS.md`](scripts/real/LABELS.md)): useful only if a successor would want it in a
handover *and* the statement is true to its quote. Round 2 labels were made by the team. Round 3 labels
([`request-promise`](scripts/real/llm/request-promise.labels.md), [`multer`](scripts/real/llm/multer.labels.md)) were drafted by our AI
coding assistant with that rule and spot-checked by the team; close calls were labelled strictly (an open PR described as done counts as not useful).

## Limits, stated plainly

- **Free LLM quota.** Groq's free tier allows about 200,000 tokens a day per model; a full GitHub repo costs 40,000–50,000. The demo and the
  five saved repos ship with their LLM proposals, so they cost nothing. When both models' quotas are used up, the rules proposer covers the rest and the app says so.
- **Rules proposer** (fallback, and for leads-only text): it can merge two opposite statements that share words; the LLM keeps them apart.
- **Files:** Markdown, text, CSV and JSON only; export .docx/PDF first. GitHub import reads the latest 60 commits and 50 issues/PRs, and
  unauthenticated GitHub allows 60 requests an hour (the saved snapshots work without it).
- **Shared editing** is save-on-change with merge for the working state; two reviewers editing the same claim at the same second: last save wins.

## Data and privacy

All demo people, messages, tokens and phone numbers are fictional. Handovers started without an account stay in the browser. Shared
handovers live in the team's Supabase project, behind row-level security. The LLM receives only team-visible text, after masking.
