import frequencyLists from "./frequency_lists"
import adjacencyGraphs from "./adjacency_graphs"
import { mostGuessableMatchSequence } from "./scoring"
import type {
    Match,
    DictionaryMatch,
    SpatialMatch,
    RepeatMatch,
    SequenceMatch,
    RegexMatch,
    DateMatch,
    PhoneMatch,
    RankedDictionary,
    RankedDictionaries,
    L33tTable,
    AdjacencyGraph,
} from "./types"

// ----------------------------------------------------------------
// Ranked dictionaries
// ----------------------------------------------------------------

function buildRankedDict(orderedList: readonly string[]): RankedDictionary {
    const result: Record<string, number> = {}

    for (let i = 0; i < orderedList.length; i++) {
        result[orderedList[i]] = i + 1 // rank starts at 1
    }

    return result
}

// Build ranked dictionaries eagerly at module load time so they are always
// available regardless of call order (fixes a bug where setUserInputDictionary
// was called before omnimatch, causing the lazy-init guard to short-circuit).
const RANKED_DICTIONARIES: RankedDictionaries = Object.fromEntries(
    Object.entries(frequencyLists).map(([name, lst]) => [name, buildRankedDict(lst)]),
)

// ----------------------------------------------------------------
// Keyboard graphs
// ----------------------------------------------------------------

const GRAPHS: Record<string, AdjacencyGraph> = {
    qwerty: adjacencyGraphs.qwerty,
    dvorak: adjacencyGraphs.dvorak,
    keypad: adjacencyGraphs.keypad,
    mac_keypad: adjacencyGraphs.mac_keypad,
}

// ----------------------------------------------------------------
// L33t substitution table
// ----------------------------------------------------------------

const L33T_TABLE: L33tTable = {
    a: ["4", "@"],
    b: ["8"],
    c: ["(", "{", "[", "<"],
    e: ["3"],
    g: ["6", "9"],
    i: ["1", "!", "|"],
    l: ["1", "|", "7"],
    o: ["0"],
    s: ["$", "5"],
    t: ["+", "7"],
    x: ["%"],
    z: ["2"],
} as const

// ----------------------------------------------------------------
// Regex patterns
// ----------------------------------------------------------------

const REGEXEN: Record<string, RegExp> = {
    recent_year: /19\d\d|20[0-3]\d/g,
}

// ----------------------------------------------------------------
// Date split patterns
// ----------------------------------------------------------------

const DATE_MAX_YEAR = 2050
const DATE_MIN_YEAR = 1000

const DATE_SPLITS: Record<number, [number, number][]> = {
    4: [
        [1, 2],
        [2, 3],
    ],
    5: [
        [1, 3],
        [2, 3],
    ],
    6: [
        [1, 2],
        [2, 4],
        [4, 5],
    ],
    7: [
        [1, 3],
        [2, 3],
        [4, 5],
        [4, 6],
    ],
    8: [
        [2, 4],
        [4, 6],
    ],
}

// ----------------------------------------------------------------
// Utility helpers
// ----------------------------------------------------------------

function isEmpty(obj: Record<string, unknown>): boolean {
    return Object.keys(obj).length === 0
}

function extend<T>(list: T[], list2: T[]): void {
    list.push(...list2)
}

function translate(string: string, chrMap: Record<string, string>): string {
    return string
        .split("")
        .map((c) => chrMap[c] ?? c)
        .join("")
}

/** Proper modulo that handles negative numbers. Used in spatial wrapping. */
function _mod(n: number, m: number): number {
    return ((n % m) + m) % m
}
// Re-export so tree-shakers don't flag it; used in adjacency lookups if graph wraps.
void _mod

function sorted<T extends Match>(matches: T[]): T[] {
    return [...matches].sort((a, b) => a.i - b.i || a.j - b.j)
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/** Set a custom user-input dictionary (call once per zxcvbn invocation). */
export function setUserInputDictionary(orderedList: string[]): void {
    RANKED_DICTIONARIES["user_inputs"] = buildRankedDict([...orderedList])
}

/** Run all matchers against `password` and return sorted match list. */
export function omnimatch(password: string): Match[] {
    const matches: Match[] = []
    const matchers: Array<(pw: string) => Match[]> = [
        dictionaryMatch,
        reverseDictionaryMatch,
        l33tMatch,
        spatialMatch,
        repeatMatch,
        sequenceMatch,
        regexMatch,
        dateMatch,
        phoneMatch,
    ]

    for (const matcher of matchers) {
        extend(matches, matcher(password))
    }

    return sorted(matches)
}

// ----------------------------------------------------------------
// Dictionary matching
// ----------------------------------------------------------------

export function dictionaryMatch(
    password: string,
    rankedDictionaries: RankedDictionaries = RANKED_DICTIONARIES,
): DictionaryMatch[] {
    const matches: DictionaryMatch[] = []
    const len = password.length
    const passwordLower = password.toLowerCase()
    const passwordNormalized = passwordLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    for (const [dictionaryName, rankedDict] of Object.entries(rankedDictionaries)) {
        for (let i = 0; i < len; i++) {
            for (let j = i; j < len; j++) {
                const word = passwordLower.slice(i, j + 1)
                const wordNorm = passwordNormalized.slice(i, j + 1)
                const matched = word in rankedDict ? word : wordNorm in rankedDict ? wordNorm : null

                if (matched) {
                    const rank = rankedDict[matched]

                    matches.push({
                        pattern: "dictionary",
                        i,
                        j,
                        token: password.slice(i, j + 1),
                        matched_word: matched,
                        rank,
                        dictionary_name: dictionaryName,
                        reversed: false,
                        l33t: false,
                    })
                }
            }
        }
    }

    return sorted(matches)
}

export function reverseDictionaryMatch(
    password: string,
    rankedDictionaries: RankedDictionaries = RANKED_DICTIONARIES,
): DictionaryMatch[] {
    const reversedPassword = password.split("").reverse().join("")
    const matches = dictionaryMatch(reversedPassword, rankedDictionaries)

    for (const match of matches) {
        match.token = match.token.split("").reverse().join("") // reverse back
        match.reversed = true

        const [newI, newJ] = [password.length - 1 - match.j, password.length - 1 - match.i]

        match.i = newI
        match.j = newJ
    }

    return sorted(matches)
}

// ----------------------------------------------------------------
// L33t matching
// ----------------------------------------------------------------

function relevantL33tSubtable(password: string, table: L33tTable): L33tTable {
    const passwordChars = new Set(password.split(""))
    const subtable: Record<string, string[]> = {}

    for (const [letter, subs] of Object.entries(table)) {
        const relevantSubs = subs.filter((sub) => passwordChars.has(sub))

        if (relevantSubs.length > 0) {
            subtable[letter] = relevantSubs
        }
    }

    return subtable
}

function enumerateL33tSubs(table: L33tTable): Array<Record<string, string>> {
    const keys = Object.keys(table)

    let subs: Array<[string, string][]> = [[]]

    const dedup = (subs: Array<[string, string][]>): Array<[string, string][]> => {
        const deduped: Array<[string, string][]> = []
        const members = new Set<string>()

        for (const sub of subs) {
            const assoc = [...sub].sort((a, b) => (a[0] < b[0] ? -1 : 1))
            const label = assoc.map(([k, v]) => `${k},${v}`).join("-")

            if (!members.has(label)) {
                members.add(label)
                deduped.push(sub)
            }
        }

        return deduped
    }

    const helper = (keys: string[]): void => {
        if (!keys.length) return

        const [firstKey, ...restKeys] = keys
        const nextSubs: Array<[string, string][]> = []

        for (const l33tChr of table[firstKey]) {
            for (const sub of subs) {
                const dupL33tIndex = sub.findIndex(([k]) => k === l33tChr)

                if (dupL33tIndex === -1) {
                    nextSubs.push([...sub, [l33tChr, firstKey]])
                } else {
                    const subAlternative = [...sub]

                    subAlternative.splice(dupL33tIndex, 1)
                    subAlternative.push([l33tChr, firstKey])

                    nextSubs.push(sub)
                    nextSubs.push(subAlternative)
                }
            }
        }

        subs = dedup(nextSubs)

        helper(restKeys)
    }

    helper(keys)

    return subs.map((sub) => Object.fromEntries(sub))
}

export function l33tMatch(
    password: string,
    rankedDictionaries: RankedDictionaries = RANKED_DICTIONARIES,
    l33tTable: L33tTable = L33T_TABLE,
): DictionaryMatch[] {
    const matches: DictionaryMatch[] = []
    const subTable = relevantL33tSubtable(password, l33tTable)

    // If the password has too many distinct l33t characters the substitution
    // enumeration explodes combinatorially. Cap at a safe limit — passwords
    // with 5+ distinct l33t chars are almost certainly not dictionary words.
    if (Object.keys(subTable).length > 4) return matches

    for (const sub of enumerateL33tSubs(subTable)) {
        if (isEmpty(sub as Record<string, unknown>)) break

        const subbedPassword = translate(password, sub)

        for (const match of dictionaryMatch(subbedPassword, rankedDictionaries)) {
            const token = password.slice(match.i, match.j + 1)

            if (token.toLowerCase() === match.matched_word) continue // no actual substitution

            const matchSub: Record<string, string> = {}

            for (const [subbedChr, chr] of Object.entries(sub)) {
                if (token.includes(subbedChr)) {
                    matchSub[subbedChr] = chr
                }
            }

            match.l33t = true
            match.token = token
            match.sub = matchSub
            match.sub_display = Object.entries(matchSub)
                .map(([k, v]) => `${k} -> ${v}`)
                .join(", ")
            matches.push(match)
        }
    }

    // Filter single-char l33t matches (too noisy)
    return sorted(matches.filter((m) => m.token.length > 1))
}

// ----------------------------------------------------------------
// Spatial matching
// ----------------------------------------------------------------

const SHIFTED_RX = /[~!@#$%^&*()_+QWERTYUIOP{}|ASDFGHJKL:"ZXCVBNM<>?]/

function spatialMatchHelper(password: string, graph: AdjacencyGraph, graphName: string): SpatialMatch[] {
    const matches: SpatialMatch[] = []

    let i = 0

    while (i < password.length - 1) {
        let j = i + 1
        let lastDirection: number | null = null
        let turns = 0

        const isQwertyOrDvorak = graphName === "qwerty" || graphName === "dvorak"

        let shiftedCount = isQwertyOrDvorak && SHIFTED_RX.test(password.charAt(i)) ? 1 : 0

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const prevChar = password.charAt(j - 1)

            let found = false
            let foundDirection = -1
            let curDirection = -1

            const adjacents = graph[prevChar] ?? []

            if (j < password.length) {
                const curChar = password.charAt(j)

                for (const adj of adjacents) {
                    curDirection++

                    if (adj !== null && adj.includes(curChar)) {
                        found = true
                        foundDirection = curDirection

                        if (adj.indexOf(curChar) === 1) {
                            // shifted key
                            shiftedCount++
                        }

                        if (lastDirection !== foundDirection) {
                            turns++
                            lastDirection = foundDirection
                        }

                        break
                    }
                }
            }

            if (found) {
                j++
            } else {
                if (j - i > 2) {
                    // Don't record length-1 or length-2 chains
                    matches.push({
                        pattern: "spatial",
                        i,
                        j: j - 1,
                        token: password.slice(i, j),
                        graph: graphName,
                        turns,
                        shifted_count: shiftedCount,
                    })
                }

                i = j

                break
            }
        }
    }

    return matches
}

export function spatialMatch(password: string): SpatialMatch[] {
    const matches: SpatialMatch[] = []

    for (const [graphName, graph] of Object.entries(GRAPHS)) {
        extend(matches, spatialMatchHelper(password, graph, graphName))
    }

    return sorted(matches)
}

// ----------------------------------------------------------------
// Repeat matching
// ----------------------------------------------------------------

export function repeatMatch(password: string): RepeatMatch[] {
    const matches: RepeatMatch[] = []

    // Early exit: if every character in the password is unique, no repeat
    // patterns are possible. This avoids catastrophic backtracking on long
    // strings of distinct characters (e.g. all-symbols passwords).
    const charSet = new Set(password)

    if (charSet.size === password.length) return matches

    const greedy = /(.+)\1+/g
    const lazy = /(.+?)\1+/g

    // NOTE: /^(.+?)\1+$/ is ReDoS-vulnerable on certain inputs.
    // We replace it with a safe string-based check: verify the greedy
    // match token is a clean repetition by confirming it divides evenly.
    const safeGetBaseToken = (token: string, lazyBase: string): string => {
        // Try extending lazyBase up to half the token length
        for (let len = lazyBase.length; len <= token.length / 2; len++) {
            const candidate = token.slice(0, len)

            if (candidate.length > 0 && token === candidate.repeat(token.length / candidate.length)) {
                return candidate
            }
        }

        return lazyBase
    }

    let lastIndex = 0

    while (lastIndex < password.length) {
        greedy.lastIndex = lastIndex
        lazy.lastIndex = lastIndex

        const greedyMatch = greedy.exec(password)
        const lazyMatch = lazy.exec(password)

        if (!greedyMatch) break

        let match: RegExpExecArray
        let baseToken: string

        if (greedyMatch[0].length > lazyMatch![0].length) {
            match = greedyMatch

            baseToken = safeGetBaseToken(match[0], lazyMatch![1])
        } else {
            match = lazyMatch!
            baseToken = match[1]
        }

        const [i, j] = [match.index, match.index + match[0].length - 1]

        // Recursively score the base token
        const baseAnalysis = mostGuessableMatchSequence(baseToken, omnimatch(baseToken))

        matches.push({
            pattern: "repeat",
            i,
            j,
            token: match[0],
            base_token: baseToken,
            base_guesses: baseAnalysis.guesses,
            base_matches: baseAnalysis.sequence,
            repeat_count: match[0].length / baseToken.length,
        })

        lastIndex = j + 1
    }

    return matches
}

// ----------------------------------------------------------------
// Sequence matching
// ----------------------------------------------------------------

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

// ----------------------------------------------------------------
// Regex matching
// ----------------------------------------------------------------

export function regexMatch(password: string, regexen: Record<string, RegExp> = REGEXEN): RegexMatch[] {
    const matches: RegexMatch[] = []

    for (const [name, rx] of Object.entries(regexen)) {
        rx.lastIndex = 0 // keeps regex stateless
        let rxMatch: RegExpExecArray | null

        while ((rxMatch = rx.exec(password)) !== null) {
            const token = rxMatch[0]

            matches.push({
                pattern: "regex",
                token,
                i: rxMatch.index,
                j: rxMatch.index + token.length - 1,
                regex_name: name,
                regex_match: rxMatch,
            })
        }
    }

    return sorted(matches)
}

// ----------------------------------------------------------------
// Date matching
// ----------------------------------------------------------------

export function dateMatch(password: string): DateMatch[] {
    const matches: DateMatch[] = []

    const maybeDateNoSep = /^\d{4,8}$/
    const maybeDateWithSep = /^(\d{1,4})([\s/\\_.-])(\d{1,2})\2(\d{1,4})$/

    // Dates without separators: length 4–8
    for (let i = 0; i <= password.length - 4; i++) {
        for (let j = i + 3; j <= i + 7 && j < password.length; j++) {
            const token = password.slice(i, j + 1)

            if (!maybeDateNoSep.test(token)) continue

            const candidates: Dmy[] = []
            const splits = DATE_SPLITS[token.length]

            if (!splits) continue

            for (const [k, l] of splits) {
                const dmy = mapIntsToDmy([
                    parseInt(token.slice(0, k)),
                    parseInt(token.slice(k, l)),
                    parseInt(token.slice(l)),
                ])

                if (dmy !== null) candidates.push(dmy)
            }

            if (candidates.length === 0) continue

            // Pick the candidate closest to REFERENCE_YEAR
            const refYear = new Date().getFullYear()

            let bestCandidate = candidates[0]
            let minDistance = Math.abs(candidates[0].year - refYear)

            for (const candidate of candidates.slice(1)) {
                const distance = Math.abs(candidate.year - refYear)

                if (distance < minDistance) {
                    bestCandidate = candidate
                    minDistance = distance
                }
            }
            matches.push({
                pattern: "date",
                token,
                i,
                j,
                separator: "",
                year: bestCandidate.year,
                month: bestCandidate.month,
                day: bestCandidate.day,
            })
        }
    }

    // Dates with separators: length 6–10
    for (let i = 0; i <= password.length - 6; i++) {
        for (let j = i + 5; j <= i + 9 && j < password.length; j++) {
            const token = password.slice(i, j + 1)
            const rxMatch = maybeDateWithSep.exec(token)

            if (!rxMatch) continue

            const dmy = mapIntsToDmy([parseInt(rxMatch[1]), parseInt(rxMatch[3]), parseInt(rxMatch[4])])

            if (dmy === null) continue

            matches.push({
                pattern: "date",
                token,
                i,
                j,
                separator: rxMatch[2],
                year: dmy.year,
                month: dmy.month,
                day: dmy.day,
            })
        }
    }

    // Remove date matches that are strict sub-strings of other date matches
    return sorted(
        matches.filter((match) => {
            const isSub = matches.some((other) => other !== match && other.i <= match.i && other.j >= match.j)

            return !isSub
        }),
    )
}

// ----------------------------------------------------------------
// Date helpers
// ----------------------------------------------------------------

interface Dmy {
    day: number
    month: number
    year: number
}

function mapIntsToDmy(ints: [number, number, number]): Dmy | null {
    if (ints[1] > 31 || ints[1] <= 0) return null

    let over12 = 0
    let over31 = 0
    let under1 = 0

    for (const i of ints) {
        if ((i > 99 && i < DATE_MIN_YEAR) || i > DATE_MAX_YEAR) return null
        if (i > 31) over31++
        if (i > 12) over12++
        if (i <= 0) under1++
    }

    if (over31 >= 2 || over12 === 3 || under1 >= 2) return null

    const possibleYearSplits: [number, [number, number]][] = [
        [ints[2], [ints[0], ints[1]]],
        [ints[0], [ints[1], ints[2]]],
    ]

    for (const [y, rest] of possibleYearSplits) {
        if (DATE_MIN_YEAR <= y && y <= DATE_MAX_YEAR) {
            const dm = mapIntsToDm(rest)

            if (dm !== null) {
                return { year: y, month: dm.month, day: dm.day }
            } else {
                return null // year found but day/month invalid
            }
        }
    }

    // No four-digit year; try two-digit year
    for (const [y, rest] of possibleYearSplits) {
        const dm = mapIntsToDm(rest)

        if (dm !== null) {
            return {
                year: twoToFourDigitYear(y),
                month: dm.month,
                day: dm.day,
            }
        }
    }

    return null
}

function mapIntsToDm(ints: [number, number]): { day: number; month: number } | null {
    for (const [d, m] of [ints, [...ints].reverse() as [number, number]]) {
        if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
            return { day: d, month: m }
        }
    }

    return null
}

function twoToFourDigitYear(year: number): number {
    if (year > 99) return year
    if (year > 50) return year + 1900

    return year + 2000
}

// ----------------------------------------------------------------
// Phone number matching (#105)
// ----------------------------------------------------------------

/**
 * Common phone number formats as named regex patterns.
 *
 * Formats covered:
 * - NANP:          (852) 555-9630 | 852-555-9630 | 8525559630
 * - International: +44 20 7946 0958 | +442079460958
 * - Local (short): 555-9630 | 5559630
 **/
const PHONE_REGEXES: Array<{ name: string; rx: RegExp; digits: number }> = [
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

/**
 * Match phone number patterns within the password.
 * Phone numbers are weak — attackers enumerate by area code,
 * making even 10-digit numbers guessable in practice.
 **/
export function phoneMatch(password: string): PhoneMatch[] {
    const matches: PhoneMatch[] = []

    for (const { name, rx, digits } of PHONE_REGEXES) {
        rx.lastIndex = 0

        let m: RegExpExecArray | null

        while ((m = rx.exec(password)) !== null) {
            const token = m[0]
            const phoneNumber = extractDigits(token)

            if (phoneNumber.length < digits) continue

            matches.push({
                pattern: "phone",
                i: m.index,
                j: m.index + token.length - 1,
                token,
                phone_number: phoneNumber,
                phone_format: name,
            })
        }
    }

    return sorted(matches)
}
