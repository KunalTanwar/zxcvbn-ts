export { zxcvbn as default, zxcvbn } from "./main.js"

// Types
export type {
    ZxcvbnResult,
    ZxcvbnOptions,
    AttackTimes,
    CrackTimesSeconds,
    CrackTimesDisplay,
    CrackTimesCost,
    Feedback,
    Match,
    BruteforceMatch,
    DictionaryMatch,
    SpatialMatch,
    RepeatMatch,
    SequenceMatch,
    RegexMatch,
    DateMatch,
    PhoneMatch,
    InterleavedMatch,
    DoubledSequenceMatch,
    EmailMatch,
    PatternName,
    RankedDictionary,
    RankedDictionaries,
    L33tTable,
    AdjacencyGraph,
    AdjacencyGraphs,
} from "./types.js"

// Lower-level helpers (useful for custom integrations / testing)
export { mostGuessableMatchSequence } from "./scoring.js"
export {
    omnimatch,
    dictionaryMatch,
    reverseDictionaryMatch,
    l33tMatch,
    spatialMatch,
    repeatMatch,
    sequenceMatch,
    regexMatch,
    dateMatch,
    phoneMatch,
    columnWalkMatch,
    interleavedSequenceMatch,
    doubledSequenceMatch,
    emailMatch,
    setUserInputDictionary,
} from "./matching/index.js"
export { estimateAttackTimes, guessesToScore, displayTime, displayCost } from "./time_estimates.js"
export { getFeedback } from "./feedback.js"
