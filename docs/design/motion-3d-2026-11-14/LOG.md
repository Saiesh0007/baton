# Design log: 3D + motion pass (2026-11-14)

Brief from the owner: the ledger redesign reads as text-heavy and static. Judges decide in seconds. Wanted: real 3D, purposeful animation, far less copy. All features must keep working; Round 2 deadline 2026-11-15 10:00 IST.

## Directions explored (rendered side by side, not just described)
- **D1 Evidence room:** dark stage, the demo's real source cards (notes, commit, chat, PR) floating in 3D depth; threads draw from quoted lines to a claim; a conflict is flagged; a human stamps it.
- **D2 Paper desk:** light paper desk seen from above, cards scattered flat, the handover page standing up. Calm, but the desk cards are unreadable at that angle and the page has a dead band.
- **D3 Relay lane:** 3D running-track floor, a baton mid-pass, giant type. Strong line, but the baton reads as a toy and it shows a metaphor, not the mechanism.

**Picked D1, with D3's pass as its last beat.** It is the only one where the 3D carries meaning (sources at the back, verified claim in front, the handover moves toward the viewer) and the motion *is* the explanation, using real demo data. It replaces the paragraphs that made the page text-heavy.

## System (unchanged, extended)
Existing ledger tokens stay the system. The hero is a `.stage` scope that uses the dark-theme tokens; cards on it use the light (paper) tokens, like paper on a dark desk. New tokens: `--stage`, `--lamp`, `--ease-out: cubic-bezier(.2,.8,.2,1)`, `--ease-in-out: cubic-bezier(.65,0,.35,1)`, `--impact: cubic-bezier(.5,0,.75,0)` (falls into a stamp), durations 160/240/420/700 ms.

## Motion inventory (each with its Disney principle)
| Moment | What moves | Principle |
|---|---|---|
| Hero loop | highlight sweeps a source line, a thread draws to the claim, the quote settles in, the tick is inked | staging, arcs, follow-through |
| Hero conflict | two lines turn red, a red thread joins them, ≠ lands with a squash | squash and stretch, timing |
| Hero / review approve | stamp lifts, then strikes and settles | anticipation, exaggeration (first success only) |
| Hero pass | claim card arcs toward Diya | arcs, slow in / slow out |
| Camera | scene tilts with the pointer; layers parallax by depth | solid drawing (true perspective) |
| Ticks everywhere | ✓ strokes draw like ink when they enter view; the 2nd tick of ✓✓ lags | overlapping action |
| Numbers | readiness and figures count up | slow out |
| Review queue | approved/rejected rows stamp, then collapse; the rest slide up | follow-through, staging |
| Publish | approved claims stack into one handover and pass to the successor | exaggeration, arcs |
| Evidence drawer | slides in; the matched quote is highlighted like a marker stroke | staging |

Reduced motion: loops stop on the composed final frame; everything else becomes an instant change.

## Verification (what was captured and what it caught)
- Hero held on each beat (`?stage=N`) at 1440 / 1920 / 1024 / 768 / 390, plus 30 fps frame sheets of the verify and stamp transitions, plus a real-time video of the whole loop.
  - Caught: threads ended inside the claim and crossed its text → now tied to the card's outer edges and routed around it; stamp covered the meta line → moved to the bottom corner; Diya's chip ran off screen → recomposed; notes line numbers were off by one (the ledger cites line 7) → fixed; translucent dark header turned grey over the paper page → solid; 1024 stacked too early → side by side down to 900; ~2.5 s of empty centre at the loop end → timeline tightened.
  - Virtual-time stills show stray thread fragments; the real-time video does not. Capture artefact, not a page bug.
- Real-time recordings of the app: bulk approve, publish, drawer, in light, dark and at 390.
  - Caught: bulk approve gave no visible feedback (approved claims are below the fold) → "✓ 5 approved" next to the button and counts that tick over; publish overlay was white-on-paper and cut hard to the next page → moved to the shell, dark room, fades off the handover page; readiness number was shrunk by a selector meant for the % sign → fixed; "unclear?" links cluttered the successor plan → inline and quiet.
- Reduced motion: the hero is a composed still (threads, ✓✓, stamp, conflict) and everything else changes instantly.
- Production build smoke test: hero, demo, bulk approve, publish, successor view, drawer; no console errors or warnings. Seeded eval unchanged (14/14, 2/2, 31/31, 0 secrets).

## Critique (round 1)
No fresh critic agent was available in this session, so per the critique guide this was scored cold from the captures alone.

| Criterion | Score | Evidence |
|---|---|---|
| Design (40%) | 7.5 | The hero is distinctive and on-concept; working screens are clean but conventional |
| Usability (30%) | 8 | One clear primary action per screen, reduced motion respected, phone layouts hold |
| Creativity (20%) | 8 | Verification shown as motion on the product's real data; the baton pass |
| Content (10%) | 7.5 | Intros cut to one line; the ledger and handover were still dense |

Weighted ≈ 7.8. Biggest wrong note: text density on working screens. Fixed in this round: evidence lists show the first quote with "+N more sources"; a workstream's empty fields are said once ("No approved evidence for status, last decision and next action") instead of once per field.

What still stands between this and the bar: the working screens are tidy but not memorable; the home page loses energy below the hero; no sound or haptics; the hero's source cards are small on phones.

## Notes
- `interface-craft` skill is not installed on this machine, so its references could not be loaded.
- No image-generation keys were available to check; 3D is built in code (CSS 3D, real perspective), which also keeps all text real and selectable.
