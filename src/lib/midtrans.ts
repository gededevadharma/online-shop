import { ProxyAgent, request as undiciRequest } from 'undici';
import crypto from 'crypto';
import config from './config';
import connectDB from './mongodb';

interface TransactionParams {
    orderId: string;
    grossAmount: number;
    firstName: string;
    email: string;
    phone: string;
    appUrl?: string;
    itemDetails?: {
        id: string;
        price: number;
        quantity: number;
        name: string;
    }[];
    /** Batasi metode bayar di Snap, mis. ['qris'] */
    enabledPayments?: string[];
    /** Durasi kedaluwarsa transaksi dalam menit (default 60) */
    expiryMinutes?: number;
}

export type QRPaymentMethod = 'qris' | 'gopay';

interface MidtransConfig {
    serverKey: string;
    clientKey: string;
    isProduction: boolean;
    /** Metode QR yang dipakai checkout (default 'qris') */
    qrPaymentMethod: QRPaymentMethod;
}

// Cache for Midtrans settings (5 minutes TTL)
let cachedConfig: MidtransConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Single shared proxy dispatcher (proper CONNECT tunneling).
// Axios' own proxy handling is broken on Node 24 (it downgrades HTTPS
// through the proxy to plain HTTP and trips _http_client validation),
// so we bypass axios entirely and use undici directly.
let dispatcher: ProxyAgent | undefined | null = null;
function getDispatcher(): ProxyAgent | undefined {
    if (dispatcher === null) {
        const proxyUrl =
            process.env.HTTPS_PROXY ||
            process.env.https_proxy ||
            process.env.HTTP_PROXY ||
            process.env.http_proxy;
        dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
    }
    return dispatcher ?? undefined;
}

function hasValidKeys(serverKey?: string, clientKey?: string): boolean {
    return Boolean(serverKey && clientKey && serverKey.trim() && clientKey.trim());
}

export function invalidateMidtransConfigCache() {
    cachedConfig = null;
    cacheTimestamp = 0;
}

/**
 * Config publik untuk frontend Snap.js (client key memang dirancang public).
 */
export async function getPublicMidtransConfig(): Promise<{ clientKey: string; isProduction: boolean }> {
    const cfg = await getMidtransConfig();
    return { clientKey: cfg.clientKey, isProduction: cfg.isProduction };
}

/**
 * Get Midtrans configuration from database or fallback to static config
 */
async function getMidtransConfig(): Promise<MidtransConfig> {
    const now = Date.now();

    // Return cached config if still valid
    if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL) {
        return cachedConfig;
    }

    try {
        await connectDB();

        // Try to fetch from database
        const { default: MidtransSettings } = await import('@/models/MidtransSettings');
        const settings = await MidtransSettings.findOne().lean();

        if (settings && hasValidKeys(settings.serverKey, settings.clientKey)) {
            cachedConfig = {
                serverKey: settings.serverKey,
                clientKey: settings.clientKey,
                isProduction: settings.isProduction !== false,
                qrPaymentMethod: settings.qrPaymentMethod === 'gopay' ? 'gopay' : 'qris',
            };
            cacheTimestamp = now;
            return cachedConfig;
        }
    } catch (error) {
        console.warn('Failed to fetch Midtrans settings from database, using config.json:', error);
    }

    // Fallback to static config
    if (!hasValidKeys(config.midtrans.serverKey, config.midtrans.clientKey)) {
        throw new Error('Konfigurasi Midtrans belum lengkap. Atur Server Key dan Client Key di panel admin.');
    }

    cachedConfig = {
        serverKey: config.midtrans.serverKey,
        clientKey: config.midtrans.clientKey,
        isProduction: config.midtrans.isProduction,
        qrPaymentMethod: 'qris',
    };
    cacheTimestamp = now;

    return cachedConfig;
}

function apiBase(kind: 'snap' | 'core', isProduction: boolean): string {
    if (kind === 'snap') {
        return isProduction ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
    }
    return isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
}

interface MidtransApiError extends Error {
    statusCode?: number;
}

/**
 * Low-level Midtrans API call over a proper CONNECT tunnel.
 */
async function midtransRequest(
    kind: 'snap' | 'core',
    path: string,
    method: 'GET' | 'POST',
    body?: unknown
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
    const cfg = await getMidtransConfig();
    const url = apiBase(kind, cfg.isProduction) + path;
    const auth = Buffer.from(`${cfg.serverKey}:`).toString('base64');

    let res;
    try {
        res = await undiciRequest(url, {
            method,
            dispatcher: getDispatcher(),
            signal: AbortSignal.timeout(30000),
            headers: {
                'content-type': 'application/json',
                'accept': 'application/json',
                'user-agent': 'gtshop-midtrans/1.0',
                'authorization': `Basic ${auth}`,
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const error = new Error(`Midtrans API request failed: ${msg}`) as MidtransApiError;
        throw error;
    }

    const text = await res.body.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any = null;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    if (res.statusCode >= 400) {
        const detail = JSON.stringify(data).slice(0, 300);
        const error = new Error(
            `Midtrans API error ${res.statusCode}: ${detail}`
        ) as MidtransApiError;
        error.statusCode = res.statusCode;
        throw error;
    }

    // Midtrans also embeds API errors in HTTP 200 bodies (except 407 = expired, non-standard)
    const embeddedCode = Number((data as { status_code?: unknown })?.status_code);
    if (embeddedCode >= 400 && embeddedCode !== 407) {
        const detail = JSON.stringify(data).slice(0, 300);
        const error = new Error(
            `Midtrans API error ${embeddedCode}: ${detail}`
        ) as MidtransApiError;
        error.statusCode = embeddedCode;
        throw error;
    }

    return data;
}

function normalizeUrl(url?: string): string | null {
    if (!url) {
        return null;
    }

    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }

        return parsed.toString().replace(/\/$/, '');
    } catch {
        return null;
    }
}

function resolveAppUrl(preferredAppUrl?: string): string {
    const configUrl = normalizeUrl(config.app.url);

    // In production, always prefer canonical store domain from config.
    if (process.env.NODE_ENV === 'production' && configUrl) {
        return configUrl;
    }

    const candidates = [
        normalizeUrl(preferredAppUrl),
        normalizeUrl(process.env.APP_URL),
        normalizeUrl(process.env.NEXT_PUBLIC_APP_URL),
        configUrl,
    ];

    for (const candidate of candidates) {
        if (candidate) {
            return candidate;
        }
    }

    return 'http://localhost:3000';
}

/**
 * Create a Snap transaction. Returns { token, redirect_url }.
 */
export async function createTransaction(params: TransactionParams) {    const appUrl = resolveAppUrl(params.appUrl);

    const expiryMinutes = params.expiryMinutes && params.expiryMinutes > 0 ? params.expiryMinutes : 60;

    // start_time format Midtrans: "YYYY-MM-DD HH:mm:ss +0700"
    const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const startTime = `${nowWib.getUTCFullYear()}-${pad(nowWib.getUTCMonth() + 1)}-${pad(nowWib.getUTCDate())} ` +
        `${pad(nowWib.getUTCHours())}:${pad(nowWib.getUTCMinutes())}:${pad(nowWib.getUTCSeconds())} +0700`;

    const parameter: Record<string, unknown> = {
        transaction_details: {
            order_id: params.orderId,
            gross_amount: params.grossAmount,
        },
        credit_card: {
            secure: true,
        },
        customer_details: {
            first_name: params.firstName,
            email: params.email,
            phone: params.phone,
        },
        item_details: params.itemDetails,
        callbacks: {
            finish: `${appUrl}/payment/success?ref=${params.orderId}`,
            pending: `${appUrl}/payment/success?ref=${params.orderId}`,
            error: `${appUrl}/payment/cancel?ref=${params.orderId}`,
        },
        expiry: {
            start_time: startTime,
            unit: 'minute',
            duration: expiryMinutes,
        },
    };

    if (params.enabledPayments && params.enabledPayments.length > 0) {
        parameter.enabled_payments = params.enabledPayments;
    }

    try {
        const transaction = await midtransRequest('snap', '/snap/v1/transactions', 'POST', parameter);
        return transaction as { token: string; redirect_url: string };
    } catch (error) {
        console.error('Midtrans Error:', error);
        throw error;
    }
}

/**
 * Check transaction status via Core API
 */
export async function getTransactionStatus(orderId: string) {
    try {
        const status = await midtransRequest('core', `/v2/${encodeURIComponent(orderId)}/status`, 'GET');
        return status;
    } catch (error) {
        console.error('Midtrans Status Check Error:', error);
        throw error;
    }
}

export interface SnapQrisResult {
    qrCodeUrl: string;
    expiresAt?: string;
    acquirer?: string;
}

/**
 * Ambil URL gambar QRIS dari transaksi Snap via transaction details API.
 * Mengembalikan null bila QR belum tersedia (retryable oleh pemanggil).
 */
export async function getSnapQrisUrl(
    snapToken: string,
    opts?: { attempts?: number; delayMs?: number }
): Promise<SnapQrisResult | null> {
    const attempts = opts?.attempts ?? 3;
    const delayMs = opts?.delayMs ?? 1500;
    let lastErr = '';
    for (let i = 0; i < attempts; i++) {
        try {
            const detail = await midtransRequest('snap', `/snap/v1/transactions/${encodeURIComponent(snapToken)}`, 'GET');
            const qrCodeUrl: string | undefined = detail?.result?.qris_url;
            if (qrCodeUrl) {
                const rawExp: string | undefined = detail?.result?.qris_expiration_raw;
                const expiresAt = rawExp
                    ? new Date(rawExp.replace(' +0700', '+07:00')).toISOString()
                    : undefined;
                return { qrCodeUrl, expiresAt, acquirer: detail?.result?.qris_acquirer || undefined };
            }
            lastErr = 'QR belum tersedia';
        } catch (e) {
            lastErr = e instanceof Error ? e.message : String(e);
        }
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
    if (lastErr) console.warn('[getSnapQrisUrl]', lastErr);
    return null;
}

export interface QRChargeParams {
    orderId: string;
    grossAmount: number;
    firstName: string;
    email: string;
    phone: string;
    itemDetails?: {
        id: string;
        price: number;
        quantity: number;
        name: string;
    }[];
    /** Durasi kedaluwarsa QR dalam menit (default 60 = 1 jam) */
    expiryMinutes?: number;
    /** Paksa metode tertentu; default ikut pengaturan admin */
    method?: QRPaymentMethod;
}

export interface QRChargeResult {
    transaction_id: string;
    order_id: string;
    payment_type: string;
    qrCodeUrl: string;
    expiry_time?: string;
}

/**
 * Charge QR via Core API (QRIS atau GoPay, ikut pengaturan admin).
 * Mengembalikan URL gambar QR — ditampilkan di modal sendiri, tanpa redirect.
 */
export async function chargeQRPayment(params: QRChargeParams): Promise<QRChargeResult> {
    const cfg = await getMidtransConfig();
    const method: QRPaymentMethod = params.method || cfg.qrPaymentMethod || 'qris';
    const expiryMinutes = params.expiryMinutes && params.expiryMinutes > 0 ? params.expiryMinutes : 60;

    const payload: Record<string, unknown> = {
        payment_type: method,
        transaction_details: {
            order_id: params.orderId,
            gross_amount: params.grossAmount,
        },
        customer_details: {
            first_name: params.firstName,
            email: params.email,
            phone: params.phone,
        },
        item_details: params.itemDetails,
        custom_expiry: {
            expiry_duration: expiryMinutes,
            unit: 'minute',
        },
    };

    // GoPay butuh callback URL agar bisa kembali ke toko setelah bayar di app
    if (method === 'gopay') {
        payload.gopay = {
            enable_callback: true,
            callback_url: process.env.NEXT_PUBLIC_APP_URL || undefined,
        };
    }

    try {
        const result = await midtransRequest('core', '/v2/charge', 'POST', payload);

        let qrCodeUrl: string | undefined;
        if (method === 'qris') {
            qrCodeUrl = result.qr_code;
        } else {
            // GoPay: cari action generate-qr-code
            const actions = Array.isArray(result.actions) ? result.actions : [];
            const qrAction = actions.find(
                (a: { name?: string; url?: string }) => a?.name === 'generate-qr-code'
            );
            qrCodeUrl = qrAction?.url;
        }

        if (!qrCodeUrl) {
            throw new Error(
                result.status_message
                    ? `Midtrans: ${result.status_message}`
                    : 'Midtrans tidak mengembalikan QR code'
            );
        }

        return {
            transaction_id: result.transaction_id,
            order_id: result.order_id,
            payment_type: method,
            qrCodeUrl,
            expiry_time: result.expiry_time,
        };
    } catch (error) {
        console.error(`Midtrans ${method.toUpperCase()} Charge Error:`, error);
        throw error;
    }
}

/**
 * @deprecated pakai chargeQRPayment
 */
export async function chargeQRIS(params: QRChargeParams) {
    const r = await chargeQRPayment({ ...params, method: 'qris' });
    return {
        transaction_id: r.transaction_id,
        order_id: r.order_id,
        payment_type: 'qris',
        qr_code: r.qrCodeUrl,
        expiry_time: r.expiry_time || '',
    };
}

/**
 * Cancel a pending transaction via Core API
 */
export async function cancelTransaction(orderId: string) {
    try {
        return await midtransRequest('core', `/v2/${encodeURIComponent(orderId)}/cancel`, 'POST', {});
    } catch (error) {
        console.error('Midtrans Cancel Error:', error);
        throw error;
    }
}

/**
 * Verify webhook signature_key: SHA512(order_id + status_code + gross_amount + serverKey)
 */
export async function verifyWebhookSignature(
    body: Record<string, unknown>
): Promise<boolean> {
    const cfg = await getMidtransConfig();
    const orderId = body?.order_id;
    const statusCode = body?.status_code;
    const grossAmount = body?.gross_amount;
    const signatureKey = body?.signature_key;
    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
        return false;
    }
    const expected = crypto
        .createHash('sha512')
        .update(`${orderId}${statusCode}${grossAmount}${cfg.serverKey}`)
        .digest('hex');
    return expected === signatureKey;
}

/**
 * Handle incoming Midtrans webhook: verify signature, then fetch the
 * fresh transaction status from Core API (same as client.notification()).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleMidtransNotification(body: Record<string, any>): Promise<any> {
    const valid = await verifyWebhookSignature(body);
    if (!valid) {
        throw new Error('Invalid Midtrans webhook signature');
    }
    const transactionId = body.transaction_id as string;
    if (!transactionId) {
        throw new Error('Missing transaction_id in webhook body');
    }
    return midtransRequest('core', `/v2/${encodeURIComponent(transactionId)}/status`, 'GET');
}
