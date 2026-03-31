// Plain Node.js test runner — no test framework required.
// Run with:  node tests/run.js
// Or:        npm test

"use strict"

const assert = require("node:assert/strict")
const {
    zxcvbn,
    omnimatch,
    dictionaryMatch,
    reverseDictionaryMatch,
    spatialMatch,
    repeatMatch,
    sequenceMatch,
    regexMatch,
    dateMatch,
    phoneMatch,
    mostGuessableMatchSequence,
    estimateAttackTimes,
    getFeedback,
    guessesToScore,
    displayTime,
    displayCost,
} = require("../dist/cjs/index")

// ---------------------------------------------------------------------------
// Tiny test harness
// ---------------------------------------------------------------------------
let passed = 0
let failed = 0

function test(name, fn) {
    try {
        fn()
        console.log(`  ✓  ${name}`)
        passed++
    } catch (err) {
        console.log(`  ✗  ${name}`)
        console.log(`     ${err.message}`)
        failed++
    }
}

function suite(name, fn) {
    console.log(`\n${name}`)

    fn()
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

suite("zxcvbn() — top-level API", () => {
    test("returns a result object with all required fields", () => {
        const r = zxcvbn("password")
        assert.equal(typeof r.score, "number")
        assert.equal(typeof r.guesses, "number")
        assert.equal(typeof r.guesses_log10, "number")
        assert.equal(typeof r.calc_time, "number")
        assert.ok(Array.isArray(r.sequence))
        assert.ok(Array.isArray(r.feedback.suggestions))
        assert.equal(typeof r.feedback.warning, "string")
        assert.ok(r.crack_times_seconds)
        assert.ok(r.crack_times_display)
    })

    test("score is in range 0–4", () => {
        for (const pw of ["a", "password", "correcthorsebatterystaple", "xkJ#9!vQ2$mP", ""]) {
            const { score } = zxcvbn(pw)
            assert.ok(score >= 0 && score <= 4, `score=${score} out of range for "${pw}"`)
        }
    })

    test("empty password → guesses=1, score=0", () => {
        const r = zxcvbn("")

        assert.equal(r.guesses, 1)
        assert.equal(r.score, 0)
    })

    test("throws TypeError for non-string input", () => {
        assert.throws(() => zxcvbn(42), TypeError)
        assert.throws(() => zxcvbn(null), TypeError)
        assert.throws(() => zxcvbn(undefined), TypeError)
        assert.throws(() => zxcvbn([]), TypeError)
    })

    test("accepts number and boolean userInputs without throwing", () => {
        assert.doesNotThrow(() => zxcvbn("abc", [42, true, "alice"]))
    })

    test("user inputs reduce guess count for matching password", () => {
        const withInput = zxcvbn("alice2024", ["alice"])
        const without = zxcvbn("alice2024", [])

        assert.ok(withInput.guesses <= without.guesses, `expected ${withInput.guesses} <= ${without.guesses}`)
    })

    test("well-known weak passwords score low", () => {
        assert.ok(zxcvbn("password").score <= 2)
        assert.ok(zxcvbn("123456").score <= 1)
        assert.ok(zxcvbn("qwerty").score <= 1)
    })

    test("long random passwords score high", () => {
        assert.equal(zxcvbn("xkJ#9!vQ2$mPzR").score, 4)
    })

    test("guesses_log10 matches Math.log10(guesses)", () => {
        const r = zxcvbn("Test123!")

        assert.ok(
            Math.abs(r.guesses_log10 - Math.log10(r.guesses)) < 0.001,
            `guesses_log10 mismatch: ${r.guesses_log10} vs ${Math.log10(r.guesses)}`,
        )
    })

    test("crack_times_seconds has all four attack scenarios", () => {
        const { crack_times_seconds: cts } = zxcvbn("password")

        assert.equal(typeof cts.online_throttling_100_per_hour, "number")
        assert.equal(typeof cts.online_no_throttling_10_per_second, "number")
        assert.equal(typeof cts.offline_slow_hashing_1e5_per_second, "number")
        assert.equal(typeof cts.offline_fast_hashing_1e11_per_second, "number")
    })

    test("crack_times_display returns human-readable strings", () => {
        const { crack_times_display: ctd } = zxcvbn("password")

        for (const val of Object.values(ctd)) {
            assert.equal(typeof val, "string")
            assert.ok(val.length > 0)
        }
    })
})

// ---------------------------------------------------------------------------

suite("scoring — mostGuessableMatchSequence", () => {
    test("returns guesses >= 1 for any input", () => {
        for (const pw of ["", "a", "abc", "abc123!@#"]) {
            const matches = omnimatch(pw)
            const { guesses } = mostGuessableMatchSequence(pw, matches)

            assert.ok(guesses >= 1, `guesses < 1 for "${pw}"`)
        }
    })

    test("longer password has more guesses than shorter (all else equal)", () => {
        const short = mostGuessableMatchSequence("abc", omnimatch("abc")).guesses
        const long = mostGuessableMatchSequence("abcdef", omnimatch("abcdef")).guesses

        assert.ok(long >= short, `long=${long} short=${short}`)
    })

    test("sequence covers the full password (no gaps)", () => {
        const pw = "password123"
        const { sequence } = mostGuessableMatchSequence(pw, omnimatch(pw))

        assert.ok(sequence.length > 0)
        // First match starts at 0
        assert.equal(sequence[0].i, 0)
        // Last match ends at pw.length-1
        assert.equal(sequence[sequence.length - 1].j, pw.length - 1)

        // Contiguous coverage
        for (let k = 1; k < sequence.length; k++) {
            assert.equal(sequence[k].i, sequence[k - 1].j + 1)
        }
    })
})

// ---------------------------------------------------------------------------

suite("matching — individual matchers", () => {
    test("dictionaryMatch finds 'password' in ranked dict", () => {
        const matches = dictionaryMatch("password", {
            test_dict: { password: 1, hello: 2, world: 3 },
        })

        assert.ok(matches.some((m) => m.matched_word === "password"))
    })

    test("reverseDictionaryMatch finds reversed token", () => {
        const matches = reverseDictionaryMatch("drowssap", {
            test_dict: { password: 1 },
        })

        assert.ok(matches.some((m) => m.reversed === true))
    })

    test("spatialMatch finds qwerty runs", () => {
        const matches = spatialMatch("qwerty")

        assert.ok(matches.length > 0, "expected at least one spatial match")
        assert.ok(matches.every((m) => m.pattern === "spatial"))
    })

    test("repeatMatch finds aaabbb style repeats", () => {
        const matches = repeatMatch("aaabbb")

        assert.ok(matches.some((m) => m.base_token === "a" || m.base_token === "b"))
    })

    test("sequenceMatch finds 'abc'", () => {
        const matches = sequenceMatch("abcde")

        assert.ok(matches.length > 0)
        assert.ok(matches.every((m) => m.pattern === "sequence"))
    })

    test("regexMatch finds recent years", () => {
        const matches = regexMatch("in2019now")

        assert.ok(matches.some((m) => m.regex_name === "recent_year"))
    })

    test("dateMatch finds obvious date patterns", () => {
        const matches = dateMatch("1/1/1990")

        assert.ok(matches.length > 0)
        assert.ok(matches.every((m) => m.pattern === "date"))
    })

    test("omnimatch returns an array", () => {
        const matches = omnimatch("password123")

        assert.ok(Array.isArray(matches))
        assert.ok(matches.length > 0)
    })

    test("all matches have i <= j within password bounds", () => {
        const pw = "p@ssw0rd"

        for (const m of omnimatch(pw)) {
            assert.ok(m.i >= 0, `i=${m.i} < 0`)
            assert.ok(m.j < pw.length, `j=${m.j} >= ${pw.length}`)
            assert.ok(m.i <= m.j, `i=${m.i} > j=${m.j}`)
        }
    })
})

// ---------------------------------------------------------------------------

suite("time_estimates — estimateAttackTimes / displayTime", () => {
    test("score 0 for very weak (1 guess)", () => {
        assert.equal(guessesToScore(1), 0)
    })

    test("score 4 for very strong (1e15 guesses)", () => {
        assert.equal(guessesToScore(1e15), 4)
    })

    test("displayTime returns a non-empty string for various inputs", () => {
        for (const seconds of [0, 1, 60, 3600, 86400, 1e6, 1e12, Infinity]) {
            const s = displayTime(seconds)

            assert.equal(typeof s, "string")
            assert.ok(s.length > 0, `empty string for seconds=${seconds}`)
        }
    })

    test("estimateAttackTimes returns correct structure with 2025 keys", () => {
        const result = estimateAttackTimes(1e6)

        assert.ok(result.crack_times_seconds.offline_slow_hashing_1e5_per_second !== undefined)
        assert.ok(result.crack_times_seconds.offline_slow_hashing_1e11_per_second !== undefined)
        assert.ok(result.crack_times_cost)
        assert.equal(typeof result.score, "number")
    })

    test("displayCost formats correctly", () => {
        assert.equal(displayCost(0.000001), "less than $0.01")
        assert.equal(displayCost(3.5), "$3.50")
        assert.equal(displayCost(Infinity), "astronomically expensive")
    })
})

// ---------------------------------------------------------------------------

suite("feedback — getFeedback", () => {
    test("returns warning and suggestions arrays", () => {
        const { sequence } = mostGuessableMatchSequence("password", omnimatch("password"))
        const fb = getFeedback(1, sequence)

        assert.equal(typeof fb.warning, "string")
        assert.ok(Array.isArray(fb.suggestions))
    })

    test("no feedback for strong password", () => {
        const pw = "xkJ#9!vQ2$mPzR"
        const { sequence, guesses } = mostGuessableMatchSequence(pw, omnimatch(pw))
        const { score } = estimateAttackTimes(guesses)
        const fb = getFeedback(score, sequence)

        // Strong passwords may still have suggestions but warning should be empty
        assert.equal(fb.warning, "")
    })

    test("gives warning for common dictionary word", () => {
        const { sequence, guesses } = mostGuessableMatchSequence("password", omnimatch("password"))
        const { score } = estimateAttackTimes(guesses)
        const fb = getFeedback(score, sequence)

        assert.ok(fb.warning.length > 0 || fb.suggestions.length > 0, "expected some feedback for 'password'")
    })
})

// ---------------------------------------------------------------------------

suite("phoneMatch()", () => {
    test("detects NANP number", () => {
        const m = phoneMatch("8525559630")

        assert.ok(m.length > 0)
        assert.equal(m[0].phone_format, "nanp")
    })

    test("detects NANP with dashes", () => {
        assert.ok(phoneMatch("852-555-9630").some((x) => x.phone_format === "nanp"))
    })

    test("detects international number", () => {
        assert.ok(phoneMatch("+44 20 7946 0958").some((x) => x.phone_format === "international"))
    })

    test("phone password scores weak", () => {
        assert.ok(zxcvbn("8525559630").score <= 2)
    })

    test("phone password gets warning", () => {
        const r = zxcvbn("8525559630")

        assert.ok(r.feedback.warning.includes("phone") || r.feedback.warning.includes("American"))
    })

    test("non-phone returns no matches", () => {
        assert.equal(phoneMatch("hello").length, 0)
    })
})

// ---------------------------------------------------------------------------

suite("minLength option (#300)", () => {
    test("short strong password forced to score 0", () => {
        assert.equal(zxcvbn("xkJ#9!", [], { minLength: 8 }).score, 0)
    })

    test("minLength suggestion prepended", () => {
        const r = zxcvbn("abc", [], { minLength: 6 })

        assert.ok(r.feedback.suggestions[0].includes("6 characters"))
    })

    test("password meeting minLength scores normally", () => {
        assert.equal(zxcvbn("correcthorsebatterystaple", [], { minLength: 8 }).score, 4)
    })

    test("no minLength — no length suggestion added", () => {
        const r = zxcvbn("password")

        assert.ok(!r.feedback.suggestions.some((s) => s.includes("characters")))
    })
})

// ---------------------------------------------------------------------------

suite("crack_times_cost & displayCost (#142)", () => {
    test("crack_times_cost has all four scenarios", () => {
        const { crack_times_cost: ctc } = zxcvbn("password")

        assert.equal(typeof ctc.online_throttling_100_per_hour, "number")
        assert.equal(typeof ctc.offline_fast_hashing_1e11_per_second, "number")
    })

    test("strong password costs more than weak", () => {
        const weak = zxcvbn("password").crack_times_cost.offline_fast_hashing_1e11_per_second
        const strong = zxcvbn("correcthorsebatterystaple").crack_times_cost.offline_fast_hashing_1e11_per_second

        assert.ok(strong > weak)
    })

    test("displayCost: less than $0.01", () => {
        assert.equal(displayCost(0.000001), "less than $0.01")
    })

    test("displayCost: formats dollars", () => {
        assert.equal(displayCost(3.5), "$3.50")
    })

    test("displayCost: astronomically expensive for Infinity", () => {
        assert.equal(displayCost(Infinity), "astronomically expensive")
    })
})

// ---------------------------------------------------------------------------

suite("diacritics stripping (#97)", () => {
    test("pässwörd matches password", () => {
        const r = zxcvbn("pässwörd")

        assert.ok(r.sequence.some((m) => m.pattern === "dictionary"))
    })
})

// ---------------------------------------------------------------------------

suite("updated threat model (#272)", () => {
    test("crack_times_seconds uses 2025 keys", () => {
        const cts = zxcvbn("password").crack_times_seconds

        assert.ok(cts.offline_slow_hashing_1e5_per_second !== undefined)
        assert.ok(cts.offline_fast_hashing_1e11_per_second !== undefined)
    })
})

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"─".repeat(50)}`)
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`)
console.log(`${"─".repeat(50)}\n`)

if (failed > 0) process.exit(1)
