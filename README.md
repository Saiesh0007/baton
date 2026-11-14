# Baton — evidence-first knowledge handover

**Team Spectrum · CodePuneThinkers Hackathon · Round 2 (The Build)**

Baton turns a team's scattered project activity (meeting notes, chat exports, GitHub history, task records) into a
**claim ledger**: every handover statement carries a quote that is checked word-for-word against its source. Gaps
and contradictions become a short **exit interview** for the person leaving. A **reviewer approves** each claim, and the
**successor** gets a permission-filtered handover with sources, risks, people to ask and a first-week plan.

> No login needed. Click **Open demo** and use the **View as** switcher (Reviewer / Leaver / Successor) to walk through the workflow.

## Core workflow (what works end to end)

| Step | Who | What happens |
|---|---|---|
| 1 Connect | Reviewer | Import a **public GitHub repo** (live, read-only REST API), **Markdown/text notes**, **Discord/Slack JSON exports**, **task CSV**, or paste text. Each source gets a visibility (*Team* / *Leads only*). Tokens, API keys, emails and phone numbers are **masked at import**, before anything is stored or analysed. |
| 2 Reconstruct | System | Events are split into sentences. The proposer extracts atomic claims (decision, owner, status, risk, dependency, next action, recurring issue, contact) with a quote and a workstream. |
| 3 Verify | System (rules) | Every quote is checked **word-for-word** against the stored source text. Duplicates across sources are merged (**Corroborated**), and claims on the same topic with opposite polarity are flagged **Conflicting**. Ownership guessed from activity counts is labelled **Inferred**. A template per workstream (owner, status, last decision, risks, next action) gives **Missing** gaps and a **Readiness %**. |
| 3½ Ask the leaver | Leaver | Only the questions the evidence can't answer: conflicts (both sides shown), missing fields, inferred claims. Answers become a new labelled source (**Leaver-attested**). "I don't know" is kept as an honest gap. |
| 4 Review | Reviewer | Risk-sorted queue: approve / edit / reject, with version history. Inferred or unresolved conflicting claims **cannot be approved without a human edit**. Manual claims are verified against all sources too. Publish creates a frozen, versioned snapshot. |
| 5 Handover | Successor | Built only from approved claims, with **leads-only evidence removed before rendering**. Restricted claims show as **knowledge shadows** ("a decision about X exists, ask the reviewer"). Includes a risk & dependency panel, people to ask, a first-week plan, per-item acknowledgement (*Got it* / *Unclear*, which goes back to the reviewer), **Ask the handover** (answers only from approved claims, otherwise "not in evidence, ask…"), and a Markdown export with a citation appendix. |

## Evidence statuses (assigned by code, never by model confidence)

- **Corroborated**: verified quotes from 2+ independent sources (different source types or authors)
- **Cited**: one verified quote
- **Leaver-attested**: from the exit interview, labelled "according to <leaver>"
- **Inferred**: no verified quote; greyed out; needs a human edit before approval
- **Conflicting**: contradicts another claim on the same topic; turned into an interview question

## Tech

- React 19 + TypeScript + Vite, a static single-page app deployed on Vercel
- All logic runs in the browser: `src/lib/ingest.ts` (parsers + GitHub REST), `src/lib/redact.ts` (masking),
  `src/lib/analyze.ts` (proposer → verifier → corroboration → conflicts → gap engine → interview → review)
- Persistence: browser `localStorage` (no account, no server-side data)
- The claim proposer is rules-based in this build. It sits behind one function (`extractClaims`), so an LLM proposer can replace it
  without touching the verifier, which keeps checking every quote either way.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/
npx tsx scripts/eval.ts   # seeded ground-truth evaluation
```

## Seeded evaluation (synthetic demo dataset)

`scripts/eval.ts` checks the pipeline against facts planted in the demo data:

| Metric | Result |
|---|---|
| Recall on planted owners / decisions / risks / dependencies / recurring issues / tasks | 14 / 14 |
| Planted contradictions detected (Razorpay reversal; task "Done" vs chat "half done") | 2 / 2, 0 false conflict questions |
| Planted gaps turned into interview questions | 2 / 2 |
| Citation validity of Cited / Corroborated claims | 100 % (by construction) |
| Secrets/PII left after redaction | 0 |

Caveat: the extraction rules were developed with this dataset in view, so these numbers are an upper bound. The real-data
check below is the honest number.

## Real-data check (public GitHub repositories)

`scripts/real.ts` runs the same pipeline on saved snapshots of real public repos (latest 60 commits, 50 issues/PRs, README,
fetched 14 Nov 2026). Three were used while fixing rules; two were held out and fetched only after the rules were frozen.
Every claim was labelled by hand in [`scripts/real/LABELS.md`](scripts/real/LABELS.md).

| Metric | Result |
|---|---|
| Cited quotes found word-for-word in the real source, all 5 repos | **114 / 114** |
| Lifecycle status found ("request is fully deprecated", "Node Sass has reached end of life", ...) | **4 / 4** repos that have one |
| Held-out claims judged useful for a successor (request-promise, multer) | **24 / 59 (41 %)** |
| False contradictions on held-out repos | 1 pair |

The verifier holds on real data; the rules-based proposer is noisy (user support questions and README API text read like
claims), which is why every claim passes the reviewer queue before a successor sees it. The same snapshots load in the app:
**Sources → GitHub repo → Real projects, saved 14 Nov 2026**, so the check can be repeated with no network or rate limit.

## Data & privacy

All demo people, messages, tokens and phone numbers are fictional. Imported data never leaves the browser. The only network calls
are unauthenticated, read-only GitHub API requests for repositories the user enters.
