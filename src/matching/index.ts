import type { Match } from "../types"
import { columnWalkMatch } from "./columnWalk"
import { dateMatch } from "./date"
import { dictionaryMatch, reverseDictionaryMatch } from "./dictionary"
import { doubledSequenceMatch } from "./doubledSequence"
import { emailMatch } from "./email"
import { interleavedSequenceMatch } from "./interleaved"
import { l33tMatch } from "./l33t"
import { phoneMatch } from "./phone"
import { regexMatch } from "./regex"
import { repeatMatch } from "./repeat"
import { sequenceMatch } from "./sequence"
import { sorted } from "./shared"
import { spatialMatch } from "./spatial"

export { dictionaryMatch, reverseDictionaryMatch, setUserInputDictionary } from "./dictionary"

export { l33tMatch } from "./l33t"
export { spatialMatch } from "./spatial"
export { repeatMatch } from "./repeat"
export { sequenceMatch } from "./sequence"
export { regexMatch } from "./regex"
export { dateMatch } from "./date"
export { phoneMatch } from "./phone"
export { emailMatch } from "./email"
export { columnWalkMatch } from "./columnWalk"
export { interleavedSequenceMatch } from "./interleaved"
export { doubledSequenceMatch } from "./doubledSequence"

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
