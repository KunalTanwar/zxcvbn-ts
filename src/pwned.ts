/**
 * `zxcvbn-ts/pwned` — HIBP k-anonymity breach check
 *
 * ⚠️ SERVER-SIDE ONLY. Never call this from a browser — doing so would
 * expose the password hash prefix to network intermediaries and the HIBP
 * API server, undermining the privacy guarantee.
 *
 * Uses the Have I Been Pwned Pwned Passwords API with k-anonymity:
 * only the first 5 characters of the SHA1 hash are sent to the API.
 * The actual password never leaves your server.
 *
 * @example
 * ```ts
 * import { checkPwned } from "zxcvbn-ts/pwned"
 *
 * const result = await checkPwned("password123")
 *
 * console.log(result.isPwned);       // true
 * console.log(result.breachCount);   // 3861493
 * console.log(result.breachDisplay); // "seen in 3,861,493 breaches"
 * ```
 **/

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface PwnedResult {
    /** Whether the password appears in any known breach. */
    readonly isPwned: boolean
    /**
     * Number of times the password appears across all known breaches.
     * 0 if not found.
     **/
    readonly breachCount: number
    /**
     * Human-readable breach count string.
     * e.g. "seen in 3,861,493 breaches" or "not found in known breaches"
     **/
    readonly breachDisplay: string
}

export interface CheckPwnedOptions {
    /**
     * Custom fetch implementation. Defaults to the global `fetch`.
     * Useful for testing or environments with custom fetch polyfills.
     **/
    fetch?: (url: string, init?: RequestInit) => Promise<Response>
    /**
     * Request timeout in milliseconds. Defaults to 5000 (5 seconds).
     **/
    timeoutMS?: number
    /**
     * Custom User-Agent header. HIBP recommends identifying your app.
     * Defaults to "zxcvbn-ts/pwned".
     **/
    userAgent?: string
}

// ----------------------------------------------------------------
// SHA1
// ----------------------------------------------------------------

/**
 * Compute the SHA1 hash of a UTF-8 string and return it as an
 * uppercase hex string.
 *
 * Uses Node.js / Bun's built-in `crypto` module — no third-party
 * dependencies required.
 **/
async function sha1(input: string): Promise<string> {
    // Node.js / Bun — use crypto.subtle (Web Crypto API, available in both)
    const encoded = new TextEncoder().encode(input)
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-1", encoded)
    const hashArray = Array.from(new Uint8Array(hashBuffer))

    return hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
}

// ----------------------------------------------------------------
// HIBP API
// ----------------------------------------------------------------

const HIBP_API = "https://api.pwnedpasswords.com/range/"

/**
 * Check whether a password has appeared in a known data breach using
 * the HIBP Pwned Passwords API with k-anonymity.
 *
 * Only the first 5 characters of the SHA1 hash are sent to the API.
 * The suffix match is performed locally — the actual password and
 * the full hash never leave your server.
 *
 * @param password  The plaintext password to check.
 * @param options   Optional fetch, timeout, and User-Agent overrides.
 *
 * @throws { Error } If the HIBP API returns a non-200 response.
 * @throws { Error } If the request times out.
 **/
export async function checkPwned(password: string, options: CheckPwnedOptions = {}): Promise<PwnedResult> {
    if (typeof password !== "string") {
        throw new TypeError("zxcvbn-ts/pwned: password must be a string")
    }

    const fetchFn = options.fetch ?? globalThis.fetch
    const timeout = options.timeoutMS ?? 5_000
    const ua = options.userAgent ?? "zxcvbn-ts/pwned"

    // STEP 1 — hash the password
    const hash = await sha1(password)
    const prefix = hash.slice(0, 5) // sent to API
    const suffix = hash.slice(5) // checked locally

    // STEP 2 — fetch all hashes with this prefix
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    let response: Response

    try {
        response = await fetchFn(`${HIBP_API}${prefix}`, {
            headers: {
                "User-Agent": ua,
                // Request padding to make traffic analysis harder
                "Add-Padding": "true",
            },

            signal: controller.signal,
        })
    } finally {
        clearTimeout(timer)
    }

    if (!response.ok) {
        throw new Error(`zxcvbn-ts/pwned: HIBP API error ${response.status} ${response.statusText}`)
    }

    // STEP 3 — parse response and find our suffix
    const text = await response.text()
    const breachCount = parseHIBPResponse(text, suffix)

    return {
        isPwned: breachCount > 0,
        breachCount,
        breachDisplay:
            breachCount > 0
                ? `seen in ${breachCount.toLocaleString("en-US")} breach${breachCount === 1 ? "" : "es"}`
                : "not found in known breaches",
    }
}

/**
 * Parse the HIBP range response and return the count for the given suffix.
 *
 * Response format **(one per line):**
 *   `SUFFIX:COUNT`
 *   **e.g.** `1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493`
 **/
function parseHIBPResponse(body: string, suffix: string): number {
    const upperSuffix = suffix.toUpperCase()

    for (const line of body.split("\n")) {
        const separator = line.indexOf(":")

        if (separator === -1) continue

        const lineSuffix = line.slice(0, separator).trim()

        if (lineSuffix === upperSuffix) {
            const count = parseInt(line.slice(separator + 1).trim(), 10)

            return isNaN(count) ? 0 : count
        }
    }

    return 0
}
