import { DateMatch } from "../types"
import { DATE_MAX_YEAR, DATE_MIN_YEAR, DATE_SPLITS, sorted } from "./shared"

export function dateMatch(password: string): DateMatch[] {
    const matches: DateMatch[] = []

    const maybeDateNoSep = /^\d{4,8}$/
    const maybeDateWithSep = /^(\d{1,4})([\s/\\_.-])(\d{1,2})\2(\d{1,4})$/

    for (let i = 0; i <= password.length - 4; i++) {
        for (let j = i + 3; j <= i + 7 && j < password.length; j++) {
            const token = password.slice(i, j + 1)

            if (!maybeDateNoSep.test(token)) continue

            const candidates: DayMonthYear[] = []
            const splits = DATE_SPLITS[token.length]

            if (!splits) continue

            for (const [k, l] of splits) {
                const dateMonthYear = mapIntsToDmy([
                    parseInt(token.slice(0, k)),
                    parseInt(token.slice(k, l)),
                    parseInt(token.slice(l)),
                ])

                if (dateMonthYear !== null) candidates.push(dateMonthYear)
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

    for (let i = 0; i <= password.length - 6; i++) {
        for (let j = i + 5; j <= i + 9 && j < password.length; j++) {
            const token = password.slice(i, j + 1)
            const rxMatch = maybeDateWithSep.exec(token)

            if (!rxMatch) continue

            const dateMonthYear = mapIntsToDmy([parseInt(rxMatch[1]), parseInt(rxMatch[3]), parseInt(rxMatch[4])])

            if (dateMonthYear === null) continue

            matches.push({
                pattern: "date",
                token,
                i,
                j,
                separator: rxMatch[2],
                year: dateMonthYear.year,
                month: dateMonthYear.month,
                day: dateMonthYear.day,
            })
        }
    }

    return sorted(
        matches.filter((match) => {
            const isSub = matches.some((other) => other !== match && other.i <= match.i && other.j >= match.j)

            return !isSub
        }),
    )
}

interface DayMonthYear {
    day: number
    month: number
    year: number
}

function mapIntsToDmy(ints: [number, number, number]): DayMonthYear | null {
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
                return {
                    year: y,
                    month: dm.month,
                    day: dm.day,
                }
            } else {
                return null
            }
        }
    }

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
            return {
                day: d,
                month: m,
            }
        }
    }

    return null
}

function twoToFourDigitYear(year: number): number {
    if (year > 99) return year
    if (year > 50) return year + 1900

    return year + 2000
}
