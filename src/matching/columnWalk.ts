import { SpatialMatch } from "../types.js"

const QWERTY_KEY_POS: Readonly<Record<string, readonly [number, number]>> = {
    "`": [0, 0],
    "1": [1, 0],
    "2": [2, 0],
    "3": [3, 0],
    "4": [4, 0],
    "5": [5, 0],
    "6": [6, 0],
    "7": [7, 0],
    "8": [8, 0],
    "9": [9, 0],
    "0": [10, 0],
    "-": [11, 0],
    "=": [12, 0],
    q: [1, 1],
    w: [2, 1],
    e: [3, 1],
    r: [4, 1],
    t: [5, 1],
    y: [6, 1],
    u: [7, 1],
    i: [8, 1],
    o: [9, 1],
    p: [10, 1],
    "[": [11, 1],
    "]": [12, 1],
    "\\": [13, 1],
    a: [1, 2],
    s: [2, 2],
    d: [3, 2],
    f: [4, 2],
    g: [5, 2],
    h: [6, 2],
    j: [7, 2],
    k: [8, 2],
    l: [9, 2],
    ";": [10, 2],
    "'": [11, 2],
    z: [1, 3],
    x: [2, 3],
    c: [3, 3],
    v: [4, 3],
    b: [5, 3],
    n: [6, 3],
    m: [7, 3],
    ",": [8, 3],
    ".": [9, 3],
    "/": [10, 3],
}

const QWERTY_SHIFT_MAP: Readonly<Record<string, string>> = {
    "~": "`",
    "!": "1",
    "@": "2",
    "#": "3",
    $: "4",
    "%": "5",
    "^": "6",
    "&": "7",
    "*": "8",
    "(": "9",
    ")": "0",
    _: "-",
    "+": "=",
    Q: "q",
    W: "w",
    E: "e",
    R: "r",
    T: "t",
    Y: "y",
    U: "u",
    I: "i",
    O: "o",
    P: "p",
    "{": "[",
    "}": "]",
    "|": "\\",
    A: "a",
    S: "s",
    D: "d",
    F: "f",
    G: "g",
    H: "h",
    J: "j",
    K: "k",
    L: "l",
    ":": ";",
    '"': "'",
    Z: "z",
    X: "x",
    C: "c",
    V: "v",
    B: "b",
    N: "n",
    M: "m",
    "<": ",",
    ">": ".",
    "?": "/",
}

function getQwertyPosition(char: string): readonly [number, number] | null {
    const key = QWERTY_SHIFT_MAP[char] ?? char

    return QWERTY_KEY_POS[key] ?? null
}

export function columnWalkMatch(password: string): SpatialMatch[] {
    const matches: SpatialMatch[] = []

    let i = 0

    while (i < password.length - 2) {
        const startPos = getQwertyPosition(password[i])

        if (!startPos) {
            i++
            continue
        }

        let [prevCol, prevRow] = startPos

        let rowDelta = 0
        let colDelta = 0

        let shiftedCount = password[i] in QWERTY_SHIFT_MAP ? 1 : 0

        let j = i + 1

        while (j < password.length) {
            const curPos = getQwertyPosition(password[j])

            if (!curPos) break

            const [curCol, curRow] = curPos
            const dr = curRow - prevRow
            const dc = curCol - prevCol

            if (j === i + 1) {
                if (Math.abs(dr) !== 1 || Math.abs(dc) > 1) break

                rowDelta = dr
                colDelta = dc
            } else {
                if (dr !== rowDelta || dc !== colDelta) break
            }

            prevCol = curCol
            prevRow = curRow

            if (password[j] in QWERTY_SHIFT_MAP) shiftedCount++

            j++
        }

        const length = j - i

        if (length >= 3) {
            matches.push({
                pattern: "spatial",
                i,
                j: j - 1,
                token: password.slice(i, j),
                graph: "qwerty_column",
                turns: 0,
                shifted_count: shiftedCount,
            })
            i = j
        } else {
            i++
        }
    }

    return matches
}
