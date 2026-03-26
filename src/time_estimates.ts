// ============================================================
// zxcvbn-ts — Time Estimates
// ============================================================

import type { AttackTimes, CrackTimesSeconds, CrackTimesDisplay } from "./types"

/** Attack scenario guesses-per-second rates. */
const ATTACK_RATES = {
    online_throttling_100_per_hour: 100 / 3600,
    online_no_throttling_10_per_second: 10,
    offline_slow_hashing_1e4_per_second: 1e4,
    offline_fast_hashing_1e10_per_second: 1e10,
} as const

type ScenarioKey = keyof typeof ATTACK_RATES

export function estimateAttackTimes(guesses: number): AttackTimes {
    const crackTimesSeconds = {} as CrackTimesSeconds

    for (const [scenario, rate] of Object.entries(ATTACK_RATES) as Array<[ScenarioKey, number]>) {
        ;(crackTimesSeconds as Record<ScenarioKey, number>)[scenario] = guesses / rate
    }

    const crackTimesDisplay = {} as CrackTimesDisplay

    for (const [scenario, seconds] of Object.entries(crackTimesSeconds) as Array<[ScenarioKey, number]>) {
        ;(crackTimesDisplay as Record<ScenarioKey, string>)[scenario] = displayTime(seconds)
    }

    return {
        crack_times_seconds: crackTimesSeconds,
        crack_times_display: crackTimesDisplay,
        score: guessesToScore(guesses),
    }
}

const DELTA = 5

/** Map a guess count to a score 0–4. */
export function guessesToScore(guesses: number): 0 | 1 | 2 | 3 | 4 {
    if (guesses < 1e3 + DELTA) return 0
    if (guesses < 1e6 + DELTA) return 1
    if (guesses < 1e8 + DELTA) return 2
    if (guesses < 1e10 + DELTA) return 3

    return 4
}

/** Convert seconds to a human-readable string. */
export function displayTime(seconds: number): string {
    const MINUTE = 60
    const HOUR = MINUTE * 60
    const DAY = HOUR * 24
    const MONTH = DAY * 31
    const YEAR = MONTH * 12
    const CENTURY = YEAR * 100

    let displayNum: number | null
    let displayStr: string

    if (seconds < 1) {
        displayNum = null
        displayStr = "less than a second"
    } else if (seconds < MINUTE) {
        displayNum = Math.round(seconds)
        displayStr = `${displayNum} second`
    } else if (seconds < HOUR) {
        displayNum = Math.round(seconds / MINUTE)
        displayStr = `${displayNum} minute`
    } else if (seconds < DAY) {
        displayNum = Math.round(seconds / HOUR)
        displayStr = `${displayNum} hour`
    } else if (seconds < MONTH) {
        displayNum = Math.round(seconds / DAY)
        displayStr = `${displayNum} day`
    } else if (seconds < YEAR) {
        displayNum = Math.round(seconds / MONTH)
        displayStr = `${displayNum} month`
    } else if (seconds < CENTURY) {
        displayNum = Math.round(seconds / YEAR)
        displayStr = `${displayNum} year`
    } else {
        displayNum = null
        displayStr = "centuries"
    }

    if (displayNum !== null && displayNum !== 1) {
        displayStr += "s"
    }

    return displayStr
}
