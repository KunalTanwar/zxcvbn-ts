// tests/ai.test.ts
import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test"
import { zxcvbnAI, anthropic, openai, gemini } from "../src/ai"
import type { AIProvider } from "../src/ai"

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const MOCK_FEEDBACK = JSON.stringify({
    warning: "This is a common dictionary word.",
    suggestions: ["Add numbers and symbols.", "Use a passphrase instead."],
    explanation:
        "Your password is one of the most common passwords in existence. " +
        "Attackers will try it within the first few guesses. " +
        "Consider using a random passphrase of four or more words.",
})

function mockFetch(responseBody: object, status = 200) {
    global.fetch = mock(
        async () =>
            new Response(JSON.stringify(responseBody), {
                status,
                headers: { "Content-Type": "application/json" },
            }),
    ) as unknown as typeof fetch
}

const originalFetch = global.fetch
afterEach(() => {
    global.fetch = originalFetch
})

// ---------------------------------------------------------------------------
// Shared result shape tests (provider-agnostic)
// ---------------------------------------------------------------------------

function anthropicResponse(text: string) {
    return { content: [{ type: "text", text }] }
}

function openaiResponse(text: string) {
    return { choices: [{ message: { content: text } }] }
}

function geminiResponse(text: string) {
    return { candidates: [{ content: { parts: [{ text }] } }] }
}

// ---------------------------------------------------------------------------

describe("anthropic() provider", () => {
    test("returns AI feedback fields", async () => {
        mockFetch(anthropicResponse(MOCK_FEEDBACK))

        const r = await zxcvbnAI("password", {
            provider: anthropic({ apiKey: "test-key" }),
        })

        expect(r.feedback.explanation.length).toBeGreaterThan(0)
        expect(typeof r.feedback.warning).toBe("string")
        expect(Array.isArray(r.feedback.suggestions)).toBe(true)
    })

    test("sends request to Anthropic endpoint", async () => {
        let capturedUrl = ""

        global.fetch = mock(async (url: string) => {
            capturedUrl = url
            return new Response(
                JSON.stringify(anthropicResponse(MOCK_FEEDBACK)),
                { status: 200 },
            )
        }) as unknown as typeof fetch

        await zxcvbnAI("password", {
            provider: anthropic({ apiKey: "test-key" }),
        })

        expect(capturedUrl).toBe("https://api.anthropic.com/v1/messages")
    })

    test("sends x-api-key header", async () => {
        let capturedHeaders: Record<string, string> = {}

        global.fetch = mock(async (_url: string, init?: RequestInit) => {
            capturedHeaders = init?.headers as Record<string, string>
            return new Response(
                JSON.stringify(anthropicResponse(MOCK_FEEDBACK)),
                { status: 200 },
            )
        }) as unknown as typeof fetch

        await zxcvbnAI("password", {
            provider: anthropic({ apiKey: "my-secret-key" }),
        })

        expect(capturedHeaders["x-api-key"]).toBe("my-secret-key")
    })

    test("uses ANTHROPIC_API_KEY env var as fallback", async () => {
        process.env.ANTHROPIC_API_KEY = "env-key"

        mockFetch(anthropicResponse(MOCK_FEEDBACK))

        await expect(
            zxcvbnAI("password", { provider: anthropic() }),
        ).resolves.toBeTruthy()

        delete process.env.ANTHROPIC_API_KEY
    })

    test("throws if no Anthropic key provided", async () => {
        delete process.env.ANTHROPIC_API_KEY

        await expect(
            zxcvbnAI("password", { provider: anthropic() }),
        ).rejects.toThrow("Anthropic API key")
    })

    test("throws on non-200 response", async () => {
        mockFetch({ error: "unauthorized" }, 401)

        await expect(
            zxcvbnAI("password", { provider: anthropic({ apiKey: "bad" }) }),
        ).rejects.toThrow("401")
    })

    test("respects custom model option", async () => {
        let body: Record<string, unknown> = {}

        global.fetch = mock(async (_url: string, init?: RequestInit) => {
            body = JSON.parse(init?.body as string)

            return new Response(
                JSON.stringify(anthropicResponse(MOCK_FEEDBACK)),
                { status: 200 },
            )
        }) as unknown as typeof fetch

        await zxcvbnAI("password", {
            provider: anthropic({
                apiKey: "test-key",
                model: "claude-opus-4-6",
            }),
        })

        expect(body.model).toBe("claude-opus-4-6")
    })
})

// ---------------------------------------------------------------------------

describe("openai() provider", () => {
    test("returns AI feedback fields", async () => {
        mockFetch(openaiResponse(MOCK_FEEDBACK))

        const r = await zxcvbnAI("password", {
            provider: openai({ apiKey: "test-key" }),
        })

        expect(r.feedback.explanation.length).toBeGreaterThan(0)
    })

    test("sends request to OpenAI endpoint", async () => {
        let capturedUrl = ""

        global.fetch = mock(async (url: string) => {
            capturedUrl = url
            return new Response(JSON.stringify(openaiResponse(MOCK_FEEDBACK)), {
                status: 200,
            })
        }) as unknown as typeof fetch

        await zxcvbnAI("password", { provider: openai({ apiKey: "test-key" }) })

        expect(capturedUrl).toBe("https://api.openai.com/v1/chat/completions")
    })

    test("sends Bearer Authorization header", async () => {
        let capturedHeaders: Record<string, string> = {}

        global.fetch = mock(async (_url: string, init?: RequestInit) => {
            capturedHeaders = init?.headers as Record<string, string>
            return new Response(JSON.stringify(openaiResponse(MOCK_FEEDBACK)), {
                status: 200,
            })
        }) as unknown as typeof fetch

        await zxcvbnAI("password", {
            provider: openai({ apiKey: "my-openai-key" }),
        })

        expect(capturedHeaders["Authorization"]).toBe("Bearer my-openai-key")
    })

    test("uses OPENAI_API_KEY env var as fallback", async () => {
        process.env.OPENAI_API_KEY = "env-openai-key"

        mockFetch(openaiResponse(MOCK_FEEDBACK))

        await expect(
            zxcvbnAI("password", { provider: openai() }),
        ).resolves.toBeTruthy()

        delete process.env.OPENAI_API_KEY
    })

    test("throws if no OpenAI key provided", async () => {
        delete process.env.OPENAI_API_KEY

        await expect(
            zxcvbnAI("password", { provider: openai() }),
        ).rejects.toThrow("OpenAI API key")
    })

    test("respects custom model option", async () => {
        let body: Record<string, unknown> = {}

        global.fetch = mock(async (_url: string, init?: RequestInit) => {
            body = JSON.parse(init?.body as string)
            return new Response(JSON.stringify(openaiResponse(MOCK_FEEDBACK)), {
                status: 200,
            })
        }) as unknown as typeof fetch

        await zxcvbnAI("password", {
            provider: openai({ apiKey: "test-key", model: "gpt-4o" }),
        })

        expect(body.model).toBe("gpt-4o")
    })
})

// ---------------------------------------------------------------------------

describe("gemini() provider", () => {
    test("returns AI feedback fields", async () => {
        mockFetch(geminiResponse(MOCK_FEEDBACK))

        const r = await zxcvbnAI("password", {
            provider: gemini({ apiKey: "test-key" }),
        })

        expect(r.feedback.explanation.length).toBeGreaterThan(0)
    })

    test("sends request to Gemini endpoint", async () => {
        let capturedUrl = ""

        global.fetch = mock(async (url: string) => {
            capturedUrl = url
            return new Response(JSON.stringify(geminiResponse(MOCK_FEEDBACK)), {
                status: 200,
            })
        }) as unknown as typeof fetch

        await zxcvbnAI("password", { provider: gemini({ apiKey: "test-key" }) })

        expect(capturedUrl).toContain("generativelanguage.googleapis.com")
        expect(capturedUrl).toContain("test-key")
    })

    test("uses GEMINI_API_KEY env var as fallback", async () => {
        process.env.GEMINI_API_KEY = "env-gemini-key"

        mockFetch(geminiResponse(MOCK_FEEDBACK))

        await expect(
            zxcvbnAI("password", { provider: gemini() }),
        ).resolves.toBeTruthy()

        delete process.env.GEMINI_API_KEY
    })

    test("throws if no Gemini key provided", async () => {
        delete process.env.GEMINI_API_KEY

        await expect(
            zxcvbnAI("password", { provider: gemini() }),
        ).rejects.toThrow("Gemini API key")
    })

    test("respects custom model option", async () => {
        let capturedUrl = ""

        global.fetch = mock(async (url: string) => {
            capturedUrl = url
            return new Response(JSON.stringify(geminiResponse(MOCK_FEEDBACK)), {
                status: 200,
            })
        }) as unknown as typeof fetch

        await zxcvbnAI("password", {
            provider: gemini({ apiKey: "test-key", model: "gemini-1.5-pro" }),
        })

        expect(capturedUrl).toContain("gemini-1.5-pro")
    })
})

// ---------------------------------------------------------------------------

describe("custom adapter", () => {
    test("calls complete() and uses its response", async () => {
        const customProvider: AIProvider = {
            complete: mock(async () => MOCK_FEEDBACK),
        }

        const r = await zxcvbnAI("password", { provider: customProvider })

        expect(customProvider.complete).toHaveBeenCalledTimes(1)
        expect(r.feedback.warning).toBe("This is a common dictionary word.")
    })

    test("complete() receives system and user prompts", async () => {
        let capturedSystem = ""
        let capturedUser = ""

        const customProvider: AIProvider = {
            complete: mock(async (system, user) => {
                capturedSystem = system
                capturedUser = user
                return MOCK_FEEDBACK
            }),
        }

        await zxcvbnAI("password", { provider: customProvider })

        expect(capturedSystem.length).toBeGreaterThan(0)
        expect(capturedUser).toContain("Strength score:")
        expect(capturedUser).toContain("Pattern analysis:")
    })

    test("falls back to base feedback if complete() returns invalid JSON", async () => {
        const customProvider: AIProvider = {
            complete: mock(async () => "not valid json"),
        }

        const r = await zxcvbnAI("password", { provider: customProvider })

        expect(typeof r.feedback.warning).toBe("string")
        expect(r.feedback.explanation).toBe("")
    })
})

// ---------------------------------------------------------------------------

describe("zxcvbnAI() — shared behaviour", () => {
    beforeEach(() => {
        mockFetch(anthropicResponse(MOCK_FEEDBACK))
    })

    test("defaults to anthropic provider when none given", async () => {
        process.env.ANTHROPIC_API_KEY = "env-key"

        const r = await zxcvbnAI("password")

        expect(r.feedback.explanation.length).toBeGreaterThan(0)

        delete process.env.ANTHROPIC_API_KEY
    })

    test("score still reflects zxcvbn estimate, not AI opinion", async () => {
        const r = await zxcvbnAI("password", {
            provider: anthropic({ apiKey: "test" }),
        })

        expect(r.score).toBeLessThanOrEqual(2)
    })

    test("userInputs are penalised", async () => {
        const withInput = await zxcvbnAI(
            "alice2024",
            { provider: anthropic({ apiKey: "test" }) },
            ["alice"],
        )

        const without = await zxcvbnAI(
            "alice2024",
            { provider: anthropic({ apiKey: "test" }) },
            [],
        )

        expect(withInput.guesses).toBeLessThanOrEqual(without.guesses)
    })

    test("all ZxcvbnResult fields are present", async () => {
        const r = await zxcvbnAI("password", {
            provider: anthropic({ apiKey: "test" }),
        })

        expect(typeof r.score).toBe("number")
        expect(typeof r.guesses).toBe("number")
        expect(typeof r.calc_time).toBe("number")
        expect(Array.isArray(r.sequence)).toBe(true)
        expect(r.crack_times_seconds).toBeTruthy()
        expect(r.crack_times_display).toBeTruthy()
    })
})
