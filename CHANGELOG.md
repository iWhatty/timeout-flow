# CHANGELOG — `timeout-flow`

> Initial cut seeded from `git log` by the host repo's `tools/seed-changelogs.mjs` script. Version groupings infer release boundaries from tags and commit subjects; rough cuts are expected — review and tighten as part of normal maintenance.

## 0.0.20 — 2026-10-08

- feat: `sleep(duration, { signal })` promise delay (also `timeout-flow/sleep`); NaN/negative wait 0 ms like `setTimeout`
- feat(retry): `'fixed' | 'linear' | 'exponential'` backoff, numeric ±j jitter, `delayFirst`, overall `timeout`, `isSuccess`, `onAttempt`, injectable `sleep`/`now`, `attempts: Infinity`, `RetryError`
- feat(waitFor): async conditions without overlap, exact timeout, resolves with the condition's value; timeout error named `TimeoutError`
- fix: negative `after()`/`every()` delays now fire like `setTimeout`; `abort(reason)` rejects with that reason
- test: `node:test` suite with mocked timers (`npm test`)

- docs(README): apply @whatty README template + rename ReadME.md → README.md  `080ee78`
- chore(license): finalize AGPL-3.0 + WATT3D Additional Terms metadata  `c819763`
- docs(pkg): scrub em dash from npm description  `63f35f2`
- chore(pkg): update GitHub repo URL after rename  `8af0f0a`

## 0.0.19 — 2026-05-19

- Using a json bypass to ensure the object names are in quotes  `7dc2dd4`
- /** @const {!Object<string, number>} */ const timeMultipliers = Object.freeze(JSON.parse(`{   "ms": 1,   "s": 1000,   "m": 60000,   "h": 3600000 }`));  `a304a50`
- refactor: unify structure, enable TS type generation, and flatten exports  `8592435`
- sent v13 to NPM with TS types auto-gen  `002c65b`
- Post v14 NPM publish  `7f49662`
- bump to v15 for NPM  `f61d185`
- Removed previous manually generated .d.ts file  `b31f003`
- Updated debounce docstring to annotate the input as string|number|Function  `1870b2b`
- bump to v0.16 - npm publish  `187f224`
- fixed type def for throttle return to have the .cancel() return func.  `b7bac27`
- feat(core,raf): harden timing engine with perf.now, abort support, and lifecycle improvements  `4fa7f22`
- feat!: unify timer + RAF lifecycle, centralize AbortSignal handling, and enhance retry/jitter with pause-safe timing  `a2df6ed`
- feat(core): standardize AbortSignal handling and improve Node/browser compatibility  `696f883`
- fix(throttle): resolve TDZ error caused by shadowed now() reference  `b6d89ef`
- feat: stabilize flow DSL, unify every() API, add deterministic test harnesses and refine README  `a477877`
- chore: normalize README shields row  `f9426f2`
- chore: rebrand author to WATT3D, interim license  `4e21388`
- feat: relicense to AGPL-3.0 + WATT3D AI Training Rider  `4cef1ad`
- chore: deploy WATT3D AI-bot robots.txt policy  `ec4cf84`
- chore: revise AI Training Rider (v2 — pre-counsel drafting fixes)  `3637140`
- chore: rider v3 — remove gameable 0.1% safe harbor  `8c4b141`
- chore: rider v4 — Commercial Use restricted to Fully Open Source  `06158a3`

## 0.0.11 — 2025-05-28

_(no commits in this range)_

## 0.0.10 — 2025-05-21

_(no commits in this range)_

## 0.0.9 — 2025-05-21

- bumped readme to WATT v3.0  `9d1e990`
- Removed extra every.js code in the TimerBase, which we migrated to a new file after the class refactor.  `1064a08`

## 0.0.7 — 2025-05-14

- Bump to version 0.0.5 on npm.  `879a564`
- Updated debounce and throttle to be more felxible with input variables. If delay or func is passed first, it will parse it correctly.  `c06083f`
- Bumped to version 0.0.6 in NPM and published.  `5bae3bf`
- License bump to v3.0  `56a081c`
- added robots.txt  `1bd9c34`

## 0.0.4 — 2025-05-09

- Initial commit  `6561570`
- initial commit, basic code template  `c3d030f`
- parseDuration, and after, functions added to TimeoutFlow.js  `a48c187`
- Added every, syntactic sugar to creating timeouts  `c4a46a0`
- Initial Timeout Sequnce, for chaining events in a loop  `c8faa01`
- Updated chrono() with Pause / Resume  `6def4c5`
- Updated chrono() (with .loop())  `334d842`
- .loop() with a loop count limiter, like .loop(3) — so the entire timeline repeats up to a specified number of times.  `d1cf136`
- Added Index.js to handle the export interface , added some white space to improve readability.  `347cfde`
- Re-structured the project to be more modular.  `2bf9f07`
- Refactored to improve code qaulity  `e1d10c8`
- onFinishCallback callback added to Chronos Sequence.  `1f1137d`
- every updated not to pass in the iteratino count, end-user will handle this themselves, with i++, or etc  `096e55d`
- Added more gaurds on inputs in parseDuration  `9acda35`
- Added helper functions for debounce, throlle, retry loops and waitfor execution  `29dcf7e`
- jumpTo targets added formroe complex sequences  `bda9b26`
- Added if/unless flags and while/doWhile control flow blocks to the flow seqeunce  `a140786`
- Updated TimeoutFlow with the new label, jumps, if/unless and while/doWhile logic handling  `4bc9b44`
- Added readme, examples and polished up after.js  `213e18b`
- Moved main code into SRC folder, removed old notes/txt files, since the ReadME is now set-up with that info  `f7b18d0`
- Added build.js, package.json, .gitignore, and testing.HTML to run some checks over the API surface.  `b164448`
- Updated sequence control from chronos to flow. Started running through the testing.HTML  `2a3be7f`
- Running Test.html to observe behaviour. Imrpoved how After/EVery logic is handled with the Flow controller loop  `ccb8b59`
- Cleaned up Every.js to have a similar interface to after.js  `9b69a12`
- Added Philosophy to ReadMe  `701d52e`
- Cleaned up comments in after.js. Added another if condition to the resume check in every.js to match after.js  `b98ba09`
- Cleaned up after.js return block to better match the style in every.js  `2673d5f`
- Cleaned up docstrings for Every/after.js Removed the parseDuration import from TimeoutFlow, since we no longer use it.  `c9ab1ef`
- Added ESBuild to package json and tested the build script  `903323e`
- Cleaned emoojis from the readme  `137e599`
- Working on requestAnimationFrame versions of timeout  `392dafc`
- Use match() Instead of exec()? No lastIndex bug risk: .exec() with global regex (/g) can behave unexpectedly in loops or reused regexes.  `6bf4057`
- Added more Raf versions for timers and updated license.  `0a1e374`
- Added waitForRaf, and updated the Readme  `37fd091`
- added index.js to raf folder  `0b0a77e`
- Starting refactor to class pattern, created.. TimerBase.js  `7acbcbf`
- Using TimerBase to build the new AfterTimer and Everytimer. We still support the previous syntax  `21ec562`
- Updated ReadMe to reflect the new classes  `3c3753b`
- depracted the old _every and_after functions to be overridden by the new. The new after/every functions wrap the new classes, and the TimeoutFLow.js should work just as before with no code changes.  `77bdabf`
- Fixed missing import in after.js  `ab49394`
- Published v0.0.1 to npm  `1baf002`
- Added badges to readME  `8e7ca26`
- Fixed badge URLs  `d4e9d0e`
- Bumped to version 0.0.3 on npm.. merged the raf and timeout readme's into one for more clarity  `4721ade`
- Cleaned excess emoji from ReadMe  `457b365`
