# Real-data check: hand labels

Snapshots of five public GitHub repositories, taken on 14 Nov 2026 through the GitHub REST API: the latest 60 commits, the 50 most recently updated issues/PRs, and the README. That is the same data the in-app importer reads. Re-run with `npx tsx scripts/real.ts [key]`.

- **Tuning set** (looked at while fixing rules): `request/request`, `sass/node-sass`, `moment/moment`.
- **Held-out set** (fetched after the rules were frozen, never used to tune): `request/request-promise`, `expressjs/multer`.

A claim is labelled **useful** only if a successor would want it in a handover *and* its statement is true to the source. Labels were made by the team and are a judgement, not ground truth. Every row below can be checked against the link in the app's evidence drawer.

## Results

| | request-promise | multer | Held-out total |
|---|---|---|---|
| Claims proposed | 26 | 33 | 59 |
| Quotes found word-for-word in the source | 23/23 cited | 29/29 cited | **52/52 (100%)** |
| Judged useful | 15 | 9 | **24/59 (41%)** |
| Lifecycle status found (deprecated / EOL) | yes (commit 052331d) | n/a, active repo, none falsely claimed | 1/1 |
| False contradictions raised | 0 | 1 pair | 1 |

Across all five repos, 114/114 cited quotes verify. Lifecycle status was found in all four repos that have one: request ("As of Feb 11th 2020, request is fully deprecated."), node-sass ("Node Sass has reached end of life"), moment (README line 12, attached to a community issue's claim instead of its own), and request-promise.

**What this says:** the verifier holds on real data, so nothing reaches the ledger without a real quote. The rules-based proposer is noisy, though: on real repos fewer than half its claims are worth keeping, mostly because user support questions and README API text read like claims. That is why every claim goes through the reviewer queue, and why the proposer sits behind one function (`extractClaims`) so a better model can replace it while the verifier stays.

## Rule changes made on the tuning set

All five changes still pass the seeded eval (14/14, 2/2, 31/31, 0 secrets).

1. Lifecycle words (`deprecated`, `maintenance mode`, `end of life`, `no longer maintained`, `legacy project`, `archived`) become status claims. Before this, Baton missed "request is fully deprecated".
2. Code, API-reference bullets, issue-template prompts and pasted npm logs are not claims.
3. Bot accounts (dependabot and others) state no facts and are never inferred owners. Before this, dependabot was guessed as owner of node-sass's build.
4. A commit title repeated in its body gives one claim, not two.
5. Two sentences from the same message are never a contradiction.

Baseline before the changes, same labelling rule: request 10/28, node-sass 6/20, moment 9/29 useful.

## Held-out labels

`✓` useful · `✗` not useful (reason)

### request/request-promise
1. ✓ Bumped request-promise-core due to security vulnerability of lodash
2. ✓ This package will be deprecated as well as request.
3. ✓ request-promise-native has already been deprecated
4. ✓ Switched to renamed request-promise-core package
5. ✓ Security issue reported on a dependency of 4.2.6
6. ✗ user support question (timeout vs Postman)
7. ✗ user comment
8. ✗ user install report
9. ✗ user question
10. ✗ user comment
11. ✓ As of Feb 11th 2020, request is fully deprecated (quoted in issue #340)
12. ✗ user complaint about bundle size
13. ✗ user need
14. ✗ user need
15. ✗ user bug report, unconfirmed
16. ✗ same report
17. ✗ user question
18. ✓ Non-2xx responses reject the promise by default
19. ✓ request became a peer dependency
20. ✓ request must be installed as a direct dependency
21. ✓ Continuation Local Storage is no longer supported
22. ✓ Transform errors reject with TransformError
23. ✓ Previously, transform errors were thrown directly
24. ✓ analog-nico most active on maintenance (inferred, and analog-nico is the maintainer)
25. ✓ same, Promises
26. ✓ same, Security

### expressjs/multer
1. ✓ Regression tests for the storage engine _removeFile contract
2. ✗ sentence fragment from a commit body
3. ✗ fragment
4. ✗ fragment, out of context
5. ✗ fragment
6. ✓ Removed concat-stream dependency
7. ✓ Dropped deep-equal devDependency
8. ✓ Filename example uses crypto.randomBytes instead of Math.random()
9. ✓ Open PR: don't call next() twice after busboy fails
10. ✗ PR description boilerplate
11. ✗ fragment
12. ✗ test output
13. ✗ false contradiction (with 14)
14. ✗ false contradiction (with 13)
15. ✗ workaround detail
16. ✗ fragment
17. ✗ grammar fix
18. ✗ fragment
19. ✗ feature proposal, not a fact
20. ✓ Open bug: fileFilter error needs the next request to retry
21. ✓ Open bug: request after TOO_MANY_FILES hangs
22. ✗ duplicate of 21
23. ✗ user comment
24. ✗ suggestion
25. ✗ suggestion
26. ✗ README usage text
27. ✗ README fragment
28. ✗ useful gotcha but typed as an owner claim
29. ✗ README API text
30. ✗ README API text
31. ✗ fragment
32. ✓ UlisesGascon most active on uploads (inferred; a current Express maintainer)
33. ✓ same, Security
