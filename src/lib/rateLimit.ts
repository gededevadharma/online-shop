import { NextRequest, NextResponse } from 'next/server';

interface RateLimitStore {
    [key: string]: { count: number; resetTime: number };
}

const rateLimitStore: RateLimitStore = {};
const CLEANUP_INTERVAL = 60000; // 1 menit

// Cleanup old entries setiap interval
setInterval(() => {
    const now = Date.now();
    Object.keys(rateLimitStore).forEach(key => {
        if (rateLimitStore[key].resetTime < now) {
            delete rateLimitStore[key];
        }
    });
}, CLEANUP_INTERVAL);

/**
 * Rate limiting untuk API endpoints
 * @param identifier - Unique identifier (IP, user ID, email, dll)
 * @param maxRequests - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
    identifier: string,
    maxRequests: number = 5,
    windowMs: number = 900000 // 15 minutes default
): { allowed: boolean; remaining: number; retryAfter: number } {
    const now = Date.now();
    const key = `ratelimit:${identifier}`;

    if (!rateLimitStore[key]) {
        rateLimitStore[key] = { count: 0, resetTime: now + windowMs };
    }

    const entry = rateLimitStore[key];

    // Reset jika window expired
    if (entry.resetTime < now) {
        entry.count = 0;
        entry.resetTime = now + windowMs;
    }

    entry.count++;

    return {
        allowed: entry.count <= maxRequests,
        remaining: Math.max(0, maxRequests - entry.count),
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
    };
}

/**
 * Middleware untuk rate limiting
 */
export function rateLimitMiddleware(
    req: NextRequest,
    identifier: string,
    maxRequests: number = 5,
    windowMs: number = 900000
): NextResponse | null {
    const limit = checkRateLimit(identifier, maxRequests, windowMs);

    if (!limit.allowed) {
        const response = NextResponse.json(
            {
                error: 'Terlalu banyak request. Coba lagi nanti.',
                retryAfter: limit.retryAfter
            },
            { status: 429 }
        );

        response.headers.set('Retry-After', limit.retryAfter.toString());
        return response;
    }

    return null;
}

/**
 * Get client IP address
 */
export function getClientIP(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    return forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown';
}

export default {
    checkRateLimit,
    rateLimitMiddleware,
    getClientIP,
};
