import { EmailMatch } from "../types.js"
import { sorted } from "./shared.js"

const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

export function emailMatch(password: string): EmailMatch[] {
    const matches: EmailMatch[] = []

    EMAIL_PATTERN.lastIndex = 0

    let match: RegExpExecArray | null

    while ((match = EMAIL_PATTERN.exec(password)) !== null) {
        const token = match[0]

        const atIndex = token.indexOf("@")
        const local = token.slice(0, atIndex)

        const domain = token.slice(atIndex + 1)

        const dotIndex = domain.lastIndexOf(".")
        const tld = dotIndex >= 0 ? domain.slice(dotIndex + 1) : ""

        matches.push({
            pattern: "email",
            i: match.index,
            j: match.index + token.length - 1,
            token,
            local,
            domain,
            tld,
        })
    }

    return sorted(matches)
}
