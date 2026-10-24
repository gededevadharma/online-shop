import config from './config';
import connectDB from './mongodb';

// Cache site key (publik, aman di-cache)
let cachedSiteKey: string | null = null;
let siteKeyTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

export function invalidateTurnstileCache() {
    cachedSiteKey = null;
    siteKeyTimestamp = 0;
}

async function getSettings() {
    try {
        await connectDB();
        const { default: TurnstileSettings } = await import('@/models/TurnstileSettings');
        const s = await TurnstileSettings.findOne().lean();
        if (s) return s as { siteKey?: string; secretKey?: string };
    } catch (e) {
        console.warn('Gagal ambil Turnstile settings dari DB:', e);
    }
    return null;
}

/** Site key untuk widget client-side. */
export async function getTurnstileSiteKey(): Promise<string> {
    const now = Date.now();
    if (cachedSiteKey && now - siteKeyTimestamp < CACHE_TTL) return cachedSiteKey;

    const s = await getSettings();
    const key = s?.siteKey?.trim() || config.turnstile?.siteKey?.trim() || '';
    cachedSiteKey = key;
    siteKeyTimestamp = now;
    return key;
}

/** Secret key untuk verifikasi server-side. */
async function getSecretKey(): Promise<string> {
    const s = await getSettings();
    return s?.secretKey?.trim() || config.turnstile?.secretKey?.trim() || process.env.TURNSTILE_SECRET_KEY || '';
}

/**
 * Verifikasi token Turnstile ke Cloudflare.
 * Return true jika valid. Jika secret key belum dikonfigurasi, return false
 * agar admin sadar harus mengisi key (fail-closed).
 */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
    if (!token || typeof token !== 'string') return false;

    const secret = await getSecretKey();
    if (!secret) {
        console.warn('Turnstile secret key belum dikonfigurasi');
        return false;
    }

    try {
        const form = new FormData();
        form.append('secret', secret);
        form.append('response', token);
        if (remoteIp) form.append('remoteip', remoteIp);

        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: form,
        });

        if (!res.ok) return false;
        const data = await res.json();
        return data.success === true;
    } catch (e) {
        console.error('Turnstile verify error:', e);
        return false;
    }
}
