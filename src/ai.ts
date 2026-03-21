import { zxcvbn } from "./main"
import type { ZxcvbnResult, Match } from "./types"

export interface AIFeedback {
    warning: string
    suggestions: string[]
    /** The raw explanation from the AI — more detailed than warning/suggestions. */
    explanation: string
}

export interface ZxcvbnAIResult extends ZxcvbnResult {
    feedback: AIFeedback
}

export interface ZxcvbnAIOptions {
    /** Your Anthropic API key. Falls back to ANTHROPIC_API_KEY env var. */
    apiKey?: string
    /** Override the model. Defaults to claude-haiku-3-5 for speed and low cost. */
    model?: string
    /** Max tokens for the AI response. Defaults to 300. */
    maxTokens?: number
}

/** Serialize the match sequence into a concise description for the prompt. */
function describeSequence(_password: string, sequence: Match[]): string {
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

/**
 * Evaluate a password with AI-powered feedback.
 *
 * @param password    The password to evaluate.
 * @param options     API key and optional overrides.
 * @param userInputs  Optional user-specific words to penalise.
 *
 * @example
 * ```ts
 * import { zxcvbnAI } from "zxcvbn-ts/ai";
 *
 * const result = await zxcvbnAI("password123", { apiKey: "sk-ant-..." });
 * console.log(result.feedback.explanation);
 * // "Your password combines a top-10 common password with a predictable
 * //  number suffix. Attackers specifically try these combinations first.
 * //  A passphrase of 4+ random words would be far more secure."
 * ```
 */
export async function zxcvbnAI(
    password: string,
    options: ZxcvbnAIOptions = {},
    userInputs: Array<string | number | boolean> = [],
): Promise<ZxcvbnAIResult> {
    const apiKey = options.apiKey ?? (typeof process !== "undefined" ? process.env.ANTHROPIC_API_KEY : undefined)

    if (!apiKey) {
        throw new Error("zxcvbnAI: no API key provided. Pass { apiKey: '...' } or set ANTHROPIC_API_KEY.")
    }

    // Run the core estimator first
    const base = zxcvbn(password, userInputs)

    // Build a prompt that gives the AI the structured analysis
    const sequenceDesc = describeSequence(password, base.sequence)
    const userPrompt = [
        `Password length: ${password.length} characters`,
        `Strength score: ${base.score}/4`,
        `Estimated guesses: ${base.guesses_log10.toFixed(1)} (log10)`,
        `Pattern analysis: ${sequenceDesc}`,
        `Crack time (offline fast attack): ${base.crack_times_display.offline_fast_hashing_1e10_per_second}`,
        ``,
        `Provide feedback for this password.`,
    ].join("\n")

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: options.model ?? "claude-haiku-4-5-20251001",
            max_tokens: options.maxTokens ?? 300,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
        }),
    })

    if (!response.ok) {
        const err = await response.text()
        throw new Error(`zxcvbnAI: Anthropic API error ${response.status}: ${err}`)
    }

    const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>
    }

    const raw = data.content.find((b) => b.type === "text")?.text ?? "{}"

    let aiFeedback: AIFeedback
    try {
        const parsed = JSON.parse(raw) as Partial<AIFeedback>
        aiFeedback = {
            warning: parsed.warning ?? base.feedback.warning,
            suggestions: parsed.suggestions ?? [...base.feedback.suggestions],
            explanation: parsed.explanation ?? "",
        }
    } catch {
        // Fallback to base feedback if parsing fails
        aiFeedback = {
            warning: base.feedback.warning,
            suggestions: [...base.feedback.suggestions],
            explanation: "",
        }
    }

    return {
        ...base,
        feedback: aiFeedback,
    }
}
