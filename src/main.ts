// ============================================================
// zxcvbn-ts — Main entry point
// ============================================================

import { setUserInputDictionary, omnimatch } from "./matching"
import { mostGuessableMatchSequence } from "./scoring"
import { estimateAttackTimes } from "./time_estimates"
import { getFeedback } from "./feedback"
import type { ZxcvbnResult } from "./types"

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
 * @example
 * ```ts
 * import zxcvbn from "zxcvbn-ts";
 *
 * const result = zxcvbn("correcthorsebatterystaple", ["Alice"]);
 * console.log(result.score);          // 3
 * console.log(result.guesses);        // ~10^14
 * console.log(result.feedback);       // { warning: "", suggestions: [] }
 * ```
 */
export function zxcvbn(password: string, userInputs: Array<string | number | boolean> = []): ZxcvbnResult {
    // ---- Input validation ---------------------------------------------------
    if (typeof password !== "string") {
        throw new TypeError(`zxcvbn: password must be a string, got ${typeof password}`)
    }

    const start = Date.now()

    // ---- Sanitise user inputs -----------------------------------------------
    // Accept strings, numbers, and booleans; coerce to lowercase strings.
    const sanitizedInputs: string[] = []
    for (const arg of userInputs) {
        if (typeof arg === "string" || typeof arg === "number" || typeof arg === "boolean") {
            sanitizedInputs.push(String(arg).toLowerCase())
        }
    }

    // Inject user inputs as a per-request ranked dictionary so state is stateless
    setUserInputDictionary(sanitizedInputs)

    // ---- Run all matchers ---------------------------------------------------
    const matches = omnimatch(password)

    // ---- Find the optimal (minimum-guesses) match sequence ------------------
    const result = mostGuessableMatchSequence(password, matches)

    // ---- Estimate crack times -----------------------------------------------
    const attackTimes = estimateAttackTimes(result.guesses)

    // ---- Generate feedback --------------------------------------------------
    const feedback = getFeedback(attackTimes.score, result.sequence)

    return {
        ...result,
        ...attackTimes,
        feedback,
        calc_time: Date.now() - start,
    }
}

export default zxcvbn
