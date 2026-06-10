import { dictionaryMatch } from "../matching"
import { DictionaryMatch, L33tTable, RankedDictionaries } from "../types"
import { isEmpty, L33T_TABLE, RANKED_DICTIONARIES, sorted, translate } from "./shared"

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
    return sorted(matches.filter((match) => match.token.length > 1))
}
