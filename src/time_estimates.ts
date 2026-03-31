import type { AttackTimes, CrackTimesSeconds, CrackTimesDisplay, CrackTimesCost } from "./types"

// Attack scenario guesses-per-second rates
const ATTACK_RATES = {
    online_throttling_100_per_hour: 100 / 3600,
    online_no_throttling_10_per_second: 10,
    offline_slow_hashing_1e5_per_second: 1e5,
    offline_fast_hashing_1e11_per_second: 1e11,
} as const

/**
 * Approximate USD cost per second for each attack scenario.
 * Based on "2025" cloud GPU rental rates (AWS/GCP spot instances).
 *
 * - Online attacks: negligible server costs (~$0.001–$0.01/hr)
 * - Offline slow hash (bcrypt): ~$0.50/hr GPU instance
 * - Offline fast hash (MD5/SHA1): ~$3.00/hr high-end GPU instance
 **/
const ATTACK_COSTS_PER_SECOND = {
    online_throttling_100_per_hour: 0.001 / 3600,
    online_no_throttling_10_per_second: 0.01 / 3600,
    offline_slow_hashing_1e5_per_second: 0.5 / 3600,
    offline_fast_hashing_1e11_per_second: 3.0 / 3600,
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

    const crackTimesCost = {} as CrackTimesCost

    for (const [scenario, seconds] of Object.entries(crackTimesSeconds) as Array<[ScenarioKey, number]>) {
        const costPerSecond = ATTACK_COSTS_PER_SECOND[scenario]
        ;(crackTimesCost as Record<ScenarioKey, number>)[scenario] = seconds * costPerSecond
    }

    return {
        crack_times_seconds: crackTimesSeconds,
        crack_times_display: crackTimesDisplay,
        crack_times_cost: crackTimesCost,
        score: guessesToScore(guesses),
    }
}

const DELTA = 5

// Map a guess count to a score 0–4
export function guessesToScore(guesses: number): 0 | 1 | 2 | 3 | 4 {
    if (guesses < 1e6 + DELTA) return 0
    if (guesses < 1e8 + DELTA) return 1
    if (guesses < 1e10 + DELTA) return 2
    if (guesses < 1e12 + DELTA) return 3

    return 4
}

/**
 * Convert a USD cost to a human-readable string.
 *
 * @example
 * displayCost(0.000001)  // "less than $0.01"
 * displayCost(0.05)      // "$0.05"
 * displayCost(1234.56)   // "$1,234.56"
 * displayCost(Infinity)  // "astronomically expensive"
 **/
export function displayCost(usd: number): string {
    if (!isFinite(usd) || usd > 1e15) return "astronomically expensive"

    if (usd < 0.01) return "less than $0.01"

    if (usd < 1) return `$${usd.toFixed(2)}`

    if (usd < 1000) return `$${usd.toFixed(2)}`

    return `$${Math.round(usd).toLocaleString("en-US")}`
}

// Convert seconds to a human-readable string
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
