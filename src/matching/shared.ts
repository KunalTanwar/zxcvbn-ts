import adjacencyGraphs from "../adjacency_graphs.js"
import frequencyLists from "../frequency_lists.js"
import { AdjacencyGraph, L33tTable, Match, RankedDictionaries, RankedDictionary } from "../types.js"

export function buildRankedDict(orderedList: readonly string[]): RankedDictionary {
    const result: Record<string, number> = {}

    for (let i = 0; i < orderedList.length; i++) {
        result[orderedList[i]] = i + 1 // rank starts at 1
    }

    return result
}

export const RANKED_DICTIONARIES: RankedDictionaries = Object.fromEntries(
    Object.entries(frequencyLists).map(([name, list]) => [name, buildRankedDict(list)]),
)

export const GRAPHS: Record<string, AdjacencyGraph> = {
    qwerty: adjacencyGraphs.qwerty,
    dvorak: adjacencyGraphs.dvorak,
    keypad: adjacencyGraphs.keypad,
    mac_keypad: adjacencyGraphs.mac_keypad,
}

export const L33T_TABLE: L33tTable = {
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

export const REGEXES: Record<string, RegExp> = {
    recent_year: /19\d\d|20[0-3]\d/g,
}

export const DATE_MAX_YEAR = 2050
export const DATE_MIN_YEAR = 1000

export const DATE_SPLITS: Record<number, [number, number][]> = {
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

export function isEmpty(obj: Record<string, unknown>): boolean {
    return Object.keys(obj).length === 0
}

export function extend<T>(listX: T[], listY: T[]): void {
    listX.push(...listY)
}

export function translate(str: string, charMap: Record<string, string>): string {
    return str
        .split("")
        .map((c) => charMap[c] ?? c)
        .join("")
}

export function _mod(x: number, y: number): number {
    return ((x % y) + y) % y
}

export function sorted<T extends Match>(matches: T[]): T[] {
    return [...matches].sort((a, b) => a.i - b.i || a.j - b.j)
}
