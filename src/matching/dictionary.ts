import { DictionaryMatch, RankedDictionaries } from "../types.js"
import { buildRankedDict, RANKED_DICTIONARIES, sorted } from "./shared.js"

export function setUserInputDictionary(orderedList: string[]): void {
    RANKED_DICTIONARIES["user_inputs"] = buildRankedDict([...orderedList])
}

export function dictionaryMatch(
    password: string,
    rankedDictionaries: RankedDictionaries = RANKED_DICTIONARIES,
): DictionaryMatch[] {
    const matches: DictionaryMatch[] = []
    const passwordLength = password.length
    const passwordLower = password.toLowerCase()

    const passwordNormalized = passwordLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    for (const [dictionaryName, rankedDict] of Object.entries(rankedDictionaries)) {
        for (let i = 0; i < passwordLength; i++) {
            for (let j = i; j < passwordLength; j++) {
                const word = passwordLower.slice(i, j + 1)
                const wordNormalized = passwordNormalized.slice(i, j + 1)
                const matched = word in rankedDict ? word : wordNormalized in rankedDict ? wordNormalized : null

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
        match.token = match.token.split("").reverse().join("")
        match.reversed = true

        const [newI, newJ] = [password.length - 1 - match.j, password.length - 1 - match.i]

        match.i = newI
        match.j = newJ
    }

    return sorted(matches)
}
