import type { AttackTimes, CrackTimesSeconds, CrackTimesDisplay, CrackTimesCost } from "./types"

/**
 * Attack scenario guesses-per-second rates.
 *
 * Updated from the original zxcvbn (2012) values to reflect 2025 hardware:
 *
 * - Online throttled:    100/hr — unchanged, limited by server policy
 * - Online fast:         10/s  — unchanged, limited by network/server
 * - Offline slow hash:   1e4/s → 1e5/s — modern bcrypt on GPU (RTX 4090:
 *                        ~200 kH/s bcrypt; we use 1e5 as a conservative
 *                        single-GPU estimate)
 * - Offline fast hash:   1e10/s → 1e11/s — modern MD5/SHA1 on GPU
 *                        (RTX 4090: ~150 GH/s MD5; we use 1e11 as a
 *                        conservative single consumer GPU estimate)
 *
 * **Sources:** hashcat RTX 4090 benchmarks (2024), See {@link https://onlinehashcrack.com} for more info.
 **/
const ATTACK_RATES = {
    online_throttling_100_per_hour: 100 / 3600,
    online_no_throttling_10_per_second: 10,
    offline_slow_hashing_1e5_per_second: 1e5,
    offline_fast_hashing_1e11_per_second: 1e11,
} as const

/**
 * Approximate USD cost per second for each attack scenario.
 * Based on 2025 cloud GPU rental rates (AWS/GCP spot instances).
 *
 * - Online attacks:      negligible server costs (~$0.001–$0.01/hr)
 * - Offline slow hash:   ~$0.50/hr GPU instance (bcrypt, scrypt)
 * - Offline fast hash:   ~$3.00/hr high-end GPU instance (MD5, SHA1)
 **/
const ATTACK_COSTS_PER_SECOND = {
    online_throttling_100_per_hour: 0.001 / 3600,
    online_no_throttling_10_per_second: 0.01 / 3600,
    offline_slow_hashing_1e5_per_second: 0.5 / 3600,
    offline_fast_hashing_1e11_per_second: 3.0 / 3600,
} as const

type ScenarioKey = keyof typeof ATTACK_RATES

export function estimateAttackTimes(guesses: number, customHashesPerSecond?: number): AttackTimes {
    const crackTimesSeconds = {} as CrackTimesSeconds

    for (const [scenario, rate] of Object.entries(ATTACK_RATES) as Array<[ScenarioKey, number]>) {
        ;(crackTimesSeconds as Record<ScenarioKey, number>)[scenario] = guesses / rate
    }

    if (customHashesPerSecond != null && customHashesPerSecond > 0) {
        ;(crackTimesSeconds as unknown as Record<string, number>)["custom_hash_rate"] = guesses / customHashesPerSecond
    }

    const crackTimesDisplay = {} as CrackTimesDisplay

    for (const [scenario, seconds] of Object.entries(crackTimesSeconds) as Array<[string, number]>) {
        ;(crackTimesDisplay as unknown as Record<string, string>)[scenario] = displayTime(seconds)
    }

    const crackTimesCost = {} as CrackTimesCost

    for (const [scenario, seconds] of Object.entries(crackTimesSeconds) as Array<[ScenarioKey, number]>) {
        const costPerSecond = (ATTACK_COSTS_PER_SECOND as Record<string, number>)[scenario]

        ;(crackTimesCost as unknown as Record<string, number>)[scenario] = seconds * costPerSecond
    }

    return {
        crack_times_seconds: crackTimesSeconds,
        crack_times_display: crackTimesDisplay,
        crack_times_cost: crackTimesCost,
        score: guessesToScore(guesses),
    }
}

const DELTA = 5

/**
 * Map a guess count to a score 0–4.
 *
 * Thresholds updated from original zxcvbn to reflect 2025 attack speeds.
 * The offline fast hash rate is now 1e11/s (RTX 4090), so a password that
 * takes <1e9 guesses is cracked in under 10 seconds — definitely score 0.
 *
 * Thresholds (approximate crack time on offline fast hash at 1e11/s):
 *   - **score 0:** < 1e6  guesses — instant (< 10µs)
 *   - **score 1:** < 1e8  guesses — under 1ms
 *   - **score 2:** < 1e10 guesses — under 100ms
 *   - **score 3:** < 1e12 guesses — under 10s
 *   - **score 4:** >= 1e12 guesses — hours or more
 **/
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
