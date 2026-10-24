'use client';

interface CacheEntry<T> {
    data: T;
    hash: string;
    cachedAt: number;
}

interface CachedFetchResult<T> {
    ok: boolean;
    status: number;
    data: T;
    fromCache: boolean;
    hashUnchanged: boolean;
}

interface CachedFetchOptions {
    key?: string;
    ttlMs?: number;
    keepStaleOnError?: boolean;
}

const CACHE_PREFIX = 'admin-cache:v1:';
const DEFAULT_TTL = 5 * 60 * 1000;
const inMemoryCache = new Map<string, CacheEntry<unknown>>();

function getStorageKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
}

function hashString(value: string): string {
    let hash = 5381;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 33) ^ value.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
}

function readCache<T>(cacheKey: string): CacheEntry<T> | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const memory = inMemoryCache.get(cacheKey) as CacheEntry<T> | undefined;
    if (memory) {
        return memory;
    }

    try {
        const raw = window.sessionStorage.getItem(getStorageKey(cacheKey));
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as CacheEntry<T>;
        inMemoryCache.set(cacheKey, parsed as CacheEntry<unknown>);
        return parsed;
    } catch {
        return null;
    }
}

function writeCache<T>(cacheKey: string, entry: CacheEntry<T>): void {
    if (typeof window === 'undefined') {
        return;
    }

    inMemoryCache.set(cacheKey, entry as CacheEntry<unknown>);

    try {
        window.sessionStorage.setItem(getStorageKey(cacheKey), JSON.stringify(entry));
    } catch {
        // Ignore storage quota errors.
    }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!text) {
        return {} as T;
    }

    try {
        return JSON.parse(text) as T;
    } catch {
        return ({ error: text } as unknown) as T;
    }
}

export async function cachedFetchJson<T>(
    url: string,
    init?: RequestInit,
    options?: CachedFetchOptions
): Promise<CachedFetchResult<T>> {
    const cacheKey = options?.key || url;
    const ttlMs = options?.ttlMs ?? DEFAULT_TTL;
    const keepStaleOnError = options?.keepStaleOnError ?? true;

    const cached = readCache<T>(cacheKey);
    const now = Date.now();

    if (cached && now - cached.cachedAt < ttlMs) {
        return {
            ok: true,
            status: 200,
            data: cached.data,
            fromCache: true,
            hashUnchanged: true,
        };
    }

    try {
        const response = await fetch(url, {
            ...init,
            cache: 'no-store',
        });

        const data = await parseJsonResponse<T>(response);

        if (!response.ok) {
            if (cached && keepStaleOnError) {
                return {
                    ok: true,
                    status: 200,
                    data: cached.data,
                    fromCache: true,
                    hashUnchanged: true,
                };
            }

            return {
                ok: false,
                status: response.status,
                data,
                fromCache: false,
                hashUnchanged: false,
            };
        }

        const nextHash = hashString(JSON.stringify(data));

        if (cached && cached.hash === nextHash) {
            writeCache<T>(cacheKey, {
                ...cached,
                cachedAt: now,
            });

            return {
                ok: true,
                status: response.status,
                data: cached.data,
                fromCache: true,
                hashUnchanged: true,
            };
        }

        writeCache<T>(cacheKey, {
            data,
            hash: nextHash,
            cachedAt: now,
        });

        return {
            ok: true,
            status: response.status,
            data,
            fromCache: false,
            hashUnchanged: false,
        };
    } catch {
        if (cached && keepStaleOnError) {
            return {
                ok: true,
                status: 200,
                data: cached.data,
                fromCache: true,
                hashUnchanged: true,
            };
        }

        throw new Error('Gagal memuat data. Periksa koneksi internet Anda.');
    }
}

export function invalidateAdminCache(matcher: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    const keysToDelete: string[] = [];

    inMemoryCache.forEach((_, key) => {
        if (key.includes(matcher)) {
            keysToDelete.push(key);
        }
    });

    keysToDelete.forEach((key) => {
        inMemoryCache.delete(key);
        window.sessionStorage.removeItem(getStorageKey(key));
    });

    for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX) && key.includes(matcher)) {
            window.sessionStorage.removeItem(key);
        }
    }
}
