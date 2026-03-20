// ============================================================
// zxcvbn-ts — Scoring
// ============================================================

import adjacencyGraphs from "./adjacency_graphs";
import type {
  Match,
  ScoringResult,
  DictionaryMatch,
  SpatialMatch,
  RepeatMatch,
  SequenceMatch,
  RegexMatch,
  DateMatch,
  BruteforceMatch,
  AdjacencyGraph,
} from "./types";

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const BRUTEFORCE_CARDINALITY = 10;
const MIN_GUESSES_BEFORE_GROWING_SEQUENCE = 10_000;
const MIN_SUBMATCH_GUESSES_SINGLE_CHAR = 10;
const MIN_SUBMATCH_GUESSES_MULTI_CHAR = 50;

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Average adjacency degree for a keyboard graph. */
function calcAverageDegree(graph: AdjacencyGraph): number {
  let total = 0;
  let keys = 0;
  for (const neighbors of Object.values(graph)) {
    total += neighbors.filter((n) => n !== null).length;
    keys++;
  }
  return total / keys;
}

// Pre-computed constants derived from keyboard graphs
const KEYBOARD_AVERAGE_DEGREE = calcAverageDegree(adjacencyGraphs.qwerty);
const KEYPAD_AVERAGE_DEGREE = calcAverageDegree(adjacencyGraphs.keypad);
const KEYBOARD_STARTING_POSITIONS = Object.keys(adjacencyGraphs.qwerty).length;
const KEYPAD_STARTING_POSITIONS = Object.keys(adjacencyGraphs.keypad).length;

// ----------------------------------------------------------------
// Math utilities
// ----------------------------------------------------------------

/** Binomial coefficient C(n, k). */
export function nCk(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0) return 1;
  let r = 1;
  for (let d = 1; d <= k; d++) {
    r *= n;
    r /= d;
    n -= 1;
  }
  return r;
}

export function log10(n: number): number {
  return Math.log(n) / Math.log(10);
}

export function log2(n: number): number {
  return Math.log(n) / Math.log(2);
}

export function factorial(n: number): number {
  if (n < 2) return 1;
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// ----------------------------------------------------------------
// Regex patterns used in guess estimation
// ----------------------------------------------------------------

const START_UPPER = /^[A-Z][^A-Z]+$/;
const END_UPPER = /^[^A-Z]+[A-Z]$/;
const ALL_UPPER = /^[^a-z]+$/;
const ALL_LOWER = /^[^A-Z]+$/;

// ----------------------------------------------------------------
// Main scoring entry point
// ----------------------------------------------------------------

/**
 * Returns the minimum-guesses match sequence for `password` given a list
 * of candidate `matches`.
 *
 * Uses a dynamic programming approach: O(l_max * (n + m)) where n = password
 * length, m = number of matches.
 */
export function mostGuessableMatchSequence(
  password: string,
  matches: Match[],
  excludeAdditive = false
): ScoringResult {
  const n = password.length;

  // Group matches by their ending index j
  const matchesByJ: Match[][] = Array.from({ length: n }, () => []);
  for (const m of matches) {
    matchesByJ[m.j].push(m);
  }
  // Sort each bucket by starting index i for deterministic output
  for (const lst of matchesByJ) {
    lst.sort((a, b) => a.i - b.i);
  }

  // optimal.m[k][l]  = final match of best length-l sequence up to index k
  // optimal.pi[k][l] = product term of that sequence
  // optimal.g[k][l]  = overall cost (g) of that sequence
  const optimal = {
    m: Array.from({ length: n }, () => ({} as Record<number, Match>)),
    pi: Array.from({ length: n }, () => ({} as Record<number, number>)),
    g: Array.from({ length: n }, () => ({} as Record<number, number>)),
  };

  /** Update optimal state if the length-l sequence ending at m is a new best. */
  const update = (m: Match, l: number): void => {
    const k = m.j;
    let pi = estimateGuesses(m, password);
    if (l > 1) {
      // Multiply by the product term of the preceding length-(l-1) sequence
      pi *= optimal.pi[m.i - 1][l - 1];
    }
    let g = factorial(l) * pi;
    if (!excludeAdditive) {
      g += Math.pow(MIN_GUESSES_BEFORE_GROWING_SEQUENCE, l - 1);
    }
    // Check if any competing sequence with <= l matches beats this
    for (const [cL, cG] of Object.entries(optimal.g[k])) {
      if (Number(cL) > l) continue;
      if (cG <= g) return;
    }
    optimal.g[k][l] = g;
    optimal.m[k][l] = m;
    optimal.pi[k][l] = pi;
  };

  /** Evaluate all bruteforce matches ending at index k. */
  const bruteforceUpdate = (k: number): void => {
    const mBf = makeBruteforceMatch(0, k);
    update(mBf, 1);
    for (let i = 1; i <= k; i++) {
      const mBfi = makeBruteforceMatch(i, k);
      for (const [lStr, lastM] of Object.entries(optimal.m[i - 1])) {
        const l = Number(lStr);
        // Two adjacent bruteforce matches are never optimal
        if ((lastM as Match).pattern === "bruteforce") continue;
        update(mBfi, l + 1);
      }
    }
  };

  const makeBruteforceMatch = (i: number, j: number): BruteforceMatch => ({
    pattern: "bruteforce",
    token: password.slice(i, j + 1),
    i,
    j,
  });

  /** Walk back through optimal.m to reconstruct the best match sequence. */
  const unwind = (n: number): Match[] => {
    if (n === 0) return [];
    const seq: Match[] = [];
    let k = n - 1;
    let l: number | undefined;
    let g = Infinity;
    const lastG = optimal.g[k];
    if (!lastG) return [];
    for (const [candidateL, candidateG] of Object.entries(lastG)) {
      if (candidateG < g) {
        l = Number(candidateL);
        g = candidateG;
      }
    }
    if (l === undefined) return [];
    while (k >= 0) {
      const m = optimal.m[k][l];
      if (!m) break;
      seq.unshift(m);
      k = m.i - 1;
      l -= 1;
    }
    return seq;
  };

  // Main DP loop
  for (let k = 0; k < n; k++) {
    for (const m of matchesByJ[k]) {
      if (m.i > 0) {
        for (const lStr of Object.keys(optimal.m[m.i - 1])) {
          const l = Number(lStr);
          update(m, l + 1);
        }
      } else {
        update(m, 1);
      }
    }
    bruteforceUpdate(k);
  }

  const optimalMatchSequence = unwind(n);
  const optimalL = optimalMatchSequence.length;
  const guesses =
    password.length === 0 ? 1 : optimal.g[n - 1][optimalL];

  return {
    password,
    guesses,
    guesses_log10: log10(guesses),
    sequence: optimalMatchSequence,
  };
}

// ----------------------------------------------------------------
// Guess estimation — one function per pattern
// ----------------------------------------------------------------

export function estimateGuesses(match: Match, password: string): number {
  // Cache: a match's estimate never changes
  if (match.guesses != null) return match.guesses;

  let minGuesses = 1;
  if (match.token.length < password.length) {
    minGuesses =
      match.token.length === 1
        ? MIN_SUBMATCH_GUESSES_SINGLE_CHAR
        : MIN_SUBMATCH_GUESSES_MULTI_CHAR;
  }

  let guesses: number;
  switch (match.pattern) {
    case "bruteforce":
      guesses = bruteforceGuesses(match);
      break;
    case "dictionary":
      guesses = dictionaryGuesses(match);
      break;
    case "spatial":
      guesses = spatialGuesses(match);
      break;
    case "repeat":
      guesses = repeatGuesses(match);
      break;
    case "sequence":
      guesses = sequenceGuesses(match);
      break;
    case "regex":
      guesses = regexGuesses(match);
      break;
    case "date":
      guesses = dateGuesses(match);
      break;
    default: {
      // Exhaustive type check
      const _exhaustive: never = match;
      guesses = 1;
      void _exhaustive;
    }
  }

  match.guesses = Math.max(guesses, minGuesses);
  match.guesses_log10 = log10(match.guesses);
  return match.guesses;
}

function bruteforceGuesses(match: BruteforceMatch): number {
  let guesses = Math.pow(BRUTEFORCE_CARDINALITY, match.token.length);
  if (guesses === Infinity || guesses === Number.POSITIVE_INFINITY) {
    guesses = Number.MAX_VALUE;
  }
  const minGuesses =
    match.token.length === 1
      ? MIN_SUBMATCH_GUESSES_SINGLE_CHAR + 1
      : MIN_SUBMATCH_GUESSES_MULTI_CHAR + 1;
  return Math.max(guesses, minGuesses);
}

function repeatGuesses(match: RepeatMatch): number {
  return match.base_guesses * match.repeat_count;
}

function sequenceGuesses(match: SequenceMatch): number {
  const firstChr = match.token.charAt(0);
  let baseGuesses: number;
  if (["a", "A", "z", "Z", "0", "1", "9"].includes(firstChr)) {
    baseGuesses = 4;
  } else if (/^\d$/.test(firstChr)) {
    baseGuesses = 10;
  } else {
    baseGuesses = 26;
  }
  if (!match.ascending) baseGuesses *= 2;
  return baseGuesses * match.token.length;
}

const MIN_YEAR_SPACE = 20;
const REFERENCE_YEAR = new Date().getFullYear();

function regexGuesses(match: RegexMatch): number {
  const charClassBases: Record<string, number> = {
    alpha_lower: 26,
    alpha_upper: 26,
    alpha: 52,
    alphanumeric: 62,
    digits: 10,
    symbols: 33,
  };
  if (match.regex_name in charClassBases) {
    return Math.pow(charClassBases[match.regex_name], match.token.length);
  }
  if (match.regex_name === "recent_year") {
    const yearSpace = Math.max(
      Math.abs(parseInt(match.regex_match[0]) - REFERENCE_YEAR),
      MIN_YEAR_SPACE
    );
    return yearSpace;
  }
  return 1;
}

function dateGuesses(match: DateMatch): number {
  const yearSpace = Math.max(
    Math.abs(match.year - REFERENCE_YEAR),
    MIN_YEAR_SPACE
  );
  let guesses = yearSpace * 365;
  if (match.separator) guesses *= 4;
  return guesses;
}

function spatialGuesses(match: SpatialMatch): number {
  let s: number;
  let d: number;
  if (match.graph === "qwerty" || match.graph === "dvorak") {
    s = KEYBOARD_STARTING_POSITIONS;
    d = KEYBOARD_AVERAGE_DEGREE;
  } else {
    s = KEYPAD_STARTING_POSITIONS;
    d = KEYPAD_AVERAGE_DEGREE;
  }
  let guesses = 0;
  const L = match.token.length;
  const t = match.turns;
  for (let i = 2; i <= L; i++) {
    const possibleTurns = Math.min(t, i - 1);
    for (let j = 1; j <= possibleTurns; j++) {
      guesses += nCk(i - 1, j - 1) * s * Math.pow(d, j);
    }
  }
  if (match.shifted_count) {
    const S = match.shifted_count;
    const U = match.token.length - match.shifted_count;
    if (S === 0 || U === 0) {
      guesses *= 2;
    } else {
      let shiftedVariations = 0;
      for (let i = 1; i <= Math.min(S, U); i++) {
        shiftedVariations += nCk(S + U, i);
      }
      guesses *= shiftedVariations;
    }
  }
  return guesses;
}

export function uppercaseVariations(match: DictionaryMatch): number {
  const word = match.token;
  if (ALL_LOWER.test(word) || word.toLowerCase() === word) return 1;
  for (const regex of [START_UPPER, END_UPPER, ALL_UPPER]) {
    if (regex.test(word)) return 2;
  }
  const U = [...word].filter((c) => /[A-Z]/.test(c)).length;
  const L = [...word].filter((c) => /[a-z]/.test(c)).length;
  let variations = 0;
  for (let i = 1; i <= Math.min(U, L); i++) {
    variations += nCk(U + L, i);
  }
  return variations;
}

export function l33tVariations(match: DictionaryMatch): number {
  if (!match.l33t) return 1;
  let variations = 1;
  for (const [subbed, unsubbed] of Object.entries(match.sub ?? {})) {
    const chrs = match.token.toLowerCase().split("");
    const S = chrs.filter((c) => c === subbed).length;
    const U = chrs.filter((c) => c === unsubbed).length;
    if (S === 0 || U === 0) {
      variations *= 2;
    } else {
      const p = Math.min(U, S);
      let possibilities = 0;
      for (let i = 1; i <= p; i++) {
        possibilities += nCk(U + S, i);
      }
      variations *= possibilities;
    }
  }
  return variations;
}

function dictionaryGuesses(match: DictionaryMatch): number {
  match.base_guesses = match.rank;
  match.uppercase_variations = uppercaseVariations(match);
  match.l33t_variations = l33tVariations(match);
  const reversedVariations = match.reversed ? 2 : 1;
  return (
    match.base_guesses *
    match.uppercase_variations *
    match.l33t_variations *
    reversedVariations
  );
}

// Export constants needed by other modules
export { REFERENCE_YEAR, MIN_YEAR_SPACE, START_UPPER, ALL_UPPER, ALL_LOWER };
