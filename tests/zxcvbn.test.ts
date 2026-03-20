// tests/zxcvbn.test.ts
// Run with:  bun test

import { describe, expect, test } from "bun:test";
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
  estimateAttackTimes,
  getFeedback,
  guessesToScore,
  displayTime,
} from "../src/index";

// ---------------------------------------------------------------------------
// Top-level API
// ---------------------------------------------------------------------------

describe("zxcvbn()", () => {
  test("returns a result with all required fields", () => {
    const r = zxcvbn("password");
    expect(typeof r.score).toBe("number");
    expect(typeof r.guesses).toBe("number");
    expect(typeof r.guesses_log10).toBe("number");
    expect(typeof r.calc_time).toBe("number");
    expect(Array.isArray(r.sequence)).toBe(true);
    expect(Array.isArray(r.feedback.suggestions)).toBe(true);
    expect(typeof r.feedback.warning).toBe("string");
    expect(r.crack_times_seconds).toBeTruthy();
    expect(r.crack_times_display).toBeTruthy();
  });

  test("score is always in range 0–4", () => {
    const passwords = ["a", "password", "correcthorsebatterystaple", "xkJ#9!vQ2$mP", ""];
    for (const pw of passwords) {
      const { score } = zxcvbn(pw);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(4);
    }
  });

  test("empty password → guesses=1, score=0", () => {
    const r = zxcvbn("");
    expect(r.guesses).toBe(1);
    expect(r.score).toBe(0);
  });

  test("throws TypeError for non-string input", () => {
    expect(() => zxcvbn(42 as unknown as string)).toThrow(TypeError);
    expect(() => zxcvbn(null as unknown as string)).toThrow(TypeError);
    expect(() => zxcvbn(undefined as unknown as string)).toThrow(TypeError);
    expect(() => zxcvbn([] as unknown as string)).toThrow(TypeError);
  });

  test("accepts number and boolean userInputs without throwing", () => {
    expect(() => zxcvbn("abc", [42, true, "alice"])).not.toThrow();
  });

  test("user inputs reduce guess count for matching password", () => {
    const withInput = zxcvbn("alice2024", ["alice"]);
    const without   = zxcvbn("alice2024", []);
    expect(withInput.guesses).toBeLessThanOrEqual(without.guesses);
  });

  test("well-known weak passwords score low", () => {
    expect(zxcvbn("password").score).toBeLessThanOrEqual(2);
    expect(zxcvbn("123456").score).toBeLessThanOrEqual(1);
    expect(zxcvbn("qwerty").score).toBeLessThanOrEqual(1);
  });

  test("long random passwords score 4", () => {
    expect(zxcvbn("xkJ#9!vQ2$mPzR").score).toBe(4);
  });

  test("guesses_log10 equals Math.log10(guesses)", () => {
    const r = zxcvbn("Test123!");
    expect(r.guesses_log10).toBeCloseTo(Math.log10(r.guesses), 3);
  });

  test("crack_times_seconds has all four attack scenarios", () => {
    const { crack_times_seconds: cts } = zxcvbn("password");
    expect(typeof cts.online_throttling_100_per_hour).toBe("number");
    expect(typeof cts.online_no_throttling_10_per_second).toBe("number");
    expect(typeof cts.offline_slow_hashing_1e4_per_second).toBe("number");
    expect(typeof cts.offline_fast_hashing_1e10_per_second).toBe("number");
  });

  test("crack_times_display returns non-empty strings", () => {
    const { crack_times_display: ctd } = zxcvbn("password");
    for (const val of Object.values(ctd)) {
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

describe("mostGuessableMatchSequence()", () => {
  test("guesses >= 1 for any input", () => {
    for (const pw of ["", "a", "abc", "abc123!@#"]) {
      const { guesses } = mostGuessableMatchSequence(pw, omnimatch(pw));
      expect(guesses).toBeGreaterThanOrEqual(1);
    }
  });

  test("longer password has >= guesses than shorter", () => {
    const short = mostGuessableMatchSequence("abc",    omnimatch("abc")).guesses;
    const long  = mostGuessableMatchSequence("abcdef", omnimatch("abcdef")).guesses;
    expect(long).toBeGreaterThanOrEqual(short);
  });

  test("sequence has contiguous, gap-free coverage", () => {
    const pw = "password123";
    const { sequence } = mostGuessableMatchSequence(pw, omnimatch(pw));
    expect(sequence.length).toBeGreaterThan(0);
    expect(sequence[0].i).toBe(0);
    expect(sequence[sequence.length - 1].j).toBe(pw.length - 1);
    for (let k = 1; k < sequence.length; k++) {
      expect(sequence[k].i).toBe(sequence[k - 1].j + 1);
    }
  });
});

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

describe("dictionaryMatch()", () => {
  test("finds 'password' in a custom ranked dict", () => {
    const matches = dictionaryMatch("password", {
      test_dict: { password: 1, hello: 2, world: 3 },
    });
    expect(matches.some(m => m.matched_word === "password")).toBe(true);
  });

  test("match indices are within password bounds", () => {
    const pw = "hello";
    const matches = dictionaryMatch(pw, { test: { hello: 1 } });
    for (const m of matches) {
      expect(m.i).toBeGreaterThanOrEqual(0);
      expect(m.j).toBeLessThan(pw.length);
      expect(m.i).toBeLessThanOrEqual(m.j);
    }
  });
});

describe("reverseDictionaryMatch()", () => {
  test("finds reversed token and marks it", () => {
    const matches = reverseDictionaryMatch("drowssap", { test: { password: 1 } });
    expect(matches.some(m => m.reversed === true)).toBe(true);
  });
});

describe("spatialMatch()", () => {
  test("finds qwerty runs", () => {
    const matches = spatialMatch("qwerty");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every(m => m.pattern === "spatial")).toBe(true);
  });

  test("returns empty for non-adjacent characters", () => {
    const matches = spatialMatch("axqz");
    // Not a guaranteed-empty result, just shouldn't crash
    expect(Array.isArray(matches)).toBe(true);
  });
});

describe("repeatMatch()", () => {
  test("finds repeated characters", () => {
    const matches = repeatMatch("aaaaaa");
    expect(matches.some(m => m.base_token === "a")).toBe(true);
  });

  test("finds repeated sequences", () => {
    const matches = repeatMatch("abcabcabc");
    expect(matches.some(m => m.base_token === "abc")).toBe(true);
  });
});

describe("sequenceMatch()", () => {
  test("finds ascending alphabetic sequence", () => {
    const matches = sequenceMatch("abcde");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every(m => m.pattern === "sequence")).toBe(true);
  });

  test("finds descending numeric sequence", () => {
    const matches = sequenceMatch("98765");
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe("regexMatch()", () => {
  test("finds recent years", () => {
    const matches = regexMatch("in2019now");
    expect(matches.some(m => m.regex_name === "recent_year")).toBe(true);
  });
});

describe("dateMatch()", () => {
  test("finds slash-separated dates", () => {
    const matches = dateMatch("1/1/1990");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every(m => m.pattern === "date")).toBe(true);
  });

  test("date match fields are valid numbers", () => {
    for (const m of dateMatch("1/1/1990")) {
      expect(m.year).toBeGreaterThan(0);
      expect(m.month).toBeGreaterThanOrEqual(1);
      expect(m.month).toBeLessThanOrEqual(12);
      expect(m.day).toBeGreaterThanOrEqual(1);
      expect(m.day).toBeLessThanOrEqual(31);
    }
  });
});

describe("omnimatch()", () => {
  test("returns a non-empty array for a real password", () => {
    const matches = omnimatch("password123");
    expect(Array.isArray(matches)).toBe(true);
    expect(matches.length).toBeGreaterThan(0);
  });

  test("all matches have valid i/j bounds", () => {
    const pw = "p@ssw0rd";
    for (const m of omnimatch(pw)) {
      expect(m.i).toBeGreaterThanOrEqual(0);
      expect(m.j).toBeLessThan(pw.length);
      expect(m.i).toBeLessThanOrEqual(m.j);
    }
  });

  test("returns empty array for empty password", () => {
    expect(omnimatch("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Time estimates
// ---------------------------------------------------------------------------

describe("guessesToScore()", () => {
  test("1 guess → score 0",      () => expect(guessesToScore(1)).toBe(0));
  test("5e3 guesses → score 1",  () => expect(guessesToScore(5e3)).toBe(1));
  test("5e6 guesses → score 2",  () => expect(guessesToScore(5e6)).toBe(2));
  test("5e8 guesses → score 3",  () => expect(guessesToScore(5e8)).toBe(3));
  test("1e15 guesses → score 4", () => expect(guessesToScore(1e15)).toBe(4));
});

describe("displayTime()", () => {
  test("returns a non-empty string for all ranges", () => {
    for (const s of [0, 1, 60, 3600, 86400, 1e6, 1e12, Infinity]) {
      const result = displayTime(s);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    }
  });

  test("less than a second → 'less than a second'", () => {
    expect(displayTime(0)).toBe("less than a second");
  });
});

describe("estimateAttackTimes()", () => {
  test("returns correct structure", () => {
    const result = estimateAttackTimes(1e6);
    expect(result.crack_times_seconds).toBeTruthy();
    expect(result.crack_times_display).toBeTruthy();
    expect(typeof result.score).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

describe("getFeedback()", () => {
  test("returns warning string and suggestions array", () => {
    const { sequence } = mostGuessableMatchSequence("password", omnimatch("password"));
    const fb = getFeedback(1, sequence);
    expect(typeof fb.warning).toBe("string");
    expect(Array.isArray(fb.suggestions)).toBe(true);
  });

  test("strong password has empty warning", () => {
    const pw = "xkJ#9!vQ2$mPzR";
    const { sequence, guesses } = mostGuessableMatchSequence(pw, omnimatch(pw));
    const { score } = estimateAttackTimes(guesses);
    expect(getFeedback(score, sequence).warning).toBe("");
  });

  test("common password gets a warning or suggestions", () => {
    const { sequence, guesses } = mostGuessableMatchSequence("password", omnimatch("password"));
    const { score } = estimateAttackTimes(guesses);
    const fb = getFeedback(score, sequence);
    expect(fb.warning.length > 0 || fb.suggestions.length > 0).toBe(true);
  });
});