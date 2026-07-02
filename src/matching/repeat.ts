import { mostGuessableMatchSequence } from "../scoring.js"
import type { RepeatMatch } from "../types.js"
import { omnimatch } from "./index.js"

export function repeatMatch(password: string): RepeatMatch[] {
    const matches: RepeatMatch[] = []

    const charSet = new Set(password)

    if (charSet.size === password.length) {
        return matches
    }

    const greedy = /(.+)\1+/g
    const lazy = /(.+?)\1+/g

    const safeGetBaseToken = (token: string, lazyBase: string): string => {
        for (let length = lazyBase.length; length <= token.length / 2; length++) {
            const candidate = token.slice(0, length)

            if (candidate.length > 0 && token === candidate.repeat(token.length / candidate.length)) {
                return candidate
            }
        }

        return lazyBase
    }

    let lastIndex = 0

    while (lastIndex < password.length) {
        greedy.lastIndex = lastIndex
        lazy.lastIndex = lastIndex

        const greedyMatch = greedy.exec(password)
        const lazyMatch = lazy.exec(password)

        if (!greedyMatch) {
            break
        }

        let match: RegExpExecArray
        let baseToken: string

        if (greedyMatch[0].length > lazyMatch![0].length) {
            match = greedyMatch

            baseToken = safeGetBaseToken(match[0], lazyMatch![1])
        } else {
            match = lazyMatch!
            baseToken = match[1]
        }

        const i = match.index
        const j = match.index + match[0].length - 1

        const baseAnalysis = mostGuessableMatchSequence(baseToken, omnimatch(baseToken))

        matches.push({
            pattern: "repeat",
            i,
            j,
            token: match[0],
            base_token: baseToken,
            base_guesses: baseAnalysis.guesses,
            base_matches: baseAnalysis.sequence,
            repeat_count: match[0].length / baseToken.length,
        })

        lastIndex = j + 1
    }

    return matches
}
