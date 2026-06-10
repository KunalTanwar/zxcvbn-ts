import { SequenceMatch } from "../types"

const MAX_DELTA = 5

export function sequenceMatch(password: string): SequenceMatch[] {
    if (password.length === 1) return []

    const result: SequenceMatch[] = []

    const update = (i: number, j: number, delta: number): void => {
        if (j - i > 1 || (Math.abs(delta) === 1 && delta !== 0)) {
            if (Math.abs(delta) > 0 && Math.abs(delta) <= MAX_DELTA) {
                const token = password.slice(i, j + 1)

                let sequenceName: string
                let sequenceSpace: number

                if (/^[a-z]+$/.test(token)) {
                    sequenceName = "lower"
                    sequenceSpace = 26
                } else if (/^[A-Z]+$/.test(token)) {
                    sequenceName = "upper"
                    sequenceSpace = 26
                } else if (/^\d+$/.test(token)) {
                    sequenceName = "digits"
                    sequenceSpace = 10
                } else {
                    sequenceName = "unicode"
                    sequenceSpace = 26
                }

                result.push({
                    pattern: "sequence",
                    i,
                    j,
                    token,
                    sequence_name: sequenceName,
                    sequence_space: sequenceSpace,
                    ascending: delta > 0,
                })
            }
        }
    }

    let i = 0
    let lastDelta: number | null = null

    for (let k = 1; k < password.length; k++) {
        const delta = password.charCodeAt(k) - password.charCodeAt(k - 1)

        if (lastDelta === null) {
            lastDelta = delta
        }

        if (delta === lastDelta) continue

        const j = k - 1

        update(i, j, lastDelta)

        i = j

        lastDelta = delta
    }

    update(i, password.length - 1, lastDelta!)

    return result
}
