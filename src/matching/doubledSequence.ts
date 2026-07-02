import { DoubledSequenceMatch } from "../types.js"
import { sorted } from "./shared.js"

export function doubledSequenceMatch(password: string): DoubledSequenceMatch[] {
    const matches: DoubledSequenceMatch[] = []

    if (password.length < 4) return matches

    let i = 0

    while (i <= password.length - 4) {
        let foundMatch = false

        for (const n of [2, 3]) {
            // Need at least 2 groups of n chars each
            if (i + n * 2 > password.length) continue

            // Verify first group: all same character
            const firstChar = password[i]

            let firstGroupValid = true

            for (let k = 1; k < n; k++) {
                if (password[i + k] !== firstChar) {
                    firstGroupValid = false

                    break
                }
            }

            if (!firstGroupValid) continue

            // Get delta between first and second group
            const secondChar = password[i + n]
            const delta = secondChar.charCodeAt(0) - firstChar.charCodeAt(0)

            if (delta === 0 || Math.abs(delta) > 3) continue

            // Verify second group: all same character (secondChar)
            let secondGroupValid = true

            for (let k = 1; k < n; k++) {
                if (password[i + n + k] !== secondChar) {
                    secondGroupValid = false

                    break
                }
            }

            if (!secondGroupValid) continue

            // Extend as far as possible
            let groupCount = 2
            let pos = i + n * 2

            while (pos + n <= password.length) {
                const expectedChar = String.fromCharCode(firstChar.charCodeAt(0) + delta * groupCount)
                let groupValid = true

                for (let k = 0; k < n; k++) {
                    if (password[pos + k] !== expectedChar) {
                        groupValid = false

                        break
                    }
                }

                if (!groupValid) break

                groupCount++

                pos += n
            }

            if (groupCount < 2) continue

            const length = groupCount * n

            if (length < 4) continue

            const token = password.slice(i, i + length)
            const baseSeq = Array.from({ length: groupCount }, (_, idx) =>
                String.fromCharCode(firstChar.charCodeAt(0) + delta * idx),
            ).join("")

            matches.push({
                pattern: "doubled_sequence",
                i,
                j: i + length - 1,
                token,
                base_sequence: baseSeq,
                repeat_count: n,
                ascending: delta > 0,
            })

            i += length
            foundMatch = true

            break
        }

        if (!foundMatch) {
            i++
        }
    }

    return sorted(matches)
}
