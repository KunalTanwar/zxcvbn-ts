// ============================================================
// zxcvbn-ts — Feedback
// ============================================================

import { START_UPPER, ALL_UPPER } from "./scoring"
import type { Match, Feedback, DictionaryMatch, SpatialMatch, RepeatMatch, RegexMatch } from "./types"

const DEFAULT_FEEDBACK: Feedback = {
    warning: "",
    suggestions: ["Use a few words, avoid common phrases", "No need for symbols, digits, or uppercase letters"],
}

export function getFeedback(score: number, sequence: Match[]): Feedback {
    if (sequence.length === 0) return DEFAULT_FEEDBACK

    if (score > 2) {
        return { warning: "", suggestions: [] }
    }

    // Tie feedback to the longest match for sequences with multiple matches
    let longestMatch = sequence[0]
    for (const match of sequence.slice(1)) {
        if (match.token.length > longestMatch.token.length) {
            longestMatch = match
        }
    }

    const feedback = getMatchFeedback(longestMatch, sequence.length === 1)
    const extraFeedback = "Add another word or two. Uncommon words are better."

    if (feedback !== null) {
        return {
            warning: feedback.warning ?? "",
            suggestions: [extraFeedback, ...feedback.suggestions],
        }
    }
    return {
        warning: "",
        suggestions: [extraFeedback],
    }
}

function getMatchFeedback(match: Match, isSoleMatch: boolean): Feedback | null {
    switch (match.pattern) {
        case "dictionary":
            return getDictionaryMatchFeedback(match, isSoleMatch)

        case "spatial": {
            const sm = match as SpatialMatch
            const warning =
                sm.turns === 1 ? "Straight rows of keys are easy to guess" : "Short keyboard patterns are easy to guess"
            return {
                warning,
                suggestions: ["Use a longer keyboard pattern with more turns"],
            }
        }

        case "repeat": {
            const rm = match as RepeatMatch
            const warning =
                rm.base_token.length === 1
                    ? 'Repeats like "aaa" are easy to guess'
                    : 'Repeats like "abcabcabc" are only slightly harder to guess than "abc"'
            return {
                warning,
                suggestions: ["Avoid repeated words and characters"],
            }
        }

        case "sequence":
            return {
                warning: "Sequences like abc or 6543 are easy to guess",
                suggestions: ["Avoid sequences"],
            }

        case "regex": {
            const rxm = match as RegexMatch
            if (rxm.regex_name === "recent_year") {
                return {
                    warning: "Recent years are easy to guess",
                    suggestions: ["Avoid recent years", "Avoid years that are associated with you"],
                }
            }
            return null
        }

        case "date":
            return {
                warning: "Dates are often easy to guess",
                suggestions: ["Avoid dates and years that are associated with you"],
            }

        default:
            return null
    }
}

function getDictionaryMatchFeedback(match: DictionaryMatch, isSoleMatch: boolean): Feedback {
    let warning = ""

    if (match.dictionary_name === "passwords") {
        if (isSoleMatch && !match.l33t && !match.reversed) {
            if (match.rank <= 10) {
                warning = "This is a top-10 common password"
            } else if (match.rank <= 100) {
                warning = "This is a top-100 common password"
            } else {
                warning = "This is a very common password"
            }
        } else if ((match.guesses_log10 ?? 0) <= 4) {
            warning = "This is similar to a commonly used password"
        }
    } else if (match.dictionary_name === "english_wikipedia") {
        if (isSoleMatch) {
            warning = "A word by itself is easy to guess"
        }
    } else if (["surnames", "male_names", "female_names"].includes(match.dictionary_name)) {
        if (isSoleMatch) {
            warning = "Names and surnames by themselves are easy to guess"
        } else {
            warning = "Common names and surnames are easy to guess"
        }
    }

    const suggestions: string[] = []
    const word = match.token

    if (START_UPPER.test(word)) {
        suggestions.push("Capitalization doesn't help very much")
    } else if (ALL_UPPER.test(word) && word.toLowerCase() !== word) {
        suggestions.push("All-uppercase is almost as easy to guess as all-lowercase")
    }

    if (match.reversed && match.token.length >= 4) {
        suggestions.push("Reversed words aren't much harder to guess")
    }
    if (match.l33t) {
        suggestions.push("Predictable substitutions like '@' instead of 'a' don't help very much")
    }

    return { warning, suggestions }
}
