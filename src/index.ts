// ============================================================
// zxcvbn-ts — Public API barrel
// ============================================================

export { zxcvbn as default, zxcvbn } from "./main";

// Types
export type {
  ZxcvbnResult,
  AttackTimes,
  CrackTimesSeconds,
  CrackTimesDisplay,
  Feedback,
  Match,
  BruteforceMatch,
  DictionaryMatch,
  SpatialMatch,
  RepeatMatch,
  SequenceMatch,
  RegexMatch,
  DateMatch,
  PatternName,
  RankedDictionary,
  RankedDictionaries,
  L33tTable,
  AdjacencyGraph,
  AdjacencyGraphs,
} from "./types";

// Lower-level helpers (useful for custom integrations / testing)
export { mostGuessableMatchSequence } from "./scoring";
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
  setUserInputDictionary,
} from "./matching";
export { estimateAttackTimes, guessesToScore, displayTime } from "./time_estimates";
export { getFeedback } from "./feedback";
