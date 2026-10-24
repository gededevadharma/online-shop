// Client-side session fetch with retry.
//
// The store is served through a proxy chain (Pages -> tunnel -> local),
// so a single transient drop (ERR_CONNECTION_CLOSED / Failed to fetch)
// must NOT be treated as "logged out". This helper retries a few times
// and returns null on persistent network failure — callers must only
// redirect to /login when the server definitively says unauthenticated.

export interface SessionResult {
    authenticated: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user?: any;
}

export async function fetchSession(retries = 2): Promise<SessionResult | null> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch('/api/auth/session', { cache: 'no-store' });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            return (await res.json()) as SessionResult;
        } catch (err) {
            lastError = err;
            if (attempt < retries) {
                await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
            }
        }
    }
    console.warn('Session check failed after retries:', lastError);
    return null;
}
