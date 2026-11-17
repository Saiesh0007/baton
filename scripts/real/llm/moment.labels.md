# moment/moment: LLM proposals to label

Rule (same as Round 2, LABELS.md): **useful** only if a successor would want it in a handover *and* the statement is true to the quote.
Replace `[ ]` with `[✓]` or `[✗ reason]`.

- [ ] **1.** [time-zones-parsing/decision/cited] An internal date-default hook was added for Moment Timezone  <- commit 710703b
  > [feature] Add internal date-default hook for Moment Timezone (#6451)
- [ ] **2.** [general/decision/cited] Stack traces are now included in conditional deprecation warnings  <- commit 863ed94
  > [bugfix] Add stack traces to conditional deprecations
- [ ] **3.** [general/decision/conflicting] A security threat model was added to the documentation  <- commit 761e1f6
  > [misc] Add security threat model
- [ ] **4.** [locales/decision/cited] Locale parsing caches are reset after updates to avoid stale data  <- commit 4a5b290
  > [bugfix] Reset locale parsing caches after updates (#6436)
- [ ] **5.** [locales/decision/cited] Inherited lowercase long date formats are kept in a separate cache to prevent merging into child locales  <- commit 9cbe162
  > [bugfix] Fix inherited lowercase long date formats (#6434)
- [ ] **6.** [general/decision/cited] Non‑Moment arguments are ignored in min and max calculations  <- commit bd9555b
  > [bugfix] Ignore non-Moment arguments in min and max (#6433)
- [ ] **7.** [general/decision/cited] CI now includes a meta check for validation  <- commit 0433f01
  > [misc] add CI meta check for validation (#6408)
- [ ] **8.** [locales/owner/cited] The locale reviewer agent skill was created and is owned by the locales team  <- commit efcea5d
  > [misc] Create locale reviewer agent skill (#6407)
- [ ] **9.** [locales/status/cited] German locales (de, de-at, de-ch) now parse short month names without a trailing dot.  <- commit fae681c
  > [locale] de, de-at, de-ch: parse short months without trailing dot (#6396)
- [ ] **10.** [general/decision/cited] The team will uninstall the FOSSA GitHub App and run scans on the develop branch after each merge, keeping the report green.  <- commit 4d23572
  > Since the published package has no actual dependencies, we don't need to run FOSSA on PRs.  Instead, we can uninstall the app and just run the scans on develop after a merge, which will keep the report green.
- [ ] **11.** [general/owner/cited] A CODEOWNERS file has been added to define repository code owners.  <- commit e26e6f5
  > [misc] add code owners file (#6385)
- [ ] **12.** [general/status/cited] The npm packaging issues have been fixed and the package can now be published correctly.  <- commit e89b241
  > [misc] fix npm packaging (#6383)
- [ ] **13.** [locales/issue/cited] Develop CI failures were caused by recent locale changes and were fixed by converting the locale to the source tree's expected module format and aligning meridiems, 12‑hour formats, week settings, and test fixtures with CLDR data.  <- commit f6f668d
  > Fix develop CI failures from recent locale changes (#6379)
- [ ] **14.** [locales/owner/cited] Adidaslevy is the maintainer responsible for fixing the ('L') format for Georgian and Flemish (Belgium Dutch) locales.  <- commit 5b5b2ec
  > [locale] Fixed ('L') format for Georgian and Flemish (Belgium Dutch). (#6217)
- [ ] **15.** [locales/status/corroborated] The ('L') format fix for Georgian and Flemish locales is completed and merged.  <- commit 5b5b2ec
  > [locale] Fixed ('L') format for Georgian and Flemish (Belgium Dutch). (#6217)
- [ ] **16.** [locales/owner/cited] Tekleayele added the Amharic (Ethiopia) locale (am‑et).  <- commit f85937e
  > [locale] Add Amharic (Ethiopia) locale [am-et] (#6278)
- [ ] **17.** [locales/owner/cited] UsamaJ17 fixed the Thursday shortcode for the Swedish (sv) locale.  <- commit d5fc455
  > fix: thursday shortcode for sv locale (#6289)
- [ ] **18.** [locales/owner/cited] Qmoya replaced straight quotes with curly quotes in the Catalan locale file.  <- commit 7ea5aae
  > [locale] ca.js: replace straight quotes with curly quotes (#6306)
- [ ] **19.** [locales/status/cited] The quote replacement in ca.js is completed and merged.  <- commit 7ea5aae
  > [locale] ca.js: replace straight quotes with curly quotes (#6306)
- [ ] **20.** [locales/task/cited] Update Sinhala (si) translations with correct month names and minute translation; PR #6264 is open and awaiting review/merge.  <- PR #6264 (open)
  > [locale] Update Sinhala (si) translations
- [ ] **21.** [locales/issue/cited] Sinhala locale lacks standard month abbreviations, requiring careful handling to avoid meaning changes.  <- PR #6264 (open)
  > Shortening Sinhala month names changes their meanings entirely
- [ ] **22.** [general/task/cited] Fix floating point error in duration.as("weeks"); PR #6464 is open and needs review/merge.  <- PR #6464 (open)
  > [bugfix] Fix floating point error in duration.as("weeks")
- [ ] **23.** [locales/task/corroborated] Parse month format variant for object‑shaped locales; PR #6467 is open and pending integration.  <- PR #6467 (open)
  > [bugfix] Parse the month format variant that object-shaped locales format with
- [ ] **24.** [general/task/cited] Preserve interval of mixed‑sign durations in duration.abs(); PR #6460 is open and awaiting merge.  <- PR #6460 (open)
  > [bugfix] `duration.abs()`: preserve the interval of mixed-sign durations
- [ ] **25.** [locales/risk/cited] The current `meridiemParse` regex for ug‑cn matches the shorter afternoon token first, causing strict parsing of afternoon times to fail.  <- PR #6466 (open)
  > Regex alternation is ordered and matches at the earliest position, so at the start of `چۈشتىن كېيىن` the shorter `چۈش` alternative wins and the longer afternoon form is unreachable
- [ ] **26.** [locales/decision/cited] Set `weekdaysParseExact: true` fixes full weekday name parsing for ga and mt locales.  <- PR #6462 (open)
  > Setting `weekdaysParseExact: true` fixes both; `ga` already does the same for months.
- [ ] **27.** [locales/status/cited] The fix for ga and mt weekday parsing is currently in an open PR.  <- PR #6462 (open)
  > Two weekday-name bugs, one in `dddd` parsing and one in Maltese `dd` output.
- [ ] **28.** [locales/issue/cited] The Greek (el) locale cannot parse back genitive month names, causing formatted dates to be unreadable.  <- PR #6469 (open)
  > The `el` locale formats month names in the genitive case whenever a day number precedes them, but none of those genitive names can be parsed back.
- [ ] **29.** [locales/issue/cited] Ur and Sd locales fail strict parsing of `LLLL` because the preparse/postformat separator does not match the pattern literal.  <- PR #6468 (open)
  > the literal token never matches, strict mode records an unused token plus an unused input chara
- [ ] **30.** [general/status/cited] The change to keep the date when the weekday name is unparsable is in an open PR.  <- PR #6461 (open)
  > [bugfix] day()/isoWeekday(): keep the date when the weekday name is unparsable
- [ ] **31.** [general/status/cited] The `chooseLocale` prefix‑walk cap has been merged and is live.  <- PR #6458 (merged)
  > [bugfix] Bound chooseLocale prefix walk for long locale names
- [ ] **32.** [locales/issue/cited] Montenegrin (me) locale used incorrect grammatical case for numbers above 20.  <- PR #6456 (open)
  > Fixes grammatical case selection in the Montenegrin (me) locale for numbers above 20.
- [ ] **33.** [locales/task/cited] Merge the PR fixing Montenegrin number case and verify tests pass.  <- PR #6456 (open)
  > [locale] me: fix grammatical case for numbers above 20
- [ ] **34.** [locales/status/cited] Moment was bumped to version 2.31.0 and new Amharic and Pashto locale outputs were released in PR #6452.  <- PR #6452 (merged)
  > Bumps Moment to 2.31.0 and refreshes the committed release artifacts, including the new Amharic (Ethiopia) and Pashto locale outputs.
- [ ] **35.** [general/decision/cited] The build now includes the standard Moment.js metadata header in the unminified moment-with-locales.js bundle.  <- PR #6447 (merged)
  > Fixes #5974 by adding the standard Moment.js metadata header to the unminified `moment-with-locales.js` bundle.
- [ ] **36.** [locales/decision/cited] Locale postformat transformations are now applied to direct calls to Locale#relativeTime and Locale#pastFuture.  <- PR #6448 (merged)
  > Apply locale `postformat` transformations to direct calls to: - `Locale#relativeTime` - `Locale#pastFuture`
- [ ] **37.** [general/decision/cited] Object.assign in duration.humanize was replaced with Moment's existing extend utility to support legacy runtimes.  <- PR #6443 (merged)
  > Replace the Object.assign call used by duration.humanize with Moment's existing extend utility.
- [ ] **38.** [locales/decision/cited] The locale loading check now uses hasOwnProp to prevent __proto__ and similar names from corrupting the global locale.  <- PR #6442 (merged)
  > The fix swaps both lookups in `loadLocale` to use the existing `hasOwnProp` helper (already used elsewhere in this file) instead of a plain property check
- [ ] **39.** [locales/risk/corroborated] Calling moment.locale('__proto__') could corrupt the global locale and cause TypeError in format/calendar/fromNow.  <- PR #6442 (merged)
  > every later call to `format`/`calendar`/`fromNow` throws because `Object.prototype` obviously isn't a real `Locale`.
- [ ] **40.** [locales/decision/cited] Fr-ca locale now matches fr for ordinals, fixing the incorrect "Dimanche 2e avril" output.  <- PR #6110 (closed)
  > We say Samedi 1er avril, but not Dimanche 2e avril. The correct for should be Dimanche 2 avril. This has been fixed in `fr.json` but not in `fr-ca.json`.
- [ ] **41.** [time-zones-parsing/decision/cited] Parsing a weekday with an incomplete date now correctly validates the moment instead of reporting a mismatch.  <- PR #6437 (merged)
  > Parsing a weekday together with an incomplete date gives back an invalid moment:
- [ ] **42.** [general/decision/conflicting] A security threat model document was added and linked from SECURITY.md and the README Resources list.  <- PR #6445 (merged)
  > Adds a `docs/threat-model.md` defining what is and is not a security vulnerability in Moment, and links it from `SECURITY.md` and the README Resources list.
- [ ] **43.** [time-zones-parsing/issue/corroborated] Moment(isoString) converts the embedded UTC offset to defaultZone in 2.31.0 when moment.tz.setDefault(zone) is active  <- issue #6459 (open)
  > [Bug] moment(isoString) converts the embedded UTC offset to defaultZone in 2.31.0 when moment.tz.setDefault(zone) is active
- [ ] **44.** [general/task/cited] Fix the release workflow before the next release, as the manual update of master after v2.31.0 indicates a broken automation  <- issue #6453 (open)
  > The new release workflow was used on v2.31.0, but failed while updating `master` after npm was published.  The `master` branch was updated manually, so the release is ok, but we should fix this before the next release.
- [ ] **45.** [locales/issue/cited] Angular builds warn about 'moment/locale/fr' as a CommonJS dependency, requiring addition of "moment" to allowedCommonJsDependencies in angular.json  <- issue #5758 (closed)
  > it is getting resolved after adding "moment" into "allowedCommonJsDependencies" section of angular.json file.
- [ ] **46.** [time-zones-parsing/issue/cited] The format string "ddd DD" is rejected as invalid while similar strings are accepted, causing parsing failures.  <- issue #6228 (closed)
  > `ddd DD` is an invalid format whereas `DD`, `ddd`, and `ddd YYYY` are valid
- [ ] **47.** [project-status/issue/cited] The issue backlog contains 46+ bugs opened before 2023, indicating a maintenance‑mode gap.  <- issue #6444 (closed)
  > 46+ bugs open from pre-2023, 1 bug fixed in ~20 months — the "maintenance mode" gap
- [ ] **48.** [locales/task/cited] Fix typo mistakes in the Gujarati locale file (gu.js) and include the fix in the next release.  <- issue #6149 (open)
  > Typo Mistake in gu.js (in Gujarati Language)
- [ ] **49.** [project-status/status/cited] Moment.js is a legacy project, now in maintenance mode.  <- README line 12
  > ⚠️ Moment.js is a legacy project, now in **maintenance mode**. New features
- [ ] **50.** [locales/decision/cited] [locale] gu: drop the stray viramas in October and Wednesday  <- PR #6470 (open)
  > [locale] gu: drop the stray viramas in October and Wednesday
