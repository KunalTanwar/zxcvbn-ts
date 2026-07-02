import { PhoneMatch } from "../types.js"
import { sorted } from "./shared.js"

const PHONE_PATTERNS: Array<{
    name: string
    rx: RegExp
    digits: number
}> = [
    {
        name: "nanp",
        rx: /(?:\+?1[-. ]?)?(?:\(?\d{3}\)?[-. ]?)\d{3}[-. ]?\d{4}/g,
        digits: 10,
    },
    {
        name: "international",
        rx: /\+(?:\d{1,3})[-. ]?(?:\d[-. ]?){6,12}\d/g,
        digits: 8,
    },
    {
        name: "local",
        rx: /\b\d{3}[-. ]\d{4}\b/g,
        digits: 7,
    },
]

function extractDigits(str: string): string {
    return str.replace(/\D/g, "")
}

export function phoneMatch(password: string): PhoneMatch[] {
    const matches: PhoneMatch[] = []

    for (const { name, rx, digits } of PHONE_PATTERNS) {
        rx.lastIndex = 0

        let match: RegExpExecArray | null

        while ((match = rx.exec(password)) !== null) {
            const token = match[0]
            const phoneNumber = extractDigits(token)

            if (phoneNumber.length < digits) continue

            matches.push({
                pattern: "phone",
                i: match.index,
                j: match.index + token.length - 1,
                token,
                phone_number: phoneNumber,
                phone_format: name,
            })
        }
    }

    return sorted(matches)
}
