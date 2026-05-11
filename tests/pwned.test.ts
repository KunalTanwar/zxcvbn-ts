/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test"
import { checkPwned } from "../src/pwned"

// ----------------------------------------------------------------
// Mock HIBP response helpers
// ----------------------------------------------------------------

/**
 * "password" SHA1 = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
 *
 *     prefix = "5BAA6"
 *     suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8"
 **/
const PASSWORD_HASH_SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8"

function mockResponse(body: string, status = 200): Response {
    return new Response(body, {
        status,
        headers: {
            "Content-Type": "text/plain",
        },
    })
}

function HIBPBody(suffix: string, count: number): string {
    return [
        `AABBCCDDEEFF00112233445566778899AABB:1`,
        `${suffix}:${count}`,
        `FFEE00112233445566778899AABBCCDDEEFF:5`,
    ].join("\n")
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe("checkPwned()", () => {
    test("returns isPwned: true when password is in breach list", async () => {
        const result = await checkPwned("password", {
            fetch: async () => mockResponse(HIBPBody(PASSWORD_HASH_SUFFIX, 3_861_493)),
        })

        expect(result.isPwned).toBe(true)
        expect(result.breachCount).toBe(3_861_493)
    })

    test("returns isPwned: false when password is not in breach list", async () => {
        const result = await checkPwned("xkJ#9!vQ2$mPzR", {
            fetch: async () => mockResponse("AABBCCDDEEFF00112233445566778899AABB:1"),
        })

        expect(result.isPwned).toBe(false)
        expect(result.breachCount).toBe(0)
    })

    test("breachDisplay is human-readable for pwned password", async () => {
        const result = await checkPwned("password", {
            fetch: async () => mockResponse(HIBPBody(PASSWORD_HASH_SUFFIX, 1_234_567)),
        })

        expect(result.breachDisplay).toBe("seen in 1,234,567 breaches")
    })

    test("breachDisplay is correct for exactly 1 breach", async () => {
        const result = await checkPwned("password", {
            fetch: async () => mockResponse(HIBPBody(PASSWORD_HASH_SUFFIX, 1)),
        })

        expect(result.breachDisplay).toBe("seen in 1 breach")
    })

    test("breachDisplay for safe password", async () => {
        const result = await checkPwned("xkJ#9!vQ2$mPzR", {
            fetch: async () => mockResponse("AABBCCDDEEFF00112233445566778899AABB:1"),
        })

        expect(result.breachDisplay).toBe("not found in known breaches")
    })

    test("sends only first 5 chars of SHA1 hash to API", async () => {
        let capturedUrl = ""

        await checkPwned("password", {
            fetch: async (url) => {
                capturedUrl = url as string
                return mockResponse(HIBPBody(PASSWORD_HASH_SUFFIX, 1))
            },
        })

        // SHA1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
        expect(capturedUrl).toBe("https://api.pwnedpasswords.com/range/5BAA6")
        expect(capturedUrl).not.toContain("1E4C9B93F3F0682250B6CF8331B7EE68FD8")
    })

    test("throws TypeError for non-string password", async () => {
        await expect(checkPwned(42 as unknown as string)).rejects.toThrow(TypeError)
    })

    test("throws on non-200 API response", async () => {
        await expect(
            checkPwned("password", {
                fetch: async () => mockResponse("Service Unavailable", 503),
            }),
        ).rejects.toThrow("HIBP API error 503")
    })

    test("handles empty response body gracefully", async () => {
        const result = await checkPwned("password", {
            fetch: async () => mockResponse(""),
        })

        expect(result.isPwned).toBe(false)
        expect(result.breachCount).toBe(0)
    })

    test("handles CRLF line endings in response", async () => {
        const body = `AABBCC:1\r\n${PASSWORD_HASH_SUFFIX}:999\r\nDDEEFF:2`
        const result = await checkPwned("password", {
            fetch: async () => mockResponse(body),
        })

        expect(result.isPwned).toBe(true)
        expect(result.breachCount).toBe(999)
    })

    test("suffix match correctly distinguishes multiple hashes", async () => {
        const body = `${PASSWORD_HASH_SUFFIX}:100\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:200`
        const result = await checkPwned("password", {
            fetch: async () => mockResponse(body),
        })

        expect(result.breachCount).toBe(100)
    })
})
