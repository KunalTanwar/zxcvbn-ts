import { zxcvbn } from "./main"
import type { ZxcvbnResult, Match } from "./types"

// ============================================================
// Public types
// ============================================================

export interface AIFeedback {
    warning: string
    suggestions: string[]
    // Plain-English explanation of why the password is weak or strong.
    explanation: string
}

export interface ZxcvbnAIResult extends ZxcvbnResult {
    feedback: AIFeedback
}

/**
 * A provider is anything with a complete(system, user) method
 * that returns the raw text response from the model.
 */
export interface AIProvider {
    complete(systemPrompt: string, userPrompt: string): Promise<string>
}

export interface ZxcvbnAIOptions {
    /**
     * The AI provider to use. Use one of the built-in helpers:
     *   anthropic(), openai(), gemini()
     * or supply a custom adapter with a complete() method.
     *
     * Falls back to anthropic() using ANTHROPIC_API_KEY env var if omitted.
     */
    provider?: AIProvider
}

// ============================================================
// Built-in providers
// ============================================================

export interface AnthropicOptions {
    // Falls back to ANTHROPIC_API_KEY env var.
    apiKey?: string
    // Defaults to claude-haiku-4-5-20251001.
    model?: string
    // Defaults to 300.
    maxTokens?: number
}

// Built-in Anthropic (Claude) provider.
export function anthropic(options: AnthropicOptions = {}): AIProvider {
    return {
        async complete(systemPrompt, userPrompt) {
            const apiKey =
                options.apiKey ??
                (typeof process !== "undefined"
                    ? process.env.ANTHROPIC_API_KEY
                    : undefined)

            if (!apiKey) {
                throw new Error(
                    "zxcvbnAI: no Anthropic API key. Pass { apiKey } to anthropic() or set ANTHROPIC_API_KEY.",
                )
            }

            const response = await fetch(
                "https://api.anthropic.com/v1/messages",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": apiKey,
                        "anthropic-version": "2023-06-01",
                    },
                    body: JSON.stringify({
                        model: options.model ?? "claude-haiku-4-5-20251001",
                        max_tokens: options.maxTokens ?? 300,
                        system: systemPrompt,
                        messages: [{ role: "user", content: userPrompt }],
                    }),
                },
            )

            if (!response.ok) {
                const err = await response.text()
                throw new Error(
                    `zxcvbnAI: Anthropic API error ${response.status}: ${err}`,
                )
            }

            const data = (await response.json()) as {
                content: Array<{ type: string; text: string }>
            }

            return data.content.find((b) => b.type === "text")?.text ?? "{}"
        },
    }
}

export interface OpenAIOptions {
    // Falls back to OPENAI_API_KEY env var.
    apiKey?: string
    // Defaults to gpt-4o-mini.
    model?: string
    // Defaults to 300.
    maxTokens?: number
}

// Built-in OpenAI (ChatGPT) provider.
export function openai(options: OpenAIOptions = {}): AIProvider {
    return {
        async complete(systemPrompt, userPrompt) {
            const apiKey =
                options.apiKey ??
                (typeof process !== "undefined"
                    ? process.env.OPENAI_API_KEY
                    : undefined)

            if (!apiKey) {
                throw new Error(
                    "zxcvbnAI: no OpenAI API key. Pass { apiKey } to openai() or set OPENAI_API_KEY.",
                )
            }

            const response = await fetch(
                "https://api.openai.com/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: options.model ?? "gpt-4o-mini",
                        max_tokens: options.maxTokens ?? 300,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt },
                        ],
                    }),
                },
            )

            if (!response.ok) {
                const err = await response.text()
                throw new Error(
                    `zxcvbnAI: OpenAI API error ${response.status}: ${err}`,
                )
            }

            const data = (await response.json()) as {
                choices: Array<{ message: { content: string } }>
            }

            return data.choices[0]?.message?.content ?? "{}"
        },
    }
}

export interface GeminiOptions {
    // Falls back to GEMINI_API_KEY env var.
    apiKey?: string
    // Defaults to gemini-1.5-flash.
    model?: string
    // Defaults to 300.
    maxTokens?: number
}

// Built-in Google Gemini provider.
export function gemini(options: GeminiOptions = {}): AIProvider {
    return {
        async complete(systemPrompt, userPrompt) {
            const apiKey =
                options.apiKey ??
                (typeof process !== "undefined"
                    ? process.env.GEMINI_API_KEY
                    : undefined)

            if (!apiKey) {
                throw new Error(
                    "zxcvbnAI: no Gemini API key. Pass { apiKey } to gemini() or set GEMINI_API_KEY.",
                )
            }

            const model = options.model ?? "gemini-1.5-flash"
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ parts: [{ text: userPrompt }] }],
                    generationConfig: {
                        maxOutputTokens: options.maxTokens ?? 300,
                    },
                }),
            })

            if (!response.ok) {
                const err = await response.text()

                throw new Error(
                    `zxcvbnAI: Gemini API error ${response.status}: ${err}`,
                )
            }

            const data = (await response.json()) as {
                candidates: Array<{
                    content: { parts: Array<{ text: string }> }
                }>
            }

            return data.candidates[0]?.content?.parts[0]?.text ?? "{}"
        },
    }
}

// ============================================================
// Shared prompt
// ============================================================

function describeSequence(sequence: Match[]): string {
    return sequence
        .map((m) => {
            switch (m.pattern) {
                case "dictionary":
                    return `"${m.token}" is a common ${m.dictionary_name.replace(/_/g, " ")} word (rank #${m.rank}${m.reversed ? ", used reversed" : ""}${m.l33t ? ", with l33t substitutions" : ""})`
                case "spatial":
                    return `"${m.token}" is a keyboard pattern on ${m.graph} (${m.turns} turn${m.turns === 1 ? "" : "s"})`
                case "repeat":
                    return `"${m.token}" is "${m.base_token}" repeated ${m.repeat_count} times`
                case "sequence":
                    return `"${m.token}" is a ${m.sequence_name} sequence (${m.ascending ? "ascending" : "descending"})`
                case "regex":
                    return `"${m.token}" matches a predictable pattern (${m.regex_name.replace(/_/g, " ")})`
                case "date":
                    return `"${m.token}" looks like a date (${m.year}-${m.month}-${m.day})`
                case "bruteforce":
                    return `"${m.token}" has no recognisable pattern`
            }
        })
        .join("; ")
}

const SYSTEM_PROMPT = `You are a password security advisor. You will be given structured analysis of a password and must return a JSON object with exactly three fields:
- "warning": a single short sentence (max 15 words) naming the main weakness, or empty string if strong
- "suggestions": an array of 1-3 short actionable tips (max 12 words each)
- "explanation": 2-3 sentences explaining why this password is weak or strong in plain English

Be direct, specific to the actual password weakness, and never repeat the password back to the user.
Respond with raw JSON only — no markdown, no backticks, no preamble.`

// ============================================================
// Main export
// ============================================================

/**
 * Evaluate a password with AI-powered feedback.
 *
 * @param password    The password to evaluate.
 * @param options     Provider and optional overrides.
 * @param userInputs  Optional user-specific words to penalise.
 *
 * @example
 * ```ts
 * import { zxcvbnAI, anthropic, openai, gemini } from "zxcvbn-ts/ai";
 *
 * // Anthropic (default)
 * await zxcvbnAI("password123", { provider: anthropic({ apiKey: "sk-ant-..." }) });
 *
 * // OpenAI
 * await zxcvbnAI("password123", { provider: openai({ apiKey: "sk-..." }) });
 *
 * // Gemini
 * await zxcvbnAI("password123", { provider: gemini({ apiKey: "..." }) });
 *
 * // Custom adapter (Ollama, Mistral, etc.)
 * await zxcvbnAI("password123", {
 *   provider: {
 *     complete: async (system, user) => {
 *       const res = await myLLM.chat({ system, user });
 *       return res.text;
 *     }
 *   }
 * });
 * ```
 */
export async function zxcvbnAI(
    password: string,
    options: ZxcvbnAIOptions = {},
    userInputs: Array<string | number | boolean> = [],
): Promise<ZxcvbnAIResult> {
    const provider = options.provider ?? anthropic()
    const base = zxcvbn(password, userInputs)

    const userPrompt = [
        `Password length: ${password.length} characters`,
        `Strength score: ${base.score}/4`,
        `Estimated guesses: ${base.guesses_log10.toFixed(1)} (log10)`,
        `Pattern analysis: ${describeSequence(base.sequence)}`,
        `Crack time (offline fast attack): ${base.crack_times_display.offline_fast_hashing_1e10_per_second}`,
        ``,
        `Provide feedback for this password.`,
    ].join("\n")

    const raw = await provider.complete(SYSTEM_PROMPT, userPrompt)

    let aiFeedback: AIFeedback

    try {
        const parsed = JSON.parse(raw) as Partial<AIFeedback>
        aiFeedback = {
            warning: parsed.warning ?? base.feedback.warning,
            suggestions: parsed.suggestions ?? [...base.feedback.suggestions],
            explanation: parsed.explanation ?? "",
        }
    } catch {
        aiFeedback = {
            warning: base.feedback.warning,
            suggestions: [...base.feedback.suggestions],
            explanation: "",
        }
    }

    return { ...base, feedback: aiFeedback }
}
