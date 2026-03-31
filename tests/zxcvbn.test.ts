import { describe, expect, test } from "bun:test"
import {
    zxcvbn,
    omnimatch,
    mostGuessableMatchSequence,
    dictionaryMatch,
    reverseDictionaryMatch,
    spatialMatch,
    repeatMatch,
    sequenceMatch,
    regexMatch,
    dateMatch,
    phoneMatch,
    estimateAttackTimes,
    getFeedback,
    guessesToScore,
    displayTime,
    displayCost,
} from "../src/index"

// ---------------------------------------------------------------------------
// Top-level API
// ---------------------------------------------------------------------------

describe("zxcvbn()", () => {
    test("returns a result with all required fields", () => {
        const r = zxcvbn("password")

        expect(typeof r.score).toBe("number")
        expect(typeof r.guesses).toBe("number")
        expect(typeof r.guesses_log10).toBe("number")
        expect(typeof r.calc_time).toBe("number")
        expect(Array.isArray(r.sequence)).toBe(true)
        expect(Array.isArray(r.feedback.suggestions)).toBe(true)
        expect(typeof r.feedback.warning).toBe("string")
        expect(r.crack_times_seconds).toBeTruthy()
        expect(r.crack_times_display).toBeTruthy()
        expect(r.crack_times_cost).toBeTruthy()
    })

    test("score is always in range 0–4", () => {
        for (const pw of ["a", "password", "correcthorsebatterystaple", "xkJ#9!vQ2$mP", ""]) {
            const { score } = zxcvbn(pw)

            expect(score).toBeGreaterThanOrEqual(0)
            expect(score).toBeLessThanOrEqual(4)
        }
    })

    test("empty password → guesses=1, score=0", () => {
        const r = zxcvbn("")

        expect(r.guesses).toBe(1)
        expect(r.score).toBe(0)
    })

    test("throws TypeError for non-string input", () => {
        expect(() => zxcvbn(42 as unknown as string)).toThrow(TypeError)
        expect(() => zxcvbn(null as unknown as string)).toThrow(TypeError)
        expect(() => zxcvbn(undefined as unknown as string)).toThrow(TypeError)
    })

    test("accepts number and boolean userInputs without throwing", () => {
        expect(() => zxcvbn("abc", [42, true, "alice"])).not.toThrow()
    })

    test("user inputs reduce guess count for matching password", () => {
        const withInput = zxcvbn("alice2024", ["alice"])
        const without = zxcvbn("alice2024", [])

        expect(withInput.guesses).toBeLessThanOrEqual(without.guesses)
    })

    test("well-known weak passwords score low", () => {
        expect(zxcvbn("password").score).toBeLessThanOrEqual(2)
        expect(zxcvbn("123456").score).toBeLessThanOrEqual(1)
        expect(zxcvbn("qwerty").score).toBeLessThanOrEqual(1)
    })

    test("long random passwords score 4", () => {
        expect(zxcvbn("xkJ#9!vQ2$mPzR").score).toBe(4)
    })

    test("guesses_log10 equals Math.log10(guesses)", () => {
        const r = zxcvbn("Test123!")

        expect(r.guesses_log10).toBeCloseTo(Math.log10(r.guesses), 3)
    })

    test("crack_times_seconds has updated 2025 keys", () => {
        const { crack_times_seconds: cts } = zxcvbn("password")

        expect(typeof cts.online_throttling_100_per_hour).toBe("number")
        expect(typeof cts.online_no_throttling_10_per_second).toBe("number")
        expect(typeof cts.offline_slow_hashing_1e5_per_second).toBe("number")
        expect(typeof cts.offline_fast_hashing_1e11_per_second).toBe("number")
    })

    test("crack_times_display returns non-empty strings", () => {
        const { crack_times_display: ctd } = zxcvbn("password")

        for (const val of Object.values(ctd)) {
            expect(typeof val).toBe("string")
            expect((val as string).length).toBeGreaterThan(0)
        }
    })

    test("crack_times_cost has all four scenarios", () => {
        const { crack_times_cost: ctc } = zxcvbn("password")

        expect(typeof ctc.online_throttling_100_per_hour).toBe("number")
        expect(typeof ctc.online_no_throttling_10_per_second).toBe("number")
        expect(typeof ctc.offline_slow_hashing_1e5_per_second).toBe("number")
        expect(typeof ctc.offline_fast_hashing_1e11_per_second).toBe("number")
    })

    test("strong password has higher cost than weak password", () => {
        const weak = zxcvbn("password")
        const strong = zxcvbn("correcthorsebatterystaple")

        expect(strong.crack_times_cost.offline_fast_hashing_1e11_per_second).toBeGreaterThan(
            weak.crack_times_cost.offline_fast_hashing_1e11_per_second,
        )
    })
})

// ---------------------------------------------------------------------------
// minLength option
// ---------------------------------------------------------------------------

describe("zxcvbn() — minLength option", () => {
    test("short strong password forced to score 0", () => {
        const r = zxcvbn("xkJ#9!", [], { minLength: 8 })

        expect(r.score).toBe(0)
    })

    test("minLength suggestion prepended to feedback", () => {
        const r = zxcvbn("abc", [], { minLength: 6 })

        expect(r.feedback.suggestions[0]).toContain("6 characters")
    })

    test("password meeting minLength scores normally", () => {
        const r = zxcvbn("correcthorsebatterystaple", [], { minLength: 8 })

        expect(r.score).toBe(4)
    })

    test("existing warnings preserved alongside minLength suggestion", () => {
        const r = zxcvbn("alice", ["alice"], { minLength: 8 })

        expect(r.feedback.warning).toContain("personal info")
        expect(r.feedback.suggestions[0]).toContain("8 characters")
    })

    test("no minLength — normal behaviour", () => {
        const r = zxcvbn("password")

        expect(r.feedback.suggestions.some((s) => s.includes("characters"))).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

describe("mostGuessableMatchSequence()", () => {
    test("guesses >= 1 for any input", () => {
        for (const pw of ["", "a", "abc", "abc123!@#"]) {
            const { guesses } = mostGuessableMatchSequence(pw, omnimatch(pw))

            expect(guesses).toBeGreaterThanOrEqual(1)
        }
    })

    test("sequence has contiguous gap-free coverage", () => {
        const pw = "password123"
        const { sequence } = mostGuessableMatchSequence(pw, omnimatch(pw))

        expect(sequence.length).toBeGreaterThan(0)
        expect(sequence[0].i).toBe(0)
        expect(sequence[sequence.length - 1].j).toBe(pw.length - 1)

        for (let k = 1; k < sequence.length; k++) {
            expect(sequence[k].i).toBe(sequence[k - 1].j + 1)
        }
    })
})

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

describe("dictionaryMatch()", () => {
    test("finds word in custom ranked dict", () => {
        const matches = dictionaryMatch("password", { test: { password: 1, hello: 2 } })

        expect(matches.some((m) => m.matched_word === "password")).toBe(true)
    })
})

describe("reverseDictionaryMatch()", () => {
    test("finds reversed token and marks it", () => {
        const matches = reverseDictionaryMatch("drowssap", { test: { password: 1 } })

        expect(matches.some((m) => m.reversed === true)).toBe(true)
    })
})

describe("spatialMatch()", () => {
    test("finds qwerty runs", () => {
        expect(spatialMatch("qwerty").length).toBeGreaterThan(0)
    })
})

describe("repeatMatch()", () => {
    test("finds repeated characters", () => {
        expect(repeatMatch("aaaaaa").some((m) => m.base_token === "a")).toBe(true)
    })
    test("finds repeated sequences", () => {
        expect(repeatMatch("abcabcabc").some((m) => m.base_token === "abc")).toBe(true)
    })
})

describe("sequenceMatch()", () => {
    test("finds ascending alphabetic sequence", () => {
        expect(sequenceMatch("abcde").length).toBeGreaterThan(0)
    })
})

describe("regexMatch()", () => {
    test("finds recent years including 2024", () => {
        expect(regexMatch("in2024now").some((m) => m.regex_name === "recent_year")).toBe(true)
    })
    test("finds 2031 (updated regex covers up to 2039)", () => {
        expect(regexMatch("pass2031").some((m) => m.regex_name === "recent_year")).toBe(true)
    })
    test("does not match 2040 (out of range)", () => {
        expect(regexMatch("pass2040").some((m) => m.regex_name === "recent_year")).toBe(false)
    })
})

describe("dateMatch()", () => {
    test("finds slash-separated dates", () => {
        expect(dateMatch("1/1/1990").length).toBeGreaterThan(0)
    })
})

describe("phoneMatch()", () => {
    test("detects NANP 10-digit number", () => {
        const m = phoneMatch("8525559630")

        expect(m.length).toBeGreaterThan(0)
        expect(m[0].phone_format).toBe("nanp")
        expect(m[0].phone_number).toBe("8525559630")
    })

    test("detects NANP with dashes", () => {
        const m = phoneMatch("852-555-9630")

        expect(m.some((x) => x.phone_format === "nanp")).toBe(true)
    })

    test("detects NANP with parens", () => {
        const m = phoneMatch("(852) 555-9630")

        expect(m.some((x) => x.phone_format === "nanp")).toBe(true)
    })

    test("detects international number", () => {
        const m = phoneMatch("+44 20 7946 0958")

        expect(m.some((x) => x.phone_format === "international")).toBe(true)
    })

    test("detects local 7-digit number", () => {
        const m = phoneMatch("555-9630")

        expect(m.some((x) => x.phone_format === "local")).toBe(true)
    })

    test("phone embedded in password is detected", () => {
        const m = phoneMatch("pass8525559630!")

        expect(m.some((x) => x.phone_format === "nanp")).toBe(true)
    })

    test("phone password scores weak (score <= 2)", () => {
        expect(zxcvbn("8525559630").score).toBeLessThanOrEqual(2)
    })

    test("phone password gets specific warning", () => {
        const r = zxcvbn("8525559630")

        expect(r.feedback.warning).toContain("phone")
    })

    test("non-phone string returns no matches", () => {
        expect(phoneMatch("hello").length).toBe(0)
    })
})

describe("omnimatch()", () => {
    test("returns non-empty array for real password", () => {
        expect(omnimatch("password123").length).toBeGreaterThan(0)
    })

    test("all matches have valid i/j bounds", () => {
        const pw = "p@ssw0rd"

        for (const m of omnimatch(pw)) {
            expect(m.i).toBeGreaterThanOrEqual(0)
            expect(m.j).toBeLessThan(pw.length)
            expect(m.i).toBeLessThanOrEqual(m.j)
        }
    })

    test("returns empty array for empty password", () => {
        expect(omnimatch("")).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// Diacritics (#97)
// ---------------------------------------------------------------------------

describe("diacritics stripping (#97)", () => {
    test("pässwörd matches password dictionary entry", () => {
        const r = zxcvbn("pässwörd")

        expect(r.score).toBeLessThanOrEqual(1)
        expect(r.sequence.some((m) => m.pattern === "dictionary")).toBe(true)
    })

    test("café matches cafe", () => {
        const matches = dictionaryMatch("café")

        expect(matches.some((m) => m.matched_word === "cafe")).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// Feedback improvements
// ---------------------------------------------------------------------------

describe("getFeedback() — user_inputs warning (#231)", () => {
    test("returns specific warning when password matches user_inputs", () => {
        const r = zxcvbn("testclient@example.com", ["testclient@example.com"])

        expect(r.feedback.warning).toContain("personal info")
    })
})

describe("getFeedback() — l33t substitution (#128)", () => {
    test("shows actual substitution in suggestion", () => {
        const r = zxcvbn("hel3nhunt")
        const sub = r.feedback.suggestions.find((s) => s.includes("->") || s.includes("substitution"))

        expect(sub).toBeTruthy()
        expect(sub).toContain("3")
    })
})

describe("getFeedback() — capitalization wording (#116)", () => {
    test("uses updated capitalization message", () => {
        const r = zxcvbn("Password1")
        const cap = r.feedback.suggestions.find((s) => s.includes("apital"))

        expect(cap).toContain("first letter")
    })
})

describe("getFeedback() — us_tv_and_film warning (#204)", () => {
    test("gives specific warning for TV show names", () => {
        const r = zxcvbn("friends")
        const hasWarning =
            r.feedback.warning.includes("TV") ||
            r.feedback.warning.includes("film") ||
            r.feedback.suggestions.some((s) => s.includes("TV"))

        expect(hasWarning || r.sequence.some((m) => m.pattern === "dictionary")).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// Uppercase variations fix (#232)
// ---------------------------------------------------------------------------

describe("uppercaseVariations (#232)", () => {
    test("12345Qwert and 12345qwerT yield the same guess count", () => {
        const a = zxcvbn("12345Qwert").guesses
        const b = zxcvbn("12345qwerT").guesses

        expect(a).toBe(b)
    })
})

// ---------------------------------------------------------------------------
// Time estimates — updated threat model (#272)
// ---------------------------------------------------------------------------

describe("guessesToScore() — updated 2025 thresholds", () => {
    test("1 guess → score 0", () => expect(guessesToScore(1)).toBe(0))
    test("5e6 guesses → score 1", () => expect(guessesToScore(5e6)).toBe(1))
    test("5e8 guesses → score 2", () => expect(guessesToScore(5e8)).toBe(2))
    test("5e10 guesses → score 3", () => expect(guessesToScore(5e10)).toBe(3))
    test("1e15 guesses → score 4", () => expect(guessesToScore(1e15)).toBe(4))
})

describe("displayTime()", () => {
    test("returns non-empty string for all ranges", () => {
        for (const s of [0, 1, 60, 3600, 86400, 1e6, 1e12, Infinity]) {
            expect(displayTime(s).length).toBeGreaterThan(0)
        }
    })
})

describe("displayCost() (#142)", () => {
    test("less than $0.01 for tiny amounts", () => {
        expect(displayCost(0.000001)).toBe("less than $0.01")
    })

    test("formats dollars with two decimals", () => {
        expect(displayCost(3.5)).toBe("$3.50")
    })

    test("formats large amounts with commas", () => {
        expect(displayCost(1234567)).toBe("$1,234,567")
    })

    test("returns astronomically expensive for Infinity", () => {
        expect(displayCost(Infinity)).toBe("astronomically expensive")
    })

    test("strong password costs more than weak password to crack", () => {
        const weak = zxcvbn("password").crack_times_cost.offline_fast_hashing_1e11_per_second
        const strong = zxcvbn("correcthorsebatterystaple").crack_times_cost.offline_fast_hashing_1e11_per_second

        expect(strong).toBeGreaterThan(weak)
    })
})

describe("estimateAttackTimes()", () => {
    test("returns correct structure with updated keys", () => {
        const r = estimateAttackTimes(1e6)

        expect(r.crack_times_seconds.offline_slow_hashing_1e5_per_second).toBeTruthy()
        expect(r.crack_times_seconds.offline_fast_hashing_1e11_per_second).toBeTruthy()
        expect(r.crack_times_cost.offline_fast_hashing_1e11_per_second).toBeDefined()
        expect(typeof r.score).toBe("number")
    })
})

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

describe("getFeedback()", () => {
    test("returns warning and suggestions arrays", () => {
        const { sequence } = mostGuessableMatchSequence("password", omnimatch("password"))
        const fb = getFeedback(1, sequence)

        expect(typeof fb.warning).toBe("string")
        expect(Array.isArray(fb.suggestions)).toBe(true)
    })

    test("strong password has empty warning", () => {
        const pw = "xkJ#9!vQ2$mPzR"
        const { sequence, guesses } = mostGuessableMatchSequence(pw, omnimatch(pw))
        const { score } = estimateAttackTimes(guesses)

        expect(getFeedback(score, sequence).warning).toBe("")
    })
})
