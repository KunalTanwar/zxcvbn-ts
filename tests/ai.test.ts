import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test"
import { zxcvbnAI } from "../src/ai"

// ---------------------------------------------------------------------------
// Mock fetch so tests never hit the real Anthropic API
// ---------------------------------------------------------------------------

const mockFetch = mock(async (_url: string, _opts: RequestInit) => {
    return new Response(
        JSON.stringify({
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        warning: "This is a common dictionary word.",
                        suggestions: ["Add numbers and symbols.", "Use a passphrase instead."],
                        explanation:
                            "Your password is one of the most common passwords in existence. " +
                            "Attackers will try it within the first few guesses. " +
                            "Consider using a random passphrase of four or more words.",
                    }),
                },
            ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
    )
})

const originalFetch = global.fetch

beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch
})

afterEach(() => {
    global.fetch = originalFetch

    mockFetch.mockClear()
})

// ---------------------------------------------------------------------------

describe("zxcvbnAI()", () => {
    test("returns all standard ZxcvbnResult fields", async () => {
        const r = await zxcvbnAI("password", { apiKey: "test-key" })

        expect(typeof r.score).toBe("number")
        expect(typeof r.guesses).toBe("number")
        expect(typeof r.calc_time).toBe("number")
        expect(r.crack_times_seconds).toBeTruthy()
        expect(r.crack_times_display).toBeTruthy()
        expect(Array.isArray(r.sequence)).toBe(true)
    })

    test("returns AI feedback fields", async () => {
        const r = await zxcvbnAI("password", { apiKey: "test-key" })

        expect(typeof r.feedback.warning).toBe("string")
        expect(Array.isArray(r.feedback.suggestions)).toBe(true)
        expect(typeof r.feedback.explanation).toBe("string")
        expect(r.feedback.explanation.length).toBeGreaterThan(0)
    })

    test("AI warning overrides the default feedback", async () => {
        const r = await zxcvbnAI("password", { apiKey: "test-key" })

        expect(r.feedback.warning).toBe("This is a common dictionary word.")
    })

    test("AI suggestions are returned as an array", async () => {
        const r = await zxcvbnAI("password", { apiKey: "test-key" })

        expect(r.feedback.suggestions).toHaveLength(2)
    })

    test("throws if no API key is provided", async () => {
        const oldKey = process.env.ANTHROPIC_API_KEY

        delete process.env.ANTHROPIC_API_KEY

        await expect(zxcvbnAI("password")).rejects.toThrow("no API key")

        if (oldKey) process.env.ANTHROPIC_API_KEY = oldKey
    })

    test("uses ANTHROPIC_API_KEY env var as fallback", async () => {
        process.env.ANTHROPIC_API_KEY = "env-test-key"

        await expect(zxcvbnAI("password")).resolves.toBeTruthy()

        delete process.env.ANTHROPIC_API_KEY
    })

    test("calls the Anthropic API exactly once", async () => {
        await zxcvbnAI("password", { apiKey: "test-key" })

        expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    test("sends the correct API endpoint", async () => {
        await zxcvbnAI("password", { apiKey: "test-key" })

        const [url] = mockFetch.mock.calls[0]

        expect(url).toBe("https://api.anthropic.com/v1/messages")
    })

    test("sends the API key in the header", async () => {
        await zxcvbnAI("password", { apiKey: "my-secret-key" })

        const [, opts] = mockFetch.mock.calls[0]
        const headers = opts.headers as Record<string, string>

        expect(headers["x-api-key"]).toBe("my-secret-key")
    })

    test("accepts userInputs and penalises them", async () => {
        const withInput = await zxcvbnAI("alice2024", { apiKey: "test-key" }, ["alice"])
        const without = await zxcvbnAI("alice2024", { apiKey: "test-key" }, [])
        expect(withInput.guesses).toBeLessThanOrEqual(without.guesses)
    })

    test("gracefully falls back if API returns malformed JSON", async () => {
        global.fetch = mock(
            async () =>
                new Response(JSON.stringify({ content: [{ type: "text", text: "not json at all" }] }), { status: 200 }),
        ) as unknown as typeof fetch

        const r = await zxcvbnAI("password", { apiKey: "test-key" })

        // Should fall back to base feedback — no throw
        expect(typeof r.feedback.warning).toBe("string")
        expect(Array.isArray(r.feedback.suggestions)).toBe(true)
    })

    test("throws on non-200 API response", async () => {
        global.fetch = mock(async () => new Response("Unauthorized", { status: 401 })) as unknown as typeof fetch

        await expect(zxcvbnAI("password", { apiKey: "bad-key" })).rejects.toThrow("Anthropic API error 401")
    })
})
