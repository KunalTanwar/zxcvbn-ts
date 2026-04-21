# Changelog

All notable changes to **zxcvbn-ts** are documented here.

# [2.0.2] — April 2026

### Housekeeping

- **`tsconfig.base.json`** — bump `target` and `lib` from `ES2017` to `ES2020`; replace `rootDirs` array with `rootDir: "src"` (fixes VS Code rootDir warning).
- **`tsconfig.json`** — switch `moduleResolution` from `node` to `bundler`; set `noEmit: true`; scope to `src` only. Fixes the `node10` deprecation warning in VS Code.
- **`tsconfig.bun.json`** — switch to `moduleResolution: bundler`; set `types: ["bun-types"]`; include `src` and `tests`. Used by the `typecheck` script.
- **`tsconfig.cjs.json`** — add `ignoreDeprecations: "5.0"` to silence the `node10` warning. CJS build must keep `moduleResolution: node10`.
- **`tsconfig.types.json`** — switch `moduleResolution` from `node` to `bundler`.
- **`tests/ai.test.ts`** — add `/// <reference types="bun-types" />`; replace all `global.fetch` with `globalThis.fetch`; type `complete()` mock params as `string`.
- **`tests/zxcvbn.test.ts`** — add `/// <reference types="bun-types" />`.
- **`package.json`** — replace `@types/bun` with `bun-types`; add `author`, `repository`, `homepage`, `bugs` fields; improve `description` and expand `keywords`; update `typecheck` script to use `tsconfig.bun.json`.
- **`README.md`** — add server-side only warning to `zxcvbnAI()` section; add CI badge; update changelog badge to `2.0.2`.

## [2.0.1] — 2025

### Bug Fixes

- Fix TypeScript cast errors in `time_estimates.ts` — `CrackTimesDisplay` and `CrackTimesCost` now cast through `unknown` before `Record<string, ...>` to satisfy strict type checking.

### Features

- `customHashesPerSecond` option(#199) — pass a custom hash rate to `zxcvbn()` via `ZxcvbnOptions` to model key-stretched algorithms like pbkdf2, Argon2 or bcrypt with a custom cost factor. Adds an optional `custom_hash_rate` field to `crack_times_seconds`, `crack_time_display` and `crack_time_cost`.

```ts
// pbkdf2 with 100k iterations reduces effective rate to ~1M/s
const result = zxcvbn("password", [], {
    customHashesPerSecond: 1e6,
})

result.crack_times_display.custom_hash_rate // "3 hours"
displayCost(result.crack_times_cost.custom_hash_rate) // "$0.04"
```

### CI

- Added GitHub Actions workflow (`.github/workflows/ci.yml`) — runs typecheck, build, `bun test`, and `node tests/run.js` on every push and PR against `main`, across Node 18/20/22.
- Publish job triggers automatically when commit message starts with `chore(release)` and all tests pass.

### Documentation

- Added server-side only warning to `zxcvbnAI()` section — password data must never be sent to AI providers from the browser.
- Added safe usage pattern: run `zxcvbn()` client-side for instant feedback, call `zxcvbnAI()` server-side only for weak passwords.

## [2.0.0] — 2025

### ⚠️ Breaking changes

- **Threat model key names updated** — `crack_times_seconds`, `crack_times_display`, and `crack_times_cost` fields renamed to reflect 2025 GPU speeds:
    - `offline_slow_hashing_1e4_per_second` → `offline_slow_hashing_1e5_per_second`
    - `offline_fast_hashing_1e10_per_second` → `offline_fast_hashing_1e11_per_second`

### Features

- **`minLength` option (#300)** — pass `{ minLength: 8 }` as a third argument to `zxcvbn()` to enforce a minimum password length. Passwords shorter than the minimum are forced to score 0 with a clear suggestion regardless of entropy.

    ```ts
    zxcvbn("xkJ#9!", [], {
        minLength: 8,
    })
    // score: 0, suggestions: ["Password must be at least 8 characters", ...]
    ```

- **`crack_times_cost` field (#142)** — every result now includes estimated USD cost to crack under each attack scenario, based on 2025 AWS GPU spot instance pricing. Use `displayCost()` for human-readable strings.

    ```ts
    const r = zxcvbn("correcthorsebatterystaple")
    displayCost(r.crack_times_cost.offline_fast_hashing_1e11_per_second) // "$2.28"
    ```

- **Phone number detection (#105)** — new `phoneMatch()` matcher detects NANP, international, and local 7-digit phone numbers. Phone passwords receive a specific warning and score at most 2.

    ```ts
    zxcvbn("852-555-9630").feedback.warning
    // "North American phone numbers are easy to guess"
    ```

- **Updated threat model (#272)** — attack rates updated from 2012 estimates to 2025 GPU benchmarks (RTX 4090):
    - Offline slow hashing (bcrypt): `1e4/s` → `1e5/s`
    - Offline fast hashing (MD5): `1e10/s` → `1e11/s`
    - Score thresholds recalibrated accordingly

### Bug fixes

- **`uppercaseVariations` inconsistency (#232)** — non-letter characters are now stripped before computing the capitalisation multiplier. `12345Qwert` and `12345qwerT` now yield identical guess counts.
- **Uppercase user inputs bypass penalty (#267)** — original-cased user inputs are now added to the ranked dictionary alongside lowercased versions.
- **Diacritics not stripped before dictionary lookup (#97)** — passwords are NFD-normalised and diacritics stripped before lookup. `pässwörd` now correctly matches `password`.
- **No warning for user_inputs matches (#231/#129)** — passwords matching the `user_inputs` dictionary now return a specific warning: _"This password is on your personal info list"_.
- **`us_tv_and_film` matches silently ignored (#204)** — TV show and film name matches now return _"TV show and film names are easy to guess"_.
- **Generic l33t substitution suggestion (#128)** — suggestion now shows the actual substitution used (e.g. `"3 -> e"`) instead of always `"@" instead of "a"`.
- **Confusing capitalisation suggestion (#116)** — reworded to _"Capitalizing the first letter is a common pattern and doesn't add much security"_.

## [1.3.0] — 2025

### Features

- **Multi-provider AI feedback** (`zxcvbn-ts/ai`) — `zxcvbnAI()` now supports Anthropic (Claude), OpenAI (ChatGPT), Google Gemini, and any custom adapter via the `AIProvider` interface.

    ```ts
    import { zxcvbnAI, openai, gemini } from "zxcvbn-ts/ai"

    await zxcvbnAI("password", { provider: openai({ apiKey: "sk-..." }) })
    await zxcvbnAI("password", { provider: gemini({ apiKey: "..." }) })

    // Custom adapter
    await zxcvbnAI("password", {
        provider: { complete: async (system, user) => myLLM.chat(system, user) },
    })
    ```

### Bug fixes

- **ReDoS vulnerability in `repeatMatch` (#327)** — the vulnerable `^(.+?)\1+$` regex replaced with a safe string-length comparison. Attack string now processes in ~79ms instead of hanging indefinitely.
- **DOS via crafted inputs (#326)** — passwords capped at 128 characters; individual `userInputs` entries capped at 100 characters.
- **Slow inputs from l33t combinatorial explosion (#316)** — l33t substitution enumeration capped at 4 distinct characters; `repeatMatch` exits early for all-unique-character passwords. 1500ms → 9ms for the reported input.
- **`recent_year` regex out of date (#318)** — updated from `/19\d\d|200\d|201\d/` to `/19\d\d|20[0-3]\d/`. Years 2020–2039 now correctly detected.
- **Factorial overflow in scoring** — `factorial()` now clamps to `Number.MAX_VALUE` before returning `Infinity`.

## [1.2.2] — 2025

### Features

- **AI-powered feedback** (`zxcvbn-ts/ai`) — optional `zxcvbnAI()` function sends the structured zxcvbn analysis to Claude (Anthropic) and returns a plain-English `explanation` alongside the standard `warning` and `suggestions`.

    ```ts
    import { zxcvbnAI } from "zxcvbn-ts/ai"

    const r = await zxcvbnAI("password123", {
        apiKey: "sk-ant-...",
    })

    console.log(r.feedback.explanation)
    ```

### Bug fixes

- **Lazy init guard silently disabled dictionary matching** — `setUserInputDictionary()` called before `omnimatch()` caused the lazy init guard to short-circuit, leaving all frequency lists unloaded. Replaced with eager module-level initialisation.
- **`sorted()` erased match subtypes** — `sorted()` is now generic (`sorted<T extends Match>`) to preserve discriminated union narrowing.

### Performance

- **Reduced unpacked size from 7.72MB to 1.1MB** — frequency lists moved from compiled TypeScript to a single minified JSON file (`dist/data/frequency_lists.json`) shipped once instead of once per build target.
- **Source maps removed from published package** — further reduces install footprint.

## [1.1.0] — 2025

### Features

- **Populated frequency dictionaries** — all 93,855 words across 6 lists (passwords, english_wikipedia, female_names, male_names, surnames, us_tv_and_film) bundled out of the box.
- **Dual CJS/ESM output** — `dist/cjs/` for `require()`, `dist/esm/` for `import`, `dist/types/` for `.d.ts` declarations.

### Bug fixes

- **Empty password crash** — `unwind(0)` now returns `[]` instead of throwing.
- **Non-string input silently coerced** — `zxcvbn()` now throws `TypeError` for non-string passwords.
- **`$` key unquoted in adjacency graph** — corrected to `"$"` for consistency.

## [1.0.0] — 2025

Initial release — full TypeScript rewrite of Dropbox's [zxcvbn](https://github.com/dropbox/zxcvbn) password strength estimator.

### What's included

- **Strict TypeScript** — discriminated-union `Match` type (`BruteforceMatch | DictionaryMatch | SpatialMatch | RepeatMatch | SequenceMatch | RegexMatch | DateMatch`) with exhaustive type narrowing.
- **All 8 original matchers** — `dictionaryMatch`, `reverseDictionaryMatch`, `l33tMatch`, `spatialMatch`, `repeatMatch`, `sequenceMatch`, `regexMatch`, `dateMatch`.
- **Same algorithm** — results numerically identical to the original CoffeeScript library.
- **Full lower-level API** — all matchers, scoring functions, and feedback helpers exported for custom integrations.
- **Bun-native** — `bun test` for the test suite, `bun run build` for the triple-target build.
