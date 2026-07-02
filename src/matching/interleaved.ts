import { InterleavedMatch } from "../types.js"
import { sorted } from "./shared.js"

export function interleavedSequenceMatch(password: string): InterleavedMatch[] {
    const matches: InterleavedMatch[] = []

    if (password.length < 4) {
        return matches
    }

    let i = 0

    while (i <= password.length - 4) {
        const deltaA = password.charCodeAt(i + 2) - password.charCodeAt(i)
        const deltaB = password.charCodeAt(i + 3) - password.charCodeAt(i + 1)

        if (deltaA === 0 || deltaB === 0 || Math.abs(deltaA) > 5 || Math.abs(deltaB) > 5) {
            i++
            continue
        }

        let length = 4
        let k = 4

        while (i + k < password.length) {
            const expectedDelta = k % 2 === 0 ? deltaA : deltaB
            const actual = password.charCodeAt(i + k) - password.charCodeAt(i + k - 2)

            if (actual !== expectedDelta) break

            k++
            length++
        }

        const token = password.slice(i, i + length)
        const seqA = Array.from({ length: Math.ceil(length / 2) }, (_, idx) => password[i + idx * 2]).join("")
        const seqB = Array.from({ length: Math.floor(length / 2) }, (_, idx) => password[i + 1 + idx * 2]).join("")

        matches.push({
            pattern: "interleaved",
            i,
            j: i + length - 1,
            token,
            sequence_a: seqA,
            sequence_b: seqB,
            delta_a: deltaA,
            delta_b: deltaB,
        })

        i += length
    }

    return sorted(matches)
}
