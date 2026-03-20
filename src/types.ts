// ============================================================
// zxcvbn-ts — Types
// ============================================================

/** Keyboard graph: maps each character to its adjacent key-groups. */
export type AdjacencyGraph = Readonly<Record<string, ReadonlyArray<string | null>>>;

export interface AdjacencyGraphs {
  readonly qwerty: AdjacencyGraph;
  readonly dvorak: AdjacencyGraph;
  readonly keypad: AdjacencyGraph;
  readonly mac_keypad: AdjacencyGraph;
}

/** A ranked dictionary maps word → rank (1-based). */
export type RankedDictionary = Readonly<Record<string, number>>;

/** All named ranked dictionaries. */
export type RankedDictionaries = Record<string, RankedDictionary>;

// ----------------------------------------------------------------
// Match pattern types
// ----------------------------------------------------------------

export type PatternName =
  | "bruteforce"
  | "dictionary"
  | "spatial"
  | "repeat"
  | "sequence"
  | "regex"
  | "date";

/** Base fields shared by every match. */
interface BaseMatch {
  readonly pattern: PatternName;
  i: number;
  j: number;
  token: string;
  guesses?: number;
  guesses_log10?: number;
}

export interface BruteforceMatch extends BaseMatch {
  readonly pattern: "bruteforce";
}

export interface DictionaryMatch extends BaseMatch {
  readonly pattern: "dictionary";
  matched_word: string;
  rank: number;
  dictionary_name: string;
  reversed: boolean;
  l33t: boolean;
  sub?: Record<string, string>;
  sub_display?: string;
  base_guesses?: number;
  uppercase_variations?: number;
  l33t_variations?: number;
}

export interface SpatialMatch extends BaseMatch {
  readonly pattern: "spatial";
  graph: string;
  turns: number;
  shifted_count: number;
}

export interface RepeatMatch extends BaseMatch {
  readonly pattern: "repeat";
  base_token: string;
  base_guesses: number;
  base_matches: Match[];
  repeat_count: number;
}

export interface SequenceMatch extends BaseMatch {
  readonly pattern: "sequence";
  sequence_name: string;
  sequence_space: number;
  ascending: boolean;
}

export interface RegexMatch extends BaseMatch {
  readonly pattern: "regex";
  regex_name: string;
  regex_match: RegExpExecArray;
}

export interface DateMatch extends BaseMatch {
  readonly pattern: "date";
  separator: string;
  year: number;
  month: number;
  day: number;
}

export type Match =
  | BruteforceMatch
  | DictionaryMatch
  | SpatialMatch
  | RepeatMatch
  | SequenceMatch
  | RegexMatch
  | DateMatch;

// ----------------------------------------------------------------
// Scoring result
// ----------------------------------------------------------------

export interface ScoringResult {
  password: string;
  guesses: number;
  guesses_log10: number;
  sequence: Match[];
}

// ----------------------------------------------------------------
// Attack times
// ----------------------------------------------------------------

export interface CrackTimesSeconds {
  readonly online_throttling_100_per_hour: number;
  readonly online_no_throttling_10_per_second: number;
  readonly offline_slow_hashing_1e4_per_second: number;
  readonly offline_fast_hashing_1e10_per_second: number;
}

export interface CrackTimesDisplay {
  readonly online_throttling_100_per_hour: string;
  readonly online_no_throttling_10_per_second: string;
  readonly offline_slow_hashing_1e4_per_second: string;
  readonly offline_fast_hashing_1e10_per_second: string;
}

export interface AttackTimes {
  readonly crack_times_seconds: CrackTimesSeconds;
  readonly crack_times_display: CrackTimesDisplay;
  /** 0 – 4 */
  readonly score: 0 | 1 | 2 | 3 | 4;
}

// ----------------------------------------------------------------
// Feedback
// ----------------------------------------------------------------

export interface Feedback {
  readonly warning: string;
  readonly suggestions: readonly string[];
}

// ----------------------------------------------------------------
// Final zxcvbn result
// ----------------------------------------------------------------

export interface ZxcvbnResult extends ScoringResult, AttackTimes {
  readonly feedback: Feedback;
  /** Milliseconds taken to compute. */
  readonly calc_time: number;
}

// ----------------------------------------------------------------
// L33t table
// ----------------------------------------------------------------
export type L33tTable = Readonly<Record<string, readonly string[]>>;

export interface FrequencyLists {
  readonly passwords: readonly string[];
  readonly english_wikipedia: readonly string[];
  readonly female_names: readonly string[];
  readonly male_names: readonly string[];
  readonly surnames: readonly string[];
  readonly us_tv_and_film: readonly string[];
  readonly [key: string]: readonly string[];
}