// snappay.ts — helper Snap.js popup (Midtrans) client-side.
//
// Alur: POST /api/orders -> dapat snap token -> snap.pay(token).
// Popup terbuka di atas halaman sendiri (tanpa redirect), khusus QRIS.

export interface SnapPayCallbacks {
    onSuccess?: (result: unknown) => void;
    onPending?: (result: unknown) => void;
    onError?: (result: unknown) => void;
    onClose?: () => void;
}

declare global {
    interface Window {
        snap?: {
            pay: (token: string, callbacks?: Record<string, (result: unknown) => void>) => void;
        };
    }
}

let snapJsPromise: Promise<void> | null = null;

/** Load script snap.js Midtrans sekali saja. */
export function loadSnapJs(clientKey: string, isProduction: boolean): Promise<void> {
    if (typeof window === 'undefined') return Promise.reject(new Error('Bukan di browser'));
    if (window.snap) return Promise.resolve();
    if (snapJsPromise) return snapJsPromise;

    snapJsPromise = new Promise<void>((resolve, reject) => {
        const src = isProduction
            ? 'https://app.midtrans.com/snap/snap.js'
            : 'https://app.sandbox.midtrans.com/snap/snap.js';
        const script = document.createElement('script');
        script.src = src;
        script.setAttribute('data-client-key', clientKey);
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
            snapJsPromise = null;
            reject(new Error('Gagal memuat Snap.js'));
        };
        document.head.appendChild(script);
    });

    return snapJsPromise;
}

/** Buka popup pembayaran Snap dengan token. */
export async function openSnapPay(
    token: string,
    clientKey: string,
    isProduction: boolean,
    callbacks: SnapPayCallbacks = {}
): Promise<void> {
    await loadSnapJs(clientKey, isProduction);
    if (!window.snap) {
        throw new Error('Snap.js belum termuat');
    }
    // Pasang backdrop gelap transparan milik kita di belakang popup Snap,
    // sekaligus paksa overlay bawaan Snap agar transparan (tidak abu-abu pekat).
    const backdrop = ensureSnapBackdrop();
    const stopFix = startSnapOverlayFix(backdrop);
    const cleanup = () => {
        backdrop.remove();
        stopFix();
    };
    window.snap.pay(token, {
        onSuccess: (r) => { cleanup(); callbacks.onSuccess?.(r); },
        onPending: (r) => { cleanup(); callbacks.onPending?.(r); },
        onError: (r) => { cleanup(); callbacks.onError?.(r); },
        onClose: () => { cleanup(); callbacks.onClose?.(); },
    });
}

/**
 * Backdrop redup transparan agar halaman checkout terlihat di belakang
 * popup Snap (bukan tertutup abu-abu pekat). Tanpa blur agar popup tajam.
 */
function ensureSnapBackdrop(): HTMLElement {
    let el = document.getElementById('gtshop-snap-backdrop');
    if (!el) {
        el = document.createElement('div');
        el.id = 'gtshop-snap-backdrop';
        el.setAttribute('style', [
            'position:fixed',
            'inset:0',
            'background:rgba(0,0,0,0.5)',
            'z-index:9990',
            'pointer-events:none',
        ].join(';'));
        document.body.appendChild(el);
    }
    return el;
}

/**
 * Paksa overlay bawaan Snap.js agar transparan. Snap membuat elemen overlay
 * sendiri; kalau background-nya abu-abu pekat (akibat konflik CSS/browser),
 * kita buat transparan supaya backdrop kita yang tampil.
 * Backdrop diposisikan tepat 1 level di bawah overlay Snap agar popup tajam.
 * Mengembalikan fungsi stop.
 */
function startSnapOverlayFix(backdrop: HTMLElement): () => void {
    let stopped = false;
    let tries = 0;
    const fix = () => {
        if (stopped || tries++ > 40) return; // maks ~10 detik
        // Cari iframe Midtrans, lalu telusuri parent fixed sebagai overlay
        const iframe = document.querySelector('iframe[src*="midtrans.com"]') as HTMLElement | null;
        if (iframe) {
            let el: HTMLElement | null = iframe.parentElement;
            while (el && el !== document.body) {
                const cs = window.getComputedStyle(el);
                if (cs.position === 'fixed') {
                    el.style.setProperty('background', 'transparent', 'important');
                    el.style.setProperty('background-color', 'transparent', 'important');
                    // Backdrop tepat di bawah overlay Snap
                    const z = parseInt(cs.zIndex || '0', 10);
                    if (Number.isFinite(z) && z > 1) {
                        backdrop.style.zIndex = String(z - 1);
                    }
                    break;
                }
                el = el.parentElement;
            }
        }
        if (!stopped) setTimeout(fix, 250);
    };
    setTimeout(fix, 300);
    return () => { stopped = true; };
}
