# request/request: LLM proposals to label

Rule (same as Round 2, LABELS.md): **useful** only if a successor would want it in a handover *and* the statement is true to the quote.
Replace `[ ]` with `[✓]` or `[✗ reason]`.

- [ ] **1.** [maintenance-status/status/cited] The project is fully deprecated as noted in the documentation.  <- commit aded7e4
  > doc: note full deprecation (#3267)
- [ ] **2.** [general/decision/cited] The project switched from istanbul to nyc because the istanbul package is not longer maintained.  <- commit 212570b
  > istanbul package is not longer maintained
- [ ] **3.** [http-client/risk/cited] Abort now clears the request timeout to avoid lingering timers.  <- commit df346d8
  > Call `#clearTimeout()` when aborting request.
- [ ] **4.** [http-client/dependency/cited] The project now depends on tough-cookie version 2.5.0.  <- commit 670b563
  > chore: Update to tough-cookie 2.5.0 (#3089)
- [ ] **5.** [http-client/status/cited] The timeout option controls socket inactivity timeout.  <- commit 297e39b
  > Update the documentation of timeout to reflect it controls timeout of socket inactivity
- [ ] **6.** [security/issue/cited] TLS `ca` option can be an array to handle certificates with multiple issuers.  <- commit e476ce5
  > Added a paragraph of text to the TLS section, on the use of the `ca` option, explicitly detailing how to get SSL certificates that consist of more than one issuer to successfully verify.
- [ ] **7.** [maintenance-status/status/cited] Support for Node.js v4 has been dropped.  <- commit 418623c
  > Drop support for Node.js v4 (Fix #2917)
- [ ] **8.** [maintenance-status/decision/cited] The stale bot will close issues older than a year and the closure window will be tightened to 60 or 90 days after manual review.  <- commit 7c42a7f
  > After a manual review of more recent issues, we should tighten this down to 60 or 90 days.
- [ ] **9.** [general/status/corroborated] Code supporting Node.js 0.9.4 and below has been removed because that runtime is no longer supported.  <- commit 76a6e5b
  > Remove redundant code (for Node.js 0.9.4 and below) and dependency
- [ ] **10.** [security/decision/cited] The security policy and vulnerability reporting process was revised to clarify reporting and remove outdated version support.  <- PR #3757 (closed)
  > Revise security policy and vulnerability reporting Clarify reporting process for vulnerabilities and remove outdated version support.
- [ ] **11.** [http-client/decision/corroborated] Support for SOCKS proxy was added to the HTTP client.  <- PR #3749 (closed)
  > feat: add support for SOCKS proxy
- [ ] **12.** [security/decision/cited] SASVA suggested fixes for CVE-2023-28155 were applied.  <- PR #3508 (closed)
  > Added SASVA suggested fixes for CVE-2023-28155
- [ ] **13.** [security/decision/cited] A SECURITY.md file was added to document security considerations for the project.  <- PR #3506 (closed)
  > Create SECURITY.md
- [ ] **14.** [security/decision/cited] PR #3461 updates package.json to fix a security issue.  <- PR #3461 (open)
  > fixing security issue
- [ ] **15.** [general/status/cited] The project has been upgraded to run on Node 20.  <- PR #3498 (closed)
  > Node 20 upgrade
- [ ] **16.** [general/issue/cited] Log buffers can exceed their limit, potentially causing memory pressure.  <- PR #3474 (closed)
  > log buffers over limit
- [ ] **17.** [general/issue/cited] Protocol version auto handling can produce an unhandled error.  <- PR #3494 (closed)
  > Protocol version auto unhandled error
- [ ] **18.** [http-client/decision/cited] Added try-catch to prevent ERR_HTTP2_SOCKET_UNBOUND from bubbling up.  <- PR #3492 (closed)
  > Added try-catch to prevent ERR_HTTP2_SOCKET_UNBOUND from bubbling up.
- [ ] **19.** [maintenance-status/decision/cited] Dropin-request is a drop-in replacement for request, intended for migrating existing projects; for new projects use the native fetch API.  <- issue #3752 (open)
  > This library is primarily intended for migrating existing projects.  For new projects, I strongly recommend using the modern, native fetch API, which is now standard in Node.js (v18+).
- [ ] **20.** [maintenance-status/status/cited] The request library is in maintenance mode and deprecated; alternatives should be considered.  <- issue #3143 (open)
  > Since the announcement of request going into "maintenance mode" (full details in #3142)
- [ ] **21.** [security/issue/cited] A security researcher reported CVE-2023-28155 in Request library and is awaiting a communication channel.  <- issue #3442 (open)
  > Please provide a communication channel that would allow us to share the technical details and the proposed fix, otherwise we will be forced to disclose the vulnerability publicly.
- [ ] **22.** [http-client/issue/cited] Requests to self‑signed certificates fail with DEPTH_ZERO_SELF_SIGNED_CERT because strictSSL defaults to true.  <- issue #418 (closed)
  > Error: DEPTH_ZERO_SELF_SIGNED_CERT
- [ ] **23.** [security/issue/cited] Form-data versions <2.5.4, >=3.0.0 <3.0.4, >=4.0.0 <4.0.4 are vulnerable to CVE‑2025‑7783.  <- issue #3751 (open)
  > Affected versions < 2.5.4 >= 3.0.0, < 3.0.4 >= 4.0.0, < 4.0.4
- [ ] **24.** [http-client/risk/cited] Requests that convert very long strings can trigger an unhandled Buffer overflow error.  <- issue #3748 (open)
  > Error: Cannot create a string longer than 0x1fffffe8 characters
- [ ] **25.** [general/contact/cited] The maintainer of request-promise and request-promise-native should be granted issue‑deletion rights to remove spam comments.  <- issue #3620 (open)
  > Could could give me the right to delete issues so that I can delete the spam?
- [ ] **26.** [maintenance-status/decision/cited] The request library should go into maintenance mode and stop accepting new features or major releases.  <- issue #3142 (open)
  > **The most valuable thing `request` can do for the JavaScript ecosystem is to go into maintenance mode and stop considering new features or major releases.**
- [ ] **27.** [maintenance-status/status/cited] The request project is now in maintenance mode and no longer actively developed.  <- issue #3142 (open)
  > The most valuable thing `request` can do for the JavaScript ecosystem is to go into maintenance mode
- [ ] **28.** [http-client/issue/cited] Posting an array via rp.post with formData causes a TypeError: source.on is not a function.  <- issue #2366 (open)
  > TypeError: source.on is not a function
- [ ] **29.** [security/issue/cited] Using request‑promise can raise an SSL EPROTO error due to wrong TLS version, indicating a potential security/compatibility problem.  <- issue #3505 (open)
  > Error: write EPROTO 22360:error:1408F10B:SSL routines:ssl3_get_record:wrong version
- [ ] **30.** [http-client/issue/cited] Using the bearer token option in the auth field incorrectly requires a user and password, causing an "invalid user or password" error.  <- issue #923 (closed)
  > fails because `Error: auth() received invalid user or password`. If I have a token I want to specify instead of user and password, why do I also need to provide a user / password?
- [ ] **31.** [http-client/risk/cited] If an error occurs in the request callback, the process may terminate because the error is not properly handled.  <- issue #2161 (closed)
  > After this my process terminates.
- [ ] **32.** [http-client/risk/cited] Requests to the target server consistently result in a "socket hang up" error, indicating a fragile connection or server-side issue.  <- issue #2047 (open)
  > always throw "socket hang up".
- [ ] **33.** [maintenance-status/issue/cited] The deprecation discussion and rationale are tracked in issue #3142.  <- README line 6
  > [this issue](https://github.com/request/request/issues/3142).
- [ ] **34.** [security/risk/cited] Using pipe() from http.ServerRequest to http.ServerResponse can expose security risks if not properly validated.  <- README line 114
  > Which means that, if you don't really care about security, you can do:
- [ ] **35.** [http-client/decision/cited] One‑line proxying is supported because pipe() returns the destination stream in Node ≥ 0.5.x.  <- README line 126
  > And since `pipe()` returns the destination stream in ≥ Node 0.5.x you can do one line proxying. :)
- [ ] **36.** [http-client/decision/cited] A default proxy can be set globally with request.defaults({'proxy':'http://localproxy.com'}).  <- README line 135
  > const r = request.defaults({'proxy':'http://localproxy.com'})
- [ ] **37.** [general/dependency/cited] The project can use the external package request‑promise (Bluebird) for Promise‑based requests.  <- README line 157
  > - [`request-promise`](https://github.com/request/request-promise) (uses [Bluebird](https://github.com/petkaantonov/bluebird) Promises)
- [ ] **38.** [http-client/decision/cited] Enable a boundary preambleCRLF or postamble by setting them to true in request options to work around .NET WebAPI 4.0 multipart/related newline requirements.  <- README line 240
  > You can turn on a boundary preambleCRLF or postamble by passing them as `true` to your request options.
