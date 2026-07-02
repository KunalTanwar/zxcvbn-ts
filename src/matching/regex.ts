import { RegexMatch } from "../types.js"
import { REGEXES, sorted } from "./shared.js"

export function regexMatch(password: string, regexes: Record<string, RegExp> = REGEXES): RegexMatch[] {
    const matches: RegexMatch[] = []

    for (const [name, rx] of Object.entries(regexes)) {
        rx.lastIndex = 0
        let rxMatch: RegExpExecArray | null

        while ((rxMatch = rx.exec(password)) !== null) {
            const token = rxMatch[0]

            matches.push({
                pattern: "regex",
                token,
                i: rxMatch.index,
                j: rxMatch.index + token.length - 1,
                regex_name: name,
                regex_match: rxMatch,
            })
        }
    }

    return sorted(matches)
}
