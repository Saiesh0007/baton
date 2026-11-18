# request/request-promise: LLM proposals to label

Rule (same as Round 2, LABELS.md): **useful** only if a successor would want it in a handover *and* the statement is true to the quote.
Replace `[ ]` with `[✓]` or `[✗ reason]`.

**Labels drafted by our AI coding assistant with the Round 2 rule, then spot-checked by Saiesh Sutar.** Close calls were labelled strictly: an open PR described as done, or a statement that adds something the quote does not say, counts as not useful.

- [✓] **1.** [security/risk/cited] Request-promise-core was bumped due to a security vulnerability of lodash.  <- commit 4c7d51d
  > chore: bumped request-promise-core due to security vulnerability of lodash
- [✓] **2.** [maintenance-status/status/cited] This package will be deprecated as well as request.  <- commit 052331d
  > This package will be deprecated as well as request. Thank you very much for your great works. 'request-promise-native' has already been deprecated.(https://github.com/request/request-promise-native/issues/57)
- [✗ statement not in the quote (the commit does not say to contact anyone)] **3.** [maintenance-status/contact/cited] Shisama is the author of the deprecation notice and should be contacted for migration guidance.  <- commit 052331d
  > docs: deprecate this package
- [✓] **4.** [security/dependency/cited] Request-promise-core was updated, which also updates lodash.  <- commit a27ba86
  > chore: updated request-promise-core that updates lodash
- [✗ adds a reason ("vulnerability") the quote does not give] **5.** [security/dependency/cited] Tough-cookie version was fixed to address a vulnerability.  <- commit 94be6fe
  > fix: tough-cookie version
- [✓] **6.** [maintenance-status/decision/cited] Tough-cookie is limited to version 2.5 because version 3.x removes node 0.10 support.  <- commit c535eb6
  > Limit the tough-cookie to 2.5 as 3.x removes node 0.10 support
- [✓] **7.** [security/decision/corroborated] Tough-cookie was upgraded to a version without a regex DoS vulnerability.  <- commit 894672d
  > Upgrade tough-cookie to a version without regex DoS vulnerability
- [✓] **8.** [general/issue/cited] Only one tough-cookie installation is ensured to avoid duplicate copies.  <- commit 558729b
  > fix: make sure to have only one tough-cookie installation
- [✓] **9.** [general/issue/cited] The recent security fix broke backwards‑compatibility with older request versions.  <- commit 9ad707c
  > fix: although this break backwards-compatibility with old request versions bumped up because of security vulnerability
- [✓] **10.** [general/dependency/cited] The code now depends on tough-cookie for npm versions older than v3.  <- commit cc30568
  > fix: depending on tough-cookie for npm < v3
- [✓] **11.** [general/status/cited] Request now uses tough-cookie for cookie handling.  <- commit fdc522a
  > fix: using tough-cookie for the request
- [✓] **12.** [security/task/cited] A pending pull request (#370) addresses a vulnerability in the tough-cookie dependency.  <- PR #370 (open)
  > [vulnerability fix] dep - tough cookie
- [✗ closed PR, not shown as merged; statement says it happened] **13.** [general/decision/cited] The release process was updated to use Node v14 instead of v11.  <- PR #367 (closed)
  > ups node from v 11 to v14 in release step
- [✗ unrelated user issue (another project)] **14.** [general/issue/cited] Mixing NewtonsoftJson with System.Text.Json overwrites the JsonSerializerOptions and prevents notifications from being displayed.  <- issue #769 (closed)
  > Sobre escribe la configuracion de System.Text.Json: "options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());" Y eso hace que los anuncios no se muestren.
- [✗ same unrelated issue] **15.** [general/task/cited] A fix must be deployed to both test and production environments to restore notification functionality.  <- issue #769 (closed)
  > Se necesita subir un fix tanto en pruebas y produccion
- [✓] **16.** [security/issue/cited] The project depends on request‑promise version 4.2.6 which includes tough‑cookie 2.5.0 vulnerable to CVE‑2023‑26136.  <- issue #369 (closed)
  > Dependency: tough-cookie Version: 2.5.0 It is raised under this CVE ID:  CVE-2023-26136
- [✗ user bug report, unconfirmed] **17.** [general/issue/cited] Intermittent "Client network socket disconnected before secure TLS connection was established" errors occur when making HTTPS requests with request‑promise.  <- issue #357 (open)
  > error: **Client network socket disconnected before secure TLS connection was established**
- [✗ user install report] **18.** [general/dependency/cited] The "request" library is not installed automatically anymore and must be installed manually for request-promise to work.  <- issue #366 (open)
  > The "request" library is not installed automatically anymore.
- [✗ user bug report, unconfirmed] **19.** [general/risk/cited] Using HTTP proxies can cause unhandled ECONNRESET exceptions that crash the process unless caught globally.  <- issue #313 (open)
  > unhandled exception ECONNRESET, when using proxy
- [✗ user complaint] **20.** [general/issue/cited] Request-promise logs “Discarding entity body for GET requests” when a GET request includes a body, which is unnecessary and noisy.  <- issue #210 (open)
  > When making api Get request with request-promise. This message outputs to the console: **Discarding entity body for GET requests**
- [✗ user support answer] **21.** [general/task/cited] Add "request" to the project's package.json dependencies and run npm install to resolve the missing module error.  <- issue #291 (closed)
  > npm install request --save
- [✗ user question] **22.** [general/issue/cited] Proxy configuration options that work with the request module do not work with request-promise, causing failed requests.  <- issue #130 (open)
  > I am trying something like this now, which seem to be failed..
- [✗ user feature request] **23.** [security/task/cited] Provide a mechanism (e.g., setting strictSSL:false or using a custom agent) to ignore proxy signed certificates for request-promise calls.  <- issue #365 (open)
  > ignore proxy signed certificate(ssl) issue in request-promise
- [✗ user bug report, unconfirmed] **24.** [promises/risk/cited] Bluebird version 3.7.0 breaks installation of request-promise@4.2.4 because it cannot resolve 'async_hooks'.  <- issue #330 (open)
  > Module not found: Error: Can't resolve 'async_hooks' in '\node_modules\bluebird\js\release'
- [✓] **25.** [maintenance-status/status/cited] The request library is fully deprecated as of Feb 11th 2020 and will receive no further changes.  <- issue #340 (closed)
  > As of Feb 11th 2020, request is fully deprecated. No new changes are expected to land.
- [✓] **26.** [maintenance-status/dependency/cited] The deprecation of request-promise is tied to the deprecation of the underlying request library and a list of alternative libraries is provided.  <- README line 17
  > Fyi, here is the [reasoning of `request`'s deprecation](https://github.com/request/request/issues/3142) and a [list of alternative libraries](https://github.com/request/request/issues/3143).
- [✓] **27.** [general/decision/cited] Users are encouraged to migrate to newer libraries that are very similar to request-promise v4.  <- README line 25
  > Also check out the new libraries that are **very similar to `request-promise` v4**:
- [✓] **28.** [general/task/cited] Ensure that the request package is installed as a direct dependency because it became a peer dependency of request-promise.  <- README line 33
  > 1. `request` became a peer dependency. Thus make sure that `request` is installed into your project as a direct dependency. (`npm install --save request`)
- [✓] **29.** [general/decision/cited] The new option transform2xxOnly=true replaces the manual status code check in transform functions.  <- README line 35
  > you may now set the option `transform2xxOnly = true` instead.
- [✓] **30.** [general/decision/cited] The handling of the transform function was overhauled, affecting how responses are processed.  <- README line 39
  > The handling of the `transform` function got overhauled.
- [✓] **31.** [general/status/cited] StatusCodeError now contains the transformed response and is thrown for non‑2xx responses when options.simple is true.  <- README line 40
  > `StatusCodeError.response` is the transformed instead of the original response now. This error is thrown for non-2xx responses when `options.simple` is `true` (default).
- [✓] **32.** [general/task/cited] Update existing transform functions to handle transformation of non‑2xx responses or enable transform2xxOnly.  <- README line 40
  > Please update your `transform` functions to also cover the transformation of non-2xx responses.
- [✓] **33.** [general/decision/cited] Transform errors are now wrapped in a TransformError object with a cause attribute.  <- README line 41
  > If a transform operation throws an error, the request will be rejected with a `TransformError`. Its `cause` attribute contains the error thrown by the transform operation.
- [✓] **34.** [promises/risk/cited] Bluebird was upgraded from v2 to v3, which may break advanced Promise chains that start with Request‑Promise.  <- README line 43
  > Bluebird got updated from v2 to v3. This won't make a difference for most use cases. However, if you use advanced Promise chains starting with the Promise returned by Request-Promise, please check
- [✗ duplicate of 28] **35.** [general/dependency/cited] `request` is a peer‑dependency of request‑promise and must be installed separately.  <- README line 56
  > `request` is defined as a peer-dependency and thus has to be installed separately.
- [✗ README usage text; statement goes beyond the quote] **36.** [general/dependency/cited] Request‑promise wraps around request, so any changes or issues in request affect request‑promise.  <- README line 64
  > Since `request-promise` wraps around `request` everything that works with `request` also works with `request-promise`.
- [✓] **37.** [general/risk/cited] Streaming the response with Request-Promise is discouraged because it can cause high memory usage for large requests; use the original Request library for streaming.  <- README line 284
  > - However, **STREAMING THE RESPONSE** (e.g. `.pipe(...)`) is **DISCOURAGED** because Request-Promise would grow the memory footprint for large requests unnecessarily high. Use the original Request library for that. You can use both libraries in the same project.
