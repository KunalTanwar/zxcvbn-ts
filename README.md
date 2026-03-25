# zxcvbn-ts

[![npm version](https://img.shields.io/npm/v/zxcvbn-ts)](https://www.npmjs.com/package/zxcvbn-ts)
[![bundle size](https://img.shields.io/bundlephobia/minzip/zxcvbn-ts)](https://bundlephobia.com/package/zxcvbn-ts)
[![license](https://img.shields.io/npm/l/zxcvbn-ts)](./LICENSE)
[![npm downloads](https://img.shields.io/npm/dm/zxcvbn-ts)](https://www.npmjs.com/package/zxcvbn-ts)

A complete TypeScript rewrite of Dropbox's [zxcvbn](https://github.com/dropbox/zxcvbn) password strength estimator — with strict types, dual CJS/ESM output, and a fully populated dictionary set.

## Features

- **Full TypeScript** — strict mode, discriminated-union `Match` type, exhaustive type narrowing
- **Dual CJS/ESM Output** — works in Node.js, bundlers, and modern browsers
- **Populated Dictionaries** — all 93,855 words across 6 frequency lists included out of the box
- **Optional AI Feedback** — personalised explanations via Claude, ChatGPT, Gemini, or any custom adapter
- **Zero Runtime Dependencies** for the core library
- **Bun-native** — uses `bun test` and `bun run` throughout
- **Bug Fixes** over the original CoffeeScript source (see [Changes from original](#changes-from-original))
- **Same Algorithm** — results are numerically identical to the original library

## Installation

```bash
bun add zxcvbn-ts
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
console.log(result.crack_times_display.offline_fast_hashing_1e10_per_second)
// "centuries"
```

### With user-specific inputs

Pass words the attacker is likely to try first (name, email address, username, …):

```ts
const result = zxcvbn("alice1990", ["alice", "alice@example.com"])
// guess count is reduced when the password contains user-supplied words
```

## AI-powered Feedback

The core `zxcvbn()` function is synchronous and has zero dependencies. If you want richer, personalised feedback you can optionally use `zxcvbnAI()`, which runs the same analysis and then sends the structured result to Claude for a human-readable explanation.

Supports **Anthropic (Claude)**, **OpenAI (ChatGPT)**, **Google (Gemini)**, and any **custom adapter**.

### Setup

Get an API key from your preferred provider:

- Anthropic: [console.anthropic.com](https://console.anthropic.com)
- OpenAI: [platform.openai.com](https://platform.openai.com)
- Gemini: [aistudio.google.com](https://aistudio.google.com)

Add it your environment.

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
| `options`    | `ZxcvbnAIOptions`                    | `{}`    | API key and model overrides.            |
| `userInputs` | `Array<string \| number \| boolean>` | `[]`    | User-specific words to penalise.        |

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
    /** Actionable feedback for the user. */
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
    optimization: string // Plain-English explanation of the weakness
}
```

### `CrackTimesSeconds` / `CrackTimesDisplay`

Four attack scenarios, available as both raw seconds and human-readable strings:

| Key                                    | Scenario                                   |
| -------------------------------------- | ------------------------------------------ |
| `online_throttling_100_per_hour`       | Throttled online attack (100 guesses/hour) |
| `online_no_throttling_10_per_second`   | Unthrottled online attack (10/s)           |
| `offline_slow_hashing_1e4_per_second`  | Offline, slow hash e.g. bcrypt (10k/s)     |
| `offline_fast_hashing_1e10_per_second` | Offline, fast hash e.g. MD5 (10B/s)        |

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

## License

[MIT](LICENSE.md)
