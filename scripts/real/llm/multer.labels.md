# expressjs/multer: LLM proposals to label

Rule (same as Round 2, LABELS.md): **useful** only if a successor would want it in a handover *and* the statement is true to the quote.
Replace `[ ]` with `[✓]` or `[✗ reason]`.

**Labels made by our AI coding assistant with the Round 2 rule (not re-checked by hand).** Close calls were labelled strictly: an open PR described as done, or a statement that adds something the quote does not say, counts as not useful.

- [✓] **1.** [uploads-storage/decision/cited] Swallow late busboy errors after teardown to prevent crashes  <- commit 80a2d9d
  > fix: swallow late busboy error after teardown
- [✓] **2.** [uploads-storage/decision/conflicting] Do not add a failed upload to the abort cleanup list when storage engine reports an error  <- commit 6dac92f
  > fix: don't add a failed upload to the abort cleanup list (#1489)
- [✓] **3.** [uploads-storage/decision/corroborated] Allow DiskStorage to be used without providing options  <- commit 8d5c3b7
  > feat: allow diskStorage without options (#1471)
- [✓] **4.** [uploads-storage/decision/conflicting] Remove late‑completing uploads aborted before the engine assigns a path  <- commit 53337f9
  > fix: remove late-completing uploads aborted before the engine names them
- [✓] **5.** [uploads-storage/decision/cited] Add a streamHandler option to feed busboy from pre‑consumed request bodies  <- commit 7f2c9ab
  > feat: add streamHandler option to feed busboy from pre-consumed bodies (#1466)
- [✓] **6.** [uploads-storage/decision/cited] Expose busboy defCharset, highWaterMark and fileHwm options  <- commit c0af6fa
  > feat: expose busboy defCharset, highWaterMark and fileHwm options (#1465)
- [✓] **7.** [uploads-storage/decision/cited] Accept a function for limits so they can be computed per request  <- commit ea9c680
  > feat: accept a function for limits (#1133)
- [✓] **8.** [uploads-storage/decision/corroborated] Validate all limits at construction time and throw TypeError for invalid values  <- commit 9354e5d
  > fix: validate all limits at construction time (#1335)
- [✓] **9.** [uploads-storage/decision/cited] Do not consume maxCount for files skipped by fileFilter  <- commit 81cbee8
  > fix: do not consume maxCount for files skipped by fileFilter (#1426)
- [✓] **10.** [uploads-storage/decision/corroborated] Allow exactly limits.parts parts by adjusting busboy parts limit handling  <- commit 6b43484
  > fix: allow exactly limits.parts parts (#1446)
- [✓] **11.** [uploads-storage/decision/cited] Remove the concat-stream dependency and let MemoryStorage collect and Buffer.concat chunks itself.  <- commit 6313b1d
  > Drops concat-stream and its transitive dependencies (readable-stream, buffer-from, typedarray, inherits) from the production install.
- [✓] **12.** [security/decision/cited] Reject invalid field names instead of crashing on append-field errors.  <- commit 87a584e
  > fix: reject invalid field names instead of crashing on append-field errors
- [✓] **13.** [uploads-storage/decision/cited] Enforce file size limit when using an async fileFilter.  <- commit ab6aeae
  > fix: enforce file size limit with async fileFilter
- [✓] **14.** [uploads-storage/issue/corroborated] Previously aborted uploads could leak file descriptors; the fix destroys the disk write stream on abort.  <- commit eef7444
  > fix: destroy disk write stream on aborted uploads to prevent fd leak
- [✓] **15.** [uploads-storage/decision/cited] Decode WHATWG-escaped characters in the file originalname.  <- commit 5d39be7
  > fix: decode WHATWG-escaped characters in file originalname
- [✓] **16.** [uploads-storage/issue/cited] Multiple callbacks from fileFilter could crash the process; the fix guards against it.  <- commit f8e759f
  > fix: prevent process crash when fileFilter calls its callback more than once
- [✓] **17.** [uploads-storage/decision/cited] Fallback to an error code when no message mapping exists for an error.  <- commit bbc114d
  > fix: fallback to error code when no message mapping exists
- [✗ the commit is done, not a task; "Windows and Linux" is not in the quote] **18.** [general/task/cited] Enhance cross‑platform test reliability and update the CI workflow to run on Windows and Linux.  <- commit f87e850
  > Test: Enhance cross-platform test reliability and update CI workflow
- [✓] **19.** [uploads-storage/decision/conflicting] Set isDone flag in the Busboy constructor catch block to prevent calling next() twice when the request closes after a busboy failure  <- PR #1493 (open)
  > The fix sets `isDone` in the catch block. `done()` and `handleRequestFailure` already check that flag, so the listeners stay in place but no longer call `next` again.
- [✗ duplicate of 19 (same PR)] **20.** [uploads-storage/risk/cited] If isDone is not set, the middleware could call next() a second time, leading to duplicate error handling  <- PR #1493 (open)
  > If the client then disconnects, or the app destroys the request to stop reading it, `handleRequestFailure` runs and `next` is called a second time
- [✓] **21.** [uploads-storage/decision/cited] Add new limits totalFieldSize and totalFileSize to control aggregate payload sizes  <- PR #1496 (open)
  > This PR adds two new limits: `totalFieldSize` and `totalFileSize`
- [✗ open PR described as already done] **22.** [uploads-storage/status/conflicting] Multer now cleans up stored files after flush failures to prevent orphaned files on disk.  <- PR #1505 (open)
  > Clean up stored files after flush failures.
- [✗ statement not in the quote (the quote is about Node 24)] **23.** [uploads-storage/risk/cited] On Node 22 and earlier, a thrown error in `fileFilter` or a storage `filename` function crashes the server because the exception is uncaught.  <- PR #1503 (open)
  > Node 24 changed `Readable.prototype.pipe()` to catch a throw from `dest.write()` and destroy the destination with it
- [✓] **24.** [security/status/cited] CVE‑2026‑113872 has been fixed in the 2.5.0 release.  <- PR #1490 (merged)
  > Fix [CVE-2026-113872]
- [✗ open PR described as already done] **25.** [general/decision/cited] A daily GitHub Actions workflow now automatically labels and closes stale issues and PRs after 30 days of inactivity.  <- PR #1470 (open)
  > issues and pull requests with no activity for 30 days get the `stale` label
- [✗ open PR described as already done] **26.** [uploads-storage/decision/cited] If `opts.destination` is a string, Multer now wraps it in a function adapter to avoid a TypeError in custom storage engines.  <- PR #1394 (open)
  > when `opts.destination` is a string, wrap it in a `function ($0, $1, cb) { cb(null, opts.destination) }` adapter
- [✗ open PR described as already done] **27.** [uploads-storage/decision/cited] The default charset for parsing multipart headers has changed from `latin1` to `utf-8`; users needing the old behavior must set `defParamCharset: 'latin1'`.  <- PR #1368 (open)
  > BREAKING CHANGE: The default character set for parsing multipart form-data headers (e.g., filenames) is now 'utf-8' instead of 'latin1'.
- [✗ describes the bug that this merged PR fixed, in the present tense] **28.** [uploads-storage/issue/corroborated] Multer rejects a field value exactly at limits.fieldSize with LIMIT_FIELD_VALUE, unlike other limits which are inclusive.  <- PR #1481 (merged)
  > A text field whose value is exactly `limits.fieldSize` bytes is rejected with `LIMIT_FIELD_VALUE`. Every other limit in multer is inclusive: `fileSize`, `parts`, `files`, `fields` and `fieldNameSize` all accept a request sitting exactly on the limit.
- [✓] **29.** [uploads-storage/decision/cited] The limit handling was changed to treat fieldSize as inclusive, matching other limits.  <- PR #1481 (merged)
  > Set `limits: { fieldSize: 5 }`, send the 5 byte value `hello`, and you get `err.code === 'LIMIT_FIELD_VALUE'` with `err.field === 'field0'`, while `hell` goes through.
- [✓] **30.** [uploads-storage/decision/cited] Escaped field names are now decoded using decodeFormDataName, fixing rejection of inputs with escaped characters.  <- PR #1473 (merged)
  > `decodeFormDataName` reverses the WHATWG escaping of `%0A`, `%0D` and `%22`, and its own comment says the rule covers "field names and filenames".
- [✓] **31.** [security/status/cited] Version 2.4.0 includes a fix for CVE‑2026‑88932.  <- PR #1469 (merged)
  > Fix [CVE-2026-88932](https://www.cve.org/CVERecord?id=CVE-2026-88932) ([GHSA-3pph-fpjx-jg34](https://github.com/expressjs/multer/security/advisories/GHSA-3pph-fpjx-jg34))
- [✗ release bookkeeping] **32.** [general/dependency/cited] Release 2.4.0 depends on PRs #1479 and #1480 being merged.  <- PR #1469 (merged)
  > **:warning: These HAVE TO be included :warning:** - [x] https://github.com/expressjs/multer/pull/1479 - [x] https://github.com/expressjs/multer/pull/1480
- [✗ user feature request] **33.** [uploads-storage/task/cited] Implement a bodySize limit option to cap total request payload size for memory storage.  <- issue #1363 (open)
  > I wish there was an option just like what bodyParser provides which allows you to limit the total body size rather than per field.
- [✗ user comment] **34.** [general/contact/cited] The issue author (SMJSProductions) is open to collaboration on the bodySize limit feature.  <- issue #1363 (open)
  > I personally don't really have a lot of time to learn the inner workings of this framework to make this feature myself so I'm asking this from others incase anyone is interested in making this idea.
- [✗ user bug report, unconfirmed] **35.** [uploads-storage/risk/corroborated] Multer removes already uploaded files when an exception occurs, causing potential data loss.  <- issue #1279 (open)
  > Multer removes uploaded files when an exception occurs
- [✗ user opinion] **36.** [uploads-storage/task/cited] Investigate and fix the bug where Multer uploads all files even after a LIMIT_FILE_SIZE exception.  <- issue #1279 (open)
  > IMHO, this bug should be fixed asap, to avoid unexpected behavior in the future.
- [✗ user bug report, unconfirmed] **37.** [uploads-storage/issue/cited] Folders created by Multer with a custom destination cannot be deleted on Windows systems.  <- issue #1271 (open)
  > Folder cannot be deleted
- [✓] **38.** [uploads-storage/issue/cited] When a fileFilter error occurs, the next request must be manually closed to retry.  <- issue #1193 (open)
  > FileFilter when handling error needs to manually close next request to try again
- [✗ user bug report, unconfirmed] **39.** [general/risk/cited] Using Multer ≥ 1.4.4‑lts.1 causes Node AsyncLocalStorage to be destroyed or lost, potentially breaking request‑scoped context.  <- issue #1111 (open)
  > Node AsyncLocalStorage destroyed/lost when multer 1.4.4-lts.1 or later is used
- [✗ speculation] **40.** [general/dependency/cited] The issue may stem from the bundled busboy version, which has breaking changes across releases.  <- issue #1111 (open)
  > It's possible this is an issue with busboy, rather than multer
- [✗ user bug report, unconfirmed] **41.** [uploads-storage/issue/corroborated] When maxCount is exceeded Multer returns "LIMIT_UNEXPECTED_FILE" instead of the correct "LIMIT_FILE_COUNT" error message.  <- issue #1057 (open)
  > Incorrect error message for maxCount exceeded.
- [✗ user suggestion] **42.** [uploads-storage/task/cited] Update the error handling code to emit MulterError('LIMIT_FILE_COUNT') for maxCount violations.  <- issue #1057 (open)
  > Suggested edit:
- [✓] **43.** [uploads-storage/issue/cited] After a filter‑function failure, the second request hangs, indicating incomplete cleanup of the previous request.  <- issue #1205 (open)
  > Second request hangs after upload fail into filter function
- [✗ user comment] **44.** [uploads-storage/dependency/cited] Multer LTS bundles a very old version of busboy; consider bumping the busboy dependency.  <- issue #1280 (open)
  > lts uses some really prehistoric version of busboy
- [✗ user bug report, unconfirmed] **45.** [uploads-storage/issue/cited] When abortWithError is called inside fileFilter, Busboy may emit a finish event after an unexpected end of multipart data, causing unhandled errors.  <- issue #1121 (open)
  > busboy finish event called after abortWithError
- [✗ README usage text] **46.** [uploads-storage/status/cited] A minimal Multer configuration can be set with only the `dest` option as shown  <- README line 31
  > const upload = multer({ dest: 'uploads/' })
- [✗ README example] **47.** [uploads-storage/status/cited] The upload middleware is configured to store files on disk in ./public/data/uploads/  <- README line 86
  > const upload = multer({ dest: './public/data/uploads/' })
- [✗ README example, typed as an owner claim] **48.** [uploads-storage/owner/cited] The POST /stats endpoint handles single file uploads using the configured upload middleware  <- README line 87
  > app.post('/stats', upload.single('uploaded_file'), function (req, res) {
- [✗ README API text] **49.** [uploads-storage/status/cited] When using MemoryStorage Multer keeps the file data in a Buffer  <- README line 115
  > `buffer` | A `Buffer` of the entire file | `MemoryStorage`
- [✗ README API text] **50.** [uploads-storage/dependency/cited] Multer’s `dest` or `storage` option determines where uploaded files are stored  <- README line 132
  > `dest` or `storage` | Where to store the files
- [✗ README API text] **51.** [uploads-storage/dependency/cited] Multer’s `fileFilter` function can be used to accept or reject files  <- README line 133
  > `fileFilter` | Function to control which files are accepted
- [✗ adds a risk the quote does not state] **52.** [uploads-storage/risk/cited] Enabling `preservePath` can expose client‑supplied path segments and may lead to path‑traversal risks  <- README line 137
  > `preservePath` | Keep the full client-supplied path in `file.originalname` instead of just the base name
- [✗ README API text] **53.** [uploads-storage/dependency/cited] Multer uses a `streamHandler` that defaults to piping the request body to busboy  <- README line 138
  > `streamHandler` | Function that feeds the request body to busboy; defaults to `req.pipe(busboy)`
- [✓] **54.** [uploads-storage/risk/cited] `file.originalname` is always client‑supplied and must be treated as untrusted input  <- README line 151
  > `file.originalname` is always client-supplied and should be treated
- [✗ README option text; the reason is not in the quote] **55.** [uploads-storage/decision/cited] The `flush` option is optional and disabled by default because forcing a disk flush on every upload has a performance cost.  <- README line 258
  > `flush` is an optional boolean. When set to `true`, the file data is flushed to
- [✓] **56.** [uploads-storage/risk/cited] Uploading very large files or many small files with memory storage can cause the application to run out of memory.  <- README line 279
  > **WARNING**: Uploading very large files, or relatively small files in large
