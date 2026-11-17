# sass/node-sass: LLM proposals to label

Rule (same as Round 2, LABELS.md): **useful** only if a successor would want it in a handover *and* the statement is true to the quote.
Replace `[ ]` with `[✓]` or `[✗ reason]`.

- [ ] **1.** [node-support/decision/corroborated] Node 20 support has been added to the project.  <- commit 87f3899
  > feat: Node 20 support (#3355)
- [ ] **2.** [node-support/decision/cited] Node 18 and Node 19 support have been added and Node 17 support has been dropped.  <- commit 98e75b3
  > feat: Node 18 and 19 support and drop Node 17 (#3257)
- [ ] **3.** [build-binaries/dependency/cited] Node-gyp and nan were bumped to enable Node 19 support.  <- commit e9bb866
  > Bump node-gyp and nan for node 19 support (#3314)
- [ ] **4.** [build-binaries/issue/cited] Binaries were previously partially downloaded, a fix has been applied.  <- commit ab7840b
  > Fix binaries being partially downloaded (#3313)
- [ ] **5.** [general/status/cited] OpenBSD support has been added to the project.  <- PR #2885 (closed)
  > Add  OpenBSD support
- [ ] **6.** [node-support/task/cited] Merge the open PR #3418 to finalize Node 22 support and dependency updates.  <- PR #3418 (open)
  > Closes #3415
- [ ] **7.** [general/decision/cited] MacOS ARM support is being tested using new CI runners for arm64.  <- PR #3390 (open)
  > feat: add MacOS ARM
- [ ] **8.** [general/task/cited] Complete testing and merge PR #3390 to enable MacOS ARM builds.  <- PR #3390 (open)
  > Testing out the new CI runners for arm64
- [ ] **9.** [node-support/risk/cited] Removing Node 16 support may break existing users still on that version.  <- PR #3408 (open)
  > Node 16 support is removed (so the tests passes, same PR is already open for some time
- [ ] **10.** [maintenance-status/issue/cited] There is an ongoing discussion to declare the repository end‑of‑life due to lack of releases and broken installations.  <- issue #3424 (open)
  > Is it time for end-of-life?
- [ ] **11.** [maintenance-status/task/cited] Decide on and announce the end‑of‑life status, archive the repo, and update the npm package label.  <- issue #3424 (open)
  > we should officially mark it as end-of-life, archive the repository, and update the npm package to say "END OF LIFE"
- [ ] **12.** [build-binaries/issue/cited] Node‑sass 9.0.0 works with Node 21 but lacks pre‑built binaries, causing longer CI builds.  <- issue #3405 (open)
  > there are no pre-built binaries for it
- [ ] **13.** [build-binaries/issue/cited] The node-sass binary for darwin-arm64-108 fails to load, causing installation errors on Apple Silicon Macs.  <- issue #3419 (open)
  > Binary has a problem: Error: dlopen(/Users/shekaicong/D/Project/apaas-fontend/node_modules/node-sass/vendor/darwin-arm64-108/binding.node, 0x0001)
- [ ] **14.** [node-support/decision/cited] When using the latest Node versions you must use the latest node-sass because old node-sass versions are not back‑ported.  <- issue #3420 (open)
  > we don't backport support to old versions of node-sass
- [ ] **15.** [general/decision/cited] Node-sass cannot add new Sass language features like @use or @forward because it is only a LibSass wrapper.  <- issue #3421 (closed)
  > Before you request a feature, please realize this project is a wrapper for LibSass so we can't add any language features here
- [ ] **16.** [maintenance-status/risk/cited] Several transitive dependencies of node-sass are deprecated and no longer supported, increasing maintenance risk.  <- issue #3422 (closed)
  > npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it
- [ ] **17.** [node-support/decision/cited] Angular‑devkit requires node‑sass 4.13 when running on Node 13.  <- issue #2799 (closed)
  > If you're running Node 13, you must be running node-sass 4.13
- [ ] **18.** [build-binaries/risk/corroborated] The binary for node‑sass v3.13.1 is missing from the release assets, causing builds for the legacy app to fail.  <- issue #3417 (closed)
  > Cannot download "https://github.com/sass/node-sass/releases/download/v3.13.1/linux-x64-57_binding.node": HTTP error 404 Not Found
- [ ] **19.** [general/issue/cited] Node‑Sass 4.14.1 install script fails on Windows 10 with Node 14.16.0, despite clean reinstall attempts.  <- issue #3073 (closed)
  > Error: node-sass@4.14.1 install: `node scripts/install.js`
- [ ] **20.** [general/issue/cited] Rgb/rgba functions misinterpret CSS variables, causing a compile error that `$color` must be a color.  <- issue #2251 (open)
  > rgb and rgba functions misinterpret CSS variables as a single value instead of their output
- [ ] **21.** [maintenance-status/status/cited] Node Sass is in end‑of‑life and will receive no more releases, even for security fixes.  <- README line 3
  > **Warning:** [Node Sass has reached end of life]. It will receive no more
- [ ] **22.** [maintenance-status/decision/cited] Projects still using Node Sass should migrate to Dart Sass.  <- README line 4
  > Projects that still use it should move onto
- [ ] **23.** [maintenance-status/dependency/cited] Dart Sass is the recommended replacement for Node Sass.  <- README line 5
  > [Dart Sass](https://sass-lang.com/dart-sass).
- [ ] **24.** [maintenance-status/decision/cited] Node versions that hit end of life will be dropped from support at each node‑sass release (major, minor).  <- README line 12
  > Node versions that hit end of life <https://github.com/nodejs/Release>, will be dropped from support at each node-sass release (major, minor).
- [ ] **25.** [build-binaries/decision/cited] We will stop building binaries for unsupported releases, testing for breakages in dependency compatibility, but will not block installations for those that want to support themselves.  <- README line 13
  > We will stop building binaries for unsupported releases, testing for breakages in dependency compatibility, but we will not block installations for those that want to support themselves.
- [ ] **26.** [build-binaries/risk/cited] When using this option, you must also specify outFile to avoid unexpected behavior.  <- README line 273
  > **Special:** When using this, you should also specify `outFile` to avoid unexpected behavior.
