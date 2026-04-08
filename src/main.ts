import { setUserInputDictionary, omnimatch } from "./matching"
import { mostGuessableMatchSequence } from "./scoring"
import { estimateAttackTimes } from "./time_estimates"
import { getFeedback } from "./feedback"

import type { ZxcvbnOptions, ZxcvbnResult } from "./types"

/**
 * Estimate the strength of `password`.
 *
 * @param password    The password to evaluate.
 * @param userInputs  Optional list of user-specific words (name, email, etc.)
 *                    to penalise when found in the password. Accepts strings,
 *                    numbers, and booleans.
 * @returns           A {@link ZxcvbnResult} with guesses, crack-time estimates,
 *                    a 0–4 score, and actionable feedback.
 *
 * @param options     Optional settings - currently supports `minLength`
 *
 * @example
 * ```ts
 * import zxcvbn from "zxcvbn-ts";
 *
 * const result = zxcvbn("correcthorsebatterystaple", ["Alice"]);
 * console.log(result.score);          // 3
 * console.log(result.guesses);        // ~10^14
 * console.log(result.feedback);       // { warning: "", suggestions: [] }
 *
 * // with minLength
 * const short = zxcvbn("abc", [], { minLength: 8 });
 * console.log(short.score)
 * ```
 */
export function zxcvbn(
    password: string,
    userInputs: Array<string | number | boolean> = [],
    options: ZxcvbnOptions = {},
): ZxcvbnResult {
    if (typeof password !== "string") {
        throw new TypeError(`zxcvbn: password must be a string, got ${typeof password}`)
    }

    if (password.length > 128) {
        password = password.slice(0, 128)
    }

    const start = Date.now()

    const sanitizedInputs: string[] = []

    for (const arg of userInputs) {
        if (typeof arg === "string" || typeof arg === "number" || typeof arg === "boolean") {
            const s = String(arg).toLowerCase()

            if (s.length <= 100) {
                sanitizedInputs.push(s)

                const original = String(arg)

                if (original !== s && original.length <= 100) {
                    sanitizedInputs.push(original)
                }
            }
        }
    }

    setUserInputDictionary(sanitizedInputs)

    const matches = omnimatch(password)

    const result = mostGuessableMatchSequence(password, matches)

    const attackTimes = estimateAttackTimes(result.guesses, options.customHashesPerSecond)

    let feedback = getFeedback(attackTimes.score, result.sequence)

    if (typeof options.minLength === "number" && password.length < options.minLength) {
        feedback = {
            warning: feedback.warning,
            suggestions: [`Password must be at least ${options.minLength} characters`, ...feedback.suggestions],
        }

        return {
            ...result,
            ...attackTimes,
            score: 0,
            feedback,
            calc_time: Date.now() - start,
        }
    }

    return {
        ...result,
        ...attackTimes,
        feedback,
        calc_time: Date.now() - start,
    }
}

export default zxcvbn
