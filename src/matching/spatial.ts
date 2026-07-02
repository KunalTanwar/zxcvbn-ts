import adjacencyGraphs from "../adjacency_graphs.js"
import { AdjacencyGraph, SpatialMatch } from "../types.js"
import { extend, sorted } from "./shared.js"

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

    for (const [graphName, graph] of Object.entries(adjacencyGraphs)) {
        extend(matches, spatialMatchHelper(password, graph, graphName))
    }

    return sorted(matches)
}
