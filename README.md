# zxcvbn-ts

<div align="center">

![](https://badgen.net/github/checks/KunalTanwar/zxcvbn-ts/)
![](https://badgen.net/github/last-commit/KunalTanwar/zxcvbn-ts/)
![](https://badgen.net/github/license/KunalTanwar/zxcvbn-ts/)
![](https://badgen.net/npm/v/zxcvbn-ts/)
![](https://badgen.net/npm/dt/zxcvbn-ts/)
![](https://badgen.net/npm/types/zxcvbn-ts/)
![](https://badgen.net/bundlejs/minzip/zxcvbn-ts/)
![](https://badgen.net/packagephobia/install/zxcvbn-ts/)
![](https://badgen.net/packagephobia/publish/zxcvbn-ts/)
![](https://badgen.net/github/open-issues/KunalTanwar/zxcvbn-ts/)

</div>

A complete TypeScript rewrite of Dropbox's [zxcvbn](https://github.com/dropbox/zxcvbn) password strength estimator — with strict types, dual CJS/ESM output, fully populated dictionaries, optional AI feedback, and 20+ fixes over the original.

## Features

- **[Full TypeScript](#match-discriminated-union)** — strict mode, discriminated-union `Match` type, exhaustive narrowing
- **[Dual CJS/ESM Output](#building)** — works in Node.js, Bun, bundlers, and modern browsers
- **[Populated Dictionaries](#dictionaries)** — all 93,855 words across 6 frequency lists included out of the box
- **[Optional AI Feedback](#ai-powered-feedback)** — personalised explanations via Claude, ChatGPT, Gemini, or any custom adapter
- **[HIBP Breach Check](#breach-check-zxcvbn-tspwned)** — `zxcvbn-ts/pwned` checks if a password has appeared in a known breach via k-anonymity API
- **[Email Pattern Detection](#match-discriminated-union)** — email addresses used as passwords are detected and penalised
- **[Phone Number Detection](#match-discriminated-union)** — NANP, international, and local formats detected and penalised
- **[`minLength` option](#zxcvbnoptions)** — enforce a minimum password length, forcing score 0 with a clear suggestion
- **[Cost-to-crack Estimates](#cracktimesseconds--cracktimesdisplay--cracktimescost)** — `crack_times_cost` field with USD estimates alongside crack time
- **[Custom Hash Rate](#zxcvbnoptions)** — pass `customHashesPerSecond` to model pbkdf2/Argon2 key stretching
- **Updated 2025 threat model** — attack rates reflect modern RTX 4090 GPU benchmarks
- **Zero Runtime Dependencies** for the core library
- **[Bun-native](#building)** — uses `bun test` and `bun run` throughout
- **[20+ Bug Fixes](#issues-from-original-zxcvbn)** over the original CoffeeScript source

## Installation

```bash
bun add zxcvbn-ts
# or
npm install zxcvbn-ts
# or
pnpm add zxcvbn-ts
```

## Quick start

```ts
import zxcvbn from "zxcvbn-ts"

const result = zxcvbn("correcthorsebatterystaple")

console.log(result.score) // 3  (0 = very weak … 4 = very strong)
console.log(result.guesses) // ~10^14
console.log(result.feedback)
// {
//   warning: "",
//   suggestions: ["Add another word or two. Uncommon words are better."]
// }
console.log(result.crack_times_display.offline_fast_hashing_1e11_per_second)
// "centuries"
```

### With user-specific inputs

```ts
const result = zxcvbn("alice1990", ["alice", "alice@example.com"])
// guess count is reduced when the password contains user-supplied words
```

## API

### `zxcvbn(password, userInputs?, options?)`

| Parameter    | Type                                 | Default | Description                             |
| ------------ | ------------------------------------ | ------- | --------------------------------------- |
| `password`   | `string`                             | —       | The password to evaluate. **Required.** |
| `userInputs` | `Array<string \| number \| boolean>` | `[]`    | User-specific words to penalise.        |
| `options`    | `ZxcvbnOptions`                      | `{}`    | Optional settings.                      |

**Throws** `TypeError` if `password` is not a string.

**Returns** [`ZxcvbnResult`](#zxcvbnresult).

### `ZxcvbnOptions`

| Option                  | Type     | Default     | Description                                                                                                                                         |
| ----------------------- | -------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minLength`             | `number` | `undefined` | Minimum password length. Passwords shorter than this are forced to score 0 with a suggestion prepended.                                             |
| `customHashesPerSecond` | `number` | `undefined` | Custom hash rate for key-stretched algorithms (pbkdf2, Argon2, bcrypt with custom cost). Adds a `custom_hash_rate` field to all crack time results. |

```ts
// Enforce 8-character minimum
zxcvbn("abc", [], {
    minLength: 8,
})
// score: 0, suggestions: ["Password must be at least 8 characters", ...]

// Model pbkdf2 with 100k iterations (~1M hashes/s effective rate)
const result = zxcvbn("password", [], {
    customHashesPerSecond: 1e6,
})

console.log(result.crack_times_display.custom_hash_rate)
// "3 hours"
```

### `ZxcvbnResult`

```ts
interface ZxcvbnResult {
    guesses: number
    guesses_log10: number
    score: 0 | 1 | 2 | 3 | 4
    sequence: Match[]
    crack_times_seconds: CrackTimesSeconds
    crack_times_display: CrackTimesDisplay
    crack_times_cost: CrackTimesCost
    feedback: Feedback
    calc_time: number
}
```

### `Feedback`

```ts
interface Feedback {
    warning: string
    suggestions: string[]
}

// Extended by zxcvbnAI():
interface AIFeedback extends Feedback {
    explanation: string
}
```

### `CrackTimesSeconds` / `CrackTimesDisplay` / `CrackTimesCost`

Four built-in attack scenarios, available as seconds, human-readable strings, and USD cost estimates:

| Key                                    | Scenario                                                 |
| -------------------------------------- | -------------------------------------------------------- |
| `online_throttling_100_per_hour`       | Throttled online attack (100 guesses/hour)               |
| `online_no_throttling_10_per_second`   | Unthrottled online attack (10/s)                         |
| `offline_slow_hashing_1e5_per_second`  | Offline, slow hash e.g. bcrypt — 100k/s (RTX 4090, 2025) |
| `offline_fast_hashing_1e11_per_second` | Offline, fast hash e.g. MD5 — 100B/s (RTX 4090, 2025)    |
| `custom_hash_rate` _(optional)_        | Only present when `customHashesPerSecond` is passed      |

```ts
import { zxcvbn, displayCost, displayTime } from "zxcvbn-ts"

const r = zxcvbn("correcthorsebatterystaple")

displayCost(r.crack_times_cost.offline_fast_hashing_1e11_per_second) // "$2.28"
r.crack_times_display.offline_slow_hashing_1e5_per_second // "85 years"

// With key stretching
const r2 = zxcvbn("password", [], {
    customHashesPerSecond: 1e6,
})

r2.crack_times_display.custom_hash_rate // "3 hours"
r2.crack_times_seconds.custom_hash_rate // 10800
```

### `Match` (discriminated union)

```ts
type Match =
    | BruteforceMatch
    | DictionaryMatch
    | SpatialMatch
    | RepeatMatch
    | SequenceMatch
    | RegexMatch
    | DateMatch
    | PhoneMatch
    | EmailMatch
```

Narrow on the `pattern` discriminant:

```ts
for (const m of result.sequence) {
    if (m.pattern === "dictionary") {
        console.log(m.matched_word, m.rank, m.dictionary_name)
    } else if (m.pattern === "spatial") {
        console.log(m.graph, m.turns, m.shifted_count)
    } else if (m.pattern === "repeat") {
        console.log(m.base_token, m.repeat_count)
    } else if (m.pattern === "date") {
        console.log(m.year, m.month, m.day)
    } else if (m.pattern === "phone") {
        console.log(m.phone_number, m.phone_format)
    } else if (m.pattern === "email") {
        console.log(m.local, m.domain, m.tld)
    }
}
```

## Breach check (`zxcvbn-ts/pwned`)

### What is Have I Been Pwned?

[Have I Been Pwned](https://haveibeenpwned.com) (HIBP) is a free service created by security researcher Troy Hunt that aggregates data from hundreds of known data breaches — collections of leaked credentials from companies like Adobe, LinkedIn, and RockYou. The Pwned Passwords API exposes a database of over 800 million real-world passwords that have been exposed in breaches.

If a password appears in this list, an attacker using a breach dictionary attack would try it immediately — regardless of how complex it looks.

### How k-anonymity works

Sending a password to a third-party API would be a serious security risk. HIBP solves this with a k-anonymity model:

```
1. Hash the password locally with SHA1
   "password" → "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8"

2. Send only the first 5 characters to the API
   GET https://api.pwnedpasswords.com/range/5BAA6

3. HIBP returns ~800 hash suffixes that share that prefix
   1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493
   ...hundreds more...

4. Check locally whether your suffix is in the list
   Found — password appears in 3,861,493 breaches
```

The actual password and the full hash never leave your server. HIBP never sees more than 5 characters.

### Usage

```ts
import { checkPwned } from "zxcvbn-ts/pwned"

const result = await checkPwned("password123")

result.isPwned // true
result.breachCount // 3861493
result.breachDisplay // "seen in 3,861,493 breaches"
```

### ⚠️ Server-side only

`checkPwned()` is designed for server-side use (Node.js, Bun, Edge Functions). While the k-anonymity model protects the password itself, calling it from a browser exposes the 5-character hash prefix to network intermediaries and your users' ISPs. Keep breach checks server-side.

```ts
// ✅ Server-side — safe
const result = await checkPwned(password)

// ❌ Avoid in browser — hash prefix visible to network
```

### Combined with `zxcvbn()`

```ts
import { zxcvbn } from "zxcvbn-ts"
import { checkPwned } from "zxcvbn-ts/pwned"

const strength = zxcvbn(password)
const breach = await checkPwned(password)

// A breached password is always weak regardless of entropy
const finalScore = breach.isPwned ? 0 : strength.score
const warning = breach.isPwned
    ? `Found in ${breach.breachDisplay} — change this password immediately`
    : strength.feedback.warning
```

### `PwnedResult`

| Field           | Type      | Description                                               |
| --------------- | --------- | --------------------------------------------------------- |
| `isPwned`       | `boolean` | Whether the password appears in any known breach          |
| `breachCount`   | `number`  | Number of times seen across all breaches. 0 if not found  |
| `breachDisplay` | `string`  | Human-readable string e.g. `"seen in 3,861,493 breaches"` |

### Options

```ts
await checkPwned(password, {
    timeoutMs: 3000, // request timeout, default: 5000ms
    userAgent: "myapp/1.0", // HIBP recommends identifying your app
    fetch: customFetchImpl, // custom fetch, useful for testing
})
```

## AI-powered Feedback

The core `zxcvbn()` function is synchronous and has zero dependencies. For richer, personalised feedback use `zxcvbnAI()`, which sends the structured analysis to an LLM and returns a plain-English explanation.

Supports **Anthropic (Claude)**, **OpenAI (ChatGPT)**, **Google (Gemini)**, and any **custom adapter**.

### Setup

Get an API key from your preferred provider:

- Anthropic: [console.anthropic.com](https://console.anthropic.com) → env var: `ANTHROPIC_API_KEY`
- Gemini: [aistudio.google.com](https://aistudio.google.com) → env var: `GEMINI_API_KEY`
- OpenAI: [platform.openai.com](https://platform.openai.com) → env var: `OPENAI_API_KEY`

### Usage

```ts
import { zxcvbnAI, anthropic, openai, gemini } from "zxcvbn-ts/ai"

// Anthropic (default when no provider given)
const result = await zxcvbnAI("password123", {
    provider: anthropic({
        apiKey: "sk-ant-...",
    }),
})

// Gemini
const result = await zxcvbnAI("password123", {
    provider: gemini({
        apiKey: "...",
    }),
})

// OpenAI
const result = await zxcvbnAI("password123", {
    provider: openai({
        apiKey: "sk-...",
    }),
})

console.log(result.feedback.explanation)
// "Your password combines one of the most commonly used passwords with a
//  predictable number suffix. Attackers specifically try these combinations
//  first. A passphrase of four or more random words would be far more secure."
```

### Custom Adapter

```ts
import { zxcvbnAI } from "zxcvbn-ts/ai"
import type { AIProvider } from "zxcvbn-ts/ai"

const myProvider: AIProvider = {
    complete: async (systemPrompt, userPrompt) => {
        const res = await myLLM.chat({
            system: systemPrompt,
            user: userPrompt,
        })

        return res.text // must return a JSON string
    },
}

const result = await zxcvbnAI("password123", {
    provider: myProvider,
})
```

### Provider options

| Provider      | Default model               | Env var             |
| ------------- | --------------------------- | ------------------- |
| `anthropic()` | `claude-haiku-4-5-20251001` | `ANTHROPIC_API_KEY` |
| `openai()`    | `gpt-4o-mini`               | `OPENAI_API_KEY`    |
| `gemini()`    | `gemini-1.5-flash`          | `GEMINI_API_KEY`    |

### ⚠️ Security & Privacy

`zxcvbnAI()` sends the **structured analysis** of the password to the AI provider — not the raw password itself. The prompt contains the pattern breakdown, score, and crack time estimate. Even so:

- **Always call `zxcvbnAI()` server-side** — never expose your API key or send password analysis from the browser
- The raw password is never included in the prompt, but the match sequence may reveal partial information
- Use a backend endpoint to proxy calls if you need AI feedback in a client-side app

```ts
// ✅ Safe — server-side only
app.post("/check-password", async (req, res) => {
    const result = await zxcvbnAI(req.body.password, {
        provider: anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        }),
    })

    res.json({
        score: result.score,
        feedback: result.feedback,
    })
})

// ❌ Never do this — exposes API key in browser bundle
const result = await zxcvbnAI(password, {
    provider: anthropic({
        apiKey: "sk-ant-...",
    }),
})
```

### Cost

All providers default to their cheapest model. A typical check uses **~200 input** + **~100 output** tokens — a fraction of a cent per call. Consider only calling `zxcvbnAI()` for weak passwords (`score < 3`) to minimise cost.

## Dictionaries

Six ranked frequency lists are bundled, totalling 93,855 words:

| List                |  Words | Source                           |
| ------------------- | -----: | -------------------------------- |
| `passwords`         | 30,000 | Common leaked passwords          |
| `english_wikipedia` | 30,000 | Frequent Wikipedia words         |
| `us_tv_and_film`    | 19,160 | TV/film character and show names |
| `surnames`          | 10,000 | Common surnames                  |
| `female_names`      |  3,712 | Common female given names        |
| `male_names`        |    983 | Common male given names          |

### Custom Dictionaries

```ts
import { setUserInputDictionary, zxcvbn } from "zxcvbn-ts"

// Inject per-request user-specific words
setUserInputDictionary(["alice", "smith", "alice@example.com"])
const result = zxcvbn("alice2024")
```

Or pass them as `userInputs` directly (recommended — stateless):

```ts
zxcvbn("alice2024", ["alice", "smith", "alice@example.com"])
```

## Lower-level API

All internal functions are exported for custom integrations:

```ts
import {
    omnimatch,
    dictionaryMatch,
    reverseDictionaryMatch,
    l33tMatch,
    spatialMatch,
    repeatMatch,
    sequenceMatch,
    regexMatch,
    dateMatch,
    phoneMatch,
    emailMatch,
    setUserInputDictionary,
    mostGuessableMatchSequence,
    estimateAttackTimes,
    guessesToScore,
    displayTime,
    displayCost,
    getFeedback,
} from "zxcvbn-ts"
```

## Building

```bash
bun install              # install typescript + @types/bun
bun test                 # run test suite
bun run build            # emit dist/cjs, dist/esm, dist/types
bun run typecheck        # tsc --noEmit only
bun run clean            # remove dist/
```

Output after `bun run build`:

```
dist/
    cjs/        ← CommonJS (require)
    esm/        ← ES Modules (import)
    types/      ← .d.ts declarations
    data/       ← frequency_lists.json (shipped once)
```

## Issues from original zxcvbn

Status of all tracked issues from the [original zxcvbn repository](https://github.com/dropbox/zxcvbn/issues) as they apply to this rewrite.

| #   | Issue                                                | Title                                                                                                         | Note                                                                                                                                                                                                                          | Status                                                      |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | [#363](https://github.com/dropbox/zxcvbn/issues/363) | Massive Memory Footprint                                                                                      | Fixed by shipping frequency lists as a single minified JSON file in `dist/data/` — shipped once instead of 3× across CJS/ESM/types.                                                                                           | ✅ Fixed                                                    |
| 2   | [#338](https://github.com/dropbox/zxcvbn/issues/338) | Feature request: provide options for smaller builds                                                           | The JSON frequency list is a standalone file that can be replaced. `setUserInputDictionary()` supports injecting custom dictionaries at runtime.                                                                              | ✅ Fixed                                                    |
| 3   | [#327](https://github.com/dropbox/zxcvbn/issues/327) | A ReDoS vulnerability exists in matching.coffee                                                               | Replaced the vulnerable `^(.+?)\1+$` regex with a safe string-length comparison in `repeatMatch`. Attack string now processes in ~79ms vs 892ms.                                                                              | ✅ Fixed                                                    |
| 4   | [#326](https://github.com/dropbox/zxcvbn/issues/326) | Possible DOS when run server side                                                                             | Fixed with a 128-char password limit and 100-char per-userInput limit in `main.ts`.                                                                                                                                           | ✅ Fixed                                                    |
| 5   | [#318](https://github.com/dropbox/zxcvbn/issues/318) | recent year regex is... out of date.                                                                          | Updated regex from `/19\d\d\|200\d\|201\d/` to `/19\d\d\|20[0-3]\d/` in `matching.ts` — now covers years up to 2039.                                                                                                          | ✅ Fixed                                                    |
| 6   | [#316](https://github.com/dropbox/zxcvbn/issues/316) | Very slow for certain inputs                                                                                  | Added early exit in `repeatMatch` for all-unique-char passwords and capped l33t substitution enumeration at 4 distinct chars. Reduced from 1500ms → 9ms for the reported input.                                               | ⚠️ Partially Fixed                                          |
| 7   | [#300](https://github.com/dropbox/zxcvbn/issues/300) | Can `zxcvbn()` method take the `minlength` parameter also for validation                                      | Not present in the original either — length validation is the caller's responsibility.                                                                                                                                        | ✅ Fixed                                                    |
| 8   | [#291](https://github.com/dropbox/zxcvbn/issues/291) | Easy way to add build and add custom dictionaries                                                             | Already supported via the exported `setUserInputDictionary()` function.                                                                                                                                                       | ✅ Fixed                                                    |
| 9   | [#284](https://github.com/dropbox/zxcvbn/issues/284) | How to configure i18n support                                                                                 | Requires non-English word lists and translated feedback strings. **Out of scope** for this rewrite.                                                                                                                           | ❌ Not Fixed                                                |
| 10  | [#276](https://github.com/dropbox/zxcvbn/issues/276) | Score incongruous for repeated words                                                                          | The repeat matcher includes trailing spaces in the token. **Algorithmic Limitation** inherited from the original.                                                                                                             | ❌ Not Fixed                                                |
| 11  | [#274](https://github.com/dropbox/zxcvbn/issues/274) | Algorithm does not recognize dictionary words in certain cases                                                | The DP finds the minimum-guesses path, not the maximum-matches path. **Algorithmic Limitation**.                                                                                                                              | ❌ Not Fixed                                                |
| 12  | [#273](https://github.com/dropbox/zxcvbn/issues/273) | Dictionary leaves out common words                                                                            | The frequency lists are derived from Wikipedia and common passwords — not a general English dictionary.                                                                                                                       | ❌ Not Fixed                                                |
| 13  | [#272](https://github.com/dropbox/zxcvbn/issues/272) | Fash hash threat model might be optimistic                                                                    | Threat model constants are unchanged from original. Modern GPU hash rates may warrant updating.                                                                                                                               | ✅ Fixed                                                    |
| 14  | [#268](https://github.com/dropbox/zxcvbn/issues/268) | Evaluate to create a minified version that do not implement check on frequency list                           | Users can replace `data/frequency_lists.json` with `{}` for a frequency-list-free build.                                                                                                                                      | ⚠️ Partially Fixed — users can replace the JSON file        |
| 15  | [#267](https://github.com/dropbox/zxcvbn/issues/267) | User Inputs transformed to lower case leads to unexpectedly high score for upper case variants of user inputs | Fixed in `main.ts` — original-cased user inputs are now also added to the ranked dictionary alongside the lowercased version.                                                                                                 | ✅ Fixed                                                    |
| 16  | [#264](https://github.com/dropbox/zxcvbn/issues/264) | Bruteforce entropy estimator does not account for cardinality                                                 | `BRUTEFORCE_CARDINALITY` is fixed at 10 regardless of actual character set. Fixing this properly **requires algorithm changes**.                                                                                              | ❌ Not Fixed                                                |
| 17  | [#234](https://github.com/dropbox/zxcvbn/issues/234) | Add Markov Chain recognition                                                                                  | Would require a Markov chain model trained on password datasets. Significant addition — **not in scope**.                                                                                                                     | ❌ Not Fixed                                                |
| 18  | [#232](https://github.com/dropbox/zxcvbn/issues/232) | Passwords recognized as single tokens inconsistently rewarded for capitalization                              | Fixed in `scoring.ts` — `uppercaseVariations` now strips non-letter chars before computing the multiplier. `12345Qwert` and `12345qwerT` now both yield 1009 guesses.                                                         | ✅ Fixed                                                    |
| 19  | [#231](https://github.com/dropbox/zxcvbn/issues/231) | No specific suggestion or warning given for passwords that are too weak because of user imputs                | Fixed in `feedback.ts` — added a specific case for `dictionary_name === "user_inputs"` returning: "This password is on your personal info list".                                                                              | ✅ Fixed                                                    |
| 20  | [#227](https://github.com/dropbox/zxcvbn/issues/227) | user_inputs argument                                                                                          | `user_inputs` works for whole-token matches within the DP. Short words may not match across token boundaries. **DP Limitation**.                                                                                              | ❌ Not Fixed                                                |
| 21  | [#223](https://github.com/dropbox/zxcvbn/issues/223) | Group repetition not detected                                                                                 | Group repetitions like `abcabcabc` are already correctly detected as `repeat(abcabcabc)` in my TypeScript rewrite.                                                                                                            | ✅ Fixed                                                    |
| 22  | [#221](https://github.com/dropbox/zxcvbn/issues/221) | Possible L33t Matcher Bug - Relevant L33t Subtable Always Empty                                               | The l33t subtable bug existed in the original CoffeeScript. My TypeScript rewrite correctly identifies l33t matches.                                                                                                          | ✅ Fixed                                                    |
| 23  | [#216](https://github.com/dropbox/zxcvbn/issues/216) | Match tokens not accurate with spaces                                                                         | Spaces are treated as bruteforce tokens by the DP. Treating whitespace as a separator would change the core algorithm.                                                                                                        | ❌ Not Fixed                                                |
| 24  | [#211](https://github.com/dropbox/zxcvbn/issues/211) | How to generate dictionary in another language than english ?                                                 | Use `setUserInputDictionary()` with a custom non-English word list. Full i18n is **out of scope**.                                                                                                                            | ❌ Not Fixed                                                |
| 25  | [#209](https://github.com/dropbox/zxcvbn/issues/209) | Bruteforce and suboptimal scoring chains                                                                      | The DP is designed to find minimum guesses, not maximum matches. **This is by design**.                                                                                                                                       | ❌ Not Fixed                                                |
| 26  | [#208](https://github.com/dropbox/zxcvbn/issues/208) | Computed guesses for user-input matches is oddly high                                                         | The DP factorial multiplier inflates the combined guess count when all tokens come from user_inputs. **Known DP Limitation**.                                                                                                 | ❌ Not Fixed                                                |
| 27  | [#207](https://github.com/dropbox/zxcvbn/issues/207) | How to best feed large additional dictionaries                                                                | Use `setUserInputDictionary()` for custom words. Very large lists will impact performance.                                                                                                                                    | ❌ Not Fixed                                                |
| 28  | [#206](https://github.com/dropbox/zxcvbn/issues/206) | 'Administrator' password with special chars are indicated as a strong password                                | `aDm1n` is correctly detected as l33t `admin`, but `!str@t0r` cannot be reverse-mapped to `administrator` because `!` has no l33t mapping. **Algorithmic Limitation**.                                                        | ❌ Not Fixed                                                |
| 29  | [#204](https://github.com/dropbox/zxcvbn/issues/204) | ignored dictionaries during matching                                                                          | Fixed in `feedback.ts` — added a specific warning for `us_tv_and_film` dictionary matches: "TV show and film names are easy to guess".                                                                                        | ✅ Fixed                                                    |
| 30  | [#201](https://github.com/dropbox/zxcvbn/issues/201) | User input permutation suggestions                                                                            | Covered by the fix for [#231](https://github.com/dropbox/zxcvbn/issues/231) — passwords matching user_inputs now return a specific warning and suggestions.                                                                   | ✅ Fixed                                                    |
| 31  | [#199](https://github.com/dropbox/zxcvbn/issues/199) | Updating estimates for pbkdf2 streaching                                                                      | Fixed via the `customHashesPerSecond` option in `ZxcvbnOptions`. Pass your effective hash rate (e.g. `1e6` for pbkdf2 with 100k iterations) and a `custom_hash_rate` field is added to all crack time results.                | ✅ Fixed                                                    |
| 32  | [#196](https://github.com/dropbox/zxcvbn/issues/196) | I'm unfamilar with what 'keyboard turns' are                                                                  | UX wording issue in the original. "Keyboard turns" refers to direction changes in a keyboard walk (e.g. `qweasd` has 1 turn). **No code change needed**.                                                                      | ➖ No code change needed — documentation clarification only |
| 33  | [#195](https://github.com/dropbox/zxcvbn/issues/195) | Check bopomofo combinations                                                                                   | Bopomofo keyboard layout support would require adding a new adjacency graph. **Out of scope** for this rewrite.                                                                                                               | ❌ Not Fixed                                                |
| 34  | [#194](https://github.com/dropbox/zxcvbn/issues/194) | Long password throws an error                                                                                 | Fixed by the 128-char input limit added in `main.ts` (fix for [#326](https://github.com/dropbox/zxcvbn/issues/326)). Long passwords no longer crash the DP.                                                                   | ✅ Fixed                                                    |
| 35  | [#190](https://github.com/dropbox/zxcvbn/issues/190) | Better support for common keyboard layouts                                                                    | Additional keyboard layout support would require new adjacency graphs. **Out of scope**.                                                                                                                                      | ❌ Not Fixed                                                |
| 36  | [#171](https://github.com/dropbox/zxcvbn/issues/171) | Localization of feedback                                                                                      | Feedback strings are hardcoded in `feedback.ts`. A full i18n solution requires translating all strings and is **out of scope**.                                                                                               | ❌ Not Fixed                                                |
| 37  | [#157](https://github.com/dropbox/zxcvbn/issues/157) | Flaw in scoring (or Flaw in my opinion)                                                                       | Spaces between repeated words inflate the entropy estimate. Related to [#276](https://github.com/dropbox/zxcvbn/issues/276) and [#21](https://github.com/dropbox/zxcvbn/issues/21) — **Algorithmic Limitation**.              | ❌ Not Fixed                                                |
| 38  | [#142](https://github.com/dropbox/zxcvbn/issues/142) | represent difficulty to crack as money rather than time                                                       | The `crack_times_seconds` values can be used to compute cost estimates. A `crack_times_cost` field could be added as a future enhancement.                                                                                    | ✅ Fixed                                                    |
| 39  | [#132](https://github.com/dropbox/zxcvbn/issues/132) | Concat extras should have 0 score                                                                             | Concatenated user inputs should score 0. Covered by the fix for [#231](https://github.com/dropbox/zxcvbn/issues/231)/[#201](https://github.com/dropbox/zxcvbn/issues/201) — user_inputs matches now return specific warnings. | ✅ Fixed                                                    |
| 40  | [#129](https://github.com/dropbox/zxcvbn/issues/129) | Suggestion should be shown when password matches user input                                                   | Fixed by the fix for [#231](https://github.com/dropbox/zxcvbn/issues/231) — passwords matching user_inputs now return: "This password is on your personal info list".                                                         | ✅ Fixed                                                    |
| 41  | [#128](https://github.com/dropbox/zxcvbn/issues/128) | Suggestion should include actual substitution used                                                            | Fixed in `feedback.ts` — suggestion now uses the actual substitution from `sub_display` (e.g. "3 → e") instead of the generic `@` example.                                                                                    | ✅ Fixed                                                    |
| 42  | [#116](https://github.com/dropbox/zxcvbn/issues/116) | "Capitalization doesn't help very much" can be confusing                                                      | Fixed in `feedback.ts` — changed to "Capitalizing the first letter is a common pattern and doesn't add much security".                                                                                                        | ✅ Fixed                                                    |
| 43  | [#105](https://github.com/dropbox/zxcvbn/issues/105) | Telephone number format sequence                                                                              | Phone number detection would require a new regex matcher. **Out of scope**.                                                                                                                                                   | ✅ Fixed                                                    |
| 44  | [#97](https://github.com/dropbox/zxcvbn/issues/97)   | Diacritics removal before dictionary check                                                                    | Fixed in `matching.ts` — passwords are now normalized via `NFD` + diacritic strip before dictionary lookup. `pässwörd` now matches `password`.                                                                                | ✅ Fixed                                                    |
| 45  | [#21](https://github.com/dropbox/zxcvbn/issues/21)   | spaced passwords add too much entropy                                                                         | Spaces between single chars inflate entropy because each space is treated as a bruteforce token. Related to [#276](https://github.com/dropbox/zxcvbn/issues/276) — **Algorithmic Limitation**.                                | ❌ Not Fixed                                                |

## License

[MIT](LICENSE.md)
