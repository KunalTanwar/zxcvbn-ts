# zxcvbn-ts

[![npm version](https://img.shields.io/npm/v/zxcvbn-ts)](https://www.npmjs.com/package/zxcvbn-ts)
[![bundle size](https://img.shields.io/bundlephobia/minzip/zxcvbn-ts)](https://bundlephobia.com/package/zxcvbn-ts)
[![license](https://img.shields.io/npm/l/zxcvbn-ts)](./LICENSE)
[![npm downloads](https://img.shields.io/npm/dm/zxcvbn-ts)](https://www.npmjs.com/package/zxcvbn-ts)
[![changelog](https://img.shields.io/badge/changelog-2.0.0-blue)](./CHANGELOG.md)

A complete TypeScript rewrite of Dropbox's [zxcvbn](https://github.com/dropbox/zxcvbn) password strength estimator — with strict types, dual CJS/ESM output, and a fully populated dictionary set.

## Features

- **Full TypeScript** — strict mode, discriminated-union `Match` type, exhaustive type narrowing
- **Dual CJS/ESM Output** — works in Node.js, bundlers, and modern browsers
- **Populated Dictionaries** — all 93,855 words across 6 frequency lists included out of the box
- **Optional AI Feedback** — personalised explanations via Claude, ChatGPT, Gemini, or any custom adapter
- **Zero Runtime Dependencies** for the core library
- **Phone Number Detection** - NANP, international, and local formats detected and penalised
- **`minLength` Option** - enforce a minimum password length, forcing score 0 with a clear suggestion
- **Cost-to-Crack Estimates** - `crack_times_cost` field with USD estimates alongside crack time
- **Updated 2025 Threat Model** — attack rates reflect modern RTX 4090 GPU benchmarks
- **Bun-native** — uses `bun test` and `bun run` throughout
- **16+ Bug Fixes** over the original CoffeeScript source (see [Changes from original](#changes-from-original))
- **Same Algorithm** — results are numerically identical to the original library

## Installation

```bash
bun add zxcvbn-ts
# or
npm add zxcvbn-ts
# or
pnpm add zxcvbn-ts
# or
yarn add zxcvbn-ts
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

Pass words the attacker is likely to try first (name, email address, username, …):

```ts
const result = zxcvbn("alice1990", ["alice", "alice@example.com"])
// guess count is reduced when the password contains user-supplied words
```

## AI-powered Feedback

The core `zxcvbn()` function is synchronous and has zero dependencies. If you want richer, personalised feedback you can optionally use `zxcvbnAI()`, which runs the same analysis and then sends the structured result to an AI model for a human-readable explanation.

Supports **Anthropic (Claude)**, **OpenAI (ChatGPT)**, **Google (Gemini)**, and any **custom adapter**.

### Setup

Get an API key from your preferred provider:

- Anthropic: [console.anthropic.com](https://console.anthropic.com)
- OpenAI: [platform.openai.com](https://platform.openai.com)
- Gemini: [aistudio.google.com](https://aistudio.google.com)

Add it to your environment:

```bash
# .env  (never commit this file)
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...
# or
GEMINI_API_KEY=...
```

### Usage

```ts
import { zxcvbnAI, anthropic, openai, gemini } from "zxcvbn-ts/ai"

// Anthropic (Claude) — default if no provider given
const result = await zxcvbnAI("password123", {
    provider: anthropic({ apiKey: "sk-ant-..." }),
})

// OpenAI (ChatGPT)
const result = await zxcvbnAI("password123", {
    provider: openai({ apiKey: "sk-..." }),
})

// Google Gemini
const result = await zxcvbnAI("password123", {
    provider: gemini({ apiKey: "..." }),
})

console.log(result.score) // 0
console.log(result.feedback.warning) // "This is a top-10 common password."
console.log(result.feedback.suggestions) // ["Use a passphrase instead.", ...]
console.log(result.feedback.explanation)
// "Your password combines one of the most commonly used passwords with a
//  predictable number suffix. Attackers specifically try these combinations
//  first. A passphrase of four or more random words would be far more secure."
```

The API key is picked up automatically from `ANANTHROPIC_API_KEY`. You can also pass it directly:

```ts
const result = await zxcvbnAI("password123", {
    apiKey: "sk-ant-...",
})
```

### Custom Adapter

Use any LLM — Ollama, Mistral, or your own — by passing a custom adapter:

```ts
import { zxcvbnAI } from "zxcvbn-ts/ai"
import type { AIProvider } from "zxcvbn-ts/ai"

const myProvider: AIProvider = {
    complete: async (systemPrompt, userPrompt) => {
        const res = await myLLM.chat({ system: systemPrompt, user: userPrompt })

        return res.text // must return a JSON string
    },
}

const result = await zxcvbnAI("password123", { provider: myProvider })
```

The `complete()` method receives two strings — the system prompt and user prompt — and must return a JSON string with `warning`, `suggestions`, and `explanation` fields.

### Provider Options

All built-in providers accept the same options:

| Option      | Type     | Default   | Description                                                    |
| ----------- | -------- | --------- | -------------------------------------------------------------- |
| `apiKey`    | `string` | env var   | Your API key. Falls back to the provider's env var if omitted. |
| `model`     | `string` | see below | Override the model used.                                       |
| `maxTokens` | `number` | `300`     | Max tokens for the AI response.                                |

Default models and env var fallbacks:

| Provider      | Default model               | Env var             |
| ------------- | --------------------------- | ------------------- |
| `anthropic()` | `claude-haiku-4-5-20251001` | `ANTHROPIC_API_KEY` |
| `openai()`    | `gpt-4o-mini`               | `OPENAI_API_KEY`    |
| `gemini()`    | `gemini-1.5-flash`          | `GEMINI_API_KEY`    |

### `zxcvbnAI(password, options?, userInputs?)`

| Parameter    | Type                                 | Default | Description                             |
| ------------ | ------------------------------------ | ------- | --------------------------------------- |
| `password`   | `string`                             | —       | The password to evaluate. **Required.** |
| `options`    | `ZxcvbnAIOptions`                    | `{}`    | Provider Override.                      |
| `userInputs` | `Array<string \| number \| boolean>` | `[]`    | User-specific words to penalise.        |

Returns `Promise<ZxcvbnAIResult>` — a standard `ZxcvbnResult` with an extended `feedback` object that adds an `explanation` field.

### Real-world example

A signup form checking password strength with AI feedback:

```ts
import { zxcvbnAI, openai } from "zxcvbn-ts/ai"

async function validatePassword(password: string, username: string) {
    const result = await zxcvbnAI(
        password,
        { provider: openai() }, // picks up OPENAI_API_KEY automatically
        [username],
    )

    if (result.score < 3) {
        return {
            valid: false,
            message: result.feedback.explanation,
        }
    }

    return { valid: true }
}
```

### Cost

The default models are the cheapest options from each provider. A typical password check uses ~200 input tokens and ~100 output tokens — a fraction of a cent per call. For high-traffic applications consider caching results or only calling the AI for weak passwords (`score < 3`).

## API

### `zxcvbn(password, userInputs?)`

| Parameter    | Type                                 | Default | Description                                |
| ------------ | ------------------------------------ | ------- | ------------------------------------------ |
| `password`   | `string`                             | —       | The password to evaluate. **Required.**    |
| `userInputs` | `Array<string \| number \| boolean>` | `[]`    | User-specific words to penalise. Optional. |

**Throws** `TypeError` if `password` is not a string.

**Returns** [`ZxcvbnResult`](#zxcvbnresult).

### `ZxcvbnOptions`

| Option      | Type     | Default     | Description                                                                                                                    |
| ----------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `minLength` | `number` | `undefined` | Minimum password length. If the password is shorter, score is forced to 0 and a suggestion is prepended regardless of entropy. |

```ts
// Enforce 8-character minimum
const result = zxcvbn("abc", [], { minLength: 8 })
// score: 0
// suggestions: ["Password must be at least 8 characters", ...]

// Password meeting the minimum scores normally
const result2 = zxcvbn("correcthorsebatterystaple", [], { minLength: 8 })
// score: 4
```

### `ZxcvbnResult`

```ts
interface ZxcvbnResult {
    /** Estimated number of guesses needed to crack the password. */
    guesses: number
    /** log₁₀ of guesses. */
    guesses_log10: number
    /** 0 = very weak, 1 = weak, 2 = fair, 3 = strong, 4 = very strong. */
    score: 0 | 1 | 2 | 3 | 4
    /** The sequence of match objects that produced the lowest guess estimate. */
    sequence: Match[]
    /** Estimated seconds-to-crack under four attack scenarios. */
    crack_times_seconds: CrackTimesSeconds
    /** Human-readable crack-time strings. */
    crack_times_display: CrackTimesDisplay
    /** Estimated USD cost to crack under each attack scenario. */
    crack_times_cost: CrackTimesCost
    feedback: Feedback
    /** Time in ms the estimation took. */
    calc_time: number
}
```

### `Feedback`

```ts
interface Feedback {
    warning: string // Empty string if no specific warning.
    suggestions: string[]
}

interface AIFeedback extends Feedback {
    explanation: string // Plain-English explanation of the weakness
}
```

### `CrackTimesSeconds` / `CrackTimesDisplay`

Four attack scenarios, available as both raw seconds and human-readable strings:

| Key                                    | Scenario                                                 |
| -------------------------------------- | -------------------------------------------------------- |
| `online_throttling_100_per_hour`       | Throttled online attack (100 guesses/hour)               |
| `online_no_throttling_10_per_second`   | Unthrottled online attack (10/s)                         |
| `offline_slow_hashing_1e5_per_second`  | Offline, slow hash e.g. bcrypt — 100k/s (RTX 4090, 2025) |
| `offline_fast_hashing_1e11_per_second` | Offline, fast hash e.g. MD5 — 100B/s (RTX 4090, 2025)    |

### `CrackTimesCost`

Estimated USD cost to crack the password, based on 2025 AWS GPU spot instance rates. Use `displayCost()` for human-readable strings.

```ts
import { zxcvbn, displayCost } from "zxcvbn-ts"

const result = zxcvbn("correcthorsebatterystaple")

displayCost(result.crack_times_cost.offline_fast_hashing_1e11_per_second)
// "$2.28"

displayCost(result.crack_times_cost.online_throttling_100_per_hour)
// "$2,735,003,277"
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
    }
}
```

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

Words appearing in multiple lists are deduplicated during matching; the lowest rank (best match) wins.

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
    setUserInputDictionary,
    mostGuessableMatchSequence,
    estimateAttackTimes,
    guessesToScore,
    displayTime,
    displayCost,
    phoneMatch,
    getFeedback,
} from "zxcvbn-ts"
```

## Building

```bash
bun install              # install typescript + @types/bun
bun test                 # run test suite (no build step needed — bun runs TS directly)
bun run build            # emit dist/cjs, dist/esm, dist/types
bun run typecheck        # tsc --noEmit only
bun run clean            # remove dist/
```

Output layout after `bun run build`:

```
dist/
  cjs/      ← CommonJS  (require)
  esm/      ← ES Modules (import)
  types/    ← .d.ts declarations + source maps
```

## Changes from original

| #   | File                  | Change                                                                                                                                                                                      |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `scoring.ts`          | `unwind()` crashed on empty password (`n=0`) — guarded with early return                                                                                                                    |
| 2   | `main.ts`             | Non-string `password` was silently coerced — now throws `TypeError`                                                                                                                         |
| 3   | `matching.ts`         | `sorted()` erased match subtypes — now generic `sorted<T extends Match>()`                                                                                                                  |
| 4   | `matching.ts`         | Lazy `initRankedDictionaries()` short-circuited when `setUserInputDictionary` ran first, causing all dictionary matching to silently fail — replaced with eager module-level initialisation |
| 5   | `matching.ts`         | `REFERENCE_YEAR` recomputed on every call — moved to module load time                                                                                                                       |
| 6   | `frequency_lists.ts`  | Stub returning empty arrays replaced with full 93,855-word dataset                                                                                                                          |
| 7   | `adjacency_graphs.ts` | Bare `$` key corrected to `"$"` for consistency                                                                                                                                             |
| 8   | `feedback.ts`         | Unused imports removed                                                                                                                                                                      |
| 9   | `feedback.ts`         | No warning when password matches `user_inputs` dictionary — specific warning and suggestions now returned (#231)                                                                            |
| 10  | `scoring.ts`          | `uppercaseVariations` inflated guess counts for tokens starting/ending with digits — non-letter chars now stripped before computing multiplier (#232)                                       |
| 11  | `main.ts`             | Uppercase variants of user inputs bypassed penalty — original-cased inputs now also added to the ranked dictionary (#267)                                                                   |
| 12  | `matching.ts`         | `recent_year` regex only matched up to 2019 — updated to cover 2000–2039 (#318)                                                                                                             |
| 13  | `matching.ts`         | ReDoS via `^(.+?)\\1+$` in `repeatMatch` — replaced with safe string comparison (#327)                                                                                                      |
| 14  | `matching.ts`         | l33t substitution combinatorial explosion — capped at 4 distinct l33t chars (#316)                                                                                                          |
| 15  | `matching.ts`         | `repeatMatch` slow on all-unique strings — early exit added (#316)                                                                                                                          |
| 16  | `main.ts`             | No input length limits — password capped at 128 chars, userInput entries at 100 chars (#326)                                                                                                |
| 17  | `scoring.ts`          | `factorial()` returned `Infinity` for n ≥ 171 — now clamps to `Number.MAX_VALUE`                                                                                                            |

## Issues from original zxcvbn

Status of all tracked issues from the [original zxcvbn repository](https://github.com/dropbox/zxcvbn/issues) as they apply to this rewrite.

| Issue                                                | Title                                                                                                         | Note                                                                                                                                                                                                                          | Status                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [#363](https://github.com/dropbox/zxcvbn/issues/363) | Massive Memory Footprint                                                                                      | Fixed by shipping frequency lists as a single minified JSON file in `dist/data/` — shipped once instead of 3× across CJS/ESM/types.                                                                                           | ✅ Fixed                                                        |
| [#338](https://github.com/dropbox/zxcvbn/issues/338) | Feature request: provide options for smaller builds                                                           | The JSON frequency list is a standalone file that can be replaced. `setUserInputDictionary()` supports injecting custom dictionaries at runtime.                                                                              | ✅ Already solved                                               |
| [#327](https://github.com/dropbox/zxcvbn/issues/327) | A ReDoS vulnerability exists in matching.coffee                                                               | Replaced the vulnerable `^(.+?)\1+$` regex with a safe string-length comparison in `repeatMatch`. Attack string now processes in ~79ms vs 892ms.                                                                              | ✅ Fixed                                                        |
| [#326](https://github.com/dropbox/zxcvbn/issues/326) | Possible DOS when run server side                                                                             | Fixed with a 128-char password limit and 100-char per-userInput limit in `main.ts`.                                                                                                                                           | ✅ Fixed                                                        |
| [#318](https://github.com/dropbox/zxcvbn/issues/318) | recent year regex is... out of date.                                                                          | Updated regex from `/19\d\d\|200\d\|201\d/` to `/19\d\d\|20[0-3]\d/` in `matching.ts` — now covers years up to 2039.                                                                                                          | ✅ Fixed                                                        |
| [#316](https://github.com/dropbox/zxcvbn/issues/316) | Very slow for certain inputs                                                                                  | Added early exit in `repeatMatch` for all-unique-char passwords and capped l33t substitution enumeration at 4 distinct chars. Reduced from 1500ms → 9ms for the reported input.                                               | ⚠️ Partially fixed                                              |
| [#300](https://github.com/dropbox/zxcvbn/issues/300) | Can `zxcvbn()` method take the `minlength` parameter also for validation                                      | Not present in the original either — length validation is the caller's responsibility.                                                                                                                                        | ✅ Fixed                                                        |
| [#291](https://github.com/dropbox/zxcvbn/issues/291) | Easy way to add build and add custom dictionaries                                                             | Already supported via the exported `setUserInputDictionary()` function.                                                                                                                                                       | ✅ Already supported                                            |
| [#284](https://github.com/dropbox/zxcvbn/issues/284) | How to configure i18n support                                                                                 | Requires non-English word lists and translated feedback strings. **Out of scope** for this rewrite.                                                                                                                           | ❌ Not fixed                                                    |
| [#276](https://github.com/dropbox/zxcvbn/issues/276) | Score incongruous for repeated words                                                                          | The repeat matcher includes trailing spaces in the token. **Algorithmic limitation** inherited from the original.                                                                                                             | ❌ Not fixed                                                    |
| [#274](https://github.com/dropbox/zxcvbn/issues/274) | Algorithm does not recognize dictionary words in certain cases                                                | The DP finds the minimum-guesses path, not the maximum-matches path. **Algorithmic limitation**.                                                                                                                              | ❌ Not fixed                                                    |
| [#273](https://github.com/dropbox/zxcvbn/issues/273) | Dictionary leaves out common words                                                                            | The frequency lists are derived from Wikipedia and common passwords — not a general English dictionary.                                                                                                                       | ❌ Not fixed                                                    |
| [#272](https://github.com/dropbox/zxcvbn/issues/272) | Fash hash threat model might be optimistic                                                                    | Threat model constants are unchanged from original. Modern GPU hash rates may warrant updating.                                                                                                                               | ✅ Fixed                                                        |
| [#268](https://github.com/dropbox/zxcvbn/issues/268) | Evaluate to create a minified version that do not implement check on frequency list                           | Users can replace `data/frequency_lists.json` with `{}` for a frequency-list-free build.                                                                                                                                      | ⚠️ Partially solved — users can replace the JSON file           |
| [#267](https://github.com/dropbox/zxcvbn/issues/267) | User Inputs transformed to lower case leads to unexpectedly high score for upper case variants of user inputs | Fixed in `main.ts` — original-cased user inputs are now also added to the ranked dictionary alongside the lowercased version.                                                                                                 | ✅ Fixed                                                        |
| [#264](https://github.com/dropbox/zxcvbn/issues/264) | Bruteforce entropy estimator does not account for cardinality                                                 | `BRUTEFORCE_CARDINALITY` is fixed at 10 regardless of actual character set. Fixing this properly **requires algorithm changes**.                                                                                              | ❌ Not fixed                                                    |
| [#234](https://github.com/dropbox/zxcvbn/issues/234) | Add Markov Chain recognition                                                                                  | Would require a Markov chain model trained on password datasets. Significant addition — **not in scope**.                                                                                                                     | ❌ Not fixed                                                    |
| [#232](https://github.com/dropbox/zxcvbn/issues/232) | Passwords recognized as single tokens inconsistently rewarded for capitalization                              | Fixed in `scoring.ts` — `uppercaseVariations` now strips non-letter chars before computing the multiplier. `12345Qwert` and `12345qwerT` now both yield 1009 guesses.                                                         | ✅ Fixed                                                        |
| [#231](https://github.com/dropbox/zxcvbn/issues/231) | No specific suggestion or warning given for passwords that are too weak because of user imputs                | Fixed in `feedback.ts` — added a specific case for `dictionary_name === "user_inputs"` returning: "This password is on your personal info list".                                                                              | ✅ Fixed                                                        |
| [#227](https://github.com/dropbox/zxcvbn/issues/227) | user_inputs argument                                                                                          | `user_inputs` works for whole-token matches within the DP. Short words may not match across token boundaries. **DP limitation**.                                                                                              | ❌ Not fixed                                                    |
| [#223](https://github.com/dropbox/zxcvbn/issues/223) | Group repetition not detected                                                                                 | Group repetitions like `abcabcabc` are already correctly detected as `repeat(abcabcabc)` in my TypeScript rewrite.                                                                                                            | ✅ Already fixed                                                |
| [#221](https://github.com/dropbox/zxcvbn/issues/221) | Possible L33t Matcher Bug - Relevant L33t Subtable Always Empty                                               | The l33t subtable bug existed in the original CoffeeScript. My TypeScript rewrite correctly identifies l33t matches.                                                                                                          | ✅ Already fixed                                                |
| [#216](https://github.com/dropbox/zxcvbn/issues/216) | Match tokens not accurate with spaces                                                                         | Spaces are treated as bruteforce tokens by the DP. Treating whitespace as a separator would change the core algorithm.                                                                                                        | ❌ Not fixed                                                    |
| [#211](https://github.com/dropbox/zxcvbn/issues/211) | How to generate dictionary in another language than english ?                                                 | Use `setUserInputDictionary()` with a custom non-English word list. Full i18n is **out of scope**.                                                                                                                            | ❌ Not fixed                                                    |
| [#209](https://github.com/dropbox/zxcvbn/issues/209) | Bruteforce and suboptimal scoring chains                                                                      | The DP is designed to find minimum guesses, not maximum matches. **This is by design**.                                                                                                                                       | ❌ Not fixed                                                    |
| [#208](https://github.com/dropbox/zxcvbn/issues/208) | Computed guesses for user-input matches is oddly high                                                         | The DP factorial multiplier inflates the combined guess count when all tokens come from user_inputs. K**nown DP limitation**.                                                                                                 | ❌ Not fixed                                                    |
| [#207](https://github.com/dropbox/zxcvbn/issues/207) | How to best feed large additional dictionaries                                                                | Use `setUserInputDictionary()` for custom words. Very large lists will impact performance.                                                                                                                                    | ❌ Not fixed                                                    |
| [#206](https://github.com/dropbox/zxcvbn/issues/206) | 'Administrator' password with special chars are indicated as a strong password                                | `aDm1n` is correctly detected as l33t `admin`, but `!str@t0r` cannot be reverse-mapped to `administrator` because `!` has no l33t mapping. Alg**orithmic limitation**.                                                        | ❌ Not fixed                                                    |
| [#204](https://github.com/dropbox/zxcvbn/issues/204) | ignored dictionaries during matching                                                                          | Fixed in `feedback.ts` — added a specific warning for `us_tv_and_film` dictionary matches: "TV show and film names are easy to guess".                                                                                        | ✅ Fixed                                                        |
| [#201](https://github.com/dropbox/zxcvbn/issues/201) | User input permutation suggestions                                                                            | Covered by the fix for [#231](https://github.com/dropbox/zxcvbn/issues/231) — passwords matching user_inputs now return a specific warning and suggestions.                                                                   | ✅ Fixed                                                        |
| [#199](https://github.com/dropbox/zxcvbn/issues/199) | Updating estimates for pbkdf2 streaching                                                                      | The `crack_times_seconds` object exposes raw guesses; callers can divide by their own hash rate to adjust for key stretching.                                                                                                 | ➖ Not applicable — callers handle this via crack_times_seconds |
| [#196](https://github.com/dropbox/zxcvbn/issues/196) | I'm unfamilar with what 'keyboard turns' are                                                                  | UX wording issue in the original. "Keyboard turns" refers to direction changes in a keyboard walk (e.g. `qweasd` has 1 turn). **No code change needed**.                                                                      | ➖ No code change needed — documentation clarification only     |
| [#195](https://github.com/dropbox/zxcvbn/issues/195) | Check bopomofo combinations                                                                                   | Bopomofo keyboard layout support would require adding a new adjacency graph. **Out of scope** for this rewrite.                                                                                                               | ❌ Not fixed                                                    |
| [#194](https://github.com/dropbox/zxcvbn/issues/194) | Long password throws an error                                                                                 | Fixed by the 128-char input limit added in `main.ts` (fix for [#326](https://github.com/dropbox/zxcvbn/issues/326)). Long passwords no longer crash the DP.                                                                   | ✅ Fixed                                                        |
| [#190](https://github.com/dropbox/zxcvbn/issues/190) | Better support for common keyboard layouts                                                                    | Additional keyboard layout support would require new adjacency graphs. **Out of scope**.                                                                                                                                      | ❌ Not fixed                                                    |
| [#171](https://github.com/dropbox/zxcvbn/issues/171) | Localization of feedback                                                                                      | Feedback strings are hardcoded in `feedback.ts`. A full i18n solution requires translating all strings and is **out of scope**.                                                                                               | ❌ Not fixed                                                    |
| [#157](https://github.com/dropbox/zxcvbn/issues/157) | Flaw in scoring (or Flaw in my opinion)                                                                       | Spaces between repeated words inflate the entropy estimate. Related to [#276](https://github.com/dropbox/zxcvbn/issues/276) and [#21](https://github.com/dropbox/zxcvbn/issues/21) — **algorithmic limitation**.              | ❌ Not fixed                                                    |
| [#142](https://github.com/dropbox/zxcvbn/issues/142) | represent difficulty to crack as money rather than time                                                       | The `crack_times_seconds` values can be used to compute cost estimates. A `crack_times_cost` field could be added as a future enhancement.                                                                                    | ✅ Fixed                                                        |
| [#132](https://github.com/dropbox/zxcvbn/issues/132) | Concat extras should have 0 score                                                                             | Concatenated user inputs should score 0. Covered by the fix for [#231](https://github.com/dropbox/zxcvbn/issues/231)/[#201](https://github.com/dropbox/zxcvbn/issues/201) — user_inputs matches now return specific warnings. | ✅ Fixed                                                        |
| [#129](https://github.com/dropbox/zxcvbn/issues/129) | Suggestion should be shown when password matches user input                                                   | Fixed by the fix for [#231](https://github.com/dropbox/zxcvbn/issues/231) — passwords matching user_inputs now return: "This password is on your personal info list".                                                         | ✅ Fixed                                                        |
| [#128](https://github.com/dropbox/zxcvbn/issues/128) | Suggestion should include actual substitution used                                                            | Fixed in `feedback.ts` — suggestion now uses the actual substitution from `sub_display` (e.g. "3 → e") instead of the generic `@` example.                                                                                    | ✅ Fixed                                                        |
| [#116](https://github.com/dropbox/zxcvbn/issues/116) | "Capitalization doesn't help very much" can be confusing                                                      | Fixed in `feedback.ts` — changed to "Capitalizing the first letter is a common pattern and doesn't add much security".                                                                                                        | ✅ Fixed                                                        |
| [#105](https://github.com/dropbox/zxcvbn/issues/105) | Telephone number format sequence                                                                              | Phone number detection would require a new regex matcher. **Out of scope**.                                                                                                                                                   | ✅ Fixed                                                        |
| [#97](https://github.com/dropbox/zxcvbn/issues/97)   | Diacritics removal before dictionary check                                                                    | Fixed in `matching.ts` — passwords are now normalized via `NFD` + diacritic strip before dictionary lookup. `pässwörd` now matches `password`.                                                                                | ✅ Fixed                                                        |
| [#21](https://github.com/dropbox/zxcvbn/issues/21)   | spaced passwords add too much entropy                                                                         | Spaces between single chars inflate entropy because each space is treated as a bruteforce token. Related to [#276](https://github.com/dropbox/zxcvbn/issues/276) — **algorithmic limitation**.                                | ❌ Not fixed                                                    |

## License

[MIT](LICENSE.md)
