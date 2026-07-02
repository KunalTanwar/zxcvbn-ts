import type { Match } from "../types.js"
import { columnWalkMatch } from "./columnWalk.js"
import { dateMatch } from "./date.js"
import { dictionaryMatch, reverseDictionaryMatch } from "./dictionary.js"
import { doubledSequenceMatch } from "./doubledSequence.js"
import { emailMatch } from "./email.js"
import { interleavedSequenceMatch } from "./interleaved.js"
import { l33tMatch } from "./l33t.js"
import { phoneMatch } from "./phone.js"
import { regexMatch } from "./regex.js"
import { repeatMatch } from "./repeat.js"
import { sequenceMatch } from "./sequence.js"
import { sorted } from "./shared.js"
import { spatialMatch } from "./spatial.js"

export { dictionaryMatch, reverseDictionaryMatch, setUserInputDictionary } from "./dictionary.js"

export { l33tMatch } from "./l33t.js"
export { spatialMatch } from "./spatial.js"
export { repeatMatch } from "./repeat.js"
export { sequenceMatch } from "./sequence.js"
export { regexMatch } from "./regex.js"
export { dateMatch } from "./date.js"
export { phoneMatch } from "./phone.js"
export { emailMatch } from "./email.js"
export { columnWalkMatch } from "./columnWalk.js"
export { interleavedSequenceMatch } from "./interleaved.js"
export { doubledSequenceMatch } from "./doubledSequence.js"

export function omnimatch(password: string): Match[] {
    const matches: Match[] = []

    const matchers = [
        dictionaryMatch,
        reverseDictionaryMatch,
        l33tMatch,
        spatialMatch,
        columnWalkMatch,
        sequenceMatch,
        regexMatch,
        dateMatch,
        phoneMatch,
        interleavedSequenceMatch,
        doubledSequenceMatch,
        emailMatch,
    ]

    for (const matcher of matchers) {
        matches.push(...matcher(password))
    }

    matches.push(...repeatMatch(password))

    return sorted(matches)
}
